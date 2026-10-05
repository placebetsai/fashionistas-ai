-- functions/api/sales/migration-001-sales-events.sql
--
-- Idempotent D1 migration for Phase 2 (sale detection). Safe to apply more
-- than once: every statement is CREATE TABLE IF NOT EXISTS, and the server
-- itself runs the same statements on every request (ensureSalesSchema in
-- functions/api/sales/_shared.js), so a database that already has these tables
-- is untouched.
--
-- We cannot run `wrangler d1 execute --remote` yet (Cloudflare OAuth not
-- clicked), so this file is the checked-in record of what must be applied.
-- When remote access exists:
--
--   wrangler d1 execute <DB_NAME> --remote \
--     --file=functions/api/sales/migration-001-sales-events.sql
--
-- Identity mirrors apps/extension/sales/registry.js:
--   key = shop + ':' + listing_ref  →  UNIQUE(user_id, shop, listing_ref)

CREATE TABLE IF NOT EXISTS sales_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  shop TEXT NOT NULL,
  listing_ref TEXT NOT NULL,
  listing_url TEXT,
  title TEXT,
  price REAL,
  currency TEXT,
  sold_at TEXT,
  sold_at_text TEXT,
  detected_at TEXT,
  source TEXT NOT NULL DEFAULT 'scan',
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, shop, listing_ref)
);

CREATE TABLE IF NOT EXISTS sales_delist_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sale_key TEXT,
  from_shop TEXT,
  shop TEXT NOT NULL,
  outcome TEXT NOT NULL,
  detail TEXT,
  at TEXT,
  created_at INTEGER NOT NULL
);
