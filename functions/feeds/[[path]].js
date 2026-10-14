/**
 * Public product feed per seller: /feeds/<userId>.xml (Google RSS 2.0, also accepted by Meta Commerce,
 * Pinterest and TikTok catalogs) and /feeds/<userId>.csv. Only that seller's live, for-sale listings —
 * the same data already public on /shop. Free; the seller pastes the URL into each service once.
 */
import { getDB } from "../api/_lib/auth.js";
const X = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const C = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
export async function onRequestGet({ params, env, request }) {
  const m = String((params.path || []).join("/")).match(/^(\d+)\.(xml|csv)$/);
  if (!m) return new Response("Not found", { status: 404 });
  const db = getDB(env); if (!db) return new Response("Unavailable", { status: 503 });
  const uid = Number(m[1]), origin = "https://fashionistas.ai";
  let rows = [];
  try { rows = (await db.prepare("SELECT id, title, description, price, photo_url, brand, size, condition, color, category, platforms FROM listings WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1000").bind(uid).all()).results || []; } catch {}
  rows = rows.filter((l) => l.photo_url && l.title && Number(l.price) > 0 && String(l.platforms || "").includes("fashionistas"));
  const cond = (c) => (/new/i.test(c || "") ? "new" : "used");
  const img = (u) => String(u).replace(/^http:/, "https:");
  if (m[2] === "csv") {
    const head = "id,title,description,availability,condition,price,link,image_link,brand,size,color,identifier_exists";
    const body = rows.map((l) => [l.id, l.title, l.description || l.title, "in stock", cond(l.condition), Number(l.price).toFixed(2) + " USD", origin + "/shop/" + l.id, img(l.photo_url), l.brand || "", l.size || "", l.color || "", "no"].map(C).join(",")).join("\n");
    return new Response(head + "\n" + body + "\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=900", "X-Robots-Tag": "noindex" } });
  }
  const items = rows.map((l) => `<item><g:id>${l.id}</g:id><title>${X(String(l.title).slice(0, 150))}</title><description>${X(String(l.description || l.title).slice(0, 5000))}</description><link>${origin}/shop/${l.id}</link><g:image_link>${X(img(l.photo_url))}</g:image_link><g:availability>in_stock</g:availability><g:condition>${cond(l.condition)}</g:condition><g:price>${Number(l.price).toFixed(2)} USD</g:price>${l.brand ? `<g:brand>${X(l.brand)}</g:brand>` : ""}${l.size ? `<g:size>${X(l.size)}</g:size>` : ""}${l.color ? `<g:color>${X(l.color)}</g:color>` : ""}<g:identifier_exists>no</g:identifier_exists></item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>fashionistas.ai seller ${uid}</title><link>${origin}/</link><description>Listings from fashionistas.ai</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900", "X-Robots-Tag": "noindex" } });
}
