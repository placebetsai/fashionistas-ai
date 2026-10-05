/**
 * POST /api/ebay/listing
 * createDraftInventoryItem (PUT sell/inventory/v1/inventory_item/{sku}) →
 * createOffer → publishInventoryItem (POST .../offer/{offerId}/publish)
 * via the Sell Inventory API on api.ebay.com (production) or api.sandbox.ebay.com.
 *
 * Tokens come from D1 ebay_tokens (proactively refreshed when < 5 min left);
 * the HttpOnly ebay_oauth_tok cookie remains the fallback.
 * Missing business policies return {"error":"missing_business_policies","guidance":[...]}
 * instead of a raw upstream failure.
 * Never logs secrets or tokens. See docs/EBAY_OAUTH.md.
 */

import { getFreshToken } from "./oauth/callback.js";
import { requireAuth } from "../_lib/auth.js";

const TOK_COOKIE = "ebay_oauth_tok";
const BYO_COOKIE = "ebay_byo_sess";

function pickDb(env) {
  if (!env || typeof env !== "object") return null;
  for (const n of ["DB", "FASHIONISTAS_DB", "EBAY_DB", "EBAY_TOKENS_DB", "D1"]) {
    const db = env[n];
    if (db && typeof db.prepare === "function" && typeof db.bind === "function") return db;
  }
  return null;
}

const TOKEN_SCHEMA = `CREATE TABLE IF NOT EXISTS ebay_tokens (
  token_key TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  env TEXT,
  scopes TEXT,
  updated_at INTEGER
)`;

/** Same key scheme as the OAuth callback: signed-in user, else anonymous. */
function tokenKeyFromRequest(request) {
  const raw = request.headers.get("Cookie") || "";
  for (const name of ["fash_uid", "fash_user_id", "fash_session", "fash_connect_v1"]) {
    for (const part of raw.split(";")) {
      const p = part.trim();
      if (!p.startsWith(name + "=")) continue;
      const v = p.slice(name.length + 1);
      if (v) return "u:" + v.slice(0, 120);
    }
  }
  return "anon";
}

/**
 * Prefer the durable D1 token. Refreshes it when it expires within 5 minutes.
 * Returns { ok:false, reason } when D1 is unbound or empty — caller falls back
 * to the cookie token.
 */
async function loadDurableToken(env, request, { clientId, clientSecret, ebayEnv }) {
  const db = pickDb(env);
  if (!db) return { ok: false, reason: "d1_binding_missing" };
  try {
    await db.prepare(TOKEN_SCHEMA).run();
    const fresh = await getFreshToken(db, tokenKeyFromRequest(request), {
      clientId,
      clientSecret,
      ebayEnv,
    });
    if (!fresh.ok) return { ok: false, reason: fresh.error };
    return {
      ok: true,
      access_token: fresh.token.access_token,
      refresh_token: fresh.token.refresh_token,
      expires_in: Math.max(60, Math.round((fresh.token.expires_at - Date.now()) / 1000)),
      token_type: fresh.token.token_type,
      env: fresh.token.env,
      obtained_at: Date.now(),
      refreshed: fresh.refreshed,
    };
  } catch (e) {
    return {
      ok: false,
      reason: "d1_error:" + String(e && e.message ? e.message : e).slice(0, 80),
    };
  }
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(val) {
  try {
    const pad = val.length % 4 === 0 ? val : val + "=".repeat(4 - (val.length % 4));
    return atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
}

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith(name + "=")) continue;
    return p.slice(name.length + 1);
  }
  return null;
}

function parseTokCookie(request) {
  const val = readCookie(request, TOK_COOKIE);
  if (!val) return null;
  const jsonStr = b64urlDecode(val);
  if (!jsonStr) return null;
  try {
    const o = JSON.parse(jsonStr);
    if (!o || typeof o !== "object" || !o.access_token) return null;
    return {
      access_token: safeStr(o.access_token),
      refresh_token: safeStr(o.refresh_token),
      expires_in: Number(o.expires_in) || 7200,
      token_type: safeStr(o.token_type) || "Bearer",
      env: (safeStr(o.env) || "sandbox").toLowerCase() === "production" ? "production" : "sandbox",
      obtained_at: Number(o.obtained_at) || 0,
    };
  } catch {
    return null;
  }
}

