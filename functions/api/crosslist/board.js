/**
 * GET /api/crosslist/board — the signed-in seller's listings with every shop's status.
 * Statuses come from listing_platforms (seller-marked or API-confirmed). Nothing is
 * marked "listed" unless the seller said so or a shop API returned an id.
 */
import { requireAuth, getDB, json } from "../_lib/auth.js";
import { SHOPS } from "../../_lib/shops.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const db = getDB(env); if (!db) return json({ ok: false, error: "db_unavailable" }, 503);
  const uid = Number(auth.user.id);
  const L = await db.prepare("SELECT id, title, price, status, photo_url, description, brand, size, condition, color, category FROM listings WHERE user_id=? ORDER BY id DESC LIMIT 300").bind(uid).all();
  const rows = L.results || [];
  const byId = new Map(rows.map((l) => [l.id, { ...l, shops: {} }]));
  if (rows.length) {
    try {
      const P = await db.prepare(`SELECT p.* FROM listing_platforms p JOIN listings l ON l.id=p.listing_id WHERE l.user_id=?`).bind(uid).all();
      for (const p of P.results || []) { const l = byId.get(p.listing_id); if (l) l.shops[p.platform] = { status: p.status || "draft", url: p.url || null, remote_id: p.remote_id || null }; }
    } catch (_) {}
  }
  for (const l of byId.values()) {
    l.shops.fashionistas = { status: l.status === "sold" ? "sold" : l.status === "active" ? "listed" : (l.status || "draft"), url: `/shop/${l.id}` };
  }
  const keys = { ebay: !!(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET), etsy: !!env.ETSY_API_KEY, shopify: !!(env.SHOPIFY_STORE && env.SHOPIFY_ADMIN_TOKEN) };
  return json({ ok: true, shops: SHOPS.map((s) => ({ ...s, api_ready: s.mode === "api_when_keys" ? !!keys[s.id] : s.mode === "instant" })), listings: [...byId.values()] });
}
