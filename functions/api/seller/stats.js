/**
 * GET /api/seller/stats?days=30 — the signed-in seller's own listings with real counts:
 * views, saves, try-ons, clicks (per marketplace), shares, and sales + revenue from orders.
 */
import { requireAuth, json } from "../_lib/auth.js";
import { statsDb, ensureStats } from "../../_lib/listing-stats.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const uid = Number(auth.user.id);
  const db = statsDb(env);
  if (!db) return json({ ok: false, error: "db_unavailable" }, 503);
  await ensureStats(db);
  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const L = await db.prepare("SELECT id, title, price, status, photo_url FROM listings WHERE user_id=? ORDER BY id DESC LIMIT 500").bind(uid).all();
  const listings = (L.results || []).map((l) => ({ ...l, view: 0, save: 0, tryon: 0, click: 0, share: 0, sales: 0, revenue: 0, by_market: {} }));
  const byId = new Map(listings.map((l) => [l.id, l]));
  const S = await db.prepare("SELECT s.listing_id, s.kind, s.mkt, SUM(s.n) AS n FROM listing_stats s JOIN listings l ON l.id=s.listing_id WHERE l.user_id=? AND s.day>=? GROUP BY s.listing_id, s.kind, s.mkt").bind(uid, since).all();
  const markets = {};
  for (const r of S.results || []) {
    const l = byId.get(r.listing_id); if (!l) continue;
    l[r.kind] = (l[r.kind] || 0) + r.n;
    if (r.kind === "click" && r.mkt) {
      l.by_market[r.mkt] = l.by_market[r.mkt] || { click: 0, sales: 0, revenue: 0 }; l.by_market[r.mkt].click += r.n;
      markets[r.mkt] = markets[r.mkt] || { click: 0, sales: 0, revenue: 0 }; markets[r.mkt].click += r.n;
    }
  }
  try {
    const O = await db.prepare("SELECT listing_id, IFNULL(platform,'other') AS p, COUNT(*) AS c, SUM(IFNULL(sale_price,0)) AS rev FROM orders WHERE user_id=? GROUP BY listing_id, p").bind(uid).all();
    for (const r of O.results || []) {
      const p = String(r.p).toLowerCase();
      markets[p] = markets[p] || { click: 0, sales: 0, revenue: 0 }; markets[p].sales += r.c; markets[p].revenue += r.rev;
      const l = byId.get(r.listing_id); if (!l) continue;
      l.sales += r.c; l.revenue += r.rev;
      l.by_market[p] = l.by_market[p] || { click: 0, sales: 0, revenue: 0 }; l.by_market[p].sales += r.c; l.by_market[p].revenue += r.rev;
    }
  } catch (_) {}
  const totals = listings.reduce((t, l) => { for (const k of ["view", "save", "tryon", "click", "share", "sales", "revenue"]) t[k] += l[k]; return t; }, { view: 0, save: 0, tryon: 0, click: 0, share: 0, sales: 0, revenue: 0 });
  return json({ ok: true, days, since, totals, markets, listings, note: "Counts start when tracking went live; sales come from recorded orders (incl. ones you log)." });
}
