/** GET /api/stats/popular — {listing_id: score} over the last 30 days (views + 3×saves + 3×try-ons + 2×clicks). Public, cached 5 min. */
import { statsDb, ensureStats } from "../../_lib/listing-stats.js";
export async function onRequestGet({ env }) {
  const out = {};
  try {
    const db = statsDb(env);
    if (db) {
      await ensureStats(db);
      const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const r = await db.prepare("SELECT listing_id, SUM(CASE kind WHEN 'view' THEN n WHEN 'click' THEN 2*n ELSE 3*n END) AS s FROM listing_stats WHERE day >= ? GROUP BY listing_id").bind(since).all();
      for (const row of r.results || []) out[row.listing_id] = row.s;
    }
  } catch (_) {}
  return new Response(JSON.stringify({ popular: out }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });
}
