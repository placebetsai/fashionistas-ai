/**
 * GET /api/ebay/oauth/callback
 * Exchanges the eBay authorization code for access + refresh tokens and stores
 * them DURABLY in D1 (table ebay_tokens, CREATE TABLE IF NOT EXISTS), so the
 * server can refresh on its own instead of relying on a browser cookie.
 *
 * Cookie (ebay_oauth_tok) is still set for backward compatibility with
 * /api/ebay/listing, but D1 is the source of truth.
 * Proactive refresh: any token expiring within 5 minutes is refreshed before use.
 * Never logs client secret or tokens.
 */

const TOK_COOKIE = "ebay_oauth_tok";
const REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh when < 5 min left

const DEFAULT_REDIRECT = "https://fashionistas.ai/api/ebay/oauth/callback";

const REFRESH_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
].join(" ");

function redirect(location, setCookies = []) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
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

function basicAuthHeader(clientId, clientSecret) {
  const raw = `${clientId}:${clientSecret}`;
  const bytes = new TextEncoder().encode(raw);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "Basic " + btoa(bin);
}

function pickDb(env) {
  if (!env || typeof env !== "object") return null;
  for (const n of ["DB", "FASHIONISTAS_DB", "EBAY_DB", "EBAY_TOKENS_DB", "D1"]) {
    const db = env[n];
    if (db && typeof db.prepare === "function" && typeof db.bind === "function") return db;
  }
  return null;
}

const SCHEMA = `CREATE TABLE IF NOT EXISTS ebay_tokens (
  token_key TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  env TEXT,
  scopes TEXT,
  updated_at INTEGER
)`;

async function ensureTable(db) {
  await db.prepare(SCHEMA).run();
}

/** Stable key for the signed-in user when an auth cookie exists, else anonymous. */
function tokenKey(request) {
  const candidates = ["fash_uid", "fash_user_id", "fash_session", "fash_connect_v1"];
  for (const c of candidates) {
    const v = safeStr(readCookie(request, c));
    if (v) return "u:" + v.slice(0, 120);
  }
  return "anon";
}

async function saveTokens(db, key, tok) {
  await db
    .prepare(
      `INSERT INTO ebay_tokens (token_key, access_token, refresh_token, expires_at, token_type, env, scopes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(token_key) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         token_type = excluded.token_type,
         env = excluded.env,
         scopes = excluded.scopes,
         updated_at = excluded.updated_at`
    )
    .bind(
      key,
      tok.access_token || "",
      tok.refresh_token || "",
      Number(tok.expires_at) || 0,
      tok.token_type || "Bearer",
      tok.env || "production",
      tok.scopes || REFRESH_SCOPES,
      Date.now()
    )
    .run();
}

async function readTokens(db, key) {
  const row = await db
    .prepare(
      "SELECT access_token, refresh_token, expires_at, token_type, env, scopes FROM ebay_tokens WHERE token_key = ?"
    )
    .bind(key)
    .first();
  if (!row) return null;
  return {
    access_token: row.access_token || "",
    refresh_token: row.refresh_token || "",
    expires_at: Number(row.expires_at) || 0,
    token_type: row.token_type || "Bearer",
    env: row.env || "production",
    scopes: row.scopes || REFRESH_SCOPES,
  };
}

/**
 * Proactive refresh: returns a usable access token, refreshing first when the
 * stored one expires within REFRESH_SKEW_MS. Returns { ok, ... } always.
 */
