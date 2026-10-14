/**
 * POST /api/events  {listing_id, kind: view|save|tryon|click|share, mkt?}
 * Public (buyers are mostly signed out). Counts only; the client dedupes views per
 * session, and this route rate-limits per IP in memory so a loop can't inflate stats.
 * sendBeacon-friendly: accepts text/plain JSON. Always answers 204.
 */
import { KINDS, MARKETS, statsDb, bump } from "../_lib/listing-stats.js";
const RL = new Map();
function allow(ip) {
  const m = Math.floor(Date.now() / 60000), k = ip + ":" + m;
  const n = (RL.get(k) || 0) + 1; RL.set(k, n);
  if (RL.size > 5000) RL.clear();
  return n <= 60;
}
const done = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
export async function onRequestPost({ request, env }) {
  try {
    if (!allow(request.headers.get("cf-connecting-ip") || "?")) return done();
    const ua = request.headers.get("user-agent") || "";
    if (/bot|crawl|spider|slurp|headless|lighthouse/i.test(ua)) return done();
    const b = JSON.parse((await request.text()).slice(0, 2000) || "{}");
    const id = Number(b.listing_id), kind = String(b.kind || ""), mkt = String(b.mkt || "").toLowerCase();
    if (!Number.isInteger(id) || id <= 0 || !KINDS.includes(kind)) return done();
    const db = statsDb(env); if (!db) return done();
    await bump(db, id, kind, MARKETS.includes(mkt) ? mkt : "other");
  } catch (_) {}
  return done();
}
