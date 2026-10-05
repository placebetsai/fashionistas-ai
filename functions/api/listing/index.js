/**
 * POST /api/listing — AI listing writer. Snap a item, get structured listing
 * JSON plus what the seller actually keeps on each shop.
 *
 * Request:  application/json
 *   {
 *     "item": {
 *       "description": "…"        REQUIRED unless photo_alt is given (<=4000)
 *       "photo_alt":   "…"        what the photo shows (alternative/complement)
 *       "brand": "Levi's", "colour": "blue", "size": "28", "condition": "good"
 *       "title_hint": "…",        optional
 *       "price": 48               optional — the seller's asking price. When
 *                                  present it WINS over the model's price.
 *     },
 *     "marketplaces": ["poshmark"]  optional subset of the six breakdown shops
 *   }
 *
 * Response: 200 { ok, schema, listing:{id,title,description,category,condition,
 *                 brand,colour,size,price,tags[],hashtags[]},
 *                 breakdown:[{id,name,price,verified,lines[],fees,net,takeRate,
 *                 note}], best, usage:{...}, model:{provider,model}, feeNote }
 *           400 bad JSON / unknown marketplace      405 non-POST
 *           415 non-JSON content type               422 item too thin to write
 *           401 no session                          402 free-tier cap reached
 *           502 model unavailable / output failed schema (fail closed)
 *           503 model runtime not configured        504 model timed out
 *
 * ORDER OF GATES (deliberate):
 *   method -> body -> AUTH (401) -> QUOTA (402) -> model -> schema -> fees.
 *   The quota is checked BEFORE the model call so a free user's 11th attempt
 *   costs nothing; it is only burned AFTER a schema-valid listing exists, so a
 *   model failure never eats a free listing.
 *
 * Fees are computed here from functions/api/_lib/fees.js — the model is never
 * asked for a fee and its number would be discarded if it volunteered one.
 */

import { json, requireAuth } from "../_lib/auth.js";
import { COMPARE_NOTE, parsePrice, round2 } from "../_lib/fees.js";
import { ModelError, completeJSON, describeModel, modelConfig } from "./_lib/model.js";
import {
  BREAKDOWN_IDS,
  LISTING_SCHEMA_VERSION,
  LISTING_SYSTEM_PROMPT,
  buildBreakdown,
  listingUserPrompt,
  validateListing,
} from "./_lib/schema.js";
import { charge, checkQuota, insertListing, usageSnapshot } from "./_lib/usage.js";

const ALLOW = "POST, OPTIONS";

/** Echoed in the 502 body so a client can render the expected shape. */
const LISTING_SCHEMA_FOR_ERROR = {
  required: ["title", "description", "category", "condition", "price", "tags"],
  optional: ["brand", "colour", "size", "hashtags"],
  condition: ["new_with_tags", "new_without_tags", "excellent", "good", "fair", "poor"],
};

