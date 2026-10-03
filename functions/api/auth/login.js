/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Re-derives PBKDF2-SHA256 over the stored per-user salt, compares in constant
 * time, then issues a 32-byte random session token stored in the D1 `sessions`
 * table (30 day expiry) and returned as an HttpOnly; Secure; SameSite=Lax
 * cookie. Never logs or echoes the password or the token.
 *
 * Schema is adapted to the table that already exists (see libs/auth-db.js).
 */

import { getDB, ensureAuthSchema, findByEmail } from "../../../libs/auth-db.js";

const MIN_PASSWORD = 6;
// Cloudflare's Workers WebCrypto rejects iteration counts above 100000.
const DEFAULT_ITERATIONS = 100000;

const SESSION_COOKIE = "fash_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

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

/** Stored format: pbkdf2-sha256$<iterations>$<hex> */
function parseStoredHash(stored) {
  const raw = String(stored || "");
  const parts = raw.split("$");
  if (parts.length === 3 && parts[0] === "pbkdf2-sha256") {
    const iterations = parseInt(parts[1], 10);
    if (Number.isFinite(iterations) && iterations >= 100000) {
      return { iterations, hex: parts[2] };
    }
  }
  if (/^[0-9a-f]+$/i.test(raw)) {
    return { iterations: DEFAULT_ITERATIONS, hex: raw };
  }
  return null;
}

async function deriveHash(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
}

function timingSafeEqual(a, b) {
  const bufA = new TextEncoder().encode(String(a || ""));
  const bufB = new TextEncoder().encode(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDB(env);
  if (!db) {
    return json({ error: "Server not configured: no D1 binding found on this Pages project (tried DB, FASHIONISTAS_DB, EBAY_DB, EBAY_TOKENS_DB, D1). Set the binding named DB." }, 500);
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be JSON: { email, password }" }, 400);
  }

  const email = typeof (body && body.email) === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof (body && body.password) === "string" ? body.password : "";

  if (!email || !password || password.length < MIN_PASSWORD) {
    return json({ error: "Invalid email or password." }, 401);
  }

  try {
    await ensureAuthSchema(db);

    const user = await findByEmail(db, email);

    if (!user) {
      return json({ error: "Invalid email or password." }, 401);
    }

    // Rows written by the older Worker only have `password_hash`.
    const stored = user.pass_hash || user.password_hash;
    const parsed = parseStoredHash(stored);
    if (!parsed || !user.salt) {
      return json({ error: "Invalid email or password." }, 401);
    }

    const candidate = await deriveHash(password, user.salt, parsed.iterations);
    if (!timingSafeEqual(candidate, parsed.hex)) {
      return json({ error: "Invalid email or password." }, 401);
    }

    const token = randomHex(32);
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    await db
      .prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
      .bind(user.id, token, expiresAt)
      .run();

    // Opportunistic cleanup of expired rows (best effort).
    try {
      await db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Math.floor(Date.now() / 1000)).run();
    } catch {
      /* ignore */
    }

    return json(
      { ok: true, id: user.id, email: user.email },
      200,
      { "set-cookie": sessionCookie(token) }
    );
  } catch (err) {
    return json(
      { error: "Could not sign in.", detail: String((err && err.message) || err) },
      500
    );
  }
}

export async function onRequest() {
  return json({ error: "Method not allowed. Use POST." }, 405);
}
