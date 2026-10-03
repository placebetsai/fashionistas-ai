/* fashionistas.ai crosslister — MV3 background service worker.
 *
 * Job: receive a listing JSON payload (from the fashionistas.ai app through
 * externally_connectable, or from the popup/devtools through chrome.runtime),
 * find or open the target shop's create-listing page in the user's logged-in
 * tab, and hand the payload to the injected filler (fill.js).
 *
 * Payload contract:
 *   {
 *     type: "fashionistas:crosslist",
 *     listing: {
 *       title, description, price, currency, category, brand, size,
 *       condition, tags: string[],
 *       photos: [ { filename?, mimeType?, data: "data:image/...;base64,..." } |
 *                 { url: "https://..." } ]
 *     },
 *     shops?: ["poshmark","mercari","depop","vinted","grailed","facebook"]
 *   }
 * Reply: { ok, results: [{ shop, label, tabId, status, detail?|error? }] }
 *
 * The extension NEVER publishes: fill.js stops before Submit by design.
 */
importScripts("config.js");

const CONFIG = globalThis.FASHIONISTAS_CONFIG;
const SHOP_KEYS = Object.keys(CONFIG.shops);
const DEFAULT_SHOPS = SHOP_KEYS.slice();

const MSG = {
  crosslist: "fashionistas:crosslist",
  fill: "fashionistas:fill",
  needPayload: "fashionistas:need-payload",
  fetchPhoto: "fashionistas:fetch-photo",
  retryUrl: "fashionistas:retry-url",
  status: "fashionistas:status",
  filled: "fashionistas:filled"
};

const PENDING_PREFIX = "fashionistas:pending:";
const RESULTS_KEY = "fashionistas:results";

/* createUrls index already tried, per shop, this session. */
const urlTries = new Map();

function log() {
  try {
    console.log("[fashionistas]", ...arguments);
  } catch (e) {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ utils */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Turn a Chrome match pattern into a URL test. */
function matchPattern(url, pattern) {
  const m = /^(\*|https?):\/\/([^/]*)(\/.*)$/.exec(pattern || "");
  if (!m) return false;
  const scheme = m[1];
  const host = m[2];
  const path = m[3];
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    return false;
  }
  if (scheme !== "*" && u.protocol !== scheme + ":") return false;
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const hostRe = "^" + host.split("*").map(esc).join(".*") + "$";
  if (!new RegExp(hostRe).test(u.hostname)) return false;
  const pathRe = "^" + path.split("*").map(esc).join("[\\s\\S]*");
  return new RegExp(pathRe).test(u.pathname + u.search);
}

/** "Poshmark", "fb marketplace", "posh" -> config key. */
function normalizeShop(raw) {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  if (CONFIG.shops[k]) return k;
  const aliases = {
    fb: "facebook",
    "fb marketplace": "facebook",
    "facebook marketplace": "facebook",
    marketplace: "facebook",
    posh: "poshmark",
    "vinted.com": "vinted"
  };
  if (aliases[k]) return aliases[k];
  return (
    SHOP_KEYS.find(
      (key) =>
        CONFIG.shops[key].label.toLowerCase() === k ||
        key.startsWith(k) ||
        k.startsWith(key)
    ) || null
  );
}

function shopForUrl(url) {
  if (!url) return null;
  return (
    SHOP_KEYS.find((key) =>
      CONFIG.shops[key].tabMatch.some((p) => matchPattern(url, p))
    ) || null
  );
}

function isAppOrigin(origin) {
  try {
    const u = new URL(origin);
    const h = u.hostname;
    return (
      u.protocol === "https:" &&
      (h === "fashionistas.ai" ||
        h.endsWith(".fashionistas.ai") ||
        h.endsWith(".pages.dev"))
    );
  } catch (e) {
    return false;
  }
}

function senderIsApp(sender) {
  const origin =
    sender.origin || (sender.url ? new URL(sender.url).origin : "") || "";
  return isAppOrigin(origin);
}

/* ------------------------------------------------------- pending payloads */

async function setPending(tabId, record) {
  const key = PENDING_PREFIX + tabId;
  if (record) await chrome.storage.local.set({ [key]: record });
  else await chrome.storage.local.remove(key);
}

async function getPending(tabId) {
  const key = PENDING_PREFIX + tabId;
  const out = await chrome.storage.local.get(key);
  return out[key] || null;
}

async function saveResults(results) {
  const record = { at: Date.now(), results: results };
  await chrome.storage.local.set({ [RESULTS_KEY]: record });
  return record;
}

/* ----------------------------------------------------------- tab plumbing */

function whenReady(tabId, timeoutMs) {
  const budget = timeoutMs || 20000;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        chrome.tabs.onUpdated.removeListener(listener);
      } catch (e) {
        /* ignore */
      }
      clearTimeout(timer);
      resolve(true);
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    const timer = setTimeout(finish, budget);
    try {
      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs
        .get(tabId)
        .then((t) => {
          if (t && t.status === "complete") finish();
        })
        .catch(finish);
    } catch (e) {
      finish();
    }
  });
}

