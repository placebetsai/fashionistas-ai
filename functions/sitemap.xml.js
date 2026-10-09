/**
 * GET /sitemap.xml — static pages + every live listing.
 *
 * The checked-in sitemap listed only static pages: with zero item URLs in it,
 * Google had no way to learn that /shop/147 existed, and eight listings were
 * therefore invisible to search. This function keeps the hand-written page
 * entries and appends one <url> per active, photo-bearing listing straight from
 * the public market API (capped at its 100-row page).
 *
 * If the market API is down the static list still ships — a partial sitemap is
 * useful, a 500 is not.
 */
const API = "https://fashionistas-api.fashionistas1979.workers.dev";
const iso = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : new Date().toISOString().slice(0, 10));

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  let xml = "";
  try {
    const res = await env.ASSETS.fetch(new Request(new URL("/sitemap.xml", origin).toString()));
    if (res.ok) xml = await res.text();
  } catch (_) {}
  if (!xml.includes("</urlset>")) {
    xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`;
  }

  let items = [];
  try {
    const r = await fetch(`${API}/api/market?sort=new`, { headers: { Accept: "application/json" } });
    if (r.ok) items = ((await r.json()) || {}).market || [];
  } catch (_) {}

  const urls = items
    .filter((it) => it && it.id)
    .map(
      (it) =>
        `  <url><loc>${origin}/shop/${Number(it.id)}</loc><lastmod>${iso(it.listed_at)}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`
    )
    .join("\n");

  const out = xml.replace(/<\/urlset>/i, `${urls ? urls + "\n" : ""}</urlset>`);
  return new Response(out, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
