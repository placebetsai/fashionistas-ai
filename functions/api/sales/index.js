/**
 * /api/sales — record a sale event (POST) and list them (GET).
 *
 * The scanner (apps/extension/sales/driver.js) runs in the seller's OWN
 * logged-in session and POSTs one event per sold listing here. Identity is
 * derived (`shop` + `listingRef`), so re-posts upsert instead of duplicating —
 * the same guarantee as registry.acceptNew() on the client, enforced again by
 * the UNIQUE(user_id, shop, listing_ref) constraint for second devices.
 *
 * Auth (see ../_lib/auth.js):
 *   POST → active subscriber (401 unauthenticated, 402 subscription required)
 *   GET  → any authenticated session (401 unauthenticated), like /api/delist
 *
 * POST body: { shop, listingRef, listingUrl?, title?, price?, currency?,
 *              soldAt?, soldAtText?, detectedAt?, source? }
 *   → { ok:true, sale, deduped }   (deduped:true when the row already existed)
 *
 * GET ?status=new|acknowledged|dismissed (default: all, newest first, max 100)
 *   → { ok:true, sales:[...], counts }
 */

import { requireAuth, requireActiveSubscriber, json, getDB } from "../_lib/auth.js";
import {
  ensureSalesSchema,
  toSaleJson,
  saleKey,
  strOrNull,
  numOrNull,
  SALE_STATUSES,
} from "./_shared.js";

function pickDb(env) {
  return getDB(env);
}

export async function onRequestPost(context) {
  const gate = await requireActiveSubscriber(context.request, context.env);
  if (gate.response) return gate.response;

  const db = pickDb(context.env);
  if (!db) return json({ ok: false, error: "d1_binding_missing" }, 503);
  try {
    await ensureSalesSchema(db);
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e).slice(0, 200) }, 500);
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }
  if (!body || typeof body !== "object") body = {};

  const shop = typeof body.shop === "string" ? body.shop.trim().toLowerCase() : "";
  const listingRef =
    typeof body.listingRef === "string"
      ? body.listingRef.trim()
      : typeof body.listing_ref === "string"
        ? body.listing_ref.trim()
        : "";
  if (!saleKey(shop, listingRef)) {
    return json({ ok: false, error: "bad_request", need: ["shop", "listingRef"] }, 400);
  }

  const now = Date.now();
  const cols = {
    listing_url: strOrNull(body.listingUrl != null ? body.listingUrl : body.listing_url),
    title: strOrNull(body.title),
    price: numOrNull(body.price),
    currency: strOrNull(body.currency),
    sold_at: strOrNull(body.soldAt != null ? body.soldAt : body.sold_at),
    sold_at_text: strOrNull(body.soldAtText != null ? body.soldAtText : body.sold_at_text),
    detected_at:
      strOrNull(body.detectedAt != null ? body.detectedAt : body.detected_at) ||
      new Date(now).toISOString(),
    source: strOrNull(body.source) || "scan",
  };

  try {
    // Idempotent record: first post inserts, every re-post refreshes the
    // observation without creating a second row or clearing acknowledgement.
    await db
      .prepare(
        `INSERT INTO sales_events
           (user_id, shop, listing_ref, listing_url, title, price, currency,
            sold_at, sold_at_text, detected_at, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
         ON CONFLICT(user_id, shop, listing_ref) DO UPDATE SET
           listing_url = excluded.listing_url,
           title = excluded.title,
           price = excluded.price,
           currency = excluded.currency,
           sold_at = excluded.sold_at,
           sold_at_text = excluded.sold_at_text,
           detected_at = excluded.detected_at,
           source = excluded.source,
           updated_at = excluded.updated_at`
      )
      .bind(
        gate.user.id,
        shop,
        listingRef,
        cols.listing_url,
        cols.title,
        cols.price,
        cols.currency,
        cols.sold_at,
        cols.sold_at_text,
        cols.detected_at,
        cols.source,
        now,
        now
      )
      .run();

    const row = await db
      .prepare(
        `SELECT id, shop, listing_ref, listing_url, title, price, currency,
                sold_at, sold_at_text, detected_at, source, status,
                created_at, updated_at
           FROM sales_events
          WHERE user_id = ? AND shop = ? AND listing_ref = ?
          LIMIT 1`
      )
      .bind(gate.user.id, shop, listingRef)
      .first();

    const sale = toSaleJson(row);
    const deduped = !!row && row.created_at !== row.updated_at;
    return json({ ok: true, sale, deduped });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e).slice(0, 200) }, 500);
  }
}

export async function onRequestGet(context) {
  const gate = await requireAuth(context.request, context.env);
  if (gate.response) return gate.response;

  const db = pickDb(context.env);
  if (!db) {
    return json({
      ok: true,
      sales: [],
      counts: {},
      store: "d1_binding_missing",
      note: "Bind a D1 database (DB / FASHIONISTAS_DB / EBAY_DB / EBAY_TOKENS_DB / D1) to persist sales_events.",
    });
  }
  try {
    await ensureSalesSchema(db);
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e).slice(0, 200) }, 500);
  }

  let status = null;
  try {
    const url = new URL(context.request.url);
    const q = (url.searchParams.get("status") || "").trim().toLowerCase();
    if (q) {
      if (!SALE_STATUSES.has(q)) {
        return json({ ok: false, error: "bad_status", want: ["new", "acknowledged", "dismissed"] }, 400);
      }
      status = q;
    }
  } catch {
    status = null;
  }

  try {
    const sql = status
      ? `SELECT id, shop, listing_ref, listing_url, title, price, currency,
                sold_at, sold_at_text, detected_at, source, status,
                created_at, updated_at
           FROM sales_events
          WHERE user_id = ? AND status = ?
          ORDER BY id DESC LIMIT 100`
      : `SELECT id, shop, listing_ref, listing_url, title, price, currency,
                sold_at, sold_at_text, detected_at, source, status,
                created_at, updated_at
           FROM sales_events
          WHERE user_id = ?
          ORDER BY id DESC LIMIT 100`;
    const stmt = status
      ? db.prepare(sql).bind(gate.user.id, status)
      : db.prepare(sql).bind(gate.user.id);
    const res = await stmt.all();
    const rows = (res && res.results) || [];
    const sales = rows.map(toSaleJson).filter(Boolean);
    const counts = {};
    for (const s of sales) counts[s.status] = (counts[s.status] || 0) + 1;
    return json({ ok: true, sales, counts, store: "d1" });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e).slice(0, 200) }, 500);
  }
}
