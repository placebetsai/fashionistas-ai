// queue.js — the job queue runner for the Fashionistas crosslister extension.
//
// What it does, end to end, with NO manual step for the user:
//   1. pulls publish / delist / signup jobs from GET {API_BASE}/api/jobs?status=queued
//   2. opens ONE background tab (chrome.tabs.create {active:false}) per marketplace
//   3. runs the shop's adapter: fill() every field, upload photos,
//      then submit() — the listing is FULLY SUBMITTED, not left as a draft
//   4. captures the live listing URL from the post-submit redirect
//   5. reports {status:"posted", listing_url} (or {status:"failed", error}) back
//   6. rate-limits per shop (max posts/hour + randomized spacing) to protect
//      the account, and retries with exponential backoff (max 3 attempts)
//
// Mobile note: phones have no extension. Jobs queued from the phone are
// executed here on the desktop extension (or by the L09 cloud runner); the
// phone only displays status — it is never a manual step.

import { SHOPS, normalizeShop, selectorsFor, initSelectors } from "./config/selectors.js";
import { capFor, capKey, capOverrideKey, checkCap, prune, retryAfterSeconds } from "./ratecap.js";
import {
  apiGet,
  apiPost,
  JOB_POLL_PATH,
  MAX_ATTEMPTS,
  RETRY_BASE_MS,
  gateOpen,
  gateAfterFailure,
  gateAfterSuccess
} from "./config/api.js";
import * as poshmark from "./adapters/poshmark.js";
import * as mercari from "./adapters/mercari.js";
import * as depop from "./adapters/depop.js";
import * as vinted from "./adapters/vinted.js";
import * as grailed from "./adapters/grailed.js";
import * as facebook from "./adapters/facebook.js";
import * as kidizen from "./adapters/kidizen.js";
import * as vestiaire from "./adapters/vestiaire.js";
import * as whatnot from "./adapters/whatnot.js";
import * as ebay from "./adapters/ebay.js";
import * as etsy from "./adapters/etsy.js";

export const ADAPTERS = {
  poshmark,
  mercari,
  depop,
  vinted,
  grailed,
  facebook,
  kidizen,
  vestiaire,
  whatnot,
  ebay,
  etsy
};

const RETRY_PREFIX = "fash-retry:";
const LOCK_KEY = "queueLock";
const LOCK_STALE_MS = 3 * 60 * 1000;
const CRITICAL_FIELDS = ["title", "description", "price"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/* ---------------------------------------------------------------- storage */

async function lsGet(keys) {
  return chrome.storage.local.get(keys);
}
async function lsSet(obj) {
  return chrome.storage.local.set(obj);
}

/* ------------------------------------------------------------ tab helpers */

async function runInTab(tabId, fn, args) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: fn,
    args: args || [],
    world: "ISOLATED"
  });
  return res ? res.result : undefined;
}

/** Make sure the shared form engine is present in the tab before we drive it. */
async function ensureFormKit(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/formkit.js"],
      world: "ISOLATED"
    });
  } catch (e) {
    // adapters surface "formkit_missing" instead of throwing
  }
}

function waitForLoad(tabId, timeoutMs = 45000) {
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      try {
        chrome.tabs.onUpdated.removeListener(onUpdated);
      } catch (e) {}
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") done();
    };
    try {
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.get(tabId).then((t) => {
        if (t && t.status === "complete") done();
      }).catch(done);
    } catch (e) {
      done();
    }
    const timer = setTimeout(done, timeoutMs);
  });
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch (e) {
    // already closed
  }
}

async function tabUrl(tabId) {
  try {
    const t = await chrome.tabs.get(tabId);
    return t ? t.url || "" : "";
  } catch (e) {
    return "";
  }
}

const LOGIN_RE = /\/(login|log-in|signin|sign-in|signup|sign-up|register|auth|checkpoint)\b/i;

/* ---------------------------------------------------------- photo prep */

