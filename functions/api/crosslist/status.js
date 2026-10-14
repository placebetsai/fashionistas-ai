/**
 * POST /api/crosslist/status {listing_id, platform, status: copied|listed|sold|delisted|not_started, url?, price?}
 * The seller's own record of where an item is. Owner-checked. "sold" also records an order
 * (feeds seller stats) and marks the listing sold on fashionistas.ai.
 */
import { requireAuth, getDB, json } from "../_lib/auth.js";
import { CHANNELS } from "../../_lib/channels.js";
import { SHOPS, STATUSES } from "../../_lib/shops.js";
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const db = getDB(env); if (!db) return json({ ok: false, error: "db_unavailable" }, 503);
  const b = await request.json().catch(() => ({}));
  const id = Number(b.listing_id), platform = String(b.platform || ""), status = String(b.status || "");
  if (!Number.isInteger(id) || !(SHOPS.some((s) => s.id === platform) || CHANNELS.some((c) => c.id === platform)) || platform === "fashionistas" && status !== "sold" || !STATUSES.includes(status)) return json({ ok: false, error: "bad_request" }, 400);
  const own = await db.prepare("SELECT id, price FROM listings WHERE id=? AND user_id=?").bind(id, Number(auth.user.id)).first();
  if (!own) return json({ ok: false, error: "not_found" }, 404);
  let url = String(b.url || "").trim().slice(0, 500);
  if (url && !/^https:\/\//i.test(url)) url = "";
  try { await db.prepare("CREATE TABLE IF NOT EXISTS listing_platforms (id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER, platform TEXT, status TEXT, listing_copy TEXT, url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run(); } catch (_) {}
  try { await db.prepare("ALTER TABLE listing_platforms ADD COLUMN url TEXT").run(); } catch (_) {}
  if (platform !== "fashionistas") {
    const ex = await db.prepare("SELECT 1 AS x FROM listing_platforms WHERE listing_id=? AND platform=?").bind(id, platform).first();
    if (ex) await db.prepare("UPDATE listing_platforms SET status=?, url=COALESCE(NULLIF(?,''),url) WHERE listing_id=? AND platform=?").bind(status, url, id, platform).run();
    else await db.prepare("INSERT INTO listing_platforms (listing_id, platform, status, url) VALUES (?,?,?,?)").bind(id, platform, status, url || null).run();
  }
  if (status === "sold") {
    const price = Number(b.price) > 0 ? Number(b.price) : Number(own.price) || 0;
    await db.prepare("UPDATE listings SET status='sold', sold_price=?, sold_platform=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(price, platform, id).run();
    try { await db.prepare("INSERT INTO orders (user_id, listing_id, platform, sale_price, fee, shipping, cogs, profit, status) VALUES (?,?,?,?,0,0,0,?,'completed')").bind(Number(auth.user.id), id, platform, price, price).run(); } catch (_) {}
  }
  return json({ ok: true });
}