function parseByoCookie(request) {
  const val = readCookie(request, BYO_COOKIE);
  if (!val) return null;
  const jsonStr = b64urlDecode(val);
  if (!jsonStr) return null;
  try {
    const o = JSON.parse(jsonStr);
    if (!o || typeof o !== "object") return null;
    return {
      clientId: safeStr(o.clientId),
      clientSecret: safeStr(o.clientSecret),
      redirectUri: safeStr(o.redirectUri),
      env: safeStr(o.env),
    };
  } catch {
    return null;
  }
}

function basicAuthHeader(clientId, clientSecret) {
  const raw = `${clientId}:${clientSecret}`;
  const bytes = new TextEncoder().encode(raw);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "Basic " + btoa(bin);
}

function apiHost(ebayEnv) {
  return ebayEnv === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";
}

function mapCondition(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return "USED_GOOD";
  if (/\bnew\b|bnwt|nwt|deadstock/.test(s)) return "NEW";
  if (/like.?new|excellent|pristine|mint/.test(s)) return "LIKE_NEW";
  if (/very.?good|gently/.test(s)) return "USED_VERY_GOOD";
  if (/fair|worn|distressed/.test(s)) return "USED_ACCEPTABLE";
  if (/good|pre-?loved|preowned|used/.test(s)) return "USED_GOOD";
  return "USED_GOOD";
}

/** Rough US clothing leaf categories — seller should verify in Seller Hub. */
function mapCategoryId(category, title) {
  const c = String(category || "").toLowerCase();
  const t = String(title || "").toLowerCase();
  if (/shoe|sneaker|boot|heel/.test(c + " " + t)) return "4675";
  if (/dress/.test(c + " " + t)) return "63861";
  if (/outer|jacket|coat|blazer/.test(c + " " + t)) return "63862";
  if (/bottom|jean|pant|trouser|skirt|short/.test(c + " " + t)) return "63863";
  if (/accessor|bag|belt|hat|scarf/.test(c + " " + t)) return "4250";
  if (/top|shirt|blouse|tee|sweater|knit/.test(c + " " + t)) return "53159";
  return "11450"; // Clothing, Shoes & Accessories root fallback (may need leaf)
}

function skuFromListing(body) {
  const given = safeStr(body.sku);
  if (given) return given.slice(0, 50).replace(/[^a-zA-Z0-9_-]/g, "-");
  const base = ("fash-" + (body.id || body.listingId || Date.now()) + "-" + Math.random().toString(36).slice(2, 8))
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 50);
  return base || ("fash-" + Date.now());
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken, ebayEnv }) {
  const tokenHost =
    ebayEnv === "production"
      ? "https://api.ebay.com/identity/v1/oauth2/token"
      : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set(
    "scope",
    [
      "https://api.ebay.com/oauth/api_scope",
      "https://api.ebay.com/oauth/api_scope/sell.inventory",
      "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
      "https://api.ebay.com/oauth/api_scope/sell.account",
      "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
    ].join(" ")
  );

  const res = await fetch(tokenHost, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(clientId, clientSecret),
    },
    body: body.toString(),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data || !data.access_token) {
    const err =
      (data && (data.error_description || data.error)) ||
      `refresh_http_${res.status}`;
    return { ok: false, error: String(err).slice(0, 200) };
  }
  return {
    ok: true,
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_in: Number(data.expires_in) || 7200,
    token_type: data.token_type || "Bearer",
  };
}

async function ebayFetch(host, path, { method, token, body, contentLanguage }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (contentLanguage) headers["Content-Language"] = contentLanguage;
  const res = await fetch(host + path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: String(text).slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, data };
}