async function toDataUrl(src) {
  const res = await fetch(src, { credentials: "omit" });
  if (!res.ok) throw new Error(`photo fetch ${res.status}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

/**
 * Adapters prefer data: URLs (no extra host permission needed, no CORS games).
 * We convert http(s) photos here, in the extension context where host
 * permissions apply. A photo we cannot fetch is passed through untouched so
 * the shop's own uploader can still try.
 */
async function normalizePhotos(photos) {
  const out = [];
  for (const src of photos || []) {
    if (typeof src !== "string" || !src) continue;
    if (src.startsWith("data:")) {
      out.push(src);
      continue;
    }
    try {
      out.push(await toDataUrl(src));
    } catch (e) {
      out.push(src);
    }
  }
  return out;
}

/* ------------------------------------------------------- rate limiting */

/* Per-ACCOUNT caps: timestamps persist under capKey(shop, account) in
   chrome.storage.local, so closing Chrome does not hand an account a fresh
   allowance. Window math and limits live in ratecap.js (pure, unit-tested). */
async function capState(shop, cfg, account) {
  const key = capKey(shop, account);
  const store = await lsGet(key);
  const stamps = Array.isArray(store[key]) ? store[key] : [];
  const ovStore = await lsGet(capOverrideKey(shop));
  const override = ovStore[capOverrideKey(shop)] || null;
  return { key, stamps, caps: capFor(shop, override, cfg) };
}

/** Timestamps this account holds on a shop (raw; windows applied by checkCap). */
async function recentPosts(shop, account) {
  const { stamps } = await capState(shop, null, account);
  return prune(stamps, Date.now());
}

/** Decide whether this account may post to this shop right now. */
async function canPost(shop, cfg, account) {
  const { stamps, caps } = await capState(shop, cfg, account);
  return checkCap({ stamps, now: Date.now(), ...caps }).ok;
}

/** Full cap verdict — reason + counts + wait, so a skip is never silent. */
async function capVerdict(shop, cfg, account) {
  const { stamps, caps } = await capState(shop, cfg, account);
  const now = Date.now();
  const v = checkCap({ stamps, now, ...caps });
  v.retryAfterSeconds = v.ok ? 0 : retryAfterSeconds({ stamps, now, ...caps });
  return v;
}

async function recordPost(shop, cfg, account) {
  const { key, stamps } = await capState(shop, cfg, account);
  const now = Date.now();
  await lsSet({ [key]: [...prune(stamps, now), now], [`lastPost:${shop}`]: now });
}

/** Randomized human spacing between two posts on the same shop. */
async function waitForGap(cfg, shop) {
  const store = await lsGet(`lastPost:${shop}`);
  const last = store[`lastPost:${shop}`] || 0;
  const wait = last + (cfg.minGapMs || 45000) + rand(2000, 9000) - Date.now();
  if (wait > 0) await sleep(wait);
}

/* ------------------------------------------------------------- reporting */

export async function report(job, result) {
  const body = {
    job_id: job.id,
    status: result.status,
    listing_url: result.listing_url || null,
    error: result.error || null,
    shop: job.shop,
    attempts: result.attempts || 1,
    reported_at: new Date().toISOString()
  };
  // Persist locally FIRST: fashionistas.ai queued this job and must be able to
  // read the outcome back (posted + listing_url) even if the API post fails.
  try {
    await lsSet({ [`result:${job.id}`]: body });
  } catch (e) {
    /* storage full/unavailable — the API report below still carries it */
  }
  try {
    await apiPost(`/api/jobs/${encodeURIComponent(job.id)}/status`, body);
    await lsSet({ [`pendingReport:${job.id}`]: null });
  } catch (e) {
    // keep it and flush on the next tick
    await lsSet({ [`pendingReport:${job.id}`]: body });
  }
  notify(job, body);
}

/**
 * Results for jobs this extension ran, newest first.
 * fashionistas.ai polls this so a locally queued job shows posted/failed with
 * the real listing URL instead of sitting at "queued" forever.
 */
export async function getResults() {
  const all = await lsGet(null);
  const out = [];
  for (const key of Object.keys(all)) {
    if (key.startsWith("result:") && all[key]) out.push(all[key]);
  }
  out.sort((a, b) => String(b.reported_at || "").localeCompare(String(a.reported_at || "")));
  return out.slice(0, 100);
}

function notify(job, body) {
  try {
    const cfg = SHOPS[normalizeShop(job.shop)] || {};
    const title = body.status === "posted"
      ? `Posted to ${cfg.label || job.shop}`
      : body.status === "delisted"
      ? `Delisted from ${cfg.label || job.shop}`
      : `${cfg.label || job.shop}: ${body.error || body.status}`;
    chrome.notifications.create(`fash-${job.id}-${Date.now()}`, {
      type: "basic",
      iconUrl: "icon.png",
      title: "Fashionistas Crosslister",
      message: title + (body.listing_url ? `\n${body.listing_url}` : ""),
      priority: 1
    });
  } catch (e) {
    // notifications are cosmetic — never fail a job over them
  }
}

/* --------------------------------------------------------------- api gate */
/* Per-repo state: {fails, nextAt}. chrome.storage.local, so a browser restart
   does not hand a dead endpoint a fresh allowance of 1,440 attempts a day.
   Costs no network — it is the thing that decides whether we spend one. */
const API_GATE_KEY = "apiGate";
// A report may be re-sent this many times before we stop trying. The local
// `result:` copy is never dropped, so getResults() still shows the outcome.
const MAX_REPORT_ATTEMPTS = 30;

async function readGate() {
  try {
    const store = await lsGet(API_GATE_KEY);
    return store[API_GATE_KEY] || null;
  } catch (e) {
    return null; // unreadable storage == gate open; never block the queue
  }
}

async function writeGate(state) {
  try {
    await lsSet({ [API_GATE_KEY]: state });
  } catch (e) {
    /* storage full — the next failure just re-derives it */
  }
}

/** One failed call against {API_BASE}: step back along the ladder. */
async function apiNoteFailure(err) {
  const next = gateAfterFailure(await readGate(), Date.now());
  await writeGate(next);
  console.warn(
    "[fash] api gated for", Math.round((next.nextAt - Date.now()) / 1000), "s after",
    err && err.message ? err.message : err
  );
}

/** An answer came back: back to full speed. */
async function apiNoteSuccess() {
  const cur = await readGate();
  if (cur && cur.fails) await writeGate(gateAfterSuccess());
}

async function flushReports() {
  const all = await lsGet(null);
  let flushed = 0;
  for (const key of Object.keys(all)) {
    const entry = all[key];
    if (!key.startsWith("pendingReport:") || !entry) continue;
    const attempts = (entry._attempts || 0) + 1;
    if (attempts > MAX_REPORT_ATTEMPTS) {
      // Stop hammering a route that is never going to take it. The outcome
      // survives in result: (written first in report()), so nothing is lost.
      await lsSet({ [key]: null });
      console.warn("[fash] dropped report for", entry.job_id, "after", attempts, "attempts");
      continue;
    }
    // _attempts is our bookkeeping, never part of the payload on the wire.
    const { _attempts, ...wire } = entry;
    try {
      await apiPost(`/api/jobs/${encodeURIComponent(entry.job_id)}/status`, wire);
      await lsSet({ [key]: null });
      flushed++;
    } catch (e) {
      // keep it, with the attempt counted, and let the caller gate the API
      await lsSet({ [key]: { ...entry, _attempts: attempts } });
      throw e;
    }
  }
  // How many real network calls succeeded — an empty flush proves nothing and
  // must not reset the gate. tick() keys off this number.
  return flushed;
}

/* --------------------------------------------------------------- retries */

/** Exponential backoff: 15s, 30s, 60s (+jitter), max 3 attempts. */
function backoffMs(attempt) {
  return RETRY_BASE_MS * Math.pow(2, attempt - 1) + rand(0, 5000);
}

async function failOrRetry(job, attempt, result) {
  const next = attempt + 1;
  if (next >= MAX_ATTEMPTS) {
    return report(job, {
      status: "failed",
      error: result.error || "max_attempts_reached",
      attempts: next
    });
  }
  await lsSet({
    [`pendingJob:${job.id}`]: { job, attempt: next }
  });
  const when = Date.now() + backoffMs(next);
  chrome.alarms.create(`${RETRY_PREFIX}${job.id}`, { when });
}

/** Re-queue with a later alarm (used when the hourly cap is already used). */
async function defer(job, attempt, delayMs) {
  await lsSet({ [`pendingJob:${job.id}`]: { job, attempt } });
  chrome.alarms.create(`${RETRY_PREFIX}${job.id}`, { when: Date.now() + delayMs });
}

/* ------------------------------------------------------------ job runner */

export async function tick() {
  const store = await lsGet(LOCK_KEY);
  const lockedAt = store[LOCK_KEY] || 0;
  if (lockedAt && Date.now() - lockedAt < LOCK_STALE_MS) return;
  await lsSet({ [LOCK_KEY]: Date.now() });
  try {
    await initSelectors();        // refresh selector config (bundled floor)

    /* Anything that talks to {API_BASE} runs only while the gate is open.
       The ordering here is a fix, not a style choice: pullJobs() used to run
       first with no guard, so its 401 escaped into the outer catch and
       SKIPPED runLocalJobs() every minute of every day. The site's one-tap
       jobs were queued and never executed. A remote failure must never be
       able to stop the local queue. */
    if (gateOpen(await readGate(), Date.now())) {
      let jobs = null;
      let healthy = false;   // some call against {API_BASE} answered
      let failed = false;    // and some call did not

      // Exactly one ladder step per tick, whichever call failed: a dead POST
      // must not be able to step twice because a GET failed too.
      const noteFailure = async (e) => {
        if (failed) return;
        failed = true;
        await apiNoteFailure(e);
      };

      try {
        if ((await flushReports()) > 0) healthy = true;
      } catch (e) {
        await noteFailure(e);
      }

      try {
        jobs = await pullJobs();
        healthy = true;
      } catch (e) {
        await noteFailure(e);
        console.warn("[fash] pullJobs:", e && e.message ? e.message : e);
      }

      // A failure this tick always wins over a success: otherwise one dead
      // route would be re-proved healthy every minute and gated forever.
      if (healthy && !failed) await apiNoteSuccess();

      for (const job of jobs || []) {
        // A job that blows up must not take the rest of the batch with it.
        try {
          await runJob(job, 0);
        } catch (e) {
          console.error("[fash] job", job && job.id, "failed:", e && e.message ? e.message : e);
        }
      }
    }

    await runLocalJobs();
  } catch (e) {
    console.error("[fash] tick failed:", e && e.message ? e.message : e);
  } finally {
    await lsSet({ [LOCK_KEY]: 0 });
  }
}

async function pullJobs() {
  const data = await apiGet(JOB_POLL_PATH);
  const jobs = Array.isArray(data) ? data : data && Array.isArray(data.jobs) ? data.jobs : [];
  return jobs.filter((j) => j && j.id);
}

/** Jobs created locally (site "one button" via externally_connectable). */
async function runLocalJobs() {
  const store = await lsGet("localJobs");
  const jobs = Array.isArray(store.localJobs) ? store.localJobs : [];
  for (const job of jobs) {
    await runJob(job, job.attempt || 0);
    const rest = (await lsGet("localJobs")).localJobs.filter((j) => j.id !== job.id);
    await lsSet({ localJobs: rest });
  }
}

export async function enqueue(job) {
  const store = await lsGet("localJobs");
  const jobs = Array.isArray(store.localJobs) ? store.localJobs : [];
  jobs.push({
    id: job.id || `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type: job.type || "publish",
    shop: job.shop,
    payload: job.payload || {}
  });
  await lsSet({ localJobs: jobs });
  tick();
}

