/**
 * Shared access to the live catalogue for the export feeds.
 *
 * The listings live in D1 behind the API Worker, not in Pages, so every feed
 * reads them the same way the shop does: one call to /api/market. Centralised
 * so a Worker outage degrades to an empty feed in one place instead of five
 * different crash behaviours.
 */

const API = "https://fashionistas-api.fashionistas1979.workers.dev";

/**
 * Every listing a shopper could buy, or [] when the API is unreachable.
 *
 * Deliberately never throws: a feed that 500s teaches Merchant Center to stop
 * fetching, and one bad deploy would then cost the whole catalogue its
 * listings. An empty file is a no-op import; a 500 is a fault.
 */
export async function fetchMarket(limit = 500) {
  try {
    const r = await fetch(`${API}/api/market?limit=${encodeURIComponent(limit)}`, {
      headers: { Accept: "application/json" },
      // Feeds are polled on a schedule by a crawler; 25s is the point where a
      // hung Worker should answer "nothing for sale yet" rather than stall.
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return [];
    const b = await r.json().catch(() => null);
    const rows = (b && b.market) || [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Item URL. Feeds must link to the item itself, never the shop home. */
export function itemUrl(origin, id) {
  return `${origin}/shop/${Number(id)}`;
}

/** Plain text, trimmed and stripped of anything a feed parser chokes on. */
export function plain(v, max = 5000) {
  return String(v == null ? "" : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}
