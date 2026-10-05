// sales/driver.js — extension-side orchestration of the sale scan.
//
// WHAT IT TIES TOGETHER
//   selectorsFor(shop)  (config/selectors.js — captcha + listingPattern)
//     + soldSelFor(shop)  (sales/sold-selectors.js — the scan block)
//     -> injected into the seller's own tab  (chrome.scripting.executeScript)
//     -> SALES_ADAPTERS[shop].scanSold(SEL, opts)   (the per-adapter entry)
//     -> registry.js de-duplicates the events        (idempotent)
//     -> POST /api/sales                             (D1 persistence)
//
// COMPLIANCE, RESTATED WHERE THE CODE LIVES
//   * the scan runs in the SELLER'S logged-in tab on their machine (or the
//     phone's in-app WebView) — never on our servers, and no marketplace
//     password is ever read, stored or transmitted;
//   * this module only READS. Deleting copies elsewhere is always the seller's
//     one-tap confirm (sales/prompt.js -> sales/delist.js -> the existing
//     delist path);
//   * nothing here throws: every failure path returns {status:"skipped",
//     reason:"…"} so one broken marketplace cannot stop the others.
//
// NOT PROVEN: the tab half (open listUrl, inject, read) has never run against a
// live marketplace page — there is no logged-in session in CI. It is written to
// mirror queue.js's runPublish()/runDelist() exactly; the DOM half behind it is
// covered offline by apps/extension/__tests__/sales.test.mjs.

import { selectorsFor, normalizeShop } from "../config/selectors.js";
// NOTE: libs/login-detect.js lives OUTSIDE the packaged extension
// (apps/extension/ is the package root), so a static import of it would fail
// the whole module load in Chrome. It is resolved lazily below: in-package
// global first, then a dynamic import that is allowed to fail (the kit's own
// verdict stands when the detector is unreachable). NEVER throws.
import { withSoldSel, SALES_SHOPS } from "./sold-selectors.js";
import { SALES_ADAPTERS } from "./adapters/index.js";
import { makeSaleEvent, acceptNew, pushEvent, emptyState } from "./registry.js";

/**
 * Resolve the login-wall detector without ever throwing and without a static
 * cross-package import. Returns the detectLogin function or null.
 */
export async function resolveDetectLogin() {
  try {
    const g = globalThis && globalThis.__fashLoginDetect;
    if (g && typeof g.detectLogin === "function") return g.detectLogin;
  } catch (e) { /* no global — fall through */ }
  try {
    const m = await import("../../../libs/login-detect.js");
    if (m && typeof m.detectLogin === "function") return m.detectLogin;
  } catch (e) { /* outside the packaged extension, or test harness without it */ }
  return null;
}

export const STATE_KEY = "sales:state";
export const SALES_PATH = "/api/sales";
const MAX_REPORT_LINES = 50;

/** chrome.storage.local in the shape the pure code wants ({get,set}). */
export function chromeStorage() {
  return {
    async get(key) {
      try {
        const o = await chrome.storage.local.get(key);
        return o ? o[key] : null;
      } catch (e) {
        return null;
      }
    },
    async set(key, value) {
      try {
        await chrome.storage.local.set({ [key]: value });
      } catch (e) {
        /* storage full: the next scan re-derives what it can */
      }
    }
  };
}

/** Read the shared scanner state. An unreadable store is a fresh state. */
export async function loadState(storage) {
  const base = emptyState();
  if (!storage) return base;
  try {
    const raw = await storage.get(STATE_KEY);
    if (!raw || typeof raw !== "object") return base;
    return {
      seen: Array.isArray(raw.seen) ? raw.seen : [],
      events: Array.isArray(raw.events) ? raw.events : [],
      failures: raw.failures && typeof raw.failures === "object" ? raw.failures : {},
      gaveUp: Array.isArray(raw.gaveUp) ? raw.gaveUp : [],
      report: Array.isArray(raw.report) ? raw.report : []
    };
  } catch (e) {
    return base;
  }
}

