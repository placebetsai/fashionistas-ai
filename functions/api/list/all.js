/**
 * POST /api/list/all — the one-photo flow: fan out to eBay and Etsy.
 *
 * Every marketplace gets its own entry in the response so a failure on one
 * never hides the other:
 *
 *   { ebay: { ok, status, listingId?, viewUrl?, error?, missing? },
 *     etsy: { ok, status, listingId?, viewUrl?, error?, missing? },
 *     ok }                        ← true only when BOTH published
 *
 * Auth 401 and subscription 402 are checked once, before the fan-out.
 * Per-marketplace credential problems are reported as that marketplace's own
 * failure — the call still returns 200 with both results, because partial
 * success is a real outcome, not an exception.
 */

import { requireActiveSubscriber, json, missingEnv } from "../_lib/auth.js";
import { publishToEbaySandbox } from "./ebay.js";
import { createEtsyListing } from "./etsy.js";

const EBAY_VARS = ["EBAY_SANDBOX_CLIENT_ID", "EBAY_SANDBOX_CLIENT_SECRET", "EBAY_SANDBOX_REDIRECT_URI"];
const ETSY_VARS = ["ETSY_API_KEY", "ETSY_SHARED_SECRET"];

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireActiveSubscriber(request, env);
  if (gate.response) return gate.response;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ ok: false, error: "invalid_json", detail: String((err && err.message) || err) }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "invalid_body", detail: "Expected a JSON object." }, 400);
  }

  const problems = [];
  for (const key of ["title", "description", "price", "photoUrl"]) {
    const v = body[key];
    if (v === undefined || v === null || String(v).trim() === "") problems.push(key);
  }
  if (problems.length) {
    return json(
      {
        ok: false,
        error: "missing_or_invalid_fields",
        fields: problems,
        expected: {
          required: ["title", "description", "price", "photoUrl"],
          optional: ["condition", "categoryId", "taxonomyId", "quantity", "sku"],
        },
      },
      422
    );
  }

  const [ebay, etsy] = await Promise.all([
    runOne("ebay", env, EBAY_VARS, () =>
      publishToEbaySandbox(env, {
        ...body,
        categoryId: body.categoryId || "11483",
        condition: body.condition || "USED_EXCELLENT",
      })
    ),
    runOne("etsy", env, ETSY_VARS, () =>
      createEtsyListing(env, {
        ...body,
        taxonomyId: body.taxonomyId || 1,
        quantity: body.quantity || 1,
      })
    ),
  ]);

  return json({ ok: ebay.ok && etsy.ok, ebay, etsy });
}

/**
 * Wrap one marketplace call so a credential gap becomes that marketplace's own
 * result instead of taking down the whole fan-out.
 */
async function runOne(marketplace, env, vars, fn) {
  const missing = missingEnv(env, vars);
  if (missing.length) {
    return {
      ok: false,
      marketplace,
      status: "failed",
      error: "env_missing",
      missing,
      detail: `${marketplace} credentials are not configured, so no listing was created.`,
    };
  }

  let result;
  try {
    result = await fn();
  } catch (err) {
    return {
      ok: false,
      marketplace,
      status: "failed",
      error: "exception",
      detail: String((err && err.message) || err),
    };
  }

  if (!result || result.ok !== true) {
    const r = result || {};
    return {
      ok: false,
      marketplace,
      status: "failed",
      error: r.error || `${marketplace}_error`,
      detail: r.detail || null,
      listingId: r.listingId || null,
    };
  }

  return {
    ok: true,
    marketplace,
    status: result.state || "published",
    listingId: result.listingId,
    viewUrl: result.viewUrl || null,
    sku: result.sku || null,
  };
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed", detail: "Use POST." }, 405);
  }
  return onRequestPost(context);
}
