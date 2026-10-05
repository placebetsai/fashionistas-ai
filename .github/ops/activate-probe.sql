-- .github/ops/activate-probe.sql
--
-- WHAT THIS DOES
-- Marks ONE fixed probe account as an active subscriber so the photoreal
-- try-on route can be exercised end to end against production.
--
-- WHY A SEED IS NECESSARY
-- Entitlement comes from subscriptions.status (subscriptionState in
-- functions/api/_lib/auth.js). In production that row is normally written by
-- the Stripe webhook on checkout.session.completed. That path is not usable
-- from CI today: STRIPE_SECRET_KEY is not set as a Pages secret (checkout
-- answers 503) and no Stripe webhook endpoint has been verified. Rather than
-- pretend a purchase happened, this provisions the exact row a real subscriber
-- gets, and stamps it so it is identifiable as a seed rather than a sale.
--
-- SAFETY
-- * The email is a LITERAL in this file — no workflow input reaches SQL.
-- * Idempotent: ON CONFLICT updates status, so re-running is harmless.
-- * Touches ONLY the probe account. It never matches another user.
-- * stripe_subscription_id = 'ci-seed-probe' marks the row as provisioned.

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id INTEGER PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end INTEGER,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO subscriptions
  (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, updated_at)
SELECT
  id, NULL, 'ci-seed-probe', 'active', NULL, CURRENT_TIMESTAMP
FROM users
WHERE email = 'fashn-probe@fashionistas.test'
ON CONFLICT(user_id) DO UPDATE SET
  stripe_customer_id     = NULL,
  stripe_subscription_id = 'ci-seed-probe',
  status                 = 'active',
  current_period_end     = NULL,
  updated_at             = CURRENT_TIMESTAMP;

SELECT u.id, u.email, s.status, s.stripe_subscription_id
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.email = 'fashn-probe@fashionistas.test';