export async function runJob(job, attempt) {
  const shopKey = normalizeShop(job.shop);
  const cfg = shopKey ? SHOPS[shopKey] : null;
  const adapter = shopKey ? ADAPTERS[shopKey] : null;
  if (!cfg || !adapter) {
    return report(job, { status: "failed", error: `unknown_shop:${job.shop}`, attempts: attempt + 1 });
  }
  const type = job.type || "publish";
  await initSelectors();

  const account = job.account || "default";
  if (type === "publish" && !(await canPost(shopKey, cfg, account))) {
    // This account's hourly OR daily allowance on this shop is spent. Defer
    // until it frees up, and record which cap bound — a skipped post must
    // never be silent, the seller needs to see "18/20 today, retry in 4h".
    const verdict = await capVerdict(shopKey, cfg, account);
    const delayMs = Math.max(5000, verdict.retryAfterSeconds * 1000) + rand(3000, 15000);
    await report(job, {
      status: "capped",
      error: `${verdict.reason} ${verdict.hourUsed}/${verdict.hourLimit}/h ${verdict.dayUsed}/${verdict.dayLimit}/d`,
      attempts: attempt + 1
    });
    return defer(job, attempt, delayMs);
  }

  await waitForGap(cfg, shopKey);

  try {
    const result =
      type === "delist"
        ? await runDelist(job, cfg, adapter, shopKey)
        : type === "signup"
        ? await runSignup(job, cfg, adapter, shopKey)
        : await runPublish(job, cfg, adapter, shopKey);

    if (result.status === "posted" || result.status === "delisted" || result.status === "signup_prefilled") {
      if (type === "publish") await recordPost(shopKey, cfg, account);
      return report(job, { ...result, attempts: attempt + 1 });
    }
    if (result.deferUntil) return defer(job, attempt, result.deferUntil);
    return failOrRetry(job, attempt, result);
  } catch (e) {
    return failOrRetry(job, attempt, { status: "failed", error: String((e && e.message) || e) });
  }
}

