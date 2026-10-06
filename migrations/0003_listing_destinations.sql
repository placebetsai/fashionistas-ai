-- Design rule: every listing lives in OUR D1 as the master record; marketplaces
-- are DESTINATIONS only. listings = the truth, this table = where it was sent.
CREATE TABLE IF NOT EXISTS listing_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL,
  marketplace TEXT NOT NULL,
  external_id TEXT,
  external_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  listed_at TEXT,
  last_synced_at TEXT,
  sold_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (listing_id, marketplace)
);
CREATE INDEX IF NOT EXISTS idx_listing_dest_listing ON listing_destinations(listing_id, marketplace);
CREATE INDEX IF NOT EXISTS idx_listing_dest_status ON listing_destinations(status);
