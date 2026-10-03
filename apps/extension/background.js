// background.js — MV3 service worker: the engine room of the crosslister.
//
// WHAT RUNS HERE
//   * an alarms-driven poll of GET {API_BASE}/api/jobs?status=queued
//   * queue.js executes each job: one background tab per marketplace, the
//     shop adapter fills everything, uploads photos, SUBMITS the listing,
//     captures the live listing URL and reports {status:"posted", listing_url}
//   * a "session detected" heartbeat telling fashionistas.ai which shops the
//     user is logged into
//
// MOBILE (product rule, do not "fix" this): phones have NO extension, so a
// queued job NEVER runs on the phone and NEVER becomes a manual step for the
// user. Jobs created on mobile (or from fashionistas.ai's one button) execute
// here, on the user's DESKTOP extension, or in the L09 cloud runner when the
// desktop is offline. The phone only displays status.
//
// PRIVACY (hard rule): this worker never uploads a password, a shop cookie
// or a shop token. The heartbeat sends ONLY booleans — "session present" —
// plus the one-way probe result per shop.

import { tick, onAlarm, enqueue } from "./queue.js";
import { SHOPS, SESSION_ONLY_SHOPS, normalizeShop } from "./config/selectors.js";
import { apiPost, SESSIONS_PATH } from "./config/api.js";

const POLL_ALARM = "fash-poll";
const HEARTBEAT_ALARM = "fash-heartbeat";

function scheduleAlarms() {
  // Poll fast enough that a tapped "Post to every marketplace" feels instant,
  // while staying inside Chrome's alarm budget for a persistent-less worker.
  chrome.alarms.create(POLL_ALARM, { delayInMinutes: 0.2, periodInMinutes: 1 });
  chrome.alarms.create(HEARTBEAT_ALARM, { delayInMinutes: 1, periodInMinutes: 30 });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleAlarms();
  tick().catch((e) => console.error("[fash] initial tick:", e));
  heartbeat().catch((e) => console.error("[fash] initial heartbeat:", e));
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAlarms();
  tick().catch((e) => console.error("[fash] startup tick:", e));
  heartbeat().catch((e) => console.error("[fash] startup heartbeat:", e));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || !alarm.name) return;
  if (alarm.name === POLL_ALARM) {
    tick().catch((e) => console.error("[fash] poll tick:", e));
    return;
  }
  if (alarm.name === HEARTBEAT_ALARM) {
    heartbeat().catch((e) => console.error("[fash] heartbeat:", e));
    return;
  }
  // retry:<jobId> alarms come from queue.js (exponential backoff)
  onAlarm(alarm).catch((e) => console.error("[fash] retry alarm:", e));
});

/* ------------------------------------------------------- session heartbeat */

/**
 * One-way probe: is there a live session for this shop on THIS machine?
 * Returns true/false. It never returns a cookie, a token or anything else —
 * only the boolean "session present".
 */
async function probeShop(cfg) {
  let cookieHit = false;
  try {
    const cookies = await chrome.cookies.getAll({ url: cfg.origin });
    const hints = cfg.sessionCookies || [];
    const now = Date.now() / 1000;
    cookieHit = cookies.some(
      (c) =>
        hints.includes(c.name) &&
        (!c.expirationDate || c.expirationDate > now)
    );
  } catch (e) {
    cookieHit = false;
  }

  if (!cfg.sessionCheck) return cookieHit;

  // Optional authenticated probe (eBay/Etsy session sync): a request made by
  // the extension itself, with the user's own cookies, no payload, no upload.
  try {
    const res = await fetch(cfg.sessionCheck, {
      method: "GET",
      credentials: "include",
      redirect: "manual"
    });
    if (res.type === "opaqueredirect") return false;
    if (res.status >= 200 && res.status < 400) return true;
    if (res.status === 401 || res.status === 403) return false;
  } catch (e) {
    // network hiccup -> fall back to the cookie probe result
  }
  return cookieHit;
}

/** Report which shops the user is logged into — booleans only. */
export async function heartbeat() {
  const sessions = {};
  const all = { ...SHOPS, ...SESSION_ONLY_SHOPS };
  for (const key of Object.keys(all)) {
    sessions[key] = await probeShop(all[key]);
  }
  try {
    await apiPost(SESSIONS_PATH, {
      sessions, // { poshmark: true, mercari: false, ... }  <- booleans, nothing else
      source: "extension",
      probed_at: new Date().toISOString()
    });
  } catch (e) {
    // heartbeat is best-effort; never surface it as a job failure
  }
  return sessions;
}

/* ------------------------------------------------------------- messaging */

// Status requests from the popup / devtools / the site bridge.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return false;
  if (msg.type === "fash:tick") {
    tick()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
    return true;
  }
  if (msg.type === "fash:heartbeat") {
    heartbeat()
      .then((sessions) => sendResponse({ ok: true, sessions }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
    return true;
  }
  if (msg.type === "fash:enqueue") {
    if (!normalizeShop(msg.job && msg.job.shop)) {
      sendResponse({ ok: false, error: "unknown_shop" });
      return false;
    }
    enqueue(msg.job)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
    return true;
  }
  return false;
});

// fashionistas.ai's ONE button: the page posts straight into the queue and
// the desktop extension takes it from there (no copy/paste, no manual step).
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  const fromUs =
    sender && sender.url && /^(https:\/\/(www\.)?fashionistas\.ai)\/?/.test(sender.url);
  if (!fromUs) {
    sendResponse({ ok: false, error: "origin_not_allowed" });
    return false;
  }
  if (!msg || typeof msg.type !== "string") return false;
  if (msg.type === "publish" || msg.type === "delist" || msg.type === "signup") {
    if (!normalizeShop(msg.shop)) {
      sendResponse({ ok: false, error: "unknown_shop" });
      return false;
    }
    enqueue({ type: msg.type, shop: msg.shop, payload: msg.payload || {} })
      .then(() => sendResponse({ ok: true, queued: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
    return true; // async response
  }
  if (msg.type === "status") {
    heartbeat()
      .then((sessions) => sendResponse({ ok: true, sessions }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
    return true;
  }
  return false;
});

// First boot: make sure alarms exist even if onInstalled already fired.
scheduleAlarms();