export async function saveState(storage, state) {
  if (!storage) return false;
  try {
    await storage.set(STATE_KEY, state);
    return true;
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------- the scan */

/**
 * Scan ONE marketplace and record what it found. Dependency-injected so it is
 * testable offline: `runInTab(fn, args)` is what actually executes the
 * per-adapter `scanSold` inside the tab (chrome.scripting.executeScript in
 * production, a plain call in tests).
 *
 * NEVER throws.
 *
 * @returns {object} { shop, status, reason, items, events, recorded, needsInput,
 *                     report, counts, stored, api, error? }
 *   status  "sold" | "clean" | "skipped"
 *   reason  null | "login_wall" | "captcha" | "no_listings" |
 *           "items_unreadable" | "needs_input" | "unsupported_shop" |
 *           "scan_error" | "no_run_in_tab" | "page_not_found"
 *   recorded  the events that were NEW this scan (idempotency, see registry.js)
 */
export async function scanAndRecord(deps = {}) {
  const shop = normalizeShop(deps.shop) || String(deps.shop || "").trim();
  const summary = {
    shop,
    status: "skipped",
    reason: null,
    items: [],
    events: [],
    recorded: [],
    needsInput: [],
    report: [],
    counts: null,
    stored: false,
    api: false
  };

  try {
    const adapter = SALES_ADAPTERS[shop];
    if (!adapter) {
      summary.reason = "unsupported_shop";
      return summary;
    }
    if (typeof deps.runInTab !== "function") {
      summary.reason = "no_run_in_tab";
      return summary;
    }

    const now = typeof deps.now === "function" ? deps.now : () => Date.now();
    const state = deps.state || (await loadState(deps.storage));
    const SEL = deps.SEL || withSoldSel(selectorsFor(shop) || {}, shop);
    const listUrl = (SEL.sold && SEL.sold.listUrl) || "";
    const requestedPath = deps.requestedPath || listUrl;

    // The kit's strike state travels as plain JSON (executeScript serializes).
    const kitState = {
      failures: Object.assign({}, state.failures),
      gaveUp: (state.gaveUp || []).slice()
    };

    let raw = null;
    try {
      raw = await deps.runInTab(adapter.scanSold, [
        SEL,
        { state: kitState, requestedPath, now: now() }
      ]);
    } catch (e) {
      summary.reason = "scan_error";
      summary.error = String((e && e.message) || e).slice(0, 200);
      await saveState(deps.storage, state);
      summary.stored = !!deps.storage;
      return summary;
    }

    if (!raw || typeof raw !== "object") {
      summary.reason = "no_result";
      await saveState(deps.storage, state);
      summary.stored = !!deps.storage;
      return summary;
    }

    summary.items = Array.isArray(raw.items) ? raw.items : [];
    summary.needsInput = Array.isArray(raw.needsInput) ? raw.needsInput : [];
    summary.counts = raw.counts || null;
    summary.status = raw.status === "sold" || raw.status === "clean" ? raw.status : "skipped";
    summary.reason = raw.reason || null;
    summary.href = raw.href || "";

    // Persist the kit's strike bookkeeping before anything else can fail.
    if (raw.state && typeof raw.state === "object") {
      state.failures = raw.state.failures && typeof raw.state.failures === "object"
        ? raw.state.failures
        : state.failures;
      state.gaveUp = Array.isArray(raw.state.gaveUp) ? raw.state.gaveUp : state.gaveUp;
    }
    if (Array.isArray(raw.report) && raw.report.length) {
      state.report = raw.report.concat(state.report || []).slice(0, MAX_REPORT_LINES);
      summary.report = raw.report;
    }

    // Nothing readable? Ask the login detector WHY before believing it:
    // a bounced sign-in page is a login wall, a soft-404 is not "no listings".
    const readable = summary.items.length > 0;
    const wallish = [null, "no_listings", "items_unreadable", "needs_input"].includes(summary.reason);
    if (!readable && wallish) {
      try {
        const detectLogin = typeof deps.detectLogin === "function"
          ? deps.detectLogin
          : await resolveDetectLogin();
        if (!detectLogin) {
          /* detector unreachable — keep the kit's verdict, never throw */
        } else {
          const v = detectLogin({
            requestedPath,
            finalPath: raw.href || "",
            signals: raw.signals || {}
          });
          if (!v.connected && (v.reason === "bounced" || v.reason === "login_form")) {
            summary.status = "skipped";
            summary.reason = "login_wall";
          } else if (v.reason === "soft_404") {
            summary.status = "skipped";
            summary.reason = "page_not_found";
          }
        }
      } catch (e) {
        /* the detector is pure; if it ever fails, keep the kit's verdict */
      }
    }

    // Sell the observations: exactly one event per sold listing, ever.
    const events = summary.items
      .filter((i) => i && i.status === "sold")
      .map((i) => makeSaleEvent(Object.assign({}, i, { shop }), now()))
      .filter(Boolean);
    const { fresh } = acceptNew(events, state);
    summary.events = events;
    summary.recorded = fresh;

    for (const event of fresh) {
      pushEvent(state, event);
      if (typeof deps.apiPost === "function") {
        try {
          await deps.apiPost(SALES_PATH, event);
          summary.api = true;
        } catch (e) {
          // The local copy survives (state.events) and is re-posted by the
          // next sync; never fail the scan over a network blip.
          summary.apiError = String((e && e.message) || e).slice(0, 200);
        }
      }
    }

    summary.stored = await saveState(deps.storage, state);
    return summary;
  } catch (e) {
    // Defensive close: NOTHING above may escape as an exception.
    summary.status = "skipped";
    summary.reason = "internal_error";
    summary.error = String((e && e.message) || e).slice(0, 200);
    return summary;
  }
}

/* -------------------------------------------------- the production runner */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait for the tab to reach "complete" (mirrors queue.js waitForLoad). */
export function waitForLoad(chrome, tabId, timeoutMs = 45000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { chrome.tabs.onUpdated.removeListener(onUpdated); } catch (e) {}
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (id, info) => {
      if (id === tabId && info && info.status === "complete") finish();
    };
    try {
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.get(tabId).then((t) => { if (t && t.status === "complete") finish(); }).catch(finish);
    } catch (e) {
      finish();
    }
    const timer = setTimeout(finish, timeoutMs);
  });
}

