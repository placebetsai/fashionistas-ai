/**
 * GET|POST /api/ebay/oauth/start
 * Builds and issues the eBay user-consent authorization request:
 *   https://auth.ebay.com/oauth2/authorize?client_id=...&redirect_uri=...
 *   &response_type=code&scope=...&state=...
 *
 * Credential order (never logged):
 *   1) BYO paste (X-Ebay-* headers, Authorization: EbayKeys ..., JSON body, ebay_byo_sess cookie)
 *   2) Cloudflare env EBAY_CLIENT_ID / EBAY_CLIENT_SECRET / EBAY_REDIRECT_URI
 *
 * Behavior when EBAY_CLIENT_ID is absent (declared contract, consistent for GET+POST):
 *   HTTP 400 JSON naming the missing env var. No redirect is issued with an empty
 *   client_id, because eBay would reject it anyway and a silent redirect hides the
 *   real blocker. (Etsy behaves differently on purpose — see etsy/oauth/start.js.)
 *
 * Response shape:
 *   - browser navigation (Accept: text/html)  -> 302 Location: auth.ebay.com/...
 *   - fetch/XHR or ?format=json               -> 200 { authorizeUrl, ... } (index.html contract)
 */

const DEFAULT_REDIRECT = "https://fashionistas.ai/api/ebay/oauth/callback";
const AUTH_HOST = "https://auth.ebay.com/oauth2/authorize";

// Exact consent scope string used for eBay production OAuth.
const EBAY_SCOPE =
  "https://api.ebay.com/oauth/api_scope " +
  "https://api.ebay.com/oauth/api_scope/sell.inventory " +
  "https://api.ebay.com/oauth/api_scope/sell.account";

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

function redirect(location, extraHeaders = {}) {
  return new Response(null, {
    status: 302,
    headers: { location, "cache-control": "no-store", ...extraHeaders },
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

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith(name + "=")) continue;
    return p.slice(name.length + 1);
  }
  return null;
}