/**
 * FULL SUBMIT publish path: open the shop's create page in a background tab,
 * fill everything, upload photos, run the CAPTCHA gate, call submit() and
 * take the live listing URL off the redirect.
 */
async function runPublish(job, cfg, adapter, shopKey) {
  const payload = { ...(job.payload || {}) };
  payload.photos = await normalizePhotos(payload.photos);
  const SEL = selectorsFor(shopKey);

  const tab = await chrome.tabs.create({ url: cfg.createUrl, active: false });
  try {
    await waitForLoad(tab.id);
    await sleep(rand(1200, 3000));
    await ensureFormKit(tab.id);

    const before = await runInTab(tab.id, adapter.detectCaptcha, [SEL]);
    if (before && before !== "formkit_missing") {
      return { status: "failed", error: "captcha_required" };
    }

    const fillRes = await runInTab(tab.id, adapter.fill, [payload, SEL]);
    if (fillRes && fillRes.error) return { status: "failed", error: fillRes.error };
    const missingCritical = ((fillRes && fillRes.missing) || []).filter((m) => CRITICAL_FIELDS.includes(m));
    if (missingCritical.length) {
      return { status: "failed", error: `missing_fields:${missingCritical.join(",")}` };
    }

    await sleep(rand(700, 1800));

    // HARD RULE: if a CAPTCHA (or an ID/verification wall) is on screen we
    // stop here and report it. We never solve, never bypass, never retry it.
    const captchaSel = await runInTab(tab.id, adapter.detectCaptcha, [SEL]);
    if (captchaSel && captchaSel !== "formkit_missing") {
      return { status: "failed", error: "captcha_required" };
    }

    // FULL SUBMIT — the listing goes live from this call (no draft, no pause):
    const sub = await runInTab(tab.id, adapter.submit, [payload, SEL]);
    if (!sub || sub.ok !== true) {
      if (sub && sub.captcha) return { status: "failed", error: "captcha_required" };
      return { status: "failed", error: (sub && sub.error) || "submit_failed" };
    }

    const listingUrl = await waitForListingUrl(tab.id, adapter, SEL, cfg);
    if (!listingUrl) {
      const url = await tabUrl(tab.id);
      if (LOGIN_RE.test(url)) return { status: "failed", error: "not_logged_in" };
      return { status: "failed", error: "listing_url_not_captured" };
    }
    return { status: "posted", listing_url: listingUrl };
  } finally {
    await closeTab(tab.id);
  }
}

