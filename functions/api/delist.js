/**
 * POST /api/delist — auto-delist when an item sells.
 *
 * Runs entirely server-side (Cloudflare Pages Function): no user computer, no
 * extension open, no watcher.
 *   • eBay     → Sell Inventory API withdraw (offer) or quantity 0 (inventory item)
 *   • Etsy     → Open API v3 listing state INACTIVE (DELETE fallback)
 *   • the other 6 shops (poshmark, mercari, depop, vinted, grailed, facebook)
 *     → queued as extension tasks in D1 table delist_queue (CREATE TABLE IF NOT EXISTS)
 *
 * GET /api/delist returns the queue so the client can poll progress.
 *
 * Body: {
 *   sold?: true, saleId?: string,
 *   itemRef?: string,              // our own item id (used as queue key)
 *   sku?: string, offerId?: string, ebayListingId?: string,
 *   listingId?: string,            // Etsy listing id
 *   shops?: string[]               // default: all 8
 * }
 */

import { getFreshToken } from "./ebay/oauth/callback.js";
import { getFreshEtsyToken } from "./etsy/oauth/callback.js";

const ALL_SHOPS = [
  "ebay",
  "etsy",
  "poshmark",
  "mercari",
  "depop",
  "vinted",
  "grailed",
  "facebook",
];
// Shops that cannot be delisted by an open API call → extension tasks.
const EXTENSION_SHOPS = ALL_SHOPS.filter((s) => s !== "ebay" && s !== "etsy");

