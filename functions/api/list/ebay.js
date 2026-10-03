/**
 * POST /api/list/ebay  — eBay Sell/Inventory listing (SANDBOX only).
 *
 * Layers, in order:
 *   1. auth                → 401 without a valid session token
 *   2. active subscription → 402 without an active $14.99/mo plan
 *   3. credentials         → 503 naming the exact missing env var
 *   4. real sandbox call   → returns eBay's own listingId / viewUrl / errors
 *
 * Step 4 only runs when every credential is present. Nothing below fakes a
 * listing: if eBay does not return an inventory item + offer + publish
 * confirmation, this endpoint returns an error carrying eBay's message.
 */

import { requireActiveSubscriber, json, missingEnv } from "../_lib/auth.js";

const EBAY_SANDBOX_VARS = [
  "EBAY_SANDBOX_CLIENT_ID",
  "EBAY_SANDBOX_CLIENT_SECRET",
  "EBAY_SANDBOX_REDIRECT_URI",
];

/** Sandbox Buy/Sell hosts. Production hosts are never referenced here. */
const SANDBOX = {
  api: "https://api.sandbox.ebay.com",
  auth: "https://auth.sandbox.ebay.com",
};

const REQUIRED_BODY = ["title", "description", "price", "photoUrl", "categoryId", "condition"];

function validate(body) {
  const problems = [];
  for (const key of REQUIRED_BODY) {
    const v = body[key];
    if (v === undefined || v === null || String(v).trim() === "") problems.push(key);
  }
  if (body.price !== undefined && body.price !== null) {
    const n = Number(body.price);
    if (!isFinite(n) || n <= 0) problems.push("price:must be a positive number");
  }
  return problems;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1 + 2: auth, then subscription.
  const gate = await requireActiveSubscriber(request, env);
  if (gate.response) return gate.response;

  // 3: credentials — name what is missing rather than guessing.
  const missing = missingEnv(env, EBAY_SANDBOX_VARS);
  if (missing.length) {
    return json(
      {
        ok: false,
        error: "env_missing",
        marketplace: "ebay",
        missing,
        detail:
          "eBay sandbox credentials are not configured on this Pages project. Set them with `wrangler pages secret put <NAME> --project-name fashionistas-ai`. No listing was created.",
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json(
      { ok: false, error: "invalid_json", detail: String((err && err.message) || err) },
      400
    );
  }
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "invalid_body", detail: "Expected a JSON object." }, 400);
  }

  const problems = validate(body);
  if (problems.length) {
    return json(
      {
        ok: false,
        error: "missing_or_invalid_fields",
        fields: problems,
        expected: { required: REQUIRED_BODY },
      },
      422
    );
  }

  // 4: real sandbox publish. Deliberately unreachable until step 3 passes.
  try {
    const result = await publishToEbaySandbox(env, body);
    if (!result.ok) {
      // Surface eBay's own error text; never collapse to a bare 500.
      return json(
        {
          ok: false,
          marketplace: "ebay",
          status: "failed",
          error: result.error || "ebay_error",
          detail: result.detail || null,
          ebayMessages: result.ebayMessages || null,
        },
        result.status || 502
      );
    }
    return json({
      ok: true,
      marketplace: "ebay",
      status: "published",
      listingId: result.listingId,
      viewUrl: result.viewUrl,
      sku: result.sku,
    });
  } catch (err) {
    return json(
      {
        ok: false,
        marketplace: "ebay",
        status: "failed",
        error: "ebay_call_failed",
        detail: String((err && err.message) || err),
      },
      502
    );
  }
}

/**
 * Real eBay sandbox publish: token → inventory item → offer → publishOffer.
 * Idempotent by SKU (createOrReplaceInventoryItem replaces in place).
 *
 * Returns {ok:true, listingId, viewUrl, sku} or {ok:false, error, detail}.
 */