/**
 * Find a logged-in tab already sitting on the shop's create page; otherwise
 * reuse another tab for that shop; otherwise open a new one. Never reloads a
 * tab that is already on a create-listing URL (that would discard typing).
 */
async function openShopTab(shopKey) {
  const shop = CONFIG.shops[shopKey];
  if (!shop) throw new Error("unknown shop: " + shopKey);
  const tries = Math.min(urlTries.get(shopKey) || 0, shop.createUrls.length - 1);
  const createUrl = shop.createUrls[tries];

  const existing = (await chrome.tabs.query({ url: shop.tabMatch })) || [];
  const onCreate = existing.find(
    (t) => t.url && shop.createUrls.some((u) => t.url.split("#")[0].startsWith(u))
  );
  if (onCreate) {
    await chrome.tabs.update(onCreate.id, { active: true });
    await whenReady(onCreate.id);
    return onCreate.id;
  }
  if (existing.length) {
    const tab = existing[0];
    await chrome.tabs.update(tab.id, { active: true, url: createUrl });
    await whenReady(tab.id);
    return tab.id;
  }
  const created = await chrome.tabs.create({ url: createUrl, active: true });
  await whenReady(created.id);
  return created.id;
}

/* -------------------------------------------------------------- delivery */

async function deliver(tabId, shopKey, listing) {
  const shop = CONFIG.shops[shopKey];
  const token = shopKey + ":" + tabId + ":" + Date.now();
  const record = { shop: shopKey, listing: listing, token: token, at: Date.now() };
  await setPending(tabId, record);

  /* Manifest already injects config.js + fill.js on these origins; injecting
   * again guarantees they are present even if the tab predated the install. */
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["config.js", "fill.js"]
    });
  } catch (e) {
    log("executeScript fallback failed", shopKey, e && e.message);
  }

  const payload = { type: MSG.fill, shop: shopKey, listing: listing, token: token };
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, payload);
      if (resp) {
        await setPending(tabId, null);
        return resp;
      }
    } catch (e) {
      lastError = e;
    }
    await sleep(400 + attempt * 300);
  }
  return { ok: false, error: (lastError && lastError.message) || "no reply" };
}

async function handleCrosslist(msg) {
  const listing = msg && msg.listing;
  if (!listing || typeof listing !== "object") {
    return { ok: false, error: "missing listing payload" };
  }
  const requested =
    Array.isArray(msg.shops) && msg.shops.length ? msg.shops : DEFAULT_SHOPS;
  const shops = [];
  requested.forEach((raw) => {
    const key = normalizeShop(raw);
    if (key && shops.indexOf(key) === -1) shops.push(key);
  });
  if (!shops.length) return { ok: false, error: "no known shops in 'shops'" };

  log("crosslisting to", shops.join(", "));

  const opened = await Promise.allSettled(shops.map((k) => openShopTab(k)));
  const results = [];
  const deliveries = [];
  opened.forEach((res, i) => {
    const key = shops[i];
    if (res.status === "fulfilled") {
      deliveries.push(
        deliver(res.value, key, listing)
          .then((resp) => ({ key: key, tabId: res.value, resp: resp }))
          .catch((e) => ({ key: key, tabId: res.value, resp: { ok: false, error: String(e && e.message) } }))
      );
    } else {
      results.push({
        shop: key,
        label: CONFIG.shops[key].label,
        status: "error",
        error: String(res.reason && res.reason.message ? res.reason.message : res.reason)
      });
    }
  });

  const done = await Promise.allSettled(deliveries);
  done.forEach((res) => {
    if (res.status !== "fulfilled") return;
    const r = res.value;
    results.push({
      shop: r.key,
      label: CONFIG.shops[r.key].label,
      tabId: r.tabId,
      status: r.resp && r.resp.ok ? "filled" : "error",
      detail: r.resp
    });
  });

  await saveResults(results);
  return { ok: results.some((r) => r.status === "filled"), results: results };
}

