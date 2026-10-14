/**
 * GET/POST /api/seller/prefs — the seller's chosen crosslist marketplaces, so setup is done once.
 * Lean D1: one row per seller. { marketplaces: ["poshmark", ...] }. Owner-only.
 * Per-item crosslist status lives in listing_platforms (POST /api/crosslist/status).
 */
import { requireAuth, getDB, json } from "../_lib/auth.js";
import { SHOPS } from "../../_lib/shops.js";
const ensure = (db) => db.prepare("CREATE TABLE IF NOT EXISTS seller_prefs (user_id INTEGER PRIMARY KEY, marketplaces TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const db = getDB(env); if (!db) return json({ ok: false, error: "db_unavailable" }, 503);
  await ensure(db);
  const r = await db.prepare("SELECT marketplaces, updated_at FROM seller_prefs WHERE user_id=?").bind(Number(auth.user.id)).first();
  let m = null; try { m = r ? JSON.parse(r.marketplaces) : null; } catch (_) {}
  return json({ ok: true, marketplaces: Array.isArray(m) ? m : null, updated_at: r ? r.updated_at : null });
}
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const db = getDB(env); if (!db) return json({ ok: false, error: "db_unavailable" }, 503);
  const b = await request.json().catch(() => ({}));
  const ids = new Set(SHOPS.map((s) => s.id));
  const m = [...new Set((Array.isArray(b.marketplaces) ? b.marketplaces : []).map(String))].filter((x) => ids.has(x) && x !== "fashionistas").slice(0, 30);
  await ensure(db);
  await db.prepare("INSERT INTO seller_prefs (user_id, marketplaces, updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET marketplaces=excluded.marketplaces, updated_at=CURRENT_TIMESTAMP").bind(Number(auth.user.id), JSON.stringify(m)).run();
  return json({ ok: true, marketplaces: m });
}
