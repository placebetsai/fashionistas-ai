/**
 * POST /api/billing/portal
 * Session-authenticated (HttpOnly fash_session cookie, D1 `sessions` table).
 * Opens a Stripe customer portal session so the user can cancel / manage the
 * Pro subscription themselves, then returns { "url": "https://billing.stripe.com/..." }.
 *
 * Reads env.STRIPE_SECRET_KEY only — never hardcoded, never logged.
 * Honest 503 when the key is missing.
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

function siteOrigin(request) {
  const url = new URL(request.url);
  const fwd = request.headers.get("X-Forwarded-Proto");
  const proto = fwd ? fwd.split(",")[0].trim() : url.protocol.replace(":", "");
  return `${proto}://${url.host}`;
}

async function currentUser(db, token) {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id AS id, u.email AS email, u.plan AS plan,
              u.stripe_customer_id AS stripe_customer_id
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
          AND s.expires_at > ?
        LIMIT 1`
    )
    .bind(token, Math.floor(Date.now() / 1000))
    .first();
  return row || null;
}

async function ensureBillingColumns(db) {
  const alters = [
    "ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
    "ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT",
  ];
  for (const sql of alters) {
    try {
      await db.prepare(sql).run();
    } catch (err) {
      const msg = String((err && err.message) || err);
      if (!/duplicate column/i.test(msg)) throw err;
    }
  }
}

async function stripePost(key, path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Session-only gate — reads `sessions` and never a billing column, so an
 * anonymous caller is refused before any `ALTER TABLE` runs and before the
 * answer can reveal whether Stripe is configured. `currentUser` SELECTs
 * `u.stripe_customer_id`, which `ensureBillingColumns` creates, so it cannot
 * be the gate: on a pre-column database it would force a migration first.
 */
async function hasLiveSession(db, token) {
  if (!token) return false;
  const row = await db
    .prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ? LIMIT 1")
    .bind(token, Math.floor(Date.now() / 1000))
    .first();
  return Boolean(row);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const db = env.DB;
  if (!db) {
    return json({ error: "Server not configured: D1 binding `DB` is missing on this Pages project." }, 500);
  }

  // 1. Gate — nothing above this may vary with configuration or write to D1.
  const token = readCookie(request, SESSION_COOKIE);
  let signedIn = false;
  try {
    signedIn = await hasLiveSession(db, token);
  } catch (err) {
    return json({ error: "Could not read the session.", detail: String((err && err.message) || err) }, 500);
  }
  if (!signedIn) {
    return json({ error: "Not signed in." }, 401);
  }

  // 2. Configuration, now that only a real session can see the answer.
  const stripeKey = typeof env.STRIPE_SECRET_KEY === "string" ? env.STRIPE_SECRET_KEY.trim() : "";
  if (!stripeKey) {
    return json(
      {
        error: "STRIPE_SECRET_KEY not configured",
        detail:
          "Set the STRIPE_SECRET_KEY Pages environment variable (Cloudflare Pages → Settings → Environment variables) to open the billing portal.",
      },
      503
    );
  }

  // 3. Schema, then the full user row (which needs those columns).
  try {
    await ensureBillingColumns(db);
  } catch (err) {
    return json({ error: "Could not prepare the billing schema.", detail: String((err && err.message) || err) }, 500);
  }

  let user = null;
  try {
    user = await currentUser(db, token);
  } catch (err) {
    return json({ error: "Could not read the session.", detail: String((err && err.message) || err) }, 500);
  }
  if (!user) {
    return json({ error: "Not signed in." }, 401);
  }

  let customerId = typeof user.stripe_customer_id === "string" ? user.stripe_customer_id.trim() : "";

  if (!customerId && user.email) {
    // Best effort: find the customer Stripe already knows by email.
    const lookup = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`,
      { headers: { authorization: `Bearer ${stripeKey}` } }
    ).then((r) => r.json().catch(() => ({})));
    const first = lookup && lookup.data && lookup.data[0];
    if (first && first.id) {
      customerId = first.id;
      try {
        await db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").bind(customerId, user.id).run();
      } catch {
        /* non-fatal */
      }
    }
  }

  if (!customerId) {
    return json(
      {
        error: "no_stripe_customer",
        detail: "This account has no Stripe customer yet. Subscribe from /pricing/ first, then manage or cancel here.",
      },
      400
    );
  }

  const origin = siteOrigin(request);
  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("return_url", `${origin}/pricing/?portal=return`);

  const result = await stripePost(stripeKey, "billing_portal/sessions", params);
  if (!result.ok) {
    const message =
      (result.data && result.data.error && result.data.error.message) || "Stripe rejected the portal request.";
    return json({ error: "stripe_error", detail: message, status: result.status }, 502);
  }

  const url = result.data && typeof result.data.url === "string" ? result.data.url : "";
  if (!url) {
    return json({ error: "stripe_no_portal_url", detail: "Stripe returned no portal URL." }, 502);
  }

  return json({ url, customer: customerId });
}

export async function onRequest() {
  return json({ error: "Method not allowed. Use POST." }, 405);
}