const QUEUE_SCHEMA = `CREATE TABLE IF NOT EXISTS delist_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_ref TEXT NOT NULL,
  shop TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'delist',
  listing_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  detail TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

const EBAY_TOKEN_SCHEMA = `CREATE TABLE IF NOT EXISTS ebay_tokens (
  token_key TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  env TEXT,
  scopes TEXT,
  updated_at INTEGER
)`;

const ETSY_TOKEN_SCHEMA = `CREATE TABLE IF NOT EXISTS etsy_tokens (
  token_key TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  shop_id TEXT,
  updated_at INTEGER
)`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function pickDb(env) {
  if (!env || typeof env !== "object") return null;
  for (const n of ["DB", "FASHIONISTAS_DB", "DELIST_DB", "D1"]) {
    const db = env[n];
    if (db && typeof db.prepare === "function" && typeof db.bind === "function") return db;
  }
  return null;
}

function tokenKey(request) {
  const raw = (request && request.headers && request.headers.get("Cookie")) || "";
  for (const name of ["fash_uid", "fash_user_id", "fash_session", "fash_connect_v1"]) {
    for (const part of raw.split(";")) {
      const p = part.trim();
      if (!p.startsWith(name + "=")) continue;
      const v = p.slice(name.length + 1);
      if (v) return "u:" + v.slice(0, 120);
    }
  }
  return "anon";
}

async function enqueue(db, { itemRef, shop, action, listingRef, status, detail }) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO delist_queue (item_ref, shop, action, listing_ref, status, detail, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .bind(
      itemRef,
      shop,
      action || "delist",
      listingRef || "",
      status || "pending",
      detail || "",
      now,
      now
    )
    .run();
}

/* ------------------------------- eBay ---------------------------------- */

async function delistEbay(env, request, { itemRef, sku, offerId, ebayListingId }) {
  const apiKeyMissing = !safeStr(env.EBAY_CLIENT_ID) || !safeStr(env.EBAY_CLIENT_SECRET);
  const db = pickDb(env);
  if (!db) return { ok: false, reason: "d1_binding_missing", queued: true };

  const ebayEnv =
    (safeStr(env.EBAY_ENV) || "production").toLowerCase() === "sandbox" ? "sandbox" : "production";

  const fresh = await getFreshToken(db, tokenKey(request), {
    clientId: safeStr(env.EBAY_CLIENT_ID),
    clientSecret: safeStr(env.EBAY_CLIENT_SECRET),
    ebayEnv,
  });
  if (!fresh.ok) {
    return {
      ok: false,
      reason: fresh.error,
      blocked: apiKeyMissing ? "EBAY_CLIENT_ID not configured" : null,
      queued: true,
    };
  }

  const host = ebayEnv === "production" ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
  const token = fresh.token.access_token;

  const call = async (method, path, body) => {
    const res = await fetch(host + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: String(text).slice(0, 300) };
    }
    return { ok: res.ok, status: res.status, data };
  };

  const errMsg = (r) =>
    String(
      (r.data && (r.data.errors?.[0]?.message || r.data.error || r.data.message)) ||
        `http_${r.status}`
    ).slice(0, 200);

  // Preferred: withdraw the offer (ends the listing immediately).
  let withdrawErr = null;
  let resolvedOfferId = offerId;
  if (!resolvedOfferId && ebayListingId) {
    const lookup = await call(
      "GET",
      `/sell/inventory/v1/offer?listing_id=${encodeURIComponent(ebayListingId)}&limit=1`
    );
    const offers = (lookup.data && Array.isArray(lookup.data.offers) && lookup.data.offers) || [];
    if (offers.length && offers[0].offerId) {
      resolvedOfferId = String(offers[0].offerId);
    }
  }
  if (resolvedOfferId) {
    const w = await call(
      "PUT",
      `/sell/inventory/v1/offer/${encodeURIComponent(resolvedOfferId)}/withdraw`,
      { reason: "OUT_OF_STOCK" }
    );
    if (w.ok) return { ok: true, via: "offer_withdraw", offerId: resolvedOfferId };
    withdrawErr = errMsg(w);
  }

  const targetSku = safeStr(sku);
  if (targetSku) {
    // Fallback (and sku-only path): quantity 0 ends the active listing.
    const put = await call(
      "PUT",
      `/sell/inventory/v1/inventory_item/${encodeURIComponent(targetSku)}`,
      { availability: { shipToLocationAvailability: { quantity: 0 } } }
    );
    if (put.ok) return { ok: true, via: "inventory_quantity_zero", sku: targetSku, withdrawErr };
    return { ok: false, reason: errMsg(put), withdrawErr, queued: true };
  }

  if (withdrawErr) return { ok: false, reason: withdrawErr, queued: true };
  return {
    ok: false,
    reason: "missing_sku_or_offerId",
    hint: "Pass sku (preferred) or offerId, or ebayListingId so the offer can be resolved.",
    queued: true,
  };
}

/* ------------------------------- Etsy ---------------------------------- */

async function delistEtsy(env, request, { listingId }) {
  const apiKey = safeStr(env.ETSY_API_KEY);
  if (!apiKey) {
    return { ok: false, reason: "missing_env_var:ETSY_API_KEY", blocked: "ETSY_API_KEY not configured", queued: true };
  }
  if (!listingId) return { ok: false, reason: "missing_etsy_listing_id", queued: true };

  const db = pickDb(env);
  if (!db) return { ok: false, reason: "d1_binding_missing", queued: true };

  const fresh = await getFreshEtsyToken(db, tokenKey(request), apiKey);
  if (!fresh.ok) return { ok: false, reason: fresh.error, queued: true };

  const path = `/listings/${encodeURIComponent(String(listingId))}`;
  const doCall = (method, body) =>
    fetch("https://openapi.etsy.com/v3/application" + path, {
      method,
      headers: {
        "x-api-key": apiKey,
        Authorization: `Bearer ${fresh.token.access_token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });

  const res = await doCall("PUT", { state: "INACTIVE" });
  if (res.ok) return { ok: true, via: "listing_inactive", listingId: String(listingId) };

  const text = await res.text().catch(() => "");
  // Some Etsy apps are not allowed to PUT state — DELETE removes it instead.
  if (res.status === 400 || res.status === 404 || res.status === 405) {
    const del = await doCall("DELETE");
    if (del.ok) return { ok: true, via: "listing_delete", listingId: String(listingId) };
    const delText = await del.text().catch(() => "");
    return {
      ok: false,
      reason: `put_${res.status}_delete_${del.status}: ${(delText || "").slice(0, 180)}`,
      queued: true,
    };
  }

  return {
    ok: false,
    reason: `etsy_put_${res.status}: ${(text || "").slice(0, 180)}`,
    queued: true,
  };
}

/* ------------------------------ handlers ------------------------------- */

