/**
 * tests/helpers/d1.mjs — a D1-shaped wrapper over node:sqlite.
 *
 * WHY THIS EXISTS (and why it is not a mock)
 *   Cloudflare D1 is SQLite with a promise-wrapped, chainable prepare():
 *     db.prepare(sql).bind(a, b).run()  -> { meta: { changes, last_row_id } }
 *     db.prepare(sql).first()           -> row | undefined
 *   node:sqlite exposes the same engine with bare-array results and
 *   { changes, lastInsertRowid }. Wrapping it means the tests below drive the
 *   REAL handlers against a REAL SQL engine: every CREATE TABLE, every UPSERT,
 *   every ON CONFLICT in the product code is genuinely executed. Nothing about
 *   the code under test is stubbed.
 *
 * NOTE ON THE NAME: this file is intentionally NOT a .test.mjs file, so the
 * suite's discovery globs never treat it as a test file.
 */

import { DatabaseSync } from "node:sqlite";

/** Wrap a node:sqlite DatabaseSync in the exact D1 surface this repo uses. */
export function makeD1(db) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          const stmt = db.prepare(sql);
          return {
            run: async () => stmt.run(...args),
            first: async () => stmt.get(...args),
            all: async () => stmt.all(...args),
            raw: async () => stmt.all(...args),
          };
        },
        run: async (...args) => db.prepare(sql).run(...args),
        first: async (...args) => db.prepare(sql).get(...args),
        all: async (...args) => db.prepare(sql).all(...args),
        raw: async (...args) => db.prepare(sql).all(...args),
      };
    },
    // Only `findD1()` in _tryon/ledger.js looks for .batch; nothing here needs
    // it to succeed, it just must exist for the duck-typed binding to match.
    batch: async (stmts) => Promise.all((stmts || []).map((s) => s.run())),
    exec: async (sql) => db.exec(sql),
    /** Escape hatch for tests that need to plant rows before any handler runs. */
    __raw: db,
  };
}

/** A fresh in-memory database + its D1 wrapper. */
export function freshD1() {
  const db = new DatabaseSync(":memory:");
  return { db, d1: makeD1(db) };
}

/**
 * The `users` + `sessions` shape functions/api/_lib/auth.js creates lazily.
 * The DDL is copied from that file so a seeded user is byte-identical to one a
 * real deployment would have; the handler's own CREATE TABLE IF NOT EXISTS is
 * then a genuine no-op against it.
 */
export function seedUser(db, { email = "qa@example.com", token = "qa-token-123", id = 1 } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.prepare(
    `INSERT INTO users (id, email, pass_hash, salt) VALUES (?, ?, ?, ?)`
  ).run(id, email, "hash", "salt");
  db.prepare(
    `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`
  ).run(id, token, Math.floor(Date.now() / 1000) + 3600);
  return { id, email, token };
}

/** Mark a seeded user as an ACTIVE subscriber (what the webhook writes). */
export function subscribe(db, userId, { days = 30 } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id INTEGER PRIMARY KEY,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      status TEXT NOT NULL DEFAULT 'inactive',
      current_period_end INTEGER,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.prepare(
    `INSERT INTO subscriptions (user_id, status, current_period_end) VALUES (?, 'active', ?)
       ON CONFLICT(user_id) DO UPDATE SET status='active', current_period_end=excluded.current_period_end`
  ).run(userId, Math.floor(Date.now() / 1000) + days * 86400);
}

/** A Request carrying a valid session as a Bearer token. */
export function authed(url, token = "qa-token-123", init = {}) {
  return new Request(url, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${token}` },
  });
}

/** A Request carrying a valid session as the HttpOnly cookie. */
export function cookieAuthed(url, token = "qa-token-123", init = {}) {
  return new Request(url, {
    ...init,
    headers: { ...(init.headers || {}), cookie: `fash_session=${token}` },
  });
}

/** JSON POST body helper. */
export function jsonPost(url, body, headers = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}