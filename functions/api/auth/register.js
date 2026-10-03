/**
 * POST /api/auth/register
 * Body: { email, password }
 *
 * Validates email shape + password length, then stores the account in the D1
 * `users` table as PBKDF2-SHA256 (120k iterations) over a fresh 16-byte random
 * salt. The derived hash is stored as `pbkdf2-sha256$<iterations>$<hex>` so the
 * cost parameter travels with the row. Never logs or echoes the password.
 *
 * Tables are created lazily (CREATE TABLE IF NOT EXISTS) — no migration file.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 256;
const ITERATIONS = 120000; // >= 100k as required
const SALT_BYTES = 16;

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
  return `pbkdf2-sha256$${iterations}$${toHex(bits)}`;
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

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) {
    return json({ error: "Server not configured: D1 binding `DB` is missing on this Pages project." }, 500);
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be JSON: { email, password }" }, 400);
  }

  const email = typeof (body && body.email) === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof (body && body.password) === "string" ? body.password : "";

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: "A valid email address is required." }, 400);
  }
  if (password.length < MIN_PASSWORD) {
    return json({ error: `Password must be at least ${MIN_PASSWORD} characters.` }, 400);
  }
  if (password.length > MAX_PASSWORD) {
    return json({ error: `Password must be at most ${MAX_PASSWORD} characters.` }, 400);
  }

  try {
    await ensureSchema(db);

    const existing = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();
    if (existing) {
      return json({ error: "An account with that email already exists." }, 409);
    }

    const salt = randomHex(SALT_BYTES);
    const passHash = await deriveHash(password, salt, ITERATIONS);

    let result;
    try {
      result = await db
        .prepare("INSERT INTO users (email, pass_hash, salt) VALUES (?, ?, ?)")
        .bind(email, passHash, salt)
        .run();
    } catch (err) {
      if (/unique|constraint/i.test(String((err && err.message) || err))) {
        return json({ error: "An account with that email already exists." }, 409);
      }
      throw err;
    }

    const id =
      (result && result.meta && typeof result.meta.last_row_id === "number")
        ? result.meta.last_row_id
        : null;

    return json({ ok: true, id, email, message: "Account created. You can sign in now." }, 201);
  } catch (err) {
    return json(
      { error: "Could not create the account.", detail: String((err && err.message) || err) },
      500
    );
  }
}

export async function onRequest() {
  return json({ error: "Method not allowed. Use POST." }, 405);
}