export async function onRequestPost(context) {
  const env = context.env || {};
  const req = context.request;

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!body || typeof body !== "object") body = {};

  const requested = Array.isArray(body.shops) && body.shops.length
    ? body.shops.map((s) => safeStr(s).toLowerCase()).filter((s) => ALL_SHOPS.includes(s))
    : ALL_SHOPS.slice();

  const itemRef =
    safeStr(body.itemRef) || safeStr(body.itemId) || safeStr(body.sku) || `sale_${Date.now()}`;
  const sold = body.sold !== false; // default: this call means "it sold"

  const db = pickDb(env);
  let queueStore = "d1_binding_missing";
  if (db) {
    try {
      await db.prepare(QUEUE_SCHEMA).run();
      await db.prepare(EBAY_TOKEN_SCHEMA).run();
      await db.prepare(ETSY_TOKEN_SCHEMA).run();
      queueStore = "d1";
    } catch (e) {
      queueStore = "d1_error:" + String(e && e.message ? e.message : e).slice(0, 80);
    }
  }

  const results = {};
  const queued = [];

  if (requested.includes("ebay")) {
    const r = await delistEbay(env, req, {
      itemRef,
      sku: safeStr(body.sku) || safeStr(body.ebaySku),
      offerId: safeStr(body.offerId),
      ebayListingId: safeStr(body.ebayListingId) || safeStr(body.listingId),
    });
    results.ebay = r;
    if (db && queueStore === "d1") {
      try {
        await enqueue(db, {
          itemRef,
          shop: "ebay",
          listingRef: safeStr(body.offerId) || safeStr(body.sku) || safeStr(body.ebayListingId),
          status: r.ok ? "done" : "failed",
          detail: r.ok ? r.via : r.reason,
        });
      } catch {
        queueStore = "d1_enqueue_failed";
      }
    }
    if (!r.ok && r.queued) queued.push("ebay");
  }

  if (requested.includes("etsy")) {
    const r = await delistEtsy(env, req, {
      listingId: safeStr(body.etsyListingId) || safeStr(body.listingId),
    });
    results.etsy = r;
    if (db && queueStore === "d1") {
      try {
        await enqueue(db, {
          itemRef,
          shop: "etsy",
          listingRef: safeStr(body.etsyListingId) || safeStr(body.listingId),
          status: r.ok ? "done" : "failed",
          detail: r.ok ? r.via : r.reason,
        });
      } catch {
        queueStore = "d1_enqueue_failed";
      }
    }
    if (!r.ok && r.queued) queued.push("etsy");
  }

  // The other 6 shops: no open API → queued as browser-extension tasks.
  for (const shop of EXTENSION_SHOPS) {
    if (!requested.includes(shop)) continue;
    const row = {
      itemRef,
      shop,
      action: "extension_delist",
      listingRef: safeStr(body.listingRefs && body.listingRefs[shop]) || "",
      status: "pending",
      detail: "waiting for extension worker (MV3) to call /api/delist/task",
    };
    if (db && queueStore === "d1") {
      try {
        await enqueue(db, row);
      } catch {
        queueStore = "d1_enqueue_failed";
      }
    }
    queued.push(shop);
    results[shop] = { ok: false, queued: true, via: "extension_task" };
  }

  const allDone = requested.every((s) => results[s] && results[s].ok);

  return json({
    ok: true,
    sold,
    itemRef,
    results,
    queued,
    queueStore,
    allDone,
    note: allDone
      ? "Every requested shop is delisted server-side."
      : "eBay/Etsy results above; remaining shops run as extension tasks from delist_queue.",
  });
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const db = pickDb(env);
  if (!db) {
    return json({
      ok: true,
      queue: [],
      queueStore: "d1_binding_missing",
      shops: ALL_SHOPS,
      note: "Bind a D1 database (DB / FASHIONISTAS_DB / DELIST_DB) to persist delist_queue.",
    });
  }

  try {
    await db.prepare(QUEUE_SCHEMA).run();
    const res = await db
      .prepare(
        "SELECT id, item_ref, shop, action, listing_ref, status, detail, attempts, created_at, updated_at FROM delist_queue ORDER BY id DESC LIMIT 100"
      )
      .all();
    const rows = (res && res.results) || [];
    const counts = {};
    for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
    return json({ ok: true, queue: rows, counts, queueStore: "d1", shops: ALL_SHOPS });
  } catch (e) {
    return json({
      ok: false,
      error: "delist_queue_unavailable",
      message: String(e && e.message ? e.message : e).slice(0, 200),
      queueStore: "d1_error",
    });
  }
}

/**
 * Extension workers (MV3) POST here after finishing a queued shop task.
 * Body: { itemRef, shop, status: "done"|"failed", detail? }
 */
export async function onRequestPut(context) {
  const env = context.env || {};
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }
  const itemRef = safeStr(body && body.itemRef);
  const shop = safeStr(body && body.shop);
  if (!itemRef || !shop || !ALL_SHOPS.includes(shop)) {
    return json({ ok: false, error: "bad_request", need: ["itemRef", "shop"] }, 400);
  }
  const db = pickDb(env);
  if (!db) return json({ ok: false, error: "d1_binding_missing" }, 503);

  const status = ["done", "failed", "pending"].includes(safeStr(body.status))
    ? safeStr(body.status)
    : "failed";
  try {
    await db.prepare(QUEUE_SCHEMA).run();
    await db
      .prepare(
        `UPDATE delist_queue
           SET status = ?, detail = ?, attempts = attempts + 1, updated_at = ?
         WHERE item_ref = ? AND shop = ?`
      )
      .bind(status, safeStr(body.detail).slice(0, 500), Date.now(), itemRef, shop)
      .run();
    return json({ ok: true, itemRef, shop, status });
  } catch (e) {
    return json({ ok: false, error: String(e && e.message ? e.message : e).slice(0, 200) }, 500);
  }
}
