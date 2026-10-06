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
import { localListing } from "./_lib/local.js";
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

  // CORS preflight carries no credentials, so it is answered before auth.
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { allow: ALLOW, "cache-control": "no-store" },
    });
  }

  // Auth BEFORE the method check and BEFORE the body is read. Sitting below
  // them meant an anonymous caller could drive method dispatch and body parsing
  // without ever proving a session, and a GET never saw a 401 — so the route
  // looked public. Refusing first also stops us advertising which methods we
  // accept to someone who has not proven who they are.
  const auth = await requireAuth(request, context.env);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

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

  // --- free-tier cap (402) ------------------------------------------------
  const quota = await checkQuota(context.env, userId, "listings");
  if (!quota.ok) return quota.response;

  // --- writer: the model polishes the copy, it never gates the listing -----
  // This used to hard-503 `model_not_configured` whenever MODEL_PROVIDER was
  // unset, which meant a seller could not save a listing they had typed
  // themselves. Every field the schema needs is derivable from their own input
  // and the six-shop breakdown is local math, so no model is required to save.
  //
  // If a model IS configured, we try it ONCE with a retry. If it throws or
  // returns invalid JSON, we fall back to the local seller-written builder
  // instead of failing the request. A model must never gate listing creation.
  let modelOut = null;
  let writtenBy = "model";
  const cfg = modelConfig(context.env);

  async function tryModel() {
    if (!cfg.configured) return null;
    // One retry on transient failures
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await completeJSON(context.env, {
          system: LISTING_SYSTEM_PROMPT,
          prompt: listingUserPrompt(item),
          temperature: 0.2,
        });
      } catch (err) {
        if (attempt === 0) continue; // retry once
        console.warn("[listing] model call failed, falling back to local builder:", err.message);
        return null;
      }
    }
    return null;
  }

  modelOut = await tryModel();

  // Fallback to local builder if no model configured or model failed
  if (modelOut === null) {
    const local = localListing(item);
    if (!local.ok) return json(local.body, local.status);
    modelOut = local.value;
    writtenBy = "seller";
  }

  // --- schema (fail closed on prose / half-JSON) --------------------------
  const checked = validateListing(modelOut);
  if (!checked.ok) {
    // If model output was invalid, try local builder as last resort
    if (writtenBy === "model") {
      console.warn("[listing] model output invalid, falling back to local builder");
      const local = localListing(item);
      if (local.ok) {
        modelOut = local.value;
        writtenBy = "seller";
        // Re-validate the local output (should always pass)
        const rechecked = validateListing(modelOut);
        if (rechecked.ok) {
          // Continue with local listing below
        } else {
          return json(
            {
              ok: false,
              error: "invalid_item",
              detail: "Your item fields could not be used as a listing; nothing was saved.",
              schema: LISTING_JSON_SCHEMA_FOR_ERROR,
              errors: rechecked.errors,
              model: describeModel(cfg),
            },
            422
          );
        }
      } else {
        return json(local.body, local.status);
      }
    } else {
      return json(
        {
          ok: false,
          error: "invalid_item",
          detail: "Your item fields could not be used as a listing; nothing was saved.",
          schema: LISTING_JSON_SCHEMA_FOR_ERROR,
          errors: checked.errors,
          model: describeModel(cfg),
        },
        422
      );
    }
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
  const model = describeModel(cfg);
  const id = await insertListing(context.env, userId, listing, breakdown, model);
  if (id === null) {
    // This used to return ok:true with listing.id = null, so a failed write looked
    // like success and the quota was burned anyway. Fail loudly, charge nothing.
    return json(
      {
        ok: false,
        error: "listing_write_failed",
        detail: "The listing validated but could not be saved to the database; nothing was charged.",
        listing,
        model,
      },
      500
    );
  }
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
    writer: writtenBy,
    feeNote: COMPARE_NOTE,
  });
}

export const onRequestPost = onRequest;
