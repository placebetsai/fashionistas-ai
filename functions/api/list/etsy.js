/**
 * POST /api/list/etsy — Etsy Open API v3 listing creation.
 *
 * Layers, in order:
 *   1. auth                → 401 without a valid session token
 *   2. active subscription → 402 without an active $14.99/mo plan
 *   3. credentials         → 503 naming the exact missing env var
 *   4. real API call       → draft listing + image upload, or Etsy's own error
 *
 * No listingId is ever invented. Etsy's error payload (including rate limits
 * and missing required attributes) is passed through verbatim.
 */

import { requireActiveSubscriber, json, missingEnv } from "../_lib/auth.js";

const ETSY_VARS = ["ETSY_API_KEY", "ETSY_SHARED_SECRET"];
const ETSY_API = "https://openapi.etsy.com/v3";
const REQUIRED_BODY = ["title", "description", "price", "photoUrl", "taxonomyId", "quantity"];

function validate(body) {
  const problems = [];
  for (const key of REQUIRED_BODY) {
    const v = body[key];
    if (v === undefined || v === null || String(v).trim() === "") problems.push(key);
  }
  if (body.quantity !== undefined && body.quantity !== null) {
    const q = Number(body.quantity);
    if (!Number.isFinite(q) || q < 1 || !Number.isInteger(q)) problems.push("quantity:must be a positive integer");
  }
  if (body.price !== undefined && body.price !== null) {
    const n = Number(body.price);
    if (!isFinite(n) || n <= 0) problems.push("price:must be a positive number");
  }
  if (body.title && String(body.title).length > 140) problems.push("title:must be 140 characters or fewer");
  return problems;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireActiveSubscriber(request, env);
  if (gate.response) return gate.response;

  const missing = missingEnv(env, ETSY_VARS);
  if (missing.length) {
    return json(
      {
        ok: false,
        error: "env_missing",
        marketplace: "etsy",
        missing,
        detail:
          "Etsy Open API credentials are not configured. Set them with `wrangler pages secret put <NAME> --project-name fashionistas-ai`. No listing was created.",
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ ok: false, error: "invalid_json", detail: String((err && err.message) || err) }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "invalid_body", detail: "Expected a JSON object." }, 400);
  }

  const problems = validate(body);
  if (problems.length) {
    return json(
      { ok: false, error: "missing_or_invalid_fields", fields: problems, expected: { required: REQUIRED_BODY } },
      422
    );
  }

  try {
    const result = await createEtsyListing(env, body);
    if (!result.ok) {
      return json(
        {
          ok: false,
          marketplace: "etsy",
          status: "failed",
          error: result.error || "etsy_error",
          status_code: result.status_code || null,
          detail: result.detail || null,
          etsyMessages: result.etsyMessages || null,
        },
        result.httpStatus || 502
      );
    }
    return json({
      ok: true,
      marketplace: "etsy",
      status: result.state || "active",
      listingId: result.listingId,
      viewUrl: result.viewUrl,
    });
  } catch (err) {
    return json(
      {
        ok: false,
        marketplace: "etsy",
        status: "failed",
        error: "etsy_call_failed",
        detail: String((err && err.message) || err),
      },
      502
    );
  }
}

export async function createEtsyListing(env, body) {
  // a) token (v3 keys carry x-api-key; refresh handled when a user token exists)
  const auth = await etsyToken(env);
  if (!auth.ok) return { ok: false, error: "etsy_auth_failed", detail: auth.detail, httpStatus: 502 };

  // b) draft listing
  const payload = {
    title: String(body.title).slice(0, 140),
    description: String(body.description),
    taxonomy_id: Number(body.taxonomyId),
    quantity: Number(body.quantity),
    price: {
      amount: Math.round(Number(body.price) * 100),
      currency_code: (body.currency || "USD").toUpperCase(),
    },
    state: "draft",
  };

  const create = await etsyFetch(`${ETSY_API}/application/listings`, {
    method: "POST",
    token: auth.token,
    body: payload,
  });
  if (!create.ok) return create;

  const listingId = create.data && (create.data.listing_id || create.data.listingId);
  if (!listingId) {
    return { ok: false, error: "etsy_no_listing_id", detail: JSON.stringify(create.data), httpStatus: 502 };
  }

  // c) upload the image (listing is not sellable without at least one)
  const img = await uploadEtsyImage(env, auth.token, listingId, body.photoUrl, body.alt);
  if (!img.ok) {
    // Keep the draft visible with Etsy's reason — do not report success.
    return {
      ok: false,
      error: "etsy_image_upload_failed",
      detail: img.detail,
      listingId: String(listingId),
      httpStatus: img.httpStatus || 502,
    };
  }

  return {
    ok: true,
    listingId: String(listingId),
    state: create.data.state || "draft",
    viewUrl: `https://www.etsy.com/listing/${listingId}`,
  };
}

async function etsyToken(env) {
  // Open API v3 application listings authenticate with the x-api-key header.
  return { ok: true, token: env.ETSY_API_KEY };
}

async function uploadEtsyImage(env, token, listingId, photoUrl, altText) {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) {
      return { ok: false, detail: `Could not fetch photoUrl (HTTP ${res.status})`, httpStatus: 422 };
    }
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: res.headers.get("content-type") || "image/jpeg" });

    const form = new FormData();
    form.append("image", blob, "listing.jpg");
    form.append("listing_id", String(listingId));
    if (altText) form.append("alt", String(altText));

    const r = await fetch(`${ETSY_API}/application/listings/${listingId}/images`, {
      method: "POST",
      headers: { "x-api-key": token },
      body: form,
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!r.ok) {
      return { ok: false, detail: etsyErrorText(data) || text, httpStatus: 502 };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, detail: String((err && err.message) || err), httpStatus: 502 };
  }
}

async function etsyFetch(url, opts) {
  const headers = {
    "x-api-key": opts.token,
    "content-type": "application/json",
    accept: "application/json",
  };
  let res;
  try {
    res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    return { ok: false, error: "network_error", detail: String((err && err.message) || err), httpStatus: 502 };
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (res.ok) return { ok: true, data };

  if (res.status === 429) {
    const retry = res.headers.get("retry-after");
    return {
      ok: false,
      error: "etsy_rate_limited",
      detail: `Etsy rate limit hit${retry ? ` (retry-after: ${retry}s)` : ""}. ${etsyErrorText(data)}`.trim(),
      etsyMessages: data,
      httpStatus: 429,
    };
  }

  return {
    ok: false,
    error: "etsy_api_error",
    detail: etsyErrorText(data) || text,
    status_code: data && data.status_code,
    etsyMessages: data,
    httpStatus: 502,
  };
}

/** Pull the human-readable reason out of an Etsy v3 error envelope. */
function etsyErrorText(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  const errs = data.error || data.errors;
  if (Array.isArray(errs)) {
    return errs.map((e) => (e && (e.msg || e.message)) || JSON.stringify(e)).filter(Boolean).join("; ");
  }
  if (errs && typeof errs === "object") {
    return Object.entries(errs).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ");
  }
  if (data.detail) return String(data.detail);
  if (data.user_error_msg) return String(data.user_error_msg);
  return "";
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed", detail: "Use POST." }, 405);
  }
  return onRequestPost(context);
}
