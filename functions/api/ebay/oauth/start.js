/**
 * GET|POST /api/ebay/oauth/start
 * Builds eBay authorize URL when Client ID + redirect/RuName are available.
 *
 * Credential order (never logged):
 * 1) Request BYO: POST JSON, Authorization: EbayKeys <base64url(json)>, or X-Ebay-* headers
 * 2) Cloudflare env: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_REDIRECT_URI / EBAY_RU_NAME
 *
 * When BYO secret is present, sets a short-lived HttpOnly cookie for the callback
 * round-trip only (Path=/api/ebay/oauth). See docs/EBAY_OAUTH.md.
 */

const BYO_COOKIE = "ebay_byo_sess";
const DEFAULT_REDIRECT = "https://fashionistas.ai/api/ebay/oauth/callback";

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

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

async function readByoFromRequest(request) {
  const out = {
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    env: "",
  };

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
    try {
      const raw = auth.slice(9).trim();
      const pad = raw.length % 4 === 0 ? raw : raw + "=".repeat(4 - (raw.length % 4));
      const jsonStr = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
      const o = JSON.parse(jsonStr);
      if (o && typeof o === "object") {
        if (!out.clientId) out.clientId = safeStr(o.clientId || o.client_id);
        if (!out.clientSecret) out.clientSecret = safeStr(o.clientSecret || o.client_secret);
        if (!out.redirectUri) out.redirectUri = safeStr(o.redirectUri || o.redirect_uri || o.ruName);
        if (!out.env) out.env = safeStr(o.env);
      }
    } catch {
      /* ignore malformed BYO auth — fall through to body/env */
    }
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
      /* ignore bad JSON */
    }
  }

  return out;
}

function resolveCreds(env, byo) {
  const clientId = byo.clientId || safeStr(env.EBAY_CLIENT_ID);
  const clientSecret = byo.clientSecret || safeStr(env.EBAY_CLIENT_SECRET);
  const redirectUri =
    byo.redirectUri ||
    safeStr(env.EBAY_REDIRECT_URI) ||
    safeStr(env.EBAY_RU_NAME) ||
    "";
  const ebayEnv = (byo.env || safeStr(env.EBAY_ENV) || "").toLowerCase();
  const source = byo.clientId ? "byo" : clientId ? "env" : "none";
  return { clientId, clientSecret, redirectUri, ebayEnv, source };
}

async function handleStart(context) {
  const env = context.env || {};
  const byo = await readByoFromRequest(context.request);
  const creds = resolveCreds(env, byo);

  if (!creds.clientId || !creds.redirectUri) {
    return json(
      {
        ok: false,
        error: "ebay_oauth_not_configured",
        message:
          "eBay OAuth needs a Client ID and redirect URI / RuName. Paste your keys in Multilist → Connect eBay (saved in this browser), or set Cloudflare secrets EBAY_CLIENT_ID + EBAY_REDIRECT_URI. Paste multilist still works.",
        nextStep:
          "Create an app at developer.ebay.com → register RuName with redirect https://fashionistas.ai/api/ebay/oauth/callback → paste Client ID + Secret here → Save → Connect OAuth.",
        redirectUriHint: DEFAULT_REDIRECT,
        missing: [
          !creds.clientId ? "EBAY_CLIENT_ID (or BYO clientId)" : null,
          !creds.clientSecret ? "EBAY_CLIENT_SECRET (or BYO clientSecret) — needed for token exchange on callback" : null,
          !creds.redirectUri ? "EBAY_REDIRECT_URI / EBAY_RU_NAME (or BYO redirectUri)" : null,
        ].filter(Boolean),
      },
      501
    );
  }

  const authHost =
    creds.ebayEnv === "production"
      ? "https://auth.ebay.com/oauth2/authorize"
      : "https://auth.sandbox.ebay.com/oauth2/authorize";

  const state = crypto.randomUUID();
  const url = new URL(authHost);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("state", state);
  // sell.inventory + sell.account needed for listing create; users must re-consent after scope change.
  const scopes = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  ].join(" ");
  url.searchParams.set("scope", scopes);

  const extraHeaders = {};
  // Round-trip BYO secret to callback via HttpOnly cookie (10 min). Never log.
  if (byo.clientId && byo.clientSecret) {
    const payload = b64urlEncode(
      JSON.stringify({
        clientId: byo.clientId,
        clientSecret: byo.clientSecret,
        redirectUri: creds.redirectUri,
        env: creds.ebayEnv || "sandbox",
      })
    );
    const secure =
      (context.request.url || "").startsWith("https:") ? "; Secure" : "";
    extraHeaders["Set-Cookie"] =
      `${BYO_COOKIE}=${payload}; Path=/api/ebay/oauth; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
  }

  return json(
    {
      ok: true,
      authorizeUrl: url.toString(),
      env: creds.ebayEnv || "sandbox-default",
      source: creds.source,
      note:
        "Authorize on eBay with sell.inventory + sell.account scopes; callback exchanges the code. Then Multilist can POST /api/ebay/listing. Secrets were not logged.",
    },
    200,
    extraHeaders
  );
}

export async function onRequestGet(context) {
  return handleStart(context);
}

export async function onRequestPost(context) {
  return handleStart(context);
}
