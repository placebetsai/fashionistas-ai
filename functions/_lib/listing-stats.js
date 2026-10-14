/**
 * Lean listing analytics: one D1 row per (listing, day, kind, marketplace) with a counter.
 * No raw event log in D1. Kinds are real, client- or server-observed events only.
 */
export const KINDS = ["view", "save", "tryon", "click", "share"];
export const MARKETS = ["", "fashionistas", "ebay", "etsy", "shopify", "depop", "poshmark", "mercari", "vinted", "grailed", "facebook", "whatnot", "vestiaire", "kidizen", "curtsy", "amazon", "walmart", "thredup", "therealreal", "other"];

export function statsDb(env) {
  for (const n of ["DB", "FASHIONISTAS_DB"]) if (env && env[n] && typeof env[n].prepare === "function") return env[n];
  return null;
}
let ready = false;
export async function ensureStats(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS listing_stats (listing_id INTEGER NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, mkt TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (listing_id, day, kind, mkt))").run();
  ready = true;
}
export function today() { return new Date().toISOString().slice(0, 10); }
export async function bump(db, listingId, kind, mkt = "", by = 1) {
  await ensureStats(db);
  await db.prepare("INSERT INTO listing_stats (listing_id, day, kind, mkt, n) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(listing_id, day, kind, mkt) DO UPDATE SET n = n + ?5")
    .bind(listingId, today(), kind, mkt, by).run();
}
