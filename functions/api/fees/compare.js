/**
 * POST /api/fees/compare — every shop's take-home at ONE price, best first.
 *
 * WHY: index.html's "Compare all shops" button (netItOut()) POSTs here and
 * renders `ranked`, `best`, `worst`, `spread`, `verifiedCount`, `count` and
 * `note` directly, so all seven are part of this response's contract with that
 * consumer. Every figure is computed from the catalogue in
 * functions/api/marketplaces.js — the same file GET /api/marketplaces serves —
 * so the board, the compare list and the API cannot disagree.
 *
 * Request:  application/json  { "price": <finite number > 0> }
 * Response: 200 { ok, price, currency, ranked:[{id,name,verified,lines,net,
 *                 takeRate}], best, worst, spread, count, verifiedCount, note }
 *                 `ranked` is sorted best net first; `best` === ranked[0],
 *                 `worst` === ranked[ranked.length - 1],
 *                 `spread` = best.net - worst.net (>= 0).
 *           400 bad JSON body / price
 *           405 non-POST                         (Allow: POST, OPTIONS)
 *           415 non-JSON content type
 *
 * No auth, no D1, no outbound call. `cache-control: no-store` because the
 * answer is computed, not fetched, and must never be cached across prices.
 */

import { json } from "../_lib/auth.js";
import { MARKETPLACES } from "../marketplaces.js";
import { parsePrice, takeHome, isVerified, COMPARE_NOTE } from "../_lib/fees.js";

const ALLOW = "POST, OPTIONS";

/** Read the JSON body, or explain precisely why it was rejected. */
async function readBody(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("json")) {
    return {
      error: json(
        { ok: false, error: "Content-Type must be application/json, e.g. { price: 48 }." },
        415,
        { allow: ALLOW }
      ),
    };
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return {
      error: json({ ok: false, error: "Request body must be JSON: { price }." }, 400),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      error: json({ ok: false, error: "Expected a JSON object: { price }." }, 400),
    };
  }
  return { body };
}

export async function onRequest(context) {
  const { request } = context;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { allow: ALLOW, "cache-control": "no-store" },
    });
  }

  if (method !== "POST") {
    return json({ ok: false, error: "Use POST with a JSON body: { price }." }, 405, {
      allow: ALLOW,
    });
  }

  const { body, error } = await readBody(request);
  if (error) return error;

  const price = parsePrice(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    return json(
      { ok: false, error: "price must be a finite number greater than 0 (e.g. 48)." },
      400
    );
  }

  const ranked = MARKETPLACES.map((m) => {
    const { lines, net, takeRate } = takeHome(m, price);
    return {
      id: m.id,
      name: m.name,
      verified: isVerified(m),
      lines,
      net,
      takeRate,
    };
  }).sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return json({
    ok: true,
    price,
    currency: "USD",
    ranked,
    best,
    worst,
    spread: Math.round((best.net - worst.net) * 100) / 100,
    count: ranked.length,
    verifiedCount: ranked.filter((r) => r.verified).length,
    note: COMPARE_NOTE,
  });
}
