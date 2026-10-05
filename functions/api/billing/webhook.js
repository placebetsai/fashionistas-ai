/**
 * POST /api/billing/webhook
 * Stripe webhook endpoint.
 *
 * Verifies Stripe-Signature: HMAC-SHA256 over `${t}.${payload}` with
 * env.STRIPE_WEBHOOK_SECRET, inside a 5 minute tolerance, constant-time compare.
 *
 * Handled events:
 *   checkout.session.completed   -> users.plan='pro'   + subscriptions.status='active'
 *   customer.subscription.updated -> users.plan flips on active/trialing vs
 *                                    canceled/unpaid, refreshes period end
 *   customer.subscription.deleted -> users.plan='free' + subscriptions.status='inactive'
 *
 * Entitlement note: paid routes gate on subscriptions.status (see
 * subscriptionState in functions/api/_lib/auth.js). Writing users.plan alone
 * was not enough — that bug made a completed purchase still return 402.
 *
 * Never logs the raw payload or the signing secret. Returns 400 on a bad
 * signature and 200 {received:true} for events it processed or ignored.
 */

const SIGNATURE_HEADER = "stripe-signature";
const TOLERANCE_SECONDS = 300;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

/** Parse `t=123,v1=abc,v1=def` into { timestamp, signatures[] }. */
function parseSignature(header) {
  const parts = String(header || "").split(",");
  const out = { timestamp: 0, signatures: [] };
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") {
      const t = parseInt(value, 10);
      if (Number.isFinite(t)) out.timestamp = t;
    } else if (key === "v1") {
      out.signatures.push(value);
    }
  }
  return out;
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function timingSafeEqualHex(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(payload, header, secret) {
  if (!header) return false;
  const { timestamp, signatures } = parseSignature(header);
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > TOLERANCE_SECONDS) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  for (const candidate of signatures) {
    if (timingSafeEqualHex(candidate, expected)) return true;
  }
  return false;
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

/**
 * Keep `subscriptions.status` in step with `users.plan`.
 *
 * WHY THIS EXISTS: `subscriptionState()` (functions/api/_lib/auth.js) is the
 * only thing that gates the paid routes, and it reads `subscriptions.status`.
 * The webhook used to write ONLY `users.plan`, which nothing reads for
 * entitlement — so a buyer who had genuinely paid still got 402 forever. The two
 * stores were disconnected and no one could ever be entitled.
 *
 * `current_period_end` is not on the Checkout event, so it is passed when we
 * have it and left NULL otherwise. NULL means "no known expiry": the row stays
 * active until `customer.subscription.deleted` arrives, which is the correct
 * failure direction — we never silently revoke a paying user, and an expired
 * sub is still revoked by the delete/update events Stripe does send.
 */
async function syncSubscription(db, userId, plan, extra = {}) {
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
    .run()
    .catch((err) => {
      if (!/already exists/i.test(String((err && err.message) || err))) throw err;
    });

  const status = plan === "pro" ? "active" : "inactive";
  const periodEnd = Number.isFinite(extra.periodEnd) ? extra.periodEnd : null;

  await db
    .prepare(
      `INSERT INTO subscriptions
         (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         stripe_customer_id     = COALESCE(excluded.stripe_customer_id, subscriptions.stripe_customer_id),
         stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, subscriptions.stripe_subscription_id),
         status                 = excluded.status,
         current_period_end     = COALESCE(excluded.current_period_end, subscriptions.current_period_end),
         updated_at             = CURRENT_TIMESTAMP`
    )
    .bind(
      userId,
      extra.customerId || null,
      extra.subscriptionId || null,
      status,
      periodEnd
    )
    .run();
}

/**
 * Flip a user's plan AND mirror it into `subscriptions`, so entitlement can
 * actually see it. Returns the user id that was updated, or null.
 */
async function setPlan(db, where, bind, plan, extra = {}) {
  const sets = ["plan = ?"];
  const binds = [plan];
  if (extra.customerId !== undefined) {
    sets.push("stripe_customer_id = ?");
    binds.push(extra.customerId);
  }
  if (extra.subscriptionId !== undefined) {
    sets.push("stripe_subscription_id = ?");
    binds.push(extra.subscriptionId);
  }
  const sql = `UPDATE users SET ${sets.join(", ")} WHERE ${where}`;
  const stmt = db.prepare(sql).bind(...binds, ...bind);
  await stmt.run();

  // Resolve which user this was: `id = ?` already tells us, the customer-id
  // and subscription-id branches need one lookup.
  let userId = where === "id = ?" ? bind[0] : null;
  if (userId === null || userId === undefined) {
    try {
      const row = await db.prepare(`SELECT id FROM users WHERE ${where} LIMIT 1`).bind(...bind).first();
      userId = row && row.id;
    } catch {
      userId = null;
    }
  }
  if (userId === null || userId === undefined) return null;

  try {
    await syncSubscription(db, userId, plan, extra);
  } catch {
    // Never fail the Stripe acknowledgement because the mirror write hiccuped —
    // Stripe would retry forever. The next event repairs it.
  }
  return userId;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const secret = safeStr(env.STRIPE_WEBHOOK_SECRET);
  if (!secret) {
    return json({ error: "STRIPE_WEBHOOK_SECRET not configured" }, 503);
  }

  const payload = await request.text();
  const header = request.headers.get(SIGNATURE_HEADER) || "";

  const ok = await verifySignature(payload, header, secret);
  if (!ok) {
    return json({ error: "Invalid signature." }, 400);
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Malformed JSON payload." }, 400);
  }

  const type = safeStr(event && event.type);
  const object = (event && event.data && event.data.object) || {};

  const db = env.DB;
  if (!db) {
    return json({ error: "Server not configured: D1 binding `DB` is missing on this Pages project." }, 500);
  }

  try {
    await ensureBillingColumns(db);

    if (type === "checkout.session.completed") {
      const uid = safeStr(object.client_reference_id || (object.metadata && object.metadata.uid));
      const customerId = safeStr(object.customer);
      const subscriptionId = safeStr(object.subscription);

      if (uid && /^\d+$/.test(uid)) {
        await setPlan(
          db,
          "id = ?",
          [parseInt(uid, 10)],
          "pro",
          { customerId: customerId || undefined, subscriptionId: subscriptionId || undefined }
        );
      } else if (customerId) {
        await setPlan(db, "stripe_customer_id = ?", [customerId], "pro", {
          subscriptionId: subscriptionId || undefined,
        });
      }
      return json({ received: true, plan: "pro" });
    }

    if (type === "customer.subscription.updated") {
      // Stripe sends this on renewal and cancellation, and it is the only event
      // that carries current_period_end — without it an "active" row would never
      // expire (subscriptionState only re-checks the date it was given).
      const st = safeStr(object.status);
      const customerId = safeStr(object.customer);
      const subscriptionId = safeStr(object.id);
      const rawEnd = Number(object.current_period_end);
      const periodEnd = Number.isFinite(rawEnd) && rawEnd > 0 ? rawEnd : null;
      const where = customerId ? "stripe_customer_id = ?" : subscriptionId ? "stripe_subscription_id = ?" : null;
      const bind = customerId ? [customerId] : subscriptionId ? [subscriptionId] : [];
      if (!where) return json({ received: true, ignored: "subscription_updated:no_identity" });

      if (st === "canceled" || st === "unpaid" || st === "incomplete_expired") {
        await setPlan(db, where, bind, "free", { subscriptionId, periodEnd });
        return json({ received: true, plan: "free" });
      }
      if (st === "active" || st === "trialing") {
        await setPlan(db, where, bind, "pro", { subscriptionId, periodEnd });
        return json({ received: true, plan: "pro" });
      }
      // past_due / incomplete: leave the plan alone rather than revoking a
      // customer mid-dunning. Stripe retries and follows up with canceled.
      return json({ received: true, ignored: `subscription_updated:${st || "unknown"}` });
    }

    if (type === "customer.subscription.deleted") {
      const customerId = safeStr(object.customer);
      const subscriptionId = safeStr(object.id);
      if (customerId) {
        await setPlan(db, "stripe_customer_id = ?", [customerId], "free", {
          subscriptionId: subscriptionId || "",
        });
      } else if (subscriptionId) {
        await setPlan(db, "stripe_subscription_id = ?", [subscriptionId], "free");
      }
      return json({ received: true, plan: "free" });
    }

    return json({ received: true, ignored: type || "unknown" });
  } catch (err) {
    return json({ error: "webhook_handling_failed", detail: String((err && err.message) || err) }, 500);
  }
}

export async function onRequest() {
  return json({ error: "Method not allowed. Use POST." }, 405);
}
