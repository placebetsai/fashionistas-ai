// functions/api/billing/__tests__/webhook.test.mjs
//
// Run:  node --test functions/api/billing/__tests__/*.mjs
//
// WHY THIS EXISTS
// The webhook writes `users.plan`, but the paid routes gate on
// `subscriptions.status` (subscriptionState in ../_lib/auth.js). Those two were
// disconnected: `subscriptions` was read by the gate and written by NOTHING, so
// a buyer who had genuinely completed checkout still got 402 forever. Nothing
// in this repo had ever executed the webhook, which is how it shipped.
//
// These tests run the REAL handler against a REAL SQLite database with a REAL
// HMAC-signed Stripe payload — no mocks of the code under test — and assert
// that the entitlement table the gate actually reads ends up correct.

import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { onRequestPost } from "../webhook.js";
import { subscriptionState } from "../../_lib/auth.js";

const SECRET = "whsec_test_secret_not_a_real_one";

/* ------------------------------------------------------- test database */

/**
 * A D1-shaped wrapper over an in-memory SQLite DB: prepare() -> bind() ->
 * run()/first(), which is the exact subset functions/api/* uses.
 */
function makeD1(db) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            run: async () => db.prepare(sql).run(...args),
            first: async () => db.prepare(sql).get(...args),
          };
        },
        run: async (...args) => db.prepare(sql).run(...args),
        first: async (...args) => db.prepare(sql).get(...args),
      };
    },
  };
}

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      pass_hash TEXT DEFAULT '',
      salt TEXT DEFAULT '',
      plan TEXT DEFAULT 'free',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT
    );
  `);
  return db;
}

/** Sign a payload exactly the way Stripe does: v1 = HMAC-SHA256(`${t}.${payload}`). */
async function stripeSignature(payload, secret = SECRET) {
  const t = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${t},v1=${hex}`;
}

async function deliver(db, event, secret = SECRET) {
  const payload = JSON.stringify(event);
  const request = new Request("https://fashionistas.ai/api/billing/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": await stripeSignature(payload, secret),
    },
    body: payload,
  });
  return onRequestPost({ request, env: { DB: makeD1(db), STRIPE_WEBHOOK_SECRET: secret } });
}

function readUser(db, id = 1) {
  return db.prepare("SELECT id, plan, stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?").get(id);
}

function readSubscription(db, userId = 1) {
  // A forged/absent event never creates the table, and querying a missing table
  // throws. "Table absent" IS "no row", so express that instead of crashing.
  const t = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subscriptions'")
    .get();
  if (!t) return undefined;
  return db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId);
}

function insertUser(db, email = "buyer@example.com") {
  const r = db.prepare("INSERT INTO users (email) VALUES (?)").run(email);
  return Number(r.lastInsertRowid);
}

/* ------------------------------------------------------------- tests */

test("a completed checkout makes the user ACTUALLY entitled (the 402 bug)", async () => {
  const db = freshDb();
  const uid = insertUser(db);

  // Baseline: a fresh user must not be entitled.
  const before = await subscriptionState({ DB: makeD1(db) }, uid);
  assert.equal(before.ok, true);
  assert.equal(before.status, "inactive", "fresh user starts inactive");

  const res = await deliver(db, {
    type: "checkout.session.completed",
    data: { object: { client_reference_id: String(uid), customer: "cus_1", subscription: "sub_1" } }
  });
  assert.equal(res.status, 200, "webhook must acknowledge Stripe with 200");

  // users.plan — what the webhook used to write.
  assert.equal(readUser(db, uid).plan, "pro");

  // subscriptions.status — what the paid routes actually read. THIS was never
  // written before the fix, which is why a paying user still got 402.
  const row = readSubscription(db, uid);
  assert.ok(row, "subscriptions row must exist after checkout");
  assert.equal(row.status, "active", "entitlement gate reads status='active'");
  assert.equal(row.stripe_customer_id, "cus_1");
  assert.equal(row.stripe_subscription_id, "sub_1");

  // The gate itself, end to end.
  const after = await subscriptionState({ DB: makeD1(db) }, uid);
  assert.equal(after.ok, true);
  assert.equal(after.status, "active", "subscriptionState must now report active");
});

