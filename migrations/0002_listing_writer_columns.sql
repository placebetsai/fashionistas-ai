-- The AI-listing writer (functions/api/listing/_lib/usage.js) INSERTs 6 columns that
-- the live `listings` table never had. The live table was created by a different schema
-- (the 418KB index.html app), so CREATE TABLE IF NOT EXISTS silently skipped ours and
-- every insert threw "no such column: colour", which the catch swallowed -> returned null.
-- Proof before this migration:
--   $ wrangler d1 execute fashionistas-db --remote --command "INSERT INTO listings (user_id,title,...,colour,tags,hashtags,breakdown,model_provider,model_name) VALUES (...)"
--   ✘ table listings has no column named colour: SQLITE_ERROR [code: 7500]
ALTER TABLE listings ADD COLUMN colour TEXT;
ALTER TABLE listings ADD COLUMN tags TEXT;
ALTER TABLE listings ADD COLUMN hashtags TEXT;
ALTER TABLE listings ADD COLUMN breakdown TEXT;
ALTER TABLE listings ADD COLUMN model_provider TEXT;
ALTER TABLE listings ADD COLUMN model_name TEXT;
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id, created_at);
