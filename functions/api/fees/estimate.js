/**
 * POST /api/fees/estimate — what ONE shop keeps from ONE price.
 *
 * WHY: index.html's "See what I'd keep" button (calcFees()) POSTs here and
 * renders `lines`, `net`, `takeRate`, `verified` and `note` directly, so this
 * response shape is a contract with that consumer: every field must be a real
 * number or a real string — never NaN, never null inside a success payload.
 *
 * Request:  application/json  { "price": <finite number > 0>, "platform": <id> }
 * Response: 200 { ok, platform, name, price, currency, lines:[{label,amount}],
 *                 net, takeRate, verified, note }
 *           400 bad JSON body / price / platform   (clear message, no NaN)
 *           405 non-POST                          (Allow: POST, OPTIONS)
 *           415 non-JSON content type
 *
 * Rates come from functions/api/marketplaces.js through _lib/fees.js so this
 * endpoint can never disagree with GET /api/marketplaces. No auth, no D1, no
 * outbound call: a logged-out visitor can price a sale. `cache-control:
 * no-store` because the answer is computed, not fetched, and must never be
 * cached across price changes.
 */

import { json } from "../_lib/auth.js";
import {
  findMarketplace,
  marketplaceIds,
  parsePrice,
  takeHome,
  isVerified,
  modelNote,
} from "../_lib/fees.js";

const ALLOW = "POST, OPTIONS";

/** Read the JSON body, or explain precisely why it was rejected. */
async function readBody(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("json")) {
    return {
      error: json(
        {
          ok: false,
          error: "Content-Type must be application/json, e.g. { price, platform }.",
        },
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
      error: json(
        { ok: false, error: "Request body must be JSON: { price, platform }." },
        400
      ),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      error: json(
        { ok: false, error: "Expected a JSON object: { price, platform }." },
        400
      ),
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
    return json(
      { ok: false, error: 'Use POST with a JSON body: { price, platform }.' },
      405,
      { allow: ALLOW }
    );
  }

  const { body, error } = await readBody(request);
  if (error) return error;

  const price = parsePrice(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    return json(
      {
        ok: false,
        error: "price must be a finite number greater than 0 (e.g. 48).",
      },
      400
    );
  }

  const marketplace = findMarketplace(body.platform);
  if (!marketplace) {
    const sent =
      typeof body.platform === "string" && body.platform.trim()
        ? `"${body.platform}"`
        : String(body.platform);
    return json(
      {
        ok: false,
        error: `Unknown platform ${sent}. Valid ids: ${marketplaceIds().join(", ")}.`,
      },
      400
    );
  }

  const { lines, net, takeRate } = takeHome(marketplace, price);

  return json({
    ok: true,
    platform: marketplace.id,
    name: marketplace.name,
    price,
    currency: "USD",
    lines,
    net,
    takeRate,
    verified: isVerified(marketplace),
    note: modelNote(marketplace),
  });
}
