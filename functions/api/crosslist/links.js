/**
 * GET /api/crosslist/links?id=N — public: other shops where the seller confirmed this item
 * is listed AND gave a link. Powers "Buy on eBay ↗" on the item page. Only https links,
 * only status listed, only active listings.
 */
import { getDB, json } from "../_lib/auth.js";
import { SHOPS } from "../../_lib/shops.js";
export async function onRequestGet({ request, env }) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  const db = getDB(env);
  if (!Number.isInteger(id) || !db) return json({ ok: true, links: [] });
  try {
    const r = await db.prepare("SELECT p.platform, p.url FROM listing_platforms p JOIN listings l ON l.id=p.listing_id WHERE p.listing_id=? AND l.status='active' AND p.status IN ('listed','active') AND p.url LIKE 'https://%'").bind(id).all();
    const seen = new Set(), links = [];
    for (const x of r.results || []) {
      const s = SHOPS.find((s) => s.id === x.platform);
      if (!s || seen.has(s.id)) continue; seen.add(s.id);
      links.push({ platform: s.id, name: s.name, url: String(x.url).slice(0, 500) });
    }
    return json({ ok: true, links }, 200, { "Cache-Control": "public, max-age=60" });
  } catch (_) { return json({ ok: true, links: [] }); }
}
