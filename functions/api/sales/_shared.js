/**
 * functions/api/sales/_shared.js — D1 schema + row helpers for sale detection.
 *
 * Files/directories prefixed with `_` are ignored by the Pages Functions
 * router, so this is a library, not a route (same convention as ../_lib/).
 *
 * Identity is derived, never generated, mirroring
 * apps/extension/sales/registry.js:
 *
 *     key = `${shop}:${listingRef}`      (listingRef = the listing's URL path)
 *
 * so the same closet scanned every minute produces ONE event, and a re-post
 * from a second device upserts instead of duplicating. The UNIQUE constraint
 * is (user_id, shop, listing_ref) — two sellers never collide, two shops never
 * collide.
 *
 * Nothing here touches delist_queue: deletion stays entirely inside the
 * existing functions/api/delist.js path. This module only records what sold,
 * lists it, and tracks acknowledgement.
 */

export const SALES_EVENTS_SCHEMA = `CREATE TABLE IF NOT EXISTS sales_events (
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
)`;

/** Ledger for one-tap delist attempts (outcome ∈ ok | failed | skipped). */
export const SALES_DELIST_LOG_SCHEMA = `CREATE TABLE IF NOT EXISTS sales_delist_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sale_key TEXT,
  from_shop TEXT,
  shop TEXT NOT NULL,
  outcome TEXT NOT NULL,
  detail TEXT,
  at TEXT,
  created_at INTEGER NOT NULL
)`;

export const SALE_STATUSES = new Set(["new", "acknowledged", "dismissed"]);

/** Shops sale detection covers — byte-for-byte SALES_SHOPS in sold-selectors.js. */
export const SALES_SHOPS = Object.freeze([
  "poshmark",
  "mercari",
  "depop",
  "grailed",
  "ebay",
  "etsy",
]);

export async function ensureSalesSchema(db) {
  await db.prepare(SALES_EVENTS_SCHEMA).run();
  await db.prepare(SALES_DELIST_LOG_SCHEMA).run();
}

function strOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** The stable identity of a sale — must match registry.saleKey() exactly. */
export function saleKey(shop, listingRef) {
  const s = String(shop || "").trim();
  const r = String(listingRef || "").trim();
  if (!s || !r) return null;
  return `${s}:${r}`;
}

/** Normalize one row for the wire (never leaks other users' rows: caller scopes by user_id). */
export function toSaleJson(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id,
    key: `${row.shop}:${row.listing_ref}`,
    shop: row.shop,
    listingRef: row.listing_ref,
    listingUrl: row.listing_url,
    title: row.title,
    price: row.price,
    currency: row.currency,
    soldAt: row.sold_at,
    soldAtText: row.sold_at_text,
    detectedAt: row.detected_at,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { strOrNull, numOrNull };