function decodeJsonCookie(val) {
  if (!val) return null;
  try {
    const pad = val.length % 4 === 0 ? val : val + "=".repeat(4 - (val.length % 4));
    const jsonStr = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
    const o = JSON.parse(jsonStr);
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

function b64UrlDecodeStrict(raw) {
  if (!raw) return "";
  try {
    const pad = raw.length % 4 === 0 ? raw : raw + "=".repeat(4 - (raw.length % 4));
    return atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return "";
  }
}

async function readByoFromRequest(request) {
  const out = { clientId: "", clientSecret: "", redirectUri: "", env: "" };

  const hId = safeStr(request.headers.get("X-Ebay-Client-Id"));
  const hSec = safeStr(request.headers.get("X-Ebay-Client-Secret"));
  const hRed = safeStr(request.headers.get("X-Ebay-Redirect-Uri"));
  const hEnv = safeStr(request.headers.get("X-Ebay-Env"));
  if (hId) out.clientId = hId;
  if (hSec) out.clientSecret = hSec;
  if (hRed) out.redirectUri = hRed;
  if (hEnv) out.env = hEnv;

  const auth = safeStr(request.headers.get("Authorization"));
  if (auth.toLowerCase().startsWith("ebaykeys ")) {
    const o = decodeJsonCookie(b64UrlDecodeStrict(auth.slice(9).trim()));
    if (o) {
      if (!out.clientId) out.clientId = safeStr(o.clientId || o.client_id);
      if (!out.clientSecret) out.clientSecret = safeStr(o.clientSecret || o.client_secret);
      if (!out.redirectUri) out.redirectUri = safeStr(o.redirectUri || o.redirect_uri || o.ruName);
      if (!out.env) out.env = safeStr(o.env);
    }
  }

  const cookie = decodeJsonCookie(readCookie(request, "ebay_byo_sess"));
  if (cookie) {
    if (!out.clientId) out.clientId = safeStr(cookie.clientId);
    if (!out.clientSecret) out.clientSecret = safeStr(cookie.clientSecret);
    if (!out.redirectUri) out.redirectUri = safeStr(cookie.redirectUri);
    if (!out.env) out.env = safeStr(cookie.env);
  }

  if (request.method === "POST") {
    try {
      const ct = (request.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("application/json")) {
        const body = await request.json();
        if (body && typeof body === "object") {
          if (!out.clientId) out.clientId = safeStr(body.clientId || body.client_id);
          if (!out.clientSecret) out.clientSecret = safeStr(body.clientSecret || body.client_secret);
          if (!out.redirectUri)
            out.redirectUri = safeStr(body.redirectUri || body.redirect_uri || body.ruName);
          if (!out.env) out.env = safeStr(body.env);
        }
      }
    } catch {
      /* malformed body — fall through */
    }
  }

  return out;
}

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL(AUTH_HOST);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", EBAY_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function onRequestGet(context) {
  return handleStart(context);
}

export async function onRequestPost(context) {
  return handleStart(context);
}

async function handleStart(context) {
  const env = context.env || {};
  const request = context.request;
  const byo = await readByoFromRequest(request);

  const clientId = byo.clientId || safeStr(env.EBAY_CLIENT_ID);
  const clientSecret = byo.clientSecret || safeStr(env.EBAY_CLIENT_SECRET);
  const redirectUri =
    byo.redirectUri ||
    safeStr(env.EBAY_REDIRECT_URI) ||
    safeStr(env.EBAY_RU_NAME) ||
    DEFAULT_REDIRECT;

  if (!clientId) {
    return json(
      {
        ok: false,
        error: "missing_env_var",
        missing: ["EBAY_CLIENT_ID"],
        message:
          "eBay OAuth start aborted: EBAY_CLIENT_ID is not set on this deployment (and no BYO Client ID was pasted).",
        nextStep:
          "Set the Cloudflare Pages secret EBAY_CLIENT_ID (plus EBAY_CLIENT_SECRET) at https://developer.ebay.com/my/keys, or paste keys in Multilist → Connect eBay, then retry Connect OAuth.",
        redirectUri: redirectUri,
        scope: EBAY_SCOPE,
      },
      400
    );
  }

  if (!clientSecret) {
    return json(
      {
        ok: false,
        error: "missing_env_var",
        missing: ["EBAY_CLIENT_SECRET"],
        message:
          "eBay OAuth start aborted: EBAY_CLIENT_SECRET is not set — the callback cannot exchange the code without it.",
        nextStep: "Set the Cloudflare Pages secret EBAY_CLIENT_SECRET, then retry Connect OAuth.",
        redirectUri: redirectUri,
        scope: EBAY_SCOPE,
      },
      400
    );
  }

  const state = crypto.randomUUID();
  const authorizeUrl = buildAuthorizeUrl({ clientId, redirectUri, state });

  const extraHeaders = {};
  if (byo.clientId && byo.clientSecret) {
    const secure = (request.url || "").startsWith("https:") ? "; Secure" : "";
    extraHeaders["Set-Cookie"] =
      "ebay_byo_sess=" +
      b64urlEncode(
        JSON.stringify({
          clientId: byo.clientId,
          clientSecret: byo.clientSecret,
          redirectUri,
          env: byo.env || safeStr(env.EBAY_ENV) || "production",
        })
      ) +
      "; Path=/api/ebay/oauth; HttpOnly; SameSite=Lax; Max-Age=600" +
      secure;
  }

  const accept = (request.headers.get("Accept") || "").toLowerCase();
  const wantsJson =
    new URL(request.url).searchParams.get("format") === "json" ||
    request.headers.get("X-Requested-With") === "fetch" ||
    (!accept.includes("text/html") && accept.includes("*/*"));

  if (!wantsJson) {
    return redirect(authorizeUrl, extraHeaders);
  }

  return json(
    {
      ok: true,
      authorizeUrl,
      redirect_url: authorizeUrl,
      env: "production",
      scope: EBAY_SCOPE,
      redirectUri,
      state,
      source: byo.clientId ? "byo" : "env",
      note:
        "Open authorizeUrl to consent sell.inventory + sell.account scopes; the callback stores the tokens in D1 (ebay_tokens).",
    },
    200,
    extraHeaders
  );
}