/** Poll the tab after submit until the live listing URL shows up (max ~60s). */
async function waitForListingUrl(tabId, adapter, SEL, cfg, timeoutMs = 60000) {
  const pattern = new RegExp(cfg.listingPattern || "$^");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(1500);
    try {
      const url = await runInTab(tabId, adapter.extractUrl, [SEL]);
      if (typeof url === "string" && /^https?:/.test(url) && pattern.test(url)) {
        return url.split("#")[0];
      }
    } catch (e) {
      break;
    }
    const url = await tabUrl(tabId);
    if (url && pattern.test(url)) return url.split("#")[0];
    if (LOGIN_RE.test(url)) return null;
  }
  return null;
}

/** Delist jobs run through the same queue, same rate limits, same retries. */
async function runDelist(job, cfg, adapter, shopKey) {
  const SEL = selectorsFor(shopKey);
  const listingUrl = (job.payload && (job.payload.listingUrl || job.payload.listing_url)) || job.listingUrl;
  if (!listingUrl) return { status: "failed", error: "missing_listing_url" };

  const tab = await chrome.tabs.create({ url: listingUrl, active: false });
  try {
    await waitForLoad(tab.id);
    await sleep(rand(800, 2000));
    await ensureFormKit(tab.id);

    const captchaSel = await runInTab(tab.id, adapter.detectCaptcha, [SEL]);
    if (captchaSel && captchaSel !== "formkit_missing") {
      return { status: "failed", error: "captcha_required" };
    }

    const res = await runInTab(tab.id, adapter.delist, [SEL]);
    if (res && res.captcha) return { status: "failed", error: "captcha_required" };
    if (!res || !res.ok) return { status: "failed", error: (res && res.error) || "delist_failed" };

    await sleep(rand(2000, 4000));
    return { status: "delisted" };
  } finally {
    await closeTab(tab.id);
  }
}

