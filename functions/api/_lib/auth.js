/**
 * Shared auth + subscription guard for mutating endpoints.
 *
 * Files/directories prefixed with `_` are ignored by the Pages Functions
 * router, so this is a library, not a route.
 *
 * Credential resolution order:
 *   1. `Authorization: Bearer <session token>`   — API / curl clients
 *   2. `fash_session` cookie                     — the web app (same-origin fetch)
 *
 * Both resolve against the D1 `sessions` table, so a browser session and a
 * Bearer token are the same credential carried two ways. Anything that fails
 * to resolve is a hard 401 — there is no anonymous path on a mutating route.
 */

export const SESSION_COOKIE = "fash_session";

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

/** First binding on env that actually looks like a D1 database. */
export function getDB(env) {
  for (const name of ["DB", "FASHIONISTAS_DB", "EBAY_DB", "EBAY_TOKENS_DB", "D1"]) {
    const candidate = env ? env[name] : null;
    if (candidate && typeof candidate.prepare === "function") return candidate;
  }
  return null;
}

export function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith(name + "=")) continue;
    return p.slice(name.length + 1);
  }
  return null;
}

/** Pull a session token from the request, or null when absent. */
export function bearerOrCookie(request) {
  const auth = request.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (m && m[1]) return m[1].trim();
  return readCookie(request, SESSION_COOKIE);
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

export const UNAUTHORIZED = () =>
  json({ ok: false, error: "unauthorized", detail: "A valid Bearer token (or fash_session cookie) is required." }, 401);

/**
 * Resolve the caller. Returns `{ ok:true, user, token }` or
 * `{ ok:false, response }` — the caller must return `response` verbatim.
 *
 * Never throws: an unreadable session store fails loud as 500 with the
 * binding names it tried, never as a silent pass-through.
 */
export async function requireAuth(request, env) {
  const token = bearerOrCookie(request);
  if (!token) return { ok: false, response: UNAUTHORIZED() };

  const db = getDB(env);
  if (!db) {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error: "server_not_configured",
          detail:
            "No D1 binding found on this Pages project (tried DB, FASHIONISTAS_DB, EBAY_DB, EBAY_TOKENS_DB, D1). Set the binding named DB.",
        },
        500
      ),
    };
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

    if (!row) return { ok: false, response: UNAUTHORIZED() };
    return { ok: true, user: { id: row.id, email: row.email }, token };
  } catch (err) {
    return {
      ok: false,
      response: json(
        { ok: false, error: "session_lookup_failed", detail: String((err && err.message) || err) },
        500
      ),
    };
  }
}

/**
 * Subscription state for /api/list/*. No Stripe key is touched here, so it is
 * safe to call before STRIPE_* exists. Returns 'active' | 'inactive'.
 *
 * Row missing entirely → 'inactive' (a non-subscriber may not list). That is
 * a 402, never a silent pass.
 */
export async function subscriptionState(env, userId) {
  const db = getDB(env);
  if (!db) return { ok: false, error: "server_not_configured" };

  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS subscriptions (
          user_id INTEGER PRIMARY KEY,
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          status TEXT NOT NULL DEFAULT 'inactive',
          current_period_end INTEGER,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      )
      .run();
  } catch (err) {
    const msg = String((err && err.message) || err);
    if (!/already exists/i.test(msg)) return { ok: false, error: msg };
  }

  try {
    const row = await db
      .prepare(`SELECT status, current_period_end FROM subscriptions WHERE user_id = ? LIMIT 1`)
      .bind(userId)
      .first();

    if (!row) return { ok: true, status: "inactive" };
    if (row.status !== "active") return { ok: true, status: row.status };

    // An 'active' row whose period lapsed without a webhook is not active.
    if (row.current_period_end && row.current_period_end * 1000 < Date.now()) {
      return { ok: true, status: "inactive" };
    }
    return { ok: true, status: "active" };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/** Gate for listing endpoints: auth first, then active subscription (402). */
export async function requireActiveSubscriber(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth;

  const sub = await subscriptionState(env, auth.user.id);
  if (!sub.ok) {
    return {
      ok: false,
      response: json({ ok: false, error: sub.error || "subscription_lookup_failed" }, 500),
    };
  }
  if (sub.status !== "active") {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error: "subscription_required",
          status: sub.status,
          detail: "An active $14.99/mo subscription is required to list. POST /api/billing/checkout to subscribe.",
        },
        402
      ),
    };
  }
  return { ...auth, subscription: "active" };
}

/** Env presence check — names the exact missing var, never stubs around it. */
export function missingEnv(env, names) {
  const missing = (names || []).filter((n) => !env || !env[n]);
  return missing;
}