function firstPolicyId(listPayload, key) {
  const arr =
    (listPayload && (listPayload[key] || listPayload.fulfillmentPolicies || listPayload.paymentPolicies || listPayload.returnPolicies)) ||
    [];
  if (!Array.isArray(arr) || !arr.length) return "";
  const p = arr[0];
  return safeStr(p.fulfillmentPolicyId || p.paymentPolicyId || p.returnPolicyId || p.policyId);
}

async function loadPolicies(host, token, marketplaceId) {
  const q = `?marketplace_id=${encodeURIComponent(marketplaceId)}`;
  const [ful, pay, ret] = await Promise.all([
    ebayFetch(host, `/sell/account/v1/fulfillment_policy${q}`, { method: "GET", token }),
    ebayFetch(host, `/sell/account/v1/payment_policy${q}`, { method: "GET", token }),
    ebayFetch(host, `/sell/account/v1/return_policy${q}`, { method: "GET", token }),
  ]);

  const scopeBlocked = [ful, pay, ret].some(
    (r) =>
      r.status === 401 ||
      r.status === 403 ||
      (r.data &&
        String(r.data.errors?.[0]?.message || r.data.error || "")
          .toLowerCase()
          .includes("scope"))
  );

  return {
    fulfillmentPolicyId: firstPolicyId(ful.data, "fulfillmentPolicies"),
    paymentPolicyId: firstPolicyId(pay.data, "paymentPolicies"),
    returnPolicyId: firstPolicyId(ret.data, "returnPolicies"),
    scopeBlocked,
    statuses: { fulfillment: ful.status, payment: pay.status, return: ret.status },
  };
}

