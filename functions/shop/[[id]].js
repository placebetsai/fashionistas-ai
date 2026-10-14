/**
 * GET /shop/<id> — the marketplace's first crawlable address.
 *
 * Before this route existed, /shop/147 answered 404: an item could be reached
 * only by clicking inside a running SPA, so nothing could be linked, shared,
 * indexed or opened cold. This function serves the app shell with the real
 * listing head injected (title, description, Open Graph, Product JSON-LD), so
 * crawlers and link previews see the item while the SPA takes over rendering
 * on load.
 *
 * Status codes are honest: a live item is 200, a missing/delisted one is 404
 * (still shell, so the SPA can say "no longer for sale"), and if the Worker is
 * unreachable we fall back to a plain 200 shell rather than lying either way.
 */
import { itemHead, injectHead, itemBody, shopBody, injectBody } from "../_lib/item-meta.js";
import { filterMarketBody, isHidden } from "../_lib/hidden-listings.js";
import { fromSlug, inCategory, liveCategories, catUrl, slug } from "../_lib/category-pages.js";
import { shopScreen, itemScreen, prerenderInto, thumbPreload, TILE_SIZES, ITEM_SIZES } from "../_lib/prerender.js";

async function marketBody() {
  try {
    const r = await fetch(`${API}/api/market`, { headers: { Accept: "application/json" } });
    if (r.ok) return filterMarketBody((await r.json()) || null);
  } catch (_) {}
  return null;
}
async function market() { const b = await marketBody(); return (b && b.market) || []; }
/* Speed: hand the app the exact /api/market body the server already fetched, so
   the first shop/item paint doesn't wait for a second round trip after the JS runs.
   The shim in index.html serves it once to the app's first anonymous /w/api/market call. */
function embedMarket(b) {
  return b && Array.isArray(b.market) ? `<script>window.__FASH_MARKET__=${JSON.stringify(b).replace(/</g, "\\u003c")}</script>` : "";
}

const API = "https://fashionistas-api.fashionistas1979.workers.dev";

async function shell(context) {
  const url = new URL(context.request.url);
  const res = await context.env.ASSETS.fetch(new Request(new URL("/index.html", url.origin).toString()));
  return res.text();
}

/**
 * The shell IS index.html, so it carries the homepage hero heading:
 * <h1 class="rd-h1">. Once the SPA takes over an item it renders its own
 * <h1 class="ux-item-title">, which left every /shop/<id> document holding
 * two <h1>s — the second being a hero heading that was not even painted (the
 * hero sits inside a <section class="hidden">, display:none).
 *
 * Demote the shell's heading to a <div> for a live item, so the only <h1> on
 * the page is the thing actually for sale. This is purely semantic: the
 * demoted node is inside that hidden section either way, so nothing moves on
 * screen. It is applied to the live-item response only — the 404 path renders
 * no item heading of its own, so demoting there would leave a document with
 * none at all.
 */
export function demoteShellH1(html) {
  return String(html).replace(
    /<h1(\s+class="rd-h1"[^>]*)>([\s\S]*?)<\/h1>/,
    "<div$1>$2</div>"
  );
}