/** Validate the caller's input. Returns { body } or { error }. */
async function parseRequest(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("json")) {
    return {
      error: json(
        {
          ok: false,
          error: "unsupported_media_type",
          detail: 'Content-Type must be application/json, e.g. { item: { description: "…" } }.',
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
        { ok: false, error: "invalid_json", detail: String((err && err.message) || err) },
        400
      ),
    };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: json({ ok: false, error: "invalid_body", detail: "Expected a JSON object." }, 400) };
  }

  const item = body.item;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return {
      error: json(
        { ok: false, error: "missing_item", detail: 'Expected { item: { description: "…" } }.' },
        422
      ),
    };
  }

  const description = typeof item.description === "string" ? item.description.trim() : "";
  const photoAlt = typeof item.photo_alt === "string" ? item.photo_alt.trim() : "";
  if (!description && !photoAlt) {
    return {
      error: json(
        {
          ok: false,
          error: "missing_item_description",
          detail: "item.description (or item.photo_alt) is required so there is something to write about.",
        },
        422
      ),
    };
  }
  if (description.length > 4000 || photoAlt.length > 2000) {
    return {
      error: json(
        { ok: false, error: "item_too_long", detail: "item.description must be <= 4000 characters." },
        422
      ),
    };
  }

  let marketplaces = BREAKDOWN_IDS;
  if (body.marketplaces !== undefined && body.marketplaces !== null) {
    if (!Array.isArray(body.marketplaces) || body.marketplaces.length === 0) {
      return {
        error: json(
          {
            ok: false,
            error: "invalid_marketplaces",
            detail: "marketplaces must be a non-empty array of ids.",
            allowed: BREAKDOWN_IDS,
          },
          400
        ),
      };
    }
    const unknown = body.marketplaces.filter(
      (id) => typeof id !== "string" || !BREAKDOWN_IDS.includes(id.trim().toLowerCase())
    );
    if (unknown.length) {
      return {
        error: json(
          { ok: false, error: "unknown_marketplace", fields: unknown, allowed: BREAKDOWN_IDS },
          400
        ),
      };
    }
    marketplaces = [...new Set(body.marketplaces.map((id) => String(id).trim().toLowerCase()))];
  }

  if (item.price !== undefined && item.price !== null && item.price !== "") {
    const p = parsePrice(item.price);
    if (!Number.isFinite(p) || p <= 0 || p > 10000) {
      return {
        error: json(
          { ok: false, error: "invalid_price", detail: "item.price must be a number > 0 and <= 10000." },
          400
        ),
      };
    }
  }

  return { body: { item, marketplaces } };
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
      { ok: false, error: "method_not_allowed", detail: "Use POST with { item: { description } }." },
      405,
      { allow: ALLOW }
    );
  }

  const parsed = await parseRequest(request);
  if (parsed.error) return parsed.error;
  const { item, marketplaces } = parsed.body;

  // --- auth (401) ---------------------------------------------------------
  const auth = await requireAuth(request, context.env);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  // --- free-tier cap (402) ------------------------------------------------
  const quota = await checkQuota(context.env, userId, "listings");
  if (!quota.ok) return quota.response;

  // --- model --------------------------------------------------------------
  let modelOut;
  try {
    modelOut = await completeJSON(context.env, {
      system: LISTING_SYSTEM_PROMPT,
      prompt: listingUserPrompt(item),
      temperature: 0.2,
    });
  } catch (err) {
    if (err instanceof ModelError) {
      return json(
        { ok: false, error: err.code, detail: err.message, model: describeModel(modelConfig(context.env)) },
        err.status
      );
    }
    return json(
      { ok: false, error: "model_call_failed", detail: String((err && err.message) || err) },
      502
    );
  }

  // --- schema (fail closed on prose / half-JSON) --------------------------
  const checked = validateListing(modelOut);
  if (!checked.ok) {
    return json(
      {
        ok: false,
        error: "model_output_invalid",
        detail: "The model answer did not match the listing schema; nothing was saved.",
        schema: LISTING_JSON_SCHEMA_FOR_ERROR,
        errors: checked.errors,
        model: describeModel(modelConfig(context.env)),
      },
      502
    );
  }
  const listing = checked.value;

  // The seller's own price always wins over the model's suggestion.
  if (item.price !== undefined && item.price !== null && item.price !== "") {
    listing.price = round2(parsePrice(item.price));
  }

  // --- fees: computed, never quoted from the model ------------------------
  let breakdown;
  try {
    breakdown = buildBreakdown(listing.price, marketplaces);
  } catch (err) {
    return json(
      { ok: false, error: "fee_model_failed", detail: String((err && err.message) || err) },
      500
    );
  }

  // --- persist + burn the quota only now that the listing is real ---------
  const model = describeModel(modelConfig(context.env));
  const id = await insertListing(context.env, userId, listing, breakdown, model);
  const charged = await charge(context.env, userId, "listings");
  if (!charged.ok) {
    // The listing exists; a counter that could not be written must not turn a
    // success into a 5xx. Report usage as unknown instead of faking a number.
    console.error("[listing] quota charge failed:", charged.error);
  }
  const usage = await usageSnapshot(context.env, userId);

  const best = breakdown.reduce((a, b) => (b.net > a.net ? b : a), breakdown[0]);

  return json({
    ok: true,
    schema: LISTING_SCHEMA_VERSION,
    listing: { id, ...listing },
    breakdown,
    best: { id: best.id, name: best.name, net: best.net, takeRate: best.takeRate },
    usage,
    model,
    feeNote: COMPARE_NOTE,
  });
}

export const onRequestPost = onRequest;
