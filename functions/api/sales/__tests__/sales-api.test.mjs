// functions/api/sales/__tests__/sales-api.test.mjs
//
// Run:  node --test functions/api/sales/__tests__/sales-api.test.mjs
//
// WHY THIS FILE EXISTS
// The extension scanner POSTs sale events here and the prompt UI reads them
// back; an untested route is how duplicate sales and silent 500s ship. These
// tests run the REAL handlers (index.js, ack.js, delist-log.js) against a REAL
// SQLite database through a D1-shaped wrapper — no mocks of the code under
// test — with REAL session rows, so the 401/402 gates execute exactly as they
// do on Cloudflare.
//
// STATED LIMITATION: node:sqlite is local SQLite, not remote D1. A real D1
// insert (`wrangler d1 execute --remote`) is NOT PROVEN — Cloudflare OAuth has
// not been clicked — and is labeled as such in the phase report.

import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { onRequestPost as salesPost, onRequestGet as salesGet } from "../index.js";
import { onRequestPost as salesAck } from "../ack.js";
import { onRequestPost as delistLogPost } from "../delist-log.js";

/* ------------------------------------------------------- test database */

/**
 * A D1-shaped wrapper over an in-memory SQLite DB: prepare() -> bind() ->
 * run()/first()/all(), the exact subset functions/api/* uses. Real D1 returns
 * {results} from all() and {meta:{last_row_id}} from run(); the shim matches.
 */
function makeD1(db) {
  const wrap = (stmt, args) => ({
    run: async () => {
      const r = stmt.run(...args);
      return {
        meta: {
          last_row_id: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid),
          changes: r.changes,
        },
      };
    },
    first: async () => stmt.get(...args) ?? null,
    all: async () => ({ results: stmt.all(...args) }),
  });
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        bind: (...args) => wrap(stmt, args),
        run: (...args) => wrap(stmt, args).run(),
        first: (...args) => wrap(stmt, args).first(),
        all: (...args) => wrap(stmt, args).all(),
      };
    },
  };
}