export async function getFreshToken(db, key, { clientId, clientSecret, ebayEnv }) {
  const tok = await readTokens(db, key);
  if (!tok || !tok.access_token) return { ok: false, error: "no_stored_ebay_token" };

  const msLeft = tok.expires_at - Date.now();
  if (msLeft > REFRESH_SKEW_MS) return { ok: true, token: tok, refreshed: false };
  if (!tok.refresh_token) return { ok: false, error: "access_token_expired_no_refresh_token" };
  if (!clientId || !clientSecret) return { ok: false, error: "missing_env_var:EBAY_CLIENT_SECRET" };

  const tokenHost =
    ebayEnv === "production"
      ? "https://api.ebay.com/identity/v1/oauth2/token"
      : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", tok.refresh_token);
  body.set("scope", tok.scopes || REFRESH_SCOPES);

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
      (data && (data.error_description || data.error)) || `refresh_http_${res.status}`;
    return { ok: false, error: String(err).slice(0, 200) };
  }

  const next = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || tok.refresh_token,
    expires_at: Date.now() + (Number(data.expires_in) || 7200) * 1000,
    token_type: data.token_type || "Bearer",
    env: tok.env,
    scopes: tok.scopes,
  };
  try {
    await saveTokens(db, key, next);
  } catch {
    return { ok: false, error: "refresh_persist_failed" };
  }
  return { ok: true, token: next, refreshed: true };
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
      (data && (data.error_description || data.error)) || `token_exchange_http_${res.status}`;
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
  const req = context.request;
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get("code");
  const err = reqUrl.searchParams.get("error");
  const origin = `${reqUrl.protocol}//${reqUrl.host}`;
  const secure = (req.url || "").startsWith("https:") ? "; Secure" : "";

  const byo = decodeJsonCookie(readCookie(req, "ebay_byo_sess"));
  const clientId = (byo && byo.clientId) || safeStr(env.EBAY_CLIENT_ID);
  const clientSecret = (byo && byo.clientSecret) || safeStr(env.EBAY_CLIENT_SECRET);
  const redirectUri =
    (byo && byo.redirectUri) ||
    safeStr(env.EBAY_REDIRECT_URI) ||
    safeStr(env.EBAY_RU_NAME) ||
    DEFAULT_REDIRECT;
  const ebayEnv =
    ((byo && byo.env) || safeStr(env.EBAY_ENV) || "production").toLowerCase() === "sandbox"
      ? "sandbox"
      : "production";

  const fail = (why) =>
    redirect(`${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(why)}`);

  if (err) return fail(err);
  if (!clientId || !clientSecret) return fail("missing_env_var_EBAY_CLIENT_ID_or_EBAY_CLIENT_SECRET");
  if (!redirectUri) return fail("missing_redirect_uri_or_RuName");
  if (!code) return fail("missing_code");

  let result;
  try {
    result = await exchangeCode({ clientId, clientSecret, redirectUri, ebayEnv, code });
  } catch {
    return fail("token_exchange_network_error");
  }
  if (!result.ok) return fail(result.error);

  const now = Date.now();
  const tok = {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: now + result.expires_in * 1000,
    token_type: result.token_type,
    env: ebayEnv,
    scopes: REFRESH_SCOPES,
  };

  const key = tokenKey(req);
  const db = pickDb(env);
  let stored = "d1_binding_missing";
  if (db) {
    try {
      await ensureTable(db);
      await saveTokens(db, key, tok);
      stored = "d1";
    } catch (e) {
      stored = "d1_error:" + String(e && e.message ? e.message : e).slice(0, 80);
    }
  }

  // Legacy cookie so older clients keep working; D1 row is authoritative.
  const tokPayload = b64urlEncode(
    JSON.stringify({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_in: result.expires_in,
      token_type: tok.token_type,
      env: ebayEnv,
      obtained_at: now,
    })
  );
  const maxAge = tok.refresh_token ? 7776000 : Math.max(3600, result.expires_in);
  const tokCookie = `${TOK_COOKIE}=${tokPayload}; Path=/api/ebay; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  const clearByo = `ebay_byo_sess=; Path=/api/ebay/oauth; HttpOnly; SameSite=Lax; Max-Age=0`;

  if (reqUrl.searchParams.get("format") === "json") {
    return json({
      ok: true,
      connected: true,
      env: ebayEnv,
      hasAccessToken: true,
      hasRefreshToken: !!tok.refresh_token,
      expiresAt: tok.expires_at,
      tokenStore: stored,
      tokenKeyScope: key === "anon" ? "anonymous" : "user",
    });
  }

  return redirect(`${origin}/?ebay_oauth=ok`, [clearByo, tokCookie]);
}
