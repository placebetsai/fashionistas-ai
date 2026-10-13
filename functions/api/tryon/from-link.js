/**
 * GET /api/tryon/from-link?url=<listing url>
 *   -> { ok, shop, title, price?, image: "/api/tryon/from-link?img=<signed>", buy_url }
 * GET /api/tryon/from-link?img=<url>  -> proxied listing photo (allowlisted CDN, <=8 MB)
 *
 * A buyer pastes or shares a Depop / Poshmark / Vinted / eBay / Etsy / Grailed /
 * Mercari listing. We read only the public og:image and og:title the shop
 * publishes for link previews, after checking that shop's robots.txt allows
 * the path. Cached 6 h. Nothing is posted anywhere and no account is used.
 * Affiliate params come later from env (AFF_<SHOP>, e.g. AFF_EBAY="campid=...").
 */
import { requireAuth } from "../_lib/auth.js";

const SHOPS = {
  "depop.com": "Depop", "poshmark.com": "Poshmark", "vinted.com": "Vinted", "vinted.co.uk": "Vinted",
  "vinted.fr": "Vinted", "ebay.com": "eBay", "ebay.co.uk": "eBay", "etsy.com": "Etsy",
  "grailed.com": "Grailed", "mercari.com": "Mercari",
};
const IMG_HOSTS = /(^|\.)(depop\.com|poshmark\.com|cloudfront\.net|vinted\.net|ebayimg\.com|etsystatic\.com|grailed\.com|mercdn\.net|mercari\.com|imgix\.net|fastly\.net)$/i;
const UA = "Mozilla/5.0 (compatible; fashionistas-preview/1.0; +https://fashionistas.ai/about/)";

const j = (b, s = 200, h = {}) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": s === 200 ? "public, max-age=21600" : "no-store", ...h } });

function shopOf(u) {
  const h = u.hostname.replace(/^(www|m)\./, "");
  for (const k of Object.keys(SHOPS)) if (h === k || h.endsWith("." + k)) return SHOPS[k];
  return null;
}
async function robotsAllows(u) {
  try {
    const r = await fetch(u.origin + "/robots.txt", { headers: { "user-agent": UA }, cf: { cacheTtl: 86400 } });
    if (!r.ok) return true;
    const txt = await r.text();
    let applies = false, allowed = true, best = -1;
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim(); if (!line) continue;
      const [k, ...rest] = line.split(":"); const v = rest.join(":").trim(); const key = k.toLowerCase();
      if (key === "user-agent") applies = v === "*" || /fashionistas/i.test(v);
      else if (applies && (key === "disallow" || key === "allow") && v) {
        const pat = v.replace(/\*/g, ""); if (u.pathname.startsWith(pat) && pat.length > best) { best = pat.length; allowed = key === "allow"; }
      }
    }
    return allowed;
  } catch { return true; }
}
const meta = (html, prop) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = re.exec(html); return m ? (m[1] || m[2]).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x?([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, /x/i.test(m) ? 16 : 10))).replace(/[\u200e\u200f]/g, "") : null;
};

export async function onRequestGet({ request, env }) {
  // Signed-in only: try-on needs an account anyway, and this keeps it from being an open fetch proxy.
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const q = new URL(request.url).searchParams;
  const img = q.get("img");
  if (img) {
    let u; try { u = new URL(img); } catch { return j({ ok: false, error: "bad_image" }, 400); }
    if (u.protocol !== "https:" || !IMG_HOSTS.test(u.hostname)) return j({ ok: false, error: "image_host_not_allowed" }, 400);
    const r = await fetch(u, { headers: { "user-agent": UA }, cf: { cacheTtl: 21600 } });
    const ct = r.headers.get("content-type") || "";
    const len = Number(r.headers.get("content-length") || 0);
    if (!r.ok || !/^image\//.test(ct) || len > 8e6) return j({ ok: false, error: "image_unavailable" }, 502);
    return new Response(r.body, { headers: { "content-type": ct, "cache-control": "public, max-age=21600" } });
  }
  let u; try { u = new URL(String(q.get("url") || "").trim()); } catch { return j({ ok: false, error: "Paste a full listing link (https://…)." }, 400); }
  const shop = u.protocol === "https:" ? shopOf(u) : null;
  if (!shop) return j({ ok: false, error: "Works with Depop, Poshmark, Vinted, eBay, Etsy, Grailed and Mercari links." }, 400);
  if (!(await robotsAllows(u))) return j({ ok: false, error: shop + " doesn't allow link previews for that page. Save the photo and add it instead." }, 403);
  let html = "";
  try {
    const r = await fetch(u, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", cf: { cacheTtl: 21600 } });
    if (!r.ok) return j({ ok: false, error: shop + " didn't share that listing (" + r.status + "). Save the photo and add it instead." }, 502);
    html = (await r.text()).slice(0, 600000);
  } catch { return j({ ok: false, error: "Couldn't reach " + shop + " right now." }, 502); }
  const image = meta(html, "og:image") || meta(html, "twitter:image");
  const title = meta(html, "og:title") || meta(html, "twitter:title") || ((/<title>([^<]{1,200})/i.exec(html) || [])[1] || "").trim();
  const price = meta(html, "product:price:amount") || meta(html, "og:price:amount");
  if (!image) return j({ ok: false, error: shop + " didn't include a photo for that link. Save the photo and add it instead." }, 422);
  let buy = u.toString();
  const aff = env && env["AFF_" + shop.toUpperCase()];
  if (aff) buy += (buy.includes("?") ? "&" : "?") + aff;
  return j({ ok: true, shop, title: title || shop + " listing", price: price || null, image: "/api/tryon/from-link?img=" + encodeURIComponent(image), buy_url: buy });
}