function tokSetCookie(tok, ebayEnv, secure) {
  const payload = b64urlEncode(
    JSON.stringify({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token || "",
      expires_in: tok.expires_in,
      token_type: tok.token_type || "Bearer",
      env: ebayEnv,
      obtained_at: Date.now(),
    })
  );
  // Prefer long Max-Age when refresh_token exists (best-effort until API KV).
  const maxAge = tok.refresh_token ? 7776000 : Math.max(3600, Number(tok.expires_in) || 7200);
  return `${TOK_COOKIE}=${payload}; Path=/api/ebay; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Best-effort durable store on fashionistas-api KV binding if present. */
async function bestEffortKvStore(env, tok, ebayEnv) {
  const kv = env && (env.EBAY_TOKENS || env.FASHIONISTAS_KV || env.TOKENS);
  if (!kv || typeof kv.put !== "function") {
    return { stored: false, reason: "no_kv_binding_document_fashionistas_api_need" };
  }
  try {
    const key = `ebay:refresh:${ebayEnv}:anon`;
    await kv.put(
      key,
      JSON.stringify({
        refresh_token_present: !!tok.refresh_token,
        // Store refresh only — never log. Cookie remains primary for Pages.
        refresh_token: tok.refresh_token || "",
        env: ebayEnv,
        updated_at: Date.now(),
      }),
      { expirationTtl: 7776000 }
    );
    return { stored: true, key };
  } catch {
    return { stored: false, reason: "kv_put_failed" };
  }
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const req = context.request;
  const secure = (req.url || "").startsWith("https:") ? "; Secure" : "";

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!body || typeof body !== "object") body = {};

  const byo = parseByoCookie(req);
  let tok = parseTokCookie(req);
  let tokenSource = tok && tok.access_token ? "cookie" : "none";

  const ebayEnv =
    (safeStr(body.env) || (tok && tok.env) || safeStr(env.EBAY_ENV) || "production").toLowerCase() ===
    "sandbox"
      ? "sandbox"
      : "production";

  const clientId =
    safeStr(body.clientId || body.client_id) ||
    (byo && byo.clientId) ||
    safeStr(env.EBAY_CLIENT_ID);
  const clientSecret =
    safeStr(body.clientSecret || body.client_secret) ||
    (byo && byo.clientSecret) ||
    safeStr(env.EBAY_CLIENT_SECRET);

  // Durable D1 token wins; getFreshToken refreshes when < 5 min remain.
  const durable = await loadDurableToken(env, req, { clientId, clientSecret, ebayEnv });
  if (durable.ok) {
    tok = durable;
    tokenSource = durable.refreshed ? "d1_refreshed" : "d1";
  }

  if (!tok || !tok.access_token) {
    return json(
      {
        ok: false,
        error: "ebay_not_connected",
        message:
          "No eBay OAuth token available (D1: " +
          (durable.reason || "empty") +
          "; cookie: absent). Connect eBay in Multilist first. Paste kits still work.",
        nextStep:
          "Multilist → Connect eBay → Save keys → Connect OAuth. After ?ebay_oauth=ok, retry Create on eBay.",
        tokenStore: durable.reason || "unknown",
      },
      401
    );
  }

  // Refresh if access likely expired (60s skew) and we have refresh + client secret.
  const ageMs = tok.obtained_at ? Date.now() - tok.obtained_at : 0;
  const expired = ageMs > (tok.expires_in - 60) * 1000;

  const setCookies = [];
  if ((expired || safeStr(body.forceRefresh) === "1") && tok.refresh_token) {
    if (!clientId || !clientSecret) {
      return json(
        {
          ok: false,
          error: "token_expired_missing_secret",
          message:
            "Access token expired and Client Secret is missing for refresh. Paste BYO keys again or set EBAY_CLIENT_SECRET, then reconnect OAuth.",
          nextStep: "Multilist → Connect eBay → Save keys → Connect OAuth (re-consent for sell scopes).",
        },
        401
      );
    }
    const refreshed = await refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken: tok.refresh_token,
      ebayEnv,
    });
    if (!refreshed.ok) {
      return json(
        {
          ok: false,
          error: "token_refresh_failed",
          message: "Could not refresh eBay token: " + refreshed.error,
          nextStep:
            "Reconnect OAuth with sell.inventory + sell.account scopes (Connect eBay → Connect OAuth). Sandbox recommended.",
          detail: refreshed.error,
        },
        401
      );
    }
    tok = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_in: refreshed.expires_in,
      token_type: refreshed.token_type,
      env: ebayEnv,
      obtained_at: Date.now(),
    };
    setCookies.push(tokSetCookie(tok, ebayEnv, secure));
  }

  const kvNote = await bestEffortKvStore(env, tok, ebayEnv);

  const title = safeStr(body.title) || "Untitled item";
  const description =
    safeStr(body.description) ||
    [title, body.brand, body.size ? "Size " + body.size : "", body.condition, body.category]
      .filter(Boolean)
      .join(" · ");
  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    return json(
      {
        ok: false,
        error: "invalid_price",
        message: "A positive price is required to create an eBay offer.",
      },
      400
    );
  }

  const sku = skuFromListing(body);
  const marketplaceId = safeStr(body.marketplaceId) || "EBAY_US";
  const condition = mapCondition(body.condition);
  const categoryId = safeStr(body.categoryId) || mapCategoryId(body.category, title);
  const brand = safeStr(body.brand);
  const size = safeStr(body.size);
  const color = safeStr(body.color);
  const quantity = Math.max(1, Number(body.quantity) || 1);
  const publish = !!body.publish;
  const host = apiHost(ebayEnv);

  const aspects = {};
  if (brand) aspects.Brand = [brand];
  if (size) aspects.Size = [size];
  if (color) aspects.Color = [color];
  if (body.category) aspects.Style = [String(body.category)];

  const inventoryItem = {
    availability: {
      shipToLocationAvailability: { quantity },
    },
    condition,
    product: {
      title: title.slice(0, 80),
      description: description.slice(0, 4000),
      aspects,
    },
  };
  const imgs = Array.isArray(body.imageUrls)
    ? body.imageUrls.map(safeStr).filter(Boolean).slice(0, 12)
    : [];
  if (imgs.length) inventoryItem.product.imageUrls = imgs;

  const inv = await ebayFetch(host, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: "PUT",
    token: tok.access_token,
    body: inventoryItem,
    contentLanguage: "en-US",
  });

  if (!inv.ok) {
    const errMsg =
      (inv.data &&
        (inv.data.errors?.[0]?.message ||
          inv.data.error_description ||
          inv.data.error ||
          inv.data.message)) ||
      `inventory_http_${inv.status}`;
    const lower = String(errMsg).toLowerCase();
    const scopeHint =
      inv.status === 401 ||
      inv.status === 403 ||
      lower.includes("scope") ||
      lower.includes("access denied");
    return json(
      {
        ok: false,
        error: scopeHint ? "insufficient_scope_or_auth" : "inventory_create_failed",
        message: String(errMsg).slice(0, 280),
        nextStep: scopeHint
          ? "Reconnect OAuth and approve sell.inventory (+ sell.account) scopes. Prefer Sandbox until production app scopes are enabled. Paste kits still work."
          : "Fix the listing fields (title/condition/images) and retry, or paste the kit on eBay manually.",
        env: ebayEnv,
        sku,
        status: inv.status,
        kv: kvNote,
      },
      inv.status === 401 || inv.status === 403 ? 403 : 502,
      setCookies.length ? { "Set-Cookie": setCookies[0] } : {}
    );
  }

  const policies = await loadPolicies(host, tok.access_token, marketplaceId);
  if (
    !policies.fulfillmentPolicyId ||
    !policies.paymentPolicyId ||
    !policies.returnPolicyId
  ) {
    const headers = {};
    if (setCookies[0]) headers["Set-Cookie"] = setCookies[0];

    const missingPolicies = [
      !policies.fulfillmentPolicyId ? "fulfillmentPolicyId" : null,
      !policies.paymentPolicyId ? "paymentPolicyId" : null,
      !policies.returnPolicyId ? "returnPolicyId" : null,
    ].filter(Boolean);

    const guidance = [];
    if (policies.scopeBlocked) {
      guidance.push(
        "Reconnect eBay OAuth and approve the sell.account scope (https://api.ebay.com/oauth/api_scope/sell.account) so business policies can be read."
      );
      guidance.push(
        "Retry POST /api/ebay/listing after reconnecting; inventory item " + sku + " is already saved."
      );
    } else {
      guidance.push(
        "Open eBay Seller Hub → Account → Business policies for " +
          marketplaceId +
          " and enable Business Policies if it is off."
      );
      if (!policies.fulfillmentPolicyId)
        guidance.push(
          "Create a Fulfillment policy (shipping service + handling time), then pass its fulfillmentPolicyId."
        );
      if (!policies.paymentPolicyId)
        guidance.push(
          "Create a Payment policy (accepted payment methods, immediate payment), then pass its paymentPolicyId."
        );
      if (!policies.returnPolicyId)
        guidance.push(
          "Create a Return policy (30-day returns, who pays), then pass its returnPolicyId."
        );
      guidance.push(
        "Retry POST /api/ebay/listing with those three IDs — inventory item " +
          sku +
          " already exists, so only createOffer + publish remain."
      );
      guidance.push(
        "No Seller Hub access? Copy the listing manually: the item data is ready (SKU " + sku + ")."
      );
    }

    return json(
      {
        ok: false,
        error: "missing_business_policies",
        guidance,
        cause: policies.scopeBlocked ? "insufficient_scope" : "policies_not_created",
        message: policies.scopeBlocked
          ? "Token lacks sell.account scope to read business policies (needed for createOffer)."
          : "Inventory item saved, but eBay business policies (fulfillment / payment / return) were not found — cannot createOffer yet.",
        nextStep: guidance[0] || "Create the missing business policies and retry.",
        missing: missingPolicies,
        scopeBlocked: !!policies.scopeBlocked,
        env: ebayEnv,
        sku,
        inventoryCreated: true,
        policies,
        tokenSource,
        kv: kvNote,
      },
      409,
      headers
    );
  }

  const offerBody = {
    sku,
    marketplaceId,
    format: "FIXED_PRICE",
    availableQuantity: quantity,
    categoryId,
    listingDescription: description.slice(0, 500000),
    listingPolicies: {
      fulfillmentPolicyId: policies.fulfillmentPolicyId,
      paymentPolicyId: policies.paymentPolicyId,
      returnPolicyId: policies.returnPolicyId,
    },
    pricingSummary: {
      price: { value: price.toFixed(2), currency: "USD" },
    },
  };

  const offer = await ebayFetch(host, "/sell/inventory/v1/offer", {
    method: "POST",
    token: tok.access_token,
    body: offerBody,
    contentLanguage: "en-US",
  });

  if (!offer.ok) {
    const errMsg =
      (offer.data &&
        (offer.data.errors?.[0]?.message ||
          offer.data.error_description ||
          offer.data.error ||
          offer.data.message)) ||
      `offer_http_${offer.status}`;
    const headers = {};
    if (setCookies[0]) headers["Set-Cookie"] = setCookies[0];
    return json(
      {
        ok: false,
        error: "offer_create_failed",
        message: String(errMsg).slice(0, 280),
        nextStep:
          "Inventory SKU exists. Check categoryId / policies in Seller Hub, or paste the kit. Sandbox category IDs can differ from production.",
        env: ebayEnv,
        sku,
        inventoryCreated: true,
        categoryId,
        status: offer.status,
        kv: kvNote,
      },
      502,
      headers
    );
  }

  const offerId = safeStr(offer.data && (offer.data.offerId || offer.data.offer_id));
  let listingId = "";
  let published = false;
  if (publish && offerId) {
    const pub = await ebayFetch(host, `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`, {
      method: "POST",
      token: tok.access_token,
    });
    if (pub.ok) {
      published = true;
      listingId = safeStr(pub.data && (pub.data.listingId || pub.data.listing_id));
    } else {
      const headers = {};
      if (setCookies[0]) headers["Set-Cookie"] = setCookies[0];
      return json(
        {
          ok: true,
          partial: true,
          error: "publish_failed",
          message:
            "Offer created but publish failed: " +
            String(
              (pub.data && (pub.data.errors?.[0]?.message || pub.data.error)) ||
                `publish_http_${pub.status}`
            ).slice(0, 200),
          nextStep: "Open Seller Hub → Offers to publish manually, or paste the kit.",
          env: ebayEnv,
          sku,
          offerId,
          inventoryCreated: true,
          offerCreated: true,
          published: false,
          kv: kvNote,
        },
        200,
        headers
      );
    }
  }

  const headers = {};
  if (setCookies[0]) headers["Set-Cookie"] = setCookies[0];
  // Append multiple Set-Cookie if needed later — single refresh cookie for now.

  return json(
    {
      ok: true,
      env: ebayEnv,
      sku,
      offerId,
      listingId: listingId || null,
      inventoryCreated: true,
      offerCreated: true,
      published,
      categoryId,
      marketplaceId,
      tokenSource,
      note: published
        ? "Listing published on eBay (" + ebayEnv + ")."
        : "Inventory + unpublished offer created. Set publish:true to go live, or publish in Seller Hub.",
      kv: kvNote,
    },
    200,
    headers
  );
}

/**
 * Usage/discovery response.
 *
 * This used to answer 200 to any caller with no session at all, which made the
 * route reachable anonymously and advertised its accepted body shape to
 * strangers. The help text is not secret, but there is also no reason for an
 * unauthenticated caller to have it, so it now sits behind the same session
 * gate as the POST that actually does work.
 */
export async function onRequestGet(context) {
  const auth = await requireAuth(context.request, context.env);
  if (!auth.ok) return auth.response;
  return json(
    {
      ok: true,
      method: "POST",
      usage:
        "POST JSON { title, description, price, brand, size, condition, category, color?, publish?, env? } with ebay_oauth_tok cookie from OAuth callback.",
    },
    200
  );
}