export async function publishToEbaySandbox(env, body) {
  const sku = body.sku || buildSku(body.title);
  const accessToken = await ebayAccessToken(env);
  if (!accessToken.ok) {
    return { ok: false, error: "ebay_auth_failed", detail: accessToken.detail };
  }

  // a) inventory item (idempotent — same SKU overwrites)
  const inv = await ebayFetch(`${sandboxApi()}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: "PUT",
    token: accessToken.token,
    body: {
      product: {
        title: body.title,
        description: body.description,
        imageUrls: [body.photoUrl],
      },
      condition: body.condition,
      availability: { shipToLocationAvailability: { quantity: 1 } },
    },
  });
  if (!inv.ok) return inv;

  // b) offer
  const offerRes = await ebayFetch(`${sandboxApi()}/sell/inventory/v1/offer`, {
    method: "POST",
    token: accessToken.token,
    body: {
      sku,
      marketplaceId: "EBAY_US",
      format: "FIXED_PRICE",
      availableQuantity: 1,
      categoryId: body.categoryId,
      listingPolicies: {
        fulfillmentPolicyId: env.EBAY_FULFILLMENT_POLICY || "",
        paymentPolicyId: env.EBAY_PAYMENT_POLICY || "",
        returnPolicyId: env.EBAY_RETURN_POLICY || "",
      },
      pricingSummary: {
        price: { value: String(body.price), currency: "USD" },
      },
    },
  });
  if (!offerRes.ok) return offerRes;
  const offerId = offerRes.data && offerRes.data.offerId;
  if (!offerId) {
    return { ok: false, error: "ebay_no_offer_id", detail: JSON.stringify(offerRes.data) };
  }

  // c) publish
  const pub = await ebayFetch(
    `${sandboxApi()}/sell/inventory/v1/publish_offer/${encodeURIComponent(offerId)}`,
    { method: "POST", token: accessToken.token }
  );
  if (!pub.ok) return pub;

  const listingId = pub.data && (pub.data.listingId || pub.data.offerId);
  if (!listingId) {
    return { ok: false, error: "ebay_no_listing_id", detail: JSON.stringify(pub.data) };
  }

  return {
    ok: true,
    listingId: String(listingId),
    viewUrl: `https://www.sandbox.ebay.com/viewitem?item=${encodeURIComponent(String(listingId))}`,
    sku,
  };
}

function sandboxApi() {
  return SANDBOX.api;
}

function buildSku(title) {
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `FASH-${slug || "item"}-${Date.now().toString(36).toUpperCase()}`;
}

async function ebayAccessToken(env) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope/sell.inventory",
  });
  const basic = btoa(`${env.EBAY_SANDBOX_CLIENT_ID}:${env.EBAY_SANDBOX_CLIENT_SECRET}`);
  try {
    const res = await fetch(`${SANDBOX.auth}/oauth2/v1/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      return { ok: false, detail: data.error_description || data.error || `HTTP ${res.status}` };
    }
    return { ok: true, token: data.access_token };
  } catch (err) {
    return { ok: false, detail: String((err && err.message) || err) };
  }
}

/** Thin eBay fetch that preserves eBay's own error payload. */
async function ebayFetch(url, opts) {
  const headers = {
    authorization: `Bearer ${opts.token}`,
    "content-type": "application/json",
    "accept": "application/json",
  };
  let res;
  try {
    res = await fetch(url, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch (err) {
    return { ok: false, error: "network_error", detail: String((err && err.message) || err), status: 502 };
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (res.ok) return { ok: true, data };

  const errs = (data && (data.errors || data.errorMessage)) || null;
  const detail =
    (Array.isArray(errs) && errs.map((e) => e.longMessage || e.message).filter(Boolean).join("; ")) ||
    (errs && (errs.longMessage || errs.message)) ||
    text;
  return { ok: false, error: "ebay_api_error", detail, ebayMessages: errs, status: 502 };
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