export async function onRequestGet(context) {
  const { request, params } = context;
  const raw = params && params.id;
  const idStr = Array.isArray(raw) ? raw.join("/") : raw || "";
  const url = new URL(request.url);
  const origin = url.origin;

  let body;
  try { body = await shell(context); } catch (_) { return context.next(); }
  // Speed: the homepage hero photos are preloaded in the shell; shop/item never show them.
  body = body.replace(/<link rel="preload" as="image" href="\/assets\/rd\/[^"]+"[^>]*>/g, "")
    .replace('<img src="/assets/rd/thrift-hands.webp" alt="" width="900" height="600" fetchpriority="high">', '<img src="/assets/rd/thrift-hands.webp" alt="" width="900" height="600" loading="lazy" decoding="async">');

  if (!idStr) {
    const mb = await marketBody();
    const items = (mb && mb.market) || [];
    return new Response(
      injectHead(
        injectBody(prerenderInto(demoteShellH1(body), "Shop", shopScreen(items)), shopBody(items)),
        `<title>Shop — fashionistas.ai</title>` +
          `<meta name="description" content="Everything for sale on fashionistas.ai — clothing, decor and objects listed by real sellers. One photo in, every shop updated.">` +
          `<link rel="canonical" href="${origin}/shop">` +
          items.filter((m) => m && m.photo_url).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)).slice(0, 1).map((m) => thumbPreload(m.photo_url, TILE_SIZES)).join("") + embedMarket(mb)
      ),
      { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } }
    );
  }

  if (/^[cb]\//.test(idStr)) {
    const isBrand = idStr[0] === "b";
    const c = isBrand ? null : fromSlug(idStr.slice(2));
    const bslug = isBrand ? idStr.slice(2).replace(/\/$/, "") : "";
    const mb = (c || bslug) ? await marketBody() : null;
    const all = (mb && mb.market) || [];
    const items = c ? all.filter((m) => inCategory(m, c)) : bslug ? all.filter((m) => m.brand && slug(m.brand) === bslug) : [];
    if (items.length) {
      const brandName = isBrand ? String(items[0].brand).trim() : "";
      const nice = isBrand ? brandName : (c.dept === "Home" || c.dept === "Art" ? (c.sub || c.dept) : (c.sub ? `${c.dept}'s ${c.sub}` : `${c.dept}'s fashion`));
      const path = isBrand ? `/shop/b/${bslug}` : catUrl(c.dept, c.sub);
      const canon = origin + path;
      const esc = (v) => String(v).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
      const live = liveCategories(all);
      const related = isBrand ? live.filter((x) => x.sub && items.some((m) => inCategory(m, x))) : live.filter((x) => x.dept === c.dept && x.sub && x.sub !== c.sub);
      const brands = [...new Set(items.map((m) => String(m.brand || "").trim()).filter(Boolean))].filter((b) => !isBrand);
      const prices = items.map((m) => Number(m.price)).filter((n) => n > 0).sort((a, b) => a - b);
      const priceLine = prices.length >= 2 ? ` Asking prices here run $${prices[0]}–$${prices[prices.length - 1]}.` : "";
      const seo = `<style>html.h-app body .ssr-seo{display:none}</style><section class="ssr-seo" style="max-width:1080px;margin:24px auto;padding:0 18px;color:var(--ink,#111)"><nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/shop">Shop</a>${!isBrand && c.sub ? ` › <a href="${catUrl(c.dept)}">${esc(c.dept)}</a>` : ""} › ${esc(nice)}</nav><h1>Secondhand ${esc(nice)} for sale</h1><p>${items.length} ${items.length === 1 ? "item" : "items"} listed by real sellers on fashionistas.ai.${priceLine} Try clothing on with your own photo before you buy.</p><ul>${items.map((m) => `<li><a href="/shop/${Number(m.id)}">${esc(m.title || "Item")}${m.price ? " · $" + Number(m.price) : ""}</a></li>`).join("")}</ul>${related.length ? `<p>Browse: ${related.map((x) => `<a href="${x.url}">${esc(x.dept + " " + x.sub)}</a>`).join(" · ")}</p>` : ""}${brands.length ? `<p>Brands: ${brands.map((b) => `<a href="/shop/b/${slug(b)}">${esc(b)}</a>`).join(" · ")}</p>` : ""}</section>`;
      const crumbs = [["Home", origin + "/"], ["Shop", origin + "/shop"]];
      if (!isBrand && c.sub) crumbs.push([c.dept, origin + catUrl(c.dept)]);
      crumbs.push([nice, canon]);
      const ld = [
        { "@context": "https://schema.org", "@type": "CollectionPage", name: `Secondhand ${nice}`, url: canon,
          mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items.slice(0, 24).map((m, i) => ({ "@type": "ListItem", position: i + 1, url: `${origin}/shop/${Number(m.id)}` })) } },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x[0], item: x[1] })) },
      ];
      const desc = `Shop ${items.length} secondhand ${nice} listed by real sellers on fashionistas.ai.${priceLine} Try it on with your photo first.`;
      const img = items.find((m) => m.photo_url);
      const catPath = isBrand ? "" : (c.sub ? `${c.dept}/${c.sub}` : c.dept);
      return new Response(
        injectHead(
          injectBody(prerenderInto(demoteShellH1(body), nice, shopScreen(items)), seo),
          `<title>Secondhand ${esc(nice)} — fashionistas.ai</title>` +
            `<meta name="description" content="${esc(desc)}">` +
            `<link rel="canonical" href="${canon}">` +
            `<meta property="og:type" content="website"><meta property="og:title" content="Secondhand ${esc(nice)} — fashionistas.ai"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}">` +
            (img ? `<meta property="og:image" content="${esc(img.photo_url)}">` : "") +
            ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("") +
            (catPath ? `<script>window.__FASH_CAT__=${JSON.stringify(catPath)}</script>` : `<script>window.__FASH_Q__=${JSON.stringify(brandName)}</script>`) + embedMarket(mb),
          // Demo-account listings are not real inventory: a page built only from them stays out of the index.
          { noindex: items.every((m) => [m.seller && m.seller.username, m.seller && m.seller.display_name].some((v) => String(v || "").trim().toLowerCase() === "demo")) }
        ),
        { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } }
      );
    }
    return new Response(injectHead(body, `<title>Nothing here yet — fashionistas.ai</title>`, { noindex: true }), {
      status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
    });
  }

  if (!/^\d+$/.test(idStr)) {
    return new Response(injectHead(body, `<title>Page not found — fashionistas.ai</title>`, { noindex: true }), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
    });
  }

  const morePromise = marketBody(); // in parallel with the listing fetch
  let listing = null;
  let missing = false;
  try {
    const r = await fetch(`${API}/api/market/${encodeURIComponent(idStr)}`, { headers: { Accept: "application/json" } });
    if (r.ok) {
      const b = await r.json().catch(() => null);
      listing = (b && b.listing) || null;
      if (listing && isHidden(listing)) listing = null;
      if (!listing) missing = true;
    } else if (r.status === 404) {
      missing = true;
    }
    // 429 / 5xx → neither listing nor missing: serve the plain shell.
  } catch (_) {
    listing = null;
  }

  if (!listing) {
    // Dead item: honest 404 + noindex (the shell's "index, follow" is stripped
    // by the robots rule, so we never ask a crawler to keep a sold-out page).
    // Unreachable API: plain 200 shell, no claim either way.
    const head = missing
      ? `<title>Item no longer for sale — fashionistas.ai</title>`
      : `<title>fashionistas.ai — Photograph Your Closet, Sell It Everywhere</title>`;
    return new Response(injectHead(body, head, { noindex: missing }), {
      status: missing ? 404 : 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": missing ? "public, max-age=60" : "no-store" },
    });
  }

  const sellerUser = String(listing.seller && listing.seller.username || "").trim().toLowerCase();
  const sellerName = String(listing.seller && (listing.seller.display_name || listing.seller.username) || "").trim().toLowerCase();
  const demoSeller = sellerUser === "demo" || sellerName === "demo";
  const mb = await morePromise;
  const more = (mb && mb.market) || [];
  return new Response(injectHead(injectBody(prerenderInto(demoteShellH1(body), "", itemScreen(listing)), itemBody(listing, more)), itemHead(listing, origin) + thumbPreload(listing.photo_url, ITEM_SIZES) + embedMarket(mb), { noindex: demoSeller }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}
