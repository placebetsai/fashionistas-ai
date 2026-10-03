/**
 * GET /api/auth/me
 * Reads the HttpOnly fash_session cookie, looks the token up in the D1
 * `sessions` table and echoes the signed-in user as { id, email }.
 * 401 when the cookie is absent, unknown or expired.
 */

const SESSION_COOKIE = "fash_session";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
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

export async function onRequestGet(context) {
  const { request, env } = context;
  // Bearer first (API clients), then the HttpOnly cookie (the web app).
  const authzHdr = request.headers.get("Authorization") || "";
  const bearer = /^\s*Bearer\s+(\S+)\s*$/i.exec(authzHdr);
  const token = bearer ? bearer[1] : readCookie(request, SESSION_COOKIE);

  if (!token) {
    return json({ error: "Not signed in." }, 401);
  }

  const db = getDB(env);
  if (!db) {
    return json({ error: "Server not configured: no D1 binding found on this Pages project (tried DB, FASHIONISTAS_DB, EBAY_DB, EBAY_TOKENS_DB, D1). Set the binding named DB." }, 500);
  }

  try {
    await ensureSchema(db);

    const row = await db
      .prepare(
        `SELECT u.id AS id, u.email AS email
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token = ?
            AND s.expires_at > ?
          LIMIT 1`
      )
      .bind(token, Math.floor(Date.now() / 1000))
      .first();

    if (!row) {
      return json({ error: "Not signed in." }, 401);
    }

    return json({ id: row.id, email: row.email, authenticated: true });
  } catch (err) {
    return json(
      { error: "Could not read the session.", detail: String((err && err.message) || err) },
      500
    );
  }
}

export async function onRequest(context) {
  return onRequestGet(context);
}