/** Make sure the shared reader is present in the tab (formkit pattern). */
export async function ensureSalesKit(chrome, tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["sales/saleskit.js"],
    world: "ISOLATED"
  });
}

/**
 * Scan ONE shop by opening its own-listings page in a background tab of the
 * seller's browser, reading it, and closing the tab again. NEVER throws.
 */
export async function runShopScan({ chrome, shop, storage, apiPost, now } = {}) {
  const key = normalizeShop(shop);
  const base = { shop: key || String(shop || ""), status: "skipped", reason: null, recorded: [], items: [] };
  try {
    if (!key) return Object.assign(base, { reason: "unsupported_shop" });
    if (!chrome || !chrome.tabs || !chrome.scripting) return Object.assign(base, { reason: "no_tab_runner" });

    const SEL = withSoldSel(selectorsFor(key) || {}, key);
    const listUrl = SEL.sold && SEL.sold.listUrl;
    if (!listUrl) return Object.assign(base, { reason: "no_list_url" });

    const tab = await chrome.tabs.create({ url: listUrl, active: false });
    try {
      await waitForLoad(chrome, tab.id);
      await sleep(600 + Math.floor(Math.random() * 1200)); // let the SPA settle
      await ensureSalesKit(chrome, tab.id);

      const runInTab = (fn, args) =>
        chrome.scripting
          .executeScript({ target: { tabId: tab.id }, func: fn, args: args || [], world: "ISOLATED" })
          .then((res) => (res && res[0] && res[0].result) || null);

      return await scanAndRecord({ shop: key, SEL, runInTab, storage, apiPost, requestedPath: listUrl, now });
    } finally {
      try { await chrome.tabs.remove(tab.id); } catch (e) { /* already closed */ }
    }
  } catch (e) {
    return Object.assign(base, {
      reason: "scan_error",
      error: String((e && e.message) || e).slice(0, 200)
    });
  }
}

/**
 * Scan several shops in sequence. Per-shop isolation: a throw inside one shop
 * becomes that shop's own {status:"skipped"} and the loop continues.
 */
export async function scanAllShops({ chrome, shops, storage, apiPost, now } = {}) {
  const list = (Array.isArray(shops) && shops.length ? shops : SALES_SHOPS)
    .map((s) => normalizeShop(s))
    .filter(Boolean);
  const results = [];
  for (const shop of list) {
    try {
      results.push(await runShopScan({ chrome, shop, storage, apiPost, now }));
    } catch (e) {
      results.push({
        shop,
        status: "skipped",
        reason: "internal_error",
        error: String((e && e.message) || e).slice(0, 200),
        items: [],
        recorded: []
      });
    }
  }
  return results;
}

export default { scanAndRecord, runShopScan, scanAllShops, loadState, saveState, chromeStorage, resolveDetectLogin, STATE_KEY };
