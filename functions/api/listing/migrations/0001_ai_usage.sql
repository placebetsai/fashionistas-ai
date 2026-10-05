-- functions/api/listing/migrations/0001_ai_usage.sql
-- Phase 4: monthly AI usage counters + the listings store the stylist grounds on.
--
-- STATUS: CHECKED IN, NOT APPLIED. `wrangler d1 execute --remote` cannot run
-- yet (Pages OAuth has not been clicked), so this file is the reviewed source
-- of truth for the schema. The handlers in functions/api/listing/_lib/usage.js
-- also run the same DDL lazily with CREATE TABLE IF NOT EXISTS — the pattern
-- functions/api/_lib/auth.js and functions/api/closet/clear.js already use —
-- so the endpoints work before anyone runs this, and running this later is a
-- no-op (every statement is idempotent).
--
-- To apply, once OAuth exists:
--   wrangler d1 execute fashionistas-db --remote --file functions/api/listing/migrations/0001_ai_usage.sql
--
-- COUNTERS (per user per UTC month; see CAPS in usage.js):
--   listings      free 10,  pro unlimited
--   ai_photos     free 3,   pro 100      <- reserved for the AI-photo route;
--                                           nothing in Phase 4 charges it
--   chat_messages free 10,  pro 100
-- Entitlement itself is NOT stored here: it comes from subscriptions.status
-- via subscriptionState() in functions/api/_lib/auth.js, exactly like the
-- other paid routes. This table only counts usage against that plan.
--
-- A counter row is only written AFTER a model answer passed schema validation,
-- so a failed model call never burns a free listing.

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL,
  month TEXT NOT NULL,                 -- 'YYYY-MM' in UTC
  listings INTEGER NOT NULL DEFAULT 0,
  ai_photos INTEGER NOT NULL DEFAULT 0,
  chat_messages INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, month)
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  condition TEXT,
  brand TEXT,
  colour TEXT,
  size TEXT,
  price REAL,
  tags TEXT,                           -- JSON array of strings
  hashtags TEXT,                       -- JSON array of strings
  breakdown TEXT,                      -- JSON snapshot of the fee breakdown at write time
  model_provider TEXT,
  model_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id, created_at);

-- Verify (run by hand after applying):
--   SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('ai_usage','listings');
