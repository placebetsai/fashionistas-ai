/**
 * GET /api/listing-photos/:id — every stored photo URL for one public listing (gallery).
 * Read-only, one indexed row, cached 5 min. Returns the cover only when no extra photos are stored.
 */
import { getDB, json } from "../_lib/auth.js";
const KEYS = ["photos", "images", "image_urls", "photo_urls", "pics", "extra_photos"];
export async function onRequestGet({ params, env }) {
  const id = Number(params.id); const db = getDB(env);
  if (!db || !id) return json({ photos: [] });
  try {
    const r = await db.prepare("SELECT * FROM listings WHERE id=? AND status IN ('active','reserved','sold')").bind(id).first();
    if (!r) return json({ photos: [] });
    let out = [];
    for (const k of KEYS) {
      const v = r[k]; if (!v) continue;
      try { const a = typeof v === "string" ? JSON.parse(v) : v; if (Array.isArray(a)) out = out.concat(a.map((x) => (typeof x === "string" ? x : x && x.url)).filter(Boolean)); }
      catch (_) { if (typeof v === "string") out = out.concat(v.split(/[\s,]+/).filter((u) => /^https?:\/\//.test(u))); }
    }
    if (r.photo_url && !out.includes(r.photo_url)) out.unshift(r.photo_url);
    out = [...new Set(out.filter((u) => /^https?:\/\//.test(u) || u.startsWith("/")))].slice(0, 10);
    return new Response(JSON.stringify({ photos: out }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
  } catch (_) { return json({ photos: [] }); }
}
