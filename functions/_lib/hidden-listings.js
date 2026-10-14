/**
 * Listings kept off the public shop, item pages and feeds.
 * HIDDEN_IDS: specific junk rows named in the 2026-10-14 readiness audit.
 * Non-fashion junk (cups, test rows) only; real clothing is never filtered here.
 */
export const HIDDEN_IDS = new Set(["155"]);
const TEST_TITLE = /^\s*(test|testing|asdf|qwerty|sample|dummy|xxx+)\b/i;

export function isHidden(m) {
  if (!m) return true;
  if (HIDDEN_IDS.has(String(m.id))) return true;
  return TEST_TITLE.test(String(m.title || ""));
}
export function visible(rows) {
  return Array.isArray(rows) ? rows.filter((m) => !isHidden(m)) : rows;
}
/** Filter an /api/market body ({market:[...], count}) in place. */
export function filterMarketBody(b) {
  if (b && Array.isArray(b.market)) {
    const kept = visible(b.market);
    if (typeof b.count === "number") b.count -= b.market.length - kept.length;
    b.market = kept;
  }
  return b;
}
