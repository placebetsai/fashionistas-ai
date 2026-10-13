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
 * Stateless session token issued by the fashionistas-api Worker.
 *
 * The Worker signs `{sub, u, exp}` with HMAC-SHA256 and writes no row, while
 * requireAuth() below resolved tokens by looking them up in the D1 `sessions`
 * table. Those two systems cannot interoperate, so a Worker session — the only
 * kind the web app actually has — never authenticated on this side.
 *
 * The visible casualty was virtual try-on. The real render engine is alive
 * (2026-10-11: `GET <modal>/healthz` with the proxy credentials returned
 * `200 {"ok":true,"model":"fashn-vton-1.5","steps_default":20}`), but
 * `POST /api/tryon/hd` 401'd every request before it could reach the GPU, so
 * the only try-on path anyone ever saw was the on-device overlay — a shirt
 * pasted on top of a photo, sold as a render.
 *
 * The signing key is `SESSION_SECRET`, set identically on this project and on
 * the Worker. It used to be hardcoded in the Worker's source, which is pushed
 * to a public repository — anyone could sign `{sub: <any user id>}` and become
 * that account.
 */
async function verifyWorkerToken(token, secret) {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 1) return null;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const buf = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    // Constant-time compare, same as the Worker: never return early on a match.
    const expect = btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (expect.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return null;

    const padded = body.replace(/-/g, "+").replace(/_/g, "/");
    const p = JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)));
    if (!p || !Number.isFinite(p.sub)) return null;
    if (!Number.isFinite(p.exp) || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

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

  // Worker-issued session: signed, stateless, no row to look up. Verified first
  // because this is the credential the web app actually holds; the D1 lookup
  // below only serves tokens minted by this project's own /api/auth/* routes.
  //
  // SESSION_SECRET may hold a comma-separated list, newest first. That is how
  // the signing key gets rotated without a gap: publish `new,old` on both
  // sides, let every outstanding token verify, then drop `old`.
  if (token.indexOf(".") > 0 && env && env.SESSION_SECRET) {
    for (const candidate of String(env.SESSION_SECRET).split(",")) {
      const secret = candidate.trim();
      if (!secret) continue;
      const p = await verifyWorkerToken(token, secret);
      if (p) return { ok: true, user: { id: p.sub, email: p.u || "" }, token };
    }
  }

  // Preview branches have no SESSION_SECRET. When WORKER_UPSTREAM is set
  // (preview only), let the Worker that signed the token say whether it is
  // valid. Production has SESSION_SECRET and never reaches this.
  if (token.indexOf(".") > 0 && env && !env.SESSION_SECRET && env.WORKER_UPSTREAM) {
    try {
      const r = await fetch(String(env.WORKER_UPSTREAM).replace(/\/+$/, "") + "/api/auth/me", { headers: { Authorization: "Bearer " + token } });
      if (r.ok) { const d = await r.json(); if (d && d.id) return { ok: true, user: { id: d.id, email: "" }, token }; }
    } catch {}
  }

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
      // 402 is kept because the web client branches on this status to render
      // its "this shop has no direct post yet" copy — but the DETAIL used to
      // sell something that does not exist. Measured 2026-10-12, a signed-in
      // account hitting a gated route was told:
      //   "An active $14.99/mo subscription is required to list.
      //    POST /api/billing/checkout to subscribe."
      // and POST /api/billing/checkout answers 503 "STRIPE_SECRET_KEY not
      // configured". So the site was asking for money it had no way to take,
      // for a plan that is not for sale, from an endpoint that cannot run.
      // Stripe is unset on purpose (see NEEDS_ISRAEL.txt), so no account can
      // ever satisfy this gate — which makes the old wording a promise with
      // nothing behind it. Tell the seller the truth and what to do instead.
      response: json(
        {
          ok: false,
          error: "subscription_required",
          status: sub.status,
          detail:
            "Direct posting to this shop is not live yet, so there is nothing to buy and no plan to upgrade to — the site is free while it is in launch. See /api/marketplaces for what each shop can actually do today. Copy this listing and post it on the shop yourself; /pricing/ shows the fee take-home so you know what you would keep.",
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
