/**
 * GET /api/auth/google
 * Google OAuth sign-in, start + callback in one route (no hardcoded credentials).
 *
 * Start  : no `code` -> 302 to accounts.google.com with a CSRF `state`
 *          pinned in a short-lived HttpOnly cookie.
 * Callback: `code` + `state` -> exchange at oauth2.googleapis.com/token,
 *          read the verified-ish id_token payload (or /userinfo fallback),
 *          upsert the D1 `users` row, create a D1 `sessions` row and set the
 *          fash_session cookie before bouncing back to the app.
 *
 * Required env (Pages -> Settings -> Environment variables):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 * Optional:
 *   GOOGLE_REDIRECT_URI (defaults to <origin>/api/auth/google)
 *
 * If a variable is missing we return a clear JSON error naming it instead of
 * falling back to any baked-in value.
 */

const SESSION_COOKIE = "fash_session";
const STATE_COOKIE = "fash_gstate";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const STATE_TTL_SECONDS = 600;
const SALT_BYTES = 16;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function redirect(location, setCookies = []) {
  const headers = new Headers({ Location: location, "cache-control": "no-store" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex) {
  const clean = String(hex || "");
  if (!clean || clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toHex(buf);
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

function timingSafeEqual(a, b) {
  const bufA = new TextEncoder().encode(String(a || ""));
  const bufB = new TextEncoder().encode(String(b || ""));
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

function stateCookie(state) {
  return `${STATE_COOKIE}=${state}; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}`;
}

function clearStateCookie() {
  return `${STATE_COOKIE}=; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** First binding on env that actually looks like a D1 database (`DB` is canonical). */
function getDB(env) {
  for (const name of ["DB", "FASHIONISTAS_DB", "EBAY_DB", "EBAY_TOKENS_DB", "D1"]) {
    const candidate = env ? env[name] : null;
    if (candidate && typeof candidate.prepare === "function") return candidate;
  }
  return null;
}

async function ensureSchema(db) {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const sql of stmts) {
    try {
      await db.prepare(sql).run();
    } catch (err) {
      const msg = String((err && err.message) || err);
      if (!/already exists/i.test(msg)) throw err;
    }
  }
}

function base64urlDecodeToString(value) {
  try {
    const pad = value.length % 4 === 0 ? value : value + "=".repeat(4 - (value.length % 4));
    const bin = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function emailFromIdToken(idToken) {
  const parts = String(idToken || "").split(".");
  if (parts.length < 2) return "";
  const payload = base64urlDecodeToString(parts[1]);
  if (!payload) return "";
  try {
    const obj = JSON.parse(payload);
    return typeof obj.email === "string" ? obj.email.trim().toLowerCase() : "";
  } catch {
    return "";
  }
}

async function upsertUser(db, email) {
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return existing.id;

  // OAuth account: no local password — store a random, unusable credential so
  // the NOT NULL constraints are met and password login cannot be forced.
  const salt = randomHex(SALT_BYTES);
  const randomSecret = randomHex(32);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(randomSecret),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(salt), iterations: 120000, hash: "SHA-256" },
    key,
    256
  );
  const passHash = `pbkdf2-sha256$120000$${toHex(bits)}`;

  try {
    const res = await db
      .prepare("INSERT INTO users (email, pass_hash, salt) VALUES (?, ?, ?)")
      .bind(email, passHash, salt)
      .run();
    if (res && res.meta && typeof res.meta.last_row_id === "number") return res.meta.last_row_id;
  } catch (err) {
    if (!/unique|constraint/i.test(String((err && err.message) || err))) throw err;
  }
  const again = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  return again ? again.id : null;
}

function missingEnv(name) {
  return json(
    {
      error: `Missing environment variable ${name}. Set it in Cloudflare Pages → Settings → Environment variables, then redeploy. No client id or secret is hardcoded in this repo.`,
      missing: name,
    },
    500
  );
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const clientId = typeof env.GOOGLE_CLIENT_ID === "string" ? env.GOOGLE_CLIENT_ID.trim() : "";
  const clientSecret =
    typeof env.GOOGLE_CLIENT_SECRET === "string" ? env.GOOGLE_CLIENT_SECRET.trim() : "";

  if (!clientId) return missingEnv("GOOGLE_CLIENT_ID");

  const redirectUri =
    (typeof env.GOOGLE_REDIRECT_URI === "string" && env.GOOGLE_REDIRECT_URI.trim()) ||
    `${url.origin}/api/auth/google`;
  const code = url.searchParams.get("code") || "";
  const returnedState = url.searchParams.get("state") || "";

  // ---- Start: send the user to Google -------------------------------------
  if (!code) {
    const state = randomHex(16);
    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
      }).toString();
    return redirect(authUrl, [stateCookie(state)]);
  }

  // ---- Callback: verify state, exchange the code --------------------------
  const cookieState = readCookie(request, STATE_COOKIE);
  if (!returnedState || !cookieState || !timingSafeEqual(returnedState, cookieState)) {
    return json({ error: "Google sign-in state mismatch. Please try again." }, 400);
  }

  if (!clientSecret) return missingEnv("GOOGLE_CLIENT_SECRET");

  let tokenJson = null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    tokenJson = await res.json();
  } catch (err) {
    return json({ error: "Google token exchange failed.", detail: String((err && err.message) || err) }, 502);
  }

  if (!tokenJson || !tokenJson.access_token) {
    const desc = tokenJson && (tokenJson.error_description || tokenJson.error);
    return json({ error: "Google token exchange failed.", detail: desc || "no access_token" }, 502);
  }

  let email = emailFromIdToken(tokenJson.id_token);
  if (!email) {
    try {
      const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${tokenJson.access_token}` },
      });
      const uiJson = await ui.json();
      if (uiJson && typeof uiJson.email === "string") email = uiJson.email.trim().toLowerCase();
    } catch {
      /* fall through */
    }
  }

  if (!email) {
    return json({ error: "Google did not return an email address for this account." }, 502);
  }

  const db = getDB(env);
  if (!db) {
    return json({ error: "Server not configured: no D1 binding found on this Pages project (tried DB, FASHIONISTAS_DB, EBAY_DB, EBAY_TOKENS_DB, D1). Set the binding named DB." }, 500);
  }

  try {
    await ensureSchema(db);
    const userId = await upsertUser(db, email);
    if (!userId) {
      return json({ error: "Could not create or find the local account." }, 500);
    }

    const token = randomHex(32);
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    await db
      .prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
      .bind(userId, token, expiresAt)
      .run();

    return redirect(`${url.origin}/?auth=google_ok`, [sessionCookie(token), clearStateCookie()]);
  } catch (err) {
    return json(
      { error: "Could not create the session.", detail: String((err && err.message) || err) },
      500
    );
  }
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
