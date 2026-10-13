/**
 * GET /img/<240|480|800>/<image key>  → responsive WebP thumbnail from R2
 * (thumbs/w<w>/<key>.webp, written by scripts/backfill-thumbs.py).
 * No KV, no per-request writes. A missing thumb 302s to the original photo,
 * so a listing uploaded before the backfill ran still shows.
 */
const ORIGIN = "https://fashionistas-api.fashionistas1979.workers.dev/api/images/";
const WIDTHS = new Set(["240", "480", "800"]);
export async function onRequestGet({ params, env }) {
  const parts = Array.isArray(params.path) ? params.path : String(params.path || "").split("/");
  const [w, ...rest] = parts;
  const key = rest.join("/");
  if (!WIDTHS.has(w) || !/^u\/\d+\/[\w.\-]+$/.test(key)) return new Response("Not found", { status: 404 });
  const obj = env.IMAGES ? await env.IMAGES.get(`thumbs/w${w}/${key}.webp`) : null;
  if (!obj) return new Response(null, { status: 302, headers: { Location: ORIGIN + key, "Cache-Control": "public, max-age=300" } });
  return new Response(obj.body, { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" } });
}