test("checkout found by stripe_customer_id also flips entitlement", async () => {
  const db = freshDb();
  const uid = insertUser(db);
  db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run("cus_lookup", uid);

  const res = await deliver(db, {
    type: "checkout.session.completed",
    data: { object: { customer: "cus_lookup", subscription: "sub_lookup" } }
  });
  assert.equal(res.status, 200);

  assert.equal(readUser(db, uid).plan, "pro");
  assert.equal(readSubscription(db, uid).status, "active", "resolved through stripe_customer_id");
});

test("cancelling revokes entitlement in the table the gate reads", async () => {
  const db = freshDb();
  const uid = insertUser(db);

  await deliver(db, {
    type: "checkout.session.completed",
    data: { object: { client_reference_id: String(uid), customer: "cus_2", subscription: "sub_2" } }
  });
  assert.equal(readSubscription(db, uid).status, "active");

  const res = await deliver(db, {
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_2", customer: "cus_2" } }
  });
  assert.equal(res.status, 200);

  assert.equal(readUser(db, uid).plan, "free");
  assert.equal(readSubscription(db, uid).status, "inactive", "delete must revoke, not just flip users.plan");

  const after = await subscriptionState({ DB: makeD1(db) }, uid);
  assert.equal(after.status, "inactive");
});

test("subscription.updated carries current_period_end and honors status", async () => {
  const db = freshDb();
  const uid = insertUser(db);

  await deliver(db, {
    type: "checkout.session.completed",
    data: { object: { client_reference_id: String(uid), customer: "cus_3", subscription: "sub_3" } }
  });

  const future = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  await deliver(db, {
    type: "customer.subscription.updated",
    data: { object: { id: "sub_3", customer: "cus_3", status: "active", current_period_end: future } }
  });

  const row = readSubscription(db, uid);
  assert.equal(row.status, "active");
  assert.equal(row.current_period_end, future, "expiry must be stored or a sub never expires");

  // An active row whose period lapsed must be treated as inactive.
  const past = Math.floor(Date.now() / 1000) - 60;
  await deliver(db, {
    type: "customer.subscription.updated",
    data: { object: { id: "sub_3", customer: "cus_3", status: "active", current_period_end: past } }
  });
  const lapsed = await subscriptionState({ DB: makeD1(db) }, uid);
  assert.equal(lapsed.status, "inactive", "a lapsed period must not stay active");
});

test("canceled via subscription.updated revokes too", async () => {
  const db = freshDb();
  const uid = insertUser(db);
  await deliver(db, {
    type: "checkout.session.completed",
    data: { object: { client_reference_id: String(uid), customer: "cus_4", subscription: "sub_4" } }
  });

  await deliver(db, {
    type: "customer.subscription.updated",
    data: { object: { id: "sub_4", customer: "cus_4", status: "canceled", current_period_end: 0 } }
  });

  assert.equal(readUser(db, uid).plan, "free");
  assert.equal(readSubscription(db, uid).status, "inactive");
});

test("a bad signature is rejected and changes nothing", async () => {
  const db = freshDb();
  const uid = insertUser(db);

  const payload = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { client_reference_id: String(uid), customer: "cus_x", subscription: "sub_x" } }
  });
  const request = new Request("https://fashionistas.ai/api/billing/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    body: payload,
  });
  const res = await onRequestPost({
    request,
    env: { DB: makeD1(db), STRIPE_WEBHOOK_SECRET: SECRET },
  });

  assert.equal(res.status, 400, "forged signature must be rejected");
  assert.equal(readUser(db, uid).plan, "free", "no entitlement from a forged event");
  assert.equal(readSubscription(db, uid), undefined, "no subscriptions row from a forged event");
});

test("missing STRIPE_WEBHOOK_SECRET fails closed with 503", async () => {
  const db = freshDb();
  insertUser(db);
  const request = new Request("https://fashionistas.ai/api/billing/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const res = await onRequestPost({ request, env: { DB: makeD1(db) } });
  assert.equal(res.status, 503, "must never verify with an absent secret");
  assert.equal(readUser(db, 1).plan, "free");
});