/**
 * SIGNUP ASSIST — pre-fills the shop's registration form with the user's
 * name + email and stops.
 * HARD RULES (also enforced inside formkit + every adapter):
 *   * never auto-create an account — we do not click the create button;
 *   * never bypass a CAPTCHA or an ID/verification check;
 *   * CAPTCHA on screen -> {status:"failed", error:"captcha_required"} + stop.
 */
async function runSignup(job, cfg, adapter, shopKey) {
  const SEL = selectorsFor(shopKey);
  const user = job.payload || {};
  const tab = await chrome.tabs.create({ url: cfg.signupUrl, active: false });
  try {
    await waitForLoad(tab.id);
    await sleep(rand(800, 2000));
    await ensureFormKit(tab.id);

    const captchaSel = await runInTab(tab.id, adapter.detectCaptcha, [SEL]);
    if (captchaSel && captchaSel !== "formkit_missing") {
      return { status: "failed", error: "captcha_required" };
    }

    const res = await runInTab(tab.id, adapter.prefillSignup, [user, SEL]);
    if (res && res.captcha) return { status: "failed", error: "captcha_required" };
    if (!res || !res.ok) return { status: "failed", error: "signup_fields_not_found" };
    return { status: "signup_prefilled" };
  } finally {
    await closeTab(tab.id);
  }
}

/* ---------------------------------------------------------- sales scan
   Phase 2 (sale detection) runner. A scan OPENS each marketplace's own-listings
   page in a background tab of the seller's browser, READS it, and closes the
   tab — the same session, the same machine, never our servers, no passwords.
   A sold listing becomes a POST /api/sales event (via the driver's apiPost);
   deleting copies elsewhere is always the seller's one-tap confirm, which
   enqueues through the EXISTING delist path above (runDelist), never here.

   Fail-soft by construction: the sales modules load via dynamic import inside
   try/catch, so a sales bug can never break publish/delist/tick; every wall
   (login, CAPTCHA, empty or redesigned DOM) is a per-shop skipped result. */

/** chrome.storage.local in the single-key shape sales/driver.js wants. */
function salesStorage() {
  return {
    async get(key) {
      try {
        const o = await lsGet(key);
        return o ? o[key] : null;
      } catch (e) {
        return null;
      }
    },
    async set(key, value) {
      try {
        await lsSet({ [key]: value });
      } catch (e) {
        /* storage full: the next scan re-derives what it can */
      }
    }
  };
}

/**
 * Run one sale-detection pass over the given shops (default: all six).
 * NEVER throws: without tabs it reports no_tab_runner per shop; without the
 * sales modules it reports scan_unavailable; each shop is isolated anyway.
 */
export async function runSalesScanNow({ shops, storage, apiPost: post, now } = {}) {
  const summarize = (results) =>
    (Array.isArray(results) ? results : []).map((r) => ({
      shop: (r && r.shop) || "unknown",
      status: (r && r.status) || "skipped",
      reason: (r && r.reason) || null,
      recorded: Array.isArray(r && r.recorded) ? r.recorded.length : 0,
      needsInput: Array.isArray(r && r.needsInput) ? r.needsInput.length : 0
    }));
  try {
    const [driver, sold] = await Promise.all([
      import("./sales/driver.js"),
      import("./sales/sold-selectors.js")
    ]);
    if (!driver || typeof driver.scanAllShops !== "function") {
      return [{ shop: "all", status: "skipped", reason: "scan_unavailable", recorded: 0, needsInput: 0 }];
    }
    const list = Array.isArray(shops) && shops.length ? shops : sold.SALES_SHOPS || [];
    const results = await driver.scanAllShops({
      chrome: typeof chrome !== "undefined" ? chrome : undefined,
      shops: list,
      storage: storage || salesStorage(),
      apiPost: typeof post === "function" ? post : apiPost,
      now
    });
    return summarize(results);
  } catch (e) {
    return [{ shop: "all", status: "skipped", reason: "scan_unavailable", recorded: 0, needsInput: 0 }];
  }
}

/* --------------------------------------------------------------- alarms */

/** background.js forwards chrome.alarms here (retries + poll alarm). */
export async function onAlarm(alarm) {
  if (!alarm || !alarm.name) return;
  if (!alarm.name.startsWith(RETRY_PREFIX)) return;
  const id = alarm.name.slice(RETRY_PREFIX.length);
  const store = await lsGet(`pendingJob:${id}`);
  const entry = store[`pendingJob:${id}`];
  if (!entry) return;
  await lsSet({ [`pendingJob:${id}`]: null });
  await runJob(entry.job, entry.attempt || 0);
}
