/**
 * GET /api/etsy/oauth/callback
 * Exchanges the Etsy authorization code for access + refresh tokens and stores
 * them DURABLY in D1 (table etsy_tokens, CREATE TABLE IF NOT EXISTS).
 * Verifies the CSRF state cookie set by /api/etsy/oauth/start.
 *
 * Token endpoint: POST https://api.etsy.com/v3/public/oauth/token
 *   grant_type=authorization_code | refresh_token, header x-api-key: ETSY_API_KEY
 * Proactive refresh: tokens expiring within 5 minutes are refreshed before use.
 * Never logs the app key, secret, or tokens.
 */

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const DEFAULT_REDIRECT = "https://fashionistas.ai/api/etsy/oauth/callback";
const REFRESH_SKEW_MS = 5 * 60 * 1000;

const TOKEN_SCHEMA = `CREATE TABLE IF NOT EXISTS etsy_tokens (
  token_key TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  shop_id TEXT,
  updated_at INTEGER
)`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function redirect(location, setCookies = []) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
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

function clearCookie(name, path) {
  return `${name}=; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function pickDb(env) {
  if (!env || typeof env !== "object") return null;
  for (const n of ["DB", "FASHIONISTAS_DB", "ETSY_DB", "ETSY_TOKENS_DB", "D1"]) {
    const db = env[n];
    if (db && typeof db.prepare === "function" && typeof db.bind === "function") return db;
  }
  return null;
}

async function ensureTable(db) {
  await db.prepare(TOKEN_SCHEMA).run();
}

function tokenKey(request) {
  for (const name of ["fash_uid", "fash_user_id", "fash_session", "fash_connect_v1"]) {
    const v = safeStr(readCookie(request, name));
    if (v) return "u:" + v.slice(0, 120);
  }
  return "anon";
}

export async function saveEtsyTokens(db, key, tok) {
  await ensureTable(db);
  await db
    .prepare(
      `INSERT INTO etsy_tokens (token_key, access_token, refresh_token, expires_at, token_type, shop_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(token_key) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         token_type = excluded.token_type,
         shop_id = excluded.shop_id,
         updated_at = excluded.updated_at`
    )
    .bind(
      key,
      tok.access_token || "",
      tok.refresh_token || "",
      Number(tok.expires_at) || 0,
      tok.token_type || "bearer",
      tok.shop_id || "",
      Date.now()
    )
    .run();
}

async function readEtsyTokens(db, key) {
  const row = await db
    .prepare(
      "SELECT access_token, refresh_token, expires_at, token_type, shop_id FROM etsy_tokens WHERE token_key = ?"
    )
    .bind(key)
    .first();
  if (!row) return null;
  return {
    access_token: row.access_token || "",
    refresh_token: row.refresh_token || "",
    expires_at: Number(row.expires_at) || 0,
    token_type: row.token_type || "bearer",
    shop_id: row.shop_id || "",
  };
}

/**
 * Durable read + proactive refresh (skew 5 min).
 * Returns { ok, token, refreshed } or { ok:false, error }.
 */
export async function getFreshEtsyToken(db, key, apiKey) {
  const tok = await readEtsyTokens(db, key);
  if (!tok || !tok.access_token) return { ok: false, error: "no_stored_etsy_token" };
  if (tok.expires_at - Date.now() > REFRESH_SKEW_MS) {
    return { ok: true, token: tok, refreshed: false };
  }
  if (!tok.refresh_token) return { ok: false, error: "access_token_expired_no_refresh_token" };
  if (!apiKey) return { ok: false, error: "missing_env_var:ETSY_API_KEY" };

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-api-key": apiKey,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tok.refresh_token,
    }).toString(),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data || !data.access_token) {
    const err = (data && (data.error_description || data.error)) || `etsy_refresh_http_${res.status}`;
    return { ok: false, error: String(err).slice(0, 200) };
  }

  const next = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || tok.refresh_token,
    expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    token_type: data.token_type || "bearer",
    shop_id: tok.shop_id,
  };
  try {
    await saveEtsyTokens(db, key, next);
  } catch {
    return { ok: false, error: "etsy_refresh_persist_failed" };
  }
  return { ok: true, token: next, refreshed: true };
}

async function exchangeCode({ apiKey, code, redirectUri }) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-api-key": apiKey,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data || !data.access_token) {
    const err =
      (data && (data.error_description || data.error || data.details)) ||
      `etsy_token_exchange_http_${res.status}`;
    return { ok: false, error: String(err).slice(0, 200) };
  }
  return {
    ok: true,
    access_token: data.access_token,
    refresh_token: data.refresh_token || "",
    expires_in: Number(data.expires_in) || 3600,
    token_type: data.token_type || "bearer",
    shop_id: safeStr(data.shop_id),
    user_id: safeStr(data.user_id),
  };
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const req = context.request;
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;

  const apiKey = safeStr(env.ETSY_API_KEY);
  const apiSecret = safeStr(env.ETSY_API_SECRET);
  const redirectUri = safeStr(env.ETSY_REDIRECT_URI) || DEFAULT_REDIRECT;
  const code = url.searchParams.get("code");
  const errParam = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const expectedState = decodeURIComponent(safeStr(readCookie(req, "etsy_oauth_state")));

  const fail = (why) =>
    redirect(`${origin}/?etsy_oauth=error&etsy_error=${encodeURIComponent(why)}`, [
      clearCookie("etsy_oauth_state", "/api/etsy/oauth"),
    ]);

  if (errParam) return fail(errParam);
  if (!apiKey) return fail("missing_env_var_ETSY_API_KEY");
  if (!apiSecret) return fail("missing_env_var_ETSY_API_SECRET");
  if (!code) return fail("missing_code");
  if (!state || (expectedState && state !== expectedState)) return fail("state_mismatch");

  let result;
  try {
    result = await exchangeCode({ apiKey, code, redirectUri });
  } catch {
    return fail("etsy_token_exchange_network_error");
  }
  if (!result.ok) return fail(result.error);

  const tok = {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: Date.now() + result.expires_in * 1000,
    token_type: result.token_type,
    shop_id: result.shop_id,
  };

  const key = tokenKey(req);
  const db = pickDb(env);
  let stored = "d1_binding_missing";
  if (db) {
    try {
      await saveEtsyTokens(db, key, tok);
      stored = "d1";
    } catch (e) {
      stored = "d1_error:" + String(e && e.message ? e.message : e).slice(0, 80);
    }
  }

  if (url.searchParams.get("format") === "json") {
    return json({
      ok: true,
      connected: true,
      hasAccessToken: true,
      hasRefreshToken: !!tok.refresh_token,
      shopId: tok.shop_id || null,
      userId: result.user_id || null,
      expiresAt: tok.expires_at,
      tokenStore: stored,
    });
  }

  return redirect(`${origin}/?etsy_oauth=ok`, [
    clearCookie("etsy_oauth_state", "/api/etsy/oauth"),
  ]);
}
