/**
 * POST /api/auth/demo — one-click demo sign-in.
 *
 * WHY THIS FILE EXISTS AT ALL:
 * the sign-in screen renders a real button —
 *   <button class="btn btn-soft btn-sm" onclick="demoLogin()">…</button>
 * and `demoLogin()` in the shipped bundle POSTs to `/api/auth/demo`. That route
 * did not exist. It answered 405. The client was rewired away from the
 * hardcoded demo password (correctly — a credential in public JavaScript is a
 * hole, and `Primetime2026!` was removed from the bundle for exactly that
 * reason) but the server half of the replacement was never written, so the
 * button that used to work now fails on every press.
 *
 * DESIGN — no credential is involved on either side, and none is needed:
 * the route IS the gate. It mints a normal D1 session row for the seeded demo
 * seller and hands the token back in the body, because `afterAuth(d)` in the
 * bundle reads `d.token` and stores it as the Bearer token. Those tokens are
 * 32 random bytes with no `.`, so `requireAuth()` skips the stateless-worker
 * branch and resolves them through the `sessions` lookup it keeps for this
 * project's own routes — the same path `/api/auth/login` uses.
 *
 * ABUSE: the demo account is not a free pass. It carries the same enforced
 * limits as any signed-in account — `LAUNCH_DAILY_CAP` try-ons a day
 * (functions/api/tryon/hd.js) and the 10/3/10 fair-use caps
 * (functions/api/listing/_lib/usage.js) — so there is nothing here to farm.
 * It reads and writes only the demo user's own rows.
 */

import { getDB, ensureAuthSchema } from "../../../libs/auth-db.js";

const SESSION_COOKIE = "fash_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

// Seeded demo seller. Resolved by username so the id can never drift if the
// row is ever re-seeded; email is the fallback.
const DEMO_USERNAME = "demo";
const DEMO_EMAIL = "demo@fashionistas.ai";

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

function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, "0");
  return out;
}

export async function onRequestPost(context) {
  const { env } = context;
  const db = getDB(env);
  if (!db) {
    return json(
      {
        error: "server_not_configured",
        detail: "No D1 binding found on this Pages project. Set the binding named DB.",
      },
      500
    );
  }

  try {
    await ensureAuthSchema(db);

    const user = await db
      .prepare("SELECT id, email, username FROM users WHERE username = ? OR email = ? LIMIT 1")
      .bind(DEMO_USERNAME, DEMO_EMAIL)
      .first();
    if (!user) {
      // Honest failure rather than a fake success: if the demo seller was
      // never seeded, the button must say so instead of "signing in" as
      // nobody and failing later on an empty closet.
      return json(
        {
          error: "demo_unavailable",
          detail: "The demo seller is not seeded on this deployment.",
        },
        404
      );
    }

    const token = randomHex(32);
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    await db
      .prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)")
      .bind(user.id, token, expiresAt)
      .run();

    // Best-effort cleanup, same as login.js.
    try {
      await db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Math.floor(Date.now() / 1000)).run();
    } catch {
      /* ignore */
    }

    // `token` in the body is what afterAuth() reads; the cookie serves any
    // route that relies on Cookie rather than Authorization.
    return json(
      {
        ok: true,
        id: user.id,
        email: user.email,
        username: user.username || DEMO_USERNAME,
        token,
      },
      200,
      {
        "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
      }
    );
  } catch (err) {
    return json(
      { error: "demo_failed", detail: String((err && err.message) || err) },
      500
    );
  }
}

export function onRequest() {
  return json({ error: "Method not allowed. Use POST." }, 405);
}
