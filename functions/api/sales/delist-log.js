/**
 * POST /api/sales/delist-log — audit trail for one-tap delist attempts.
 *
 * The extension's sales/delist.js audit sink (createDelistLog) records every
 * attempt locally first and POSTs it here best-effort so the trail survives a
 * lost device. A failed upload never drops the local copy, so this route only
 * ever sees well-formed entries — but it still validates and never throws.
 *
 * This route does NOT delete anything and does NOT duplicate
 * functions/api/delist.js: the actual deletion still goes through the existing
 * delist path (queue.js runDelist for extension shops, the eBay/Etsy API calls
 * inside /api/delist). This is the ledger, not the lever.
 *
 * Auth: active subscriber (401 unauthenticated, 402 subscription required),
 * like the rest of the mutating API (see ../_lib/auth.js).
 *
 * Body: { shop, outcome: "ok"|"failed"|"skipped", detail?, saleKey?, fromShop?, at? }
 */

import { requireActiveSubscriber, json, getDB } from "../_lib/auth.js";
import { ensureSalesSchema } from "./_shared.js";

const OUTCOMES = new Set(["ok", "failed", "skipped"]);

function safeStr(v, cap = 500) {
  return typeof v === "string" ? v.trim().slice(0, cap) : "";
}

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

  const shop = safeStr(body.shop, 40);
  const outcome = safeStr(body.outcome, 20).toLowerCase();
  if (!shop) return json({ ok: false, error: "bad_request", need: ["shop", "outcome"] }, 400);
  if (!OUTCOMES.has(outcome)) {
    return json({ ok: false, error: "bad_outcome", want: ["ok", "failed", "skipped"] }, 400);
  }

  const now = Date.now();
  try {
    const res = await db
      .prepare(
        `INSERT INTO sales_delist_log
           (user_id, sale_key, from_shop, shop, outcome, detail, at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        gate.user.id,
        safeStr(body.saleKey, 300) || null,
        safeStr(body.fromShop, 40) || null,
        shop,
        outcome,
        safeStr(body.detail) || "",
        safeStr(body.at, 40) || new Date(now).toISOString(),
        now
      )
      .run();
    const id =
      res && res.meta && res.meta.last_row_id != null
        ? res.meta.last_row_id
        : null;
    return json({ ok: true, id, shop, outcome });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e).slice(0, 200) }, 500);
  }
}
