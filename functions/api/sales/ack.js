/**
 * POST /api/sales/ack — acknowledge or dismiss a recorded sale.
 *
 * After the seller sees "Sold on X — delete from Y?" and confirms (or decides
 * to keep the other copies), the client marks the event so it stops surfacing
 * as new. Acknowledgement never deletes anything itself.
 *
 * Auth: active subscriber (401 unauthenticated, 402 subscription required),
 * like the other mutating sales routes (see ../_lib/auth.js).
 *
 * Body: { key: "<shop>:<listingRef>" } | { id }  +  action (default acknowledge)
 *   action: "acknowledge" | "acknowledged" | "dismiss" | "dismissed"
 *     → { ok:true, sale }  (the updated row)
 *     → 404 { ok:false, error:"not_found" } when the sale is not theirs
 */

import { requireActiveSubscriber, json, getDB } from "../_lib/auth.js";
import { ensureSalesSchema, toSaleJson, saleKey } from "./_shared.js";

const ACK = new Set(["acknowledge", "acknowledged"]);
const DISMISS = new Set(["dismiss", "dismissed"]);

export async function onRequestPost(context) {
  const gate = await requireActiveSubscriber(context.request, context.env);
  if (gate.response) return gate.response;

  const db = getDB(context.env);
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

  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "acknowledge";
  let status = null;
  if (ACK.has(action)) status = "acknowledged";
  else if (DISMISS.has(action)) status = "dismissed";
  else {
    return json(
      { ok: false, error: "bad_action", want: ["acknowledge", "dismiss"] },
      400
    );
  }

  const now = Date.now();
  try {
    let row = null;
    if (body.id != null && body.id !== "") {
      const id = Number(body.id);
      if (!Number.isFinite(id)) return json({ ok: false, error: "bad_request", need: ["id|key"] }, 400);
      await db
        .prepare(
          `UPDATE sales_events SET status = ?, updated_at = ?
            WHERE id = ? AND user_id = ?`
        )
        .bind(status, now, id, gate.user.id)
        .run();
      row = await db
        .prepare(
          `SELECT id, shop, listing_ref, listing_url, title, price, currency,
                  sold_at, sold_at_text, detected_at, source, status,
                  created_at, updated_at
             FROM sales_events WHERE id = ? AND user_id = ? LIMIT 1`
        )
        .bind(id, gate.user.id)
        .first();
    } else {
      const key = typeof body.key === "string" ? body.key : "";
      const sep = key.indexOf(":");
      const shop = sep > 0 ? key.slice(0, sep).trim() : "";
      const listingRef = sep > 0 ? key.slice(sep + 1).trim() : "";
      if (!saleKey(shop, listingRef)) {
        return json({ ok: false, error: "bad_request", need: ["id|key"] }, 400);
      }
      await db
        .prepare(
          `UPDATE sales_events SET status = ?, updated_at = ?
            WHERE user_id = ? AND shop = ? AND listing_ref = ?`
        )
        .bind(status, now, gate.user.id, shop, listingRef)
        .run();
      row = await db
        .prepare(
          `SELECT id, shop, listing_ref, listing_url, title, price, currency,
                  sold_at, sold_at_text, detected_at, source, status,
                  created_at, updated_at
             FROM sales_events
            WHERE user_id = ? AND shop = ? AND listing_ref = ? LIMIT 1`
        )
        .bind(gate.user.id, shop, listingRef)
        .first();
    }

    if (!row) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, sale: toSaleJson(row) });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e).slice(0, 200) }, 500);
  }
}