function req(url, { method = "GET", token = null, body = null } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(url, {
    method,
    headers: {
      ...headers,
      ...(body != null ? { "content-type": "application/json" } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

async function jsonOf(res) {
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  return { status: res.status, body: await res.json() };
}

/** A subscriber (401-proof token + active row) and a non-subscriber. */
function seedUsers(d1) {
  const nowSec = Math.floor(Date.now() / 1000);
  d1.prepare(
    `INSERT INTO users (email, pass_hash, salt) VALUES (?, ?, ?)`
  ).run("seller@example.com", "x", "y");
  d1.prepare(
    `INSERT INTO users (email, pass_hash, salt) VALUES (?, ?, ?)`
  ).run("free@example.com", "x", "y");
  d1.prepare(
    `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`
  ).run(1, "tok_pro", nowSec + 3600);
  d1.prepare(
    `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`
  ).run(2, "tok_free", nowSec + 3600);
  d1.prepare(
    `INSERT INTO subscriptions (user_id, status, current_period_end) VALUES (?, ?, ?)`
  ).run(1, "active", nowSec + 86400);
}

function freshEnv() {
  const db = new DatabaseSync(":memory:");
  const d1 = makeD1(db);
  // auth.js ensureSchema creates users/sessions lazily on first request, but
  // the fixture must seed session rows BEFORE that — so create the same tables
  // up front (identical DDL to functions/api/_lib/auth.js).
  db.exec(
    `CREATE TABLE users (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       email TEXT UNIQUE NOT NULL,
       pass_hash TEXT NOT NULL,
       salt TEXT NOT NULL,
       created_at TEXT DEFAULT CURRENT_TIMESTAMP
     );
     CREATE TABLE sessions (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       token TEXT UNIQUE NOT NULL,
       expires_at INTEGER NOT NULL,
       created_at TEXT DEFAULT CURRENT_TIMESTAMP
     )`
  );
  // auth.js ensureSchema creates users/sessions itself; the test only needs
  // the subscriptions table to exist before seeding (subscriptionState would
  // create it lazily anyway).
  db.exec(
    `CREATE TABLE subscriptions (
       user_id INTEGER PRIMARY KEY,
       stripe_customer_id TEXT,
       stripe_subscription_id TEXT,
       status TEXT NOT NULL DEFAULT 'inactive',
       current_period_end INTEGER,
       updated_at TEXT DEFAULT CURRENT_TIMESTAMP
     )`
  );
  seedUsers(d1);
  return { DB: d1 };
}

const SALE = {
  shop: "poshmark",
  listingRef: "/listing/Vintage-Silk-Scarf-123",
  listingUrl: "https://www.poshmark.com/listing/Vintage-Silk-Scarf-123",
  title: "Vintage silk scarf",
  price: 25,
  currency: "USD",
};

/* ------------------------------------------------------------------ gates */

test("POST /api/sales without a session token is 401, never a silent pass", async () => {
  const env = freshEnv();
  const { status, body } = await jsonOf(
    await salesPost({ request: req("https://x/api/sales", { method: "POST", body: SALE }), env })
  );
  assert.equal(status, 401);
  assert.equal(body.ok, false);
});

test("POST /api/sales with a session but no subscription is 402", async () => {
  const env = freshEnv();
  const { status, body } = await jsonOf(
    await salesPost({
      request: req("https://x/api/sales", { method: "POST", token: "tok_free", body: SALE }),
      env,
    })
  );
  assert.equal(status, 402);
  assert.equal(body.error, "subscription_required");
});

test("GET /api/sales without a session token is 401", async () => {
  const env = freshEnv();
  const { status } = await jsonOf(
    await salesGet({ request: req("https://x/api/sales"), env })
  );
  assert.equal(status, 401);
});

/* ------------------------------------------------------------ record+list */

test("POST records a sale; a re-post upserts (deduped) instead of duplicating", async () => {
  const env = freshEnv();
  const post = (body) =>
    salesPost({
      request: req("https://x/api/sales", { method: "POST", token: "tok_pro", body }),
      env,
    });

  const first = await jsonOf(await post(SALE));
  assert.equal(first.status, 200);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.sale.key, "poshmark:/listing/Vintage-Silk-Scarf-123");
  assert.equal(first.body.sale.status, "new");
  assert.equal(first.body.deduped, false);

  const second = await jsonOf(await post({ ...SALE, price: 27 }));
  assert.equal(second.body.ok, true);
  assert.equal(second.body.deduped, true);

  const list = await jsonOf(
    await salesGet({ request: req("https://x/api/sales", { token: "tok_pro" }), env })
  );
  assert.equal(list.body.ok, true);
  assert.equal(list.body.sales.length, 1);
  assert.equal(list.body.sales[0].price, 27);
  assert.deepEqual(list.body.counts, { new: 1 });
});

test("POST validates identity: missing shop/listingRef is 400", async () => {
  const env = freshEnv();
  for (const bad of [{}, { shop: "poshmark" }, { listingRef: "/x" }, { shop: "", listingRef: "" }]) {
    const { status, body } = await jsonOf(
      await salesPost({
        request: req("https://x/api/sales", { method: "POST", token: "tok_pro", body: bad }),
        env,
      })
    );
    assert.equal(status, 400, JSON.stringify(bad));
    assert.equal(body.error, "bad_request");
  }
});

test("sales are scoped per user: a second seller sees an empty list", async () => {
  const env = freshEnv();
  // give the second user a subscription too so the POST gate lets them in
  env.DB.prepare(`INSERT INTO subscriptions (user_id, status) VALUES (2, 'active')`).run();
  await salesPost({
    request: req("https://x/api/sales", { method: "POST", token: "tok_pro", body: SALE }),
    env,
  });
  const other = await jsonOf(
    await salesGet({ request: req("https://x/api/sales", { token: "tok_free" }), env })
  );
  assert.equal(other.body.ok, true);
  assert.deepEqual(other.body.sales, []);
});

test("GET ?status filters; an unknown status is 400", async () => {
  const env = freshEnv();
  await salesPost({
    request: req("https://x/api/sales", { method: "POST", token: "tok_pro", body: SALE }),
    env,
  });
  const bad = await jsonOf(
    await salesGet({ request: req("https://x/api/sales?status=bogus", { token: "tok_pro" }), env })
  );
  assert.equal(bad.status, 400);
  const only = await jsonOf(
    await salesGet({ request: req("https://x/api/sales?status=new", { token: "tok_pro" }), env })
  );
  assert.equal(only.body.sales.length, 1);
});

/* ------------------------------------------------------------------ ack */

test("POST /api/sales/ack acknowledges by key and dismisses by id", async () => {
  const env = freshEnv();
  const created = await jsonOf(
    await salesPost({
      request: req("https://x/api/sales", { method: "POST", token: "tok_pro", body: SALE }),
      env,
    })
  );
  const id = created.body.sale.id;

  const acked = await jsonOf(
    await salesAck({
      request: req("https://x/api/sales/ack", {
        method: "POST",
        token: "tok_pro",
        body: { key: SALE.shop + ":" + SALE.listingRef, action: "acknowledge" },
      }),
      env,
    })
  );
  assert.equal(acked.status, 200);
  assert.equal(acked.body.sale.status, "acknowledged");

  const dismissed = await jsonOf(
    await salesAck({
      request: req("https://x/api/sales/ack", {
        method: "POST",
        token: "tok_pro",
        body: { id, action: "dismiss" },
      }),
      env,
    })
  );
  assert.equal(dismissed.body.sale.status, "dismissed");

  const listed = await jsonOf(
    await salesGet({ request: req("https://x/api/sales?status=new", { token: "tok_pro" }), env })
  );
  assert.deepEqual(listed.body.sales, []);
});

test("ack of someone else's (or nobody's) sale is 404; bad action is 400", async () => {
  const env = freshEnv();
  const missing = await jsonOf(
    await salesAck({
      request: req("https://x/api/sales/ack", {
        method: "POST",
        token: "tok_pro",
        body: { key: "poshmark:/listing/Nope-0", action: "acknowledge" },
      }),
      env,
    })
  );
  assert.equal(missing.status, 404);

  const badAction = await jsonOf(
    await salesAck({
      request: req("https://x/api/sales/ack", {
        method: "POST",
        token: "tok_pro",
        body: { key: "poshmark:/x", action: "explode" },
      }),
      env,
    })
  );
  assert.equal(badAction.status, 400);
});

test("ack without auth is 401; without a subscription is 402", async () => {
  const env = freshEnv();
  const anon = await jsonOf(
    await salesAck({
      request: req("https://x/api/sales/ack", {
        method: "POST",
        body: { key: "poshmark:/x", action: "acknowledge" },
      }),
      env,
    })
  );
  assert.equal(anon.status, 401);
  const free = await jsonOf(
    await salesAck({
      request: req("https://x/api/sales/ack", {
        method: "POST",
        token: "tok_free",
        body: { key: "poshmark:/x", action: "acknowledge" },
      }),
      env,
    })
  );
  assert.equal(free.status, 402);
});

/* ------------------------------------------------------------ delist-log */

test("POST /api/sales/delist-log records every outcome; rejects anything else", async () => {
  const env = freshEnv();
  for (const outcome of ["ok", "failed", "skipped"]) {
    const r = await jsonOf(
      await delistLogPost({
        request: req("https://x/api/sales/delist-log", {
          method: "POST",
          token: "tok_pro",
          body: {
            shop: "mercari",
            outcome,
            detail: "enqueued",
            saleKey: "poshmark:/listing/Vintage-Silk-Scarf-123",
            fromShop: "poshmark",
          },
        }),
        env,
      })
    );
    assert.equal(r.status, 200, outcome);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.outcome, outcome);
  }
  const bad = await jsonOf(
    await delistLogPost({
      request: req("https://x/api/sales/delist-log", {
        method: "POST",
        token: "tok_pro",
        body: { shop: "mercari", outcome: "deleted-maybe" },
      }),
      env,
    })
  );
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, "bad_outcome");

  const anon = await jsonOf(
    await delistLogPost({
      request: req("https://x/api/sales/delist-log", {
        method: "POST",
        body: { shop: "mercari", outcome: "ok" },
      }),
      env,
    })
  );
  assert.equal(anon.status, 401);
});
