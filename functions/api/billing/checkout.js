/**
 * POST /api/billing/checkout
 * Session-authenticated (HttpOnly fash_session cookie, D1 `sessions` table).
 * Creates a Stripe Checkout Session for the $14.99/month Pro plan and returns
 * { "url": "https://checkout.stripe.com/..." }.
 *
 * The Stripe secret key is read from the environment only (env.STRIPE_SECRET_KEY).
 * It is never hardcoded and never logged. When the key is missing the response is
 * an honest 503 naming the variable — no fabricated checkout URL is ever returned.
 */

const SESSION_COOKIE = "fash_session";

const PRO_UNIT_AMOUNT = 1499; // cents
const PRO_CURRENCY = "usd";
const PRO_INTERVAL = "month";
const PRO_NAME = "fashionistas.ai Pro — monthly";

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

/** Resolve the signed-in user from the session cookie. Returns null when invalid. */
async function currentUser(db, token) {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id AS id, u.email AS email, u.plan AS plan
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

/** users.plan / stripe columns are added on first use (older D1 databases lack them). */
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

export async function onRequestPost(context) {
  const { request, env } = context;

  const stripeKey = typeof env.STRIPE_SECRET_KEY === "string" ? env.STRIPE_SECRET_KEY.trim() : "";
  if (!stripeKey) {
    return json(
      {
        error: "STRIPE_SECRET_KEY not configured",
        detail:
          "Set the STRIPE_SECRET_KEY Pages environment variable (Cloudflare Pages → Settings → Environment variables) to enable Stripe checkout.",
      },
      503
    );
  }

  const db = env.DB;
  if (!db) {
    return json({ error: "Server not configured: D1 binding `DB` is missing on this Pages project." }, 500);
  }

  let user = null;
  try {
    await ensureBillingColumns(db);
    user = await currentUser(db, readCookie(request, SESSION_COOKIE));
  } catch (err) {
    return json({ error: "Could not read the session.", detail: String((err && err.message) || err) }, 500);
  }
  if (!user) {
    return json({ error: "Not signed in." }, 401);
  }

  const origin = siteOrigin(request);

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", PRO_CURRENCY);
  params.set("line_items[0][price_data][unit_amount]", String(PRO_UNIT_AMOUNT));
  params.set("line_items[0][price_data][recurring][interval]", PRO_INTERVAL);
  params.set("line_items[0][price_data][product_data][name]", PRO_NAME);
  params.set("client_reference_id", String(user.id));
  params.set("customer_email", user.email || "");
  params.set("success_url", `${origin}/pricing/?checkout=success`);
  params.set("cancel_url", `${origin}/pricing/?checkout=cancelled`);
  params.set("metadata[uid]", String(user.id));
  params.set("metadata[plan]", "pro");
  params.set("subscription_data[metadata][uid]", String(user.id));

  let res;
  let data;
  try {
    res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${stripeKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    data = await res.json();
  } catch (err) {
    return json({ error: "stripe_unreachable", detail: String((err && err.message) || err) }, 502);
  }

  if (!res.ok) {
    const message =
      (data && data.error && data.error.message) || (data && data.error) || "Stripe rejected the request.";
    return json({ error: "stripe_error", detail: message, status: res.status }, 502);
  }

  const url = data && typeof data.url === "string" ? data.url : "";
  if (!url || !url.startsWith("https://checkout.stripe.com/")) {
    return json({ error: "stripe_no_checkout_url", detail: "Stripe returned no checkout URL." }, 502);
  }

  try {
    await db
      .prepare("UPDATE users SET plan = CASE WHEN plan IS NULL THEN 'free' ELSE plan END WHERE id = ?")
      .bind(user.id)
      .run();
  } catch {
    /* non-fatal: the webhook is what flips the plan */
  }

  return json({ url, id: data.id || null, uid: user.id });
}

export async function onRequest() {
  return json({ error: "Method not allowed. Use POST." }, 405);
}
