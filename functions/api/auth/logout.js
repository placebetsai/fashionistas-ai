/**
 * POST /api/auth/logout
 * Deletes the D1 session row for the fash_session cookie and clears the cookie
 * (Max-Age=0). Safe to call when not signed in — always 200.
 */

const SESSION_COOKIE = "fash_session";

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

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith(name + "=")) continue;
    return p.slice(name.length + 1);
  }
  return null;
}

function clearedCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function ensureSchema(db) {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      )
      .run();
  } catch (err) {
    const msg = String((err && err.message) || err);
    if (!/already exists/i.test(msg)) throw err;
  }
}

async function handle(context) {
  const { request, env } = context;
  const token = readCookie(request, SESSION_COOKIE);
  const db = env.DB;

  if (db && token) {
    try {
      await ensureSchema(db);
      await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    } catch {
      /* best effort — cookie is cleared regardless */
    }
  }

  return json({ ok: true, signedOut: true }, 200, { "set-cookie": clearedCookie() });
}

export async function onRequestPost(context) {
  return handle(context);
}

export async function onRequestGet(context) {
  return handle(context);
}
