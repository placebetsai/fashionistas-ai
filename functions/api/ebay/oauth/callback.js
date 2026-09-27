/**
 * GET /api/ebay/oauth/callback
 * Exchanges authorization code for tokens when BYO cookie or Cloudflare env keys are present.
 * Sets Connected via redirect ?ebay_oauth=ok (client updates fash_connect_v1).
 * Stores tokens in HttpOnly cookie for future listing-create (not implemented yet).
 * Never logs client secret or tokens. See docs/EBAY_OAUTH.md.
 */

const BYO_COOKIE = "ebay_byo_sess";
const TOK_COOKIE = "ebay_oauth_tok";

function redirect(location, setCookies = []) {
  const headers = new Headers({ Location: location, "cache-control": "no-store" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function clearByoCookie() {
  return `${BYO_COOKIE}=; Path=/api/ebay/oauth; HttpOnly; SameSite=Lax; Max-Age=0`;
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

function readByoCookie(request) {
  const raw = request.headers.get("Cookie") || "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.startsWith(BYO_COOKIE + "=")) continue;
    const val = p.slice(BYO_COOKIE.length + 1);
    try {
      const pad = val.length % 4 === 0 ? val : val + "=".repeat(4 - (val.length % 4));
      const jsonStr = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
      const o = JSON.parse(jsonStr);
      if (o && typeof o === "object") {
        return {
          clientId: safeStr(o.clientId),
          clientSecret: safeStr(o.clientSecret),
          redirectUri: safeStr(o.redirectUri),
          env: safeStr(o.env),
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

function basicAuthHeader(clientId, clientSecret) {
  const raw = `${clientId}:${clientSecret}`;
  const bytes = new TextEncoder().encode(raw);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "Basic " + btoa(bin);
}

async function exchangeCode({ clientId, clientSecret, redirectUri, ebayEnv, code }) {
  const tokenHost =
    ebayEnv === "production"
      ? "https://api.ebay.com/identity/v1/oauth2/token"
      : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

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
      `token_exchange_http_${res.status}`;
    return { ok: false, error: String(err).slice(0, 180) };
  }

  return {
    ok: true,
    access_token: data.access_token,
    refresh_token: data.refresh_token || "",
    expires_in: Number(data.expires_in) || 7200,
    token_type: data.token_type || "Bearer",
  };
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const reqUrl = new URL(context.request.url);
  const code = reqUrl.searchParams.get("code");
  const err = reqUrl.searchParams.get("error");
  const origin = `${reqUrl.protocol}//${reqUrl.host}`;
  const secure = (context.request.url || "").startsWith("https:") ? "; Secure" : "";

  if (err) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(err)}`,
      [clearByoCookie()]
    );
  }

  const byo = readByoCookie(context.request);
  const clientId = (byo && byo.clientId) || safeStr(env.EBAY_CLIENT_ID) || "";
  const clientSecret =
    (byo && byo.clientSecret) || safeStr(env.EBAY_CLIENT_SECRET) || "";
  const redirectUri =
    (byo && byo.redirectUri) ||
    safeStr(env.EBAY_REDIRECT_URI) ||
    safeStr(env.EBAY_RU_NAME) ||
    "";
  const ebayEnv = (
    (byo && byo.env) ||
    safeStr(env.EBAY_ENV) ||
    "sandbox"
  ).toLowerCase() === "production"
    ? "production"
    : "sandbox";

  if (!clientId || !clientSecret) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(
        "missing_keys_set_env_or_paste_BYO_in_Connect_panel_then_retry"
      )}`,
      [clearByoCookie()]
    );
  }

  if (!redirectUri) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(
        "missing_redirect_uri_or_RuName"
      )}`,
      [clearByoCookie()]
    );
  }

  if (!code) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent("missing_code")}`,
      [clearByoCookie()]
    );
  }

  let result;
  try {
    result = await exchangeCode({
      clientId,
      clientSecret,
      redirectUri,
      ebayEnv,
      code,
    });
  } catch {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(
        "token_exchange_network_error"
      )}`,
      [clearByoCookie()]
    );
  }

  if (!result.ok) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(result.error)}`,
      [clearByoCookie()]
    );
  }

  // Persist tokens for future listing-create (HttpOnly; not logged).
  // Max-Age ~ refresh window; access_token also carries expires_in.
  const tokPayload = b64urlEncode(
    JSON.stringify({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
      token_type: result.token_type,
      env: ebayEnv,
      obtained_at: Date.now(),
    })
  );
  const maxAge = Math.max(3600, Number(result.expires_in) || 7200);
  const tokCookie =
    `${TOK_COOKIE}=${tokPayload}; Path=/api/ebay; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;

  return redirect(`${origin}/?ebay_oauth=ok`, [clearByoCookie(), tokCookie]);
}
