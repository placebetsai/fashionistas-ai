/**
 * /price-guide/ and /price-guide/<dept>/<sub>/ — asking-price guides built ONLY from live
 * fashionistas.ai listings. A guide exists (and is indexable) only with MIN_N priced listings;
 * below that the page says so and is noindex. No outside or invented prices.
 */
import { fromSlug, inCategory, liveCategories, catUrl, slug } from "../_lib/category-pages.js";
import { visible } from "../_lib/hidden-listings.js";
const API = "https://fashionistas-api.fashionistas1979.workers.dev";
const MIN_N = 3, AD_N = 5;
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
async function market() {
  try { const r = await fetch(`${API}/api/market?limit=500`, { headers: { Accept: "application/json" } }); if (r.ok) return visible(((await r.json()) || {}).market || []); } catch (_) {}
  return [];
}
const median = (a) => (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2);
export function guides(items) {
  return liveCategories(items).filter((c) => c.sub).map((c) => {
    const ps = items.filter((m) => inCategory(m, c)).map((m) => Number(m.price)).filter((n) => n > 0).sort((a, b) => a - b);
    return { ...c, prices: ps, url: `/price-guide/${slug(c.dept)}/${slug(c.sub)}/` };
  }).filter((g) => g.prices.length >= MIN_N);
}
function page({ title, desc, canon, body, noindex, ads, ld }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}">
${noindex ? '<meta name="robots" content="noindex,follow">' : ""}
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/site.css">
${ads ? '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7215975042937417" crossorigin="anonymous" data-ad-client="ca-pub-7215975042937417"></script>' : ""}
${(ld || []).map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("")}
</head><body><div class="wrap"><header class="topnav"><a class="brand" href="/">fashionistas<span>.ai</span></a> <nav><a href="/shop">Shop</a> <a href="/price-guide/">Price guides</a> <a href="/blog/">Blog</a> <a href="/about/">About</a> <a href="/contact/">Contact</a></nav></header>
<main>${body}${ads ? '<div data-ad-slot="bottom"></div>' : ""}</main>
<footer class="site-footer"><nav aria-label="Footer"><a href="/">Home</a> <a href="/about/">About</a> <a href="/contact/">Contact</a> <a href="/privacy/">Privacy</a> <a href="/terms/">Terms</a> <a href="/blog/how-to-price-used-clothes/">How to price used clothes</a></nav></footer></div>
${ads ? '<script type="module">import { mountAllAdSlots } from "/site-adsense.js?v=2"; mountAllAdSlots();</script>' : ""}
</body></html>`;
}
const html = (s, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" } });
export async function onRequestGet({ request, params }) {
  const origin = new URL(request.url).origin;
  const parts = [].concat(params.path || []).filter(Boolean);
  const items = await market();
  const all = guides(items);
  if (!parts.length) {
    const body = `<h1>Secondhand price guides</h1><p>Asking prices from live listings on fashionistas.ai, per category. A guide appears once a category has at least ${MIN_N} priced listings — we don't pad these with outside or estimated numbers.</p>` +
      (all.length ? `<ul>${all.map((g) => `<li><a href="${g.url}">${esc(g.dept)} ${esc(g.sub)}</a> — ${g.prices.length} listings</li>`).join("")}</ul>`
        : `<p><strong>Not enough listings yet for any guide.</strong> Meanwhile, read <a href="/blog/how-to-price-used-clothes/">how to price used clothes</a> or <a href="/shop">browse the shop</a>.</p>`);
    return html(page({ title: "Secondhand price guides — fashionistas.ai", desc: "Real asking prices for secondhand clothing by category, from live fashionistas.ai listings.", canon: origin + "/price-guide/", body, noindex: !all.length, ads: false }));
  }
  const c = fromSlug(parts.join("/"));
  const g = c && all.find((x) => x.dept === c.dept && x.sub === c.sub);
  if (!g) return html(page({ title: "Price guide not available yet — fashionistas.ai", desc: "Not enough live listings for this guide yet.", canon: origin + "/price-guide/", body: `<h1>Not enough listings yet</h1><p>This guide needs at least ${MIN_N} priced listings. <a href="/price-guide/">All price guides</a></p>`, noindex: true }), 404);
  const p = g.prices, med = median(p);
  const name = `${g.dept} ${g.sub}`;
  const canon = origin + g.url;
  const faq = [
    [`What do secondhand ${name.toLowerCase()} sell for?`, `On fashionistas.ai, ${p.length} live listings ask between $${p[0]} and $${p[p.length - 1]}, with a median of $${med}.`],
    [`How should I price my ${g.sub.toLowerCase()}?`, `Start near the median ($${med}) for good condition, go lower for wear, and check sold prices on other shops too. See our pricing guide.`],
  ];
  const body = `<nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/price-guide/">Price guides</a> › ${esc(name)}</nav>
<h1>${esc(name)} price guide</h1>
<p>Based on <strong>${p.length}</strong> live listings on fashionistas.ai (asking prices, not sold prices). Updated automatically.</p>
<table><tr><th>Lowest</th><th>Median</th><th>Highest</th></tr><tr><td>$${p[0]}</td><td>$${med}</td><td>$${p[p.length - 1]}</td></tr></table>
${faq.map((f) => `<h2>${esc(f[0])}</h2><p>${esc(f[1])}</p>`).join("")}
<p><a href="${catUrl(g.dept, g.sub)}">Shop ${esc(name)}</a> · <a href="/blog/how-to-price-used-clothes/">How to price used clothes</a></p>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f[0], acceptedAnswer: { "@type": "Answer", text: f[1] } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Home", origin + "/"], ["Price guides", origin + "/price-guide/"], [name, canon]].map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x[0], item: x[1] })) },
  ];
  return html(page({ title: `${name} price guide (secondhand) — fashionistas.ai`, desc: `Secondhand ${name.toLowerCase()} asking prices from ${p.length} live listings: $${p[0]}–$${p[p.length - 1]}, median $${med}.`, canon, body, ads: p.length >= AD_N, ld }));
}