async function handleRetryUrl(msg, sender) {
  const shopKey = normalizeShop(msg.shop);
  if (!shopKey || !sender.tab) return { ok: false, error: "bad retry request" };
  const shop = CONFIG.shops[shopKey];
  const next = (urlTries.get(shopKey) || 0) + 1;
  if (next >= shop.createUrls.length) {
    return { ok: false, error: "no more create URLs for " + shopKey };
  }
  urlTries.set(shopKey, next);
  const tabId = sender.tab.id;
  await chrome.tabs.update(tabId, { url: shop.createUrls[next] });
  await whenReady(tabId);
  const resp = await deliver(tabId, shopKey, msg.listing || {});
  return { ok: !!(resp && resp.ok), detail: resp };
}

/* ---------------------------------------------------------- photo proxy */

function arrayBufferToDataUrl(buf, type) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return "data:" + (type || "image/jpeg") + ";base64," + btoa(bin);
}

async function proxyPhoto(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error("photo fetch HTTP " + res.status);
  const buf = await res.arrayBuffer();
  const type = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
  return { data: arrayBufferToDataUrl(buf, type), mimeType: type };
}

/* -------------------------------------------------------------- routing */

function route(msg, sender, sendResponse, external) {
  if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
  if (msg.type.indexOf("fashionistas:") !== 0) return;

  if (external && !senderIsApp(sender)) {
    log("rejected external sender", sender && sender.origin);
    sendResponse({ ok: false, error: "origin not allowed" });
    return;
  }
  if (external && msg.type !== MSG.crosslist && msg.type !== MSG.status) {
    sendResponse({ ok: false, error: "external senders may only crosslist/status" });
    return;
  }

  switch (msg.type) {
    case MSG.crosslist:
      handleCrosslist(msg)
        .then(sendResponse)
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;

    case MSG.status:
      chrome.storage.local
        .get(RESULTS_KEY)
        .then((out) => sendResponse({ ok: true, results: (out[RESULTS_KEY] || {}).results || [] }))
        .catch(() => sendResponse({ ok: true, results: [] }));
      return true;

    case MSG.needPayload: {
      const tabId = sender.tab && sender.tab.id;
      if (tabId == null) {
        sendResponse({ ok: true, pending: null });
        return false;
      }
      getPending(tabId)
        .then((record) => sendResponse({ ok: true, pending: record }))
        .catch(() => sendResponse({ ok: true, pending: null }));
      return true;
    }

    case MSG.fetchPhoto: {
      if (typeof msg.url !== "string" || !/^https?:/.test(msg.url)) {
        sendResponse({ ok: false, error: "bad photo url" });
        return false;
      }
      proxyPhoto(msg.url)
        .then((out) => sendResponse(Object.assign({ ok: true }, out)))
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;
    }

    case MSG.retryUrl:
      handleRetryUrl(msg, sender)
        .then(sendResponse)
        .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
      return true;

    case MSG.filled:
      /* fill.js reports what it did; keep it for the app's status panel. */
      saveResults([Object.assign({ shop: msg.shop, status: "filled" }, msg.report || {})])
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;

    default:
      sendResponse({ ok: false, error: "unknown message type" });
      return false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) =>
  route(msg, sender, sendResponse, false)
);

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) =>
  route(msg, sender, sendResponse, true)
);

chrome.tabs.onRemoved.addListener((tabId) => {
  setPending(tabId, null).catch(() => {});
});

/* Clicking the toolbar icon grants the optional host permission used only to
 * proxy photo downloads that the shop CDN refuses to serve cross-origin. */
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async () => {
    try {
      const granted = await chrome.permissions.request({
        origins: ["https://*/*", "http://*/*"]
      });
      log("photo host permission granted:", granted);
    } catch (e) {
      log("permission request failed", e && e.message);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  log("fashionistas.ai crosslister installed; shops:", SHOP_KEYS.join(", "));
});

log("service worker up; shops:", SHOP_KEYS.join(", "));
