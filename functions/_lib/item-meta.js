import { resolveCategory } from "./categories.js";
/**
 * Server-rendered <head> for a single listing.
 *
 * The app is a client-rendered SPA, so before this every listing — every
 * /shop/<id> — went out with the site-wide title and no description. Crawlers
 * and link previews therefore saw eight (or eight thousand) identical pages,
 * which is why no item was ever findable. These helpers inject the real
 * title / description / Open Graph tags / Product JSON-LD into the shell.
 *
 * Pure functions on purpose: no fetch, no DOM — unit-tested directly.
 */

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** JSON embedded in a <script> tag must not be able to close the tag. */
const jsonForScript = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

/** Facts that make a description worth reading in a search result. */
export function listingDescription(l) {
  if (!l) return "";
  if (l.description) return String(l.description).trim().slice(0, 155);
  // A listing with no seller-written description still has to say what it is.
  // Brand and colour come first: those are the two words a shopper actually
  // types, and they were missing entirely.
  const bits = [
    l.brand, l.title,
    l.color ? `${l.color}` : "",
    l.material ? `${l.material}` : "",
    l.condition ? `Condition: ${l.condition}` : "",
    l.size ? `Size ${l.size}` : "",
  ].filter(Boolean);
  return [...new Set(bits)].join(" · ").slice(0, 155);
}

/* Google's product taxonomy path, used by Merchant Center and TikTok's ads
   catalog. Only the branches this shop can actually hold are mapped; anything
   unmapped omits the tag rather than guessing, because a wrong taxonomy is a
   disapproval and a missing one is only a warning. */
const GOOGLE_CATEGORY = {
  Tops: "Apparel & Accessories > Clothing > Shirts & Tops",
  Sweaters: "Apparel & Accessories > Clothing > Shirts & Tops",
  "T-Shirts": "Apparel & Accessories > Clothing > Shirts & Tops",
  "Button-Down Shirts": "Apparel & Accessories > Clothing > Shirts & Tops",
  Polos: "Apparel & Accessories > Clothing > Shirts & Tops",
  "Hoodies & Sweatshirts": "Apparel & Accessories > Clothing > Shirts & Tops",
  Dresses: "Apparel & Accessories > Clothing > Dresses",
  "Jumpsuits & Rompers": "Apparel & Accessories > Clothing > Overalls & Jumpsuits",
  Jeans: "Apparel & Accessories > Clothing > Pants > Jeans",
  Pants: "Apparel & Accessories > Clothing > Pants",
  Skirts: "Apparel & Accessories > Clothing > Skirts",
  Shorts: "Apparel & Accessories > Clothing > Shorts",
  "Coats & Jackets": "Apparel & Accessories > Clothing > Coats & Jackets",
  "Suits & Blazers": "Apparel & Accessories > Clothing > Suits",
  Activewear: "Apparel & Accessories > Clothing > Athletic Clothing",
  Swimwear: "Apparel & Accessories > Clothing > Swimwear > Swimwear",
  Sneakers: "Apparel & Accessories > Shoes > Athletic Shoes",
  Boots: "Apparel & Accessories > Shoes > Boots",
  Heels: "Apparel & Accessories > Shoes > High Heels",
  Flats: "Apparel & Accessories > Shoes > Flats",
  Sandals: "Apparel & Accessories > Shoes > Sandals",
  "Casual Shoes": "Apparel & Accessories > Shoes > Casual Shoes",
  "Dress Shoes": "Apparel & Accessories > Shoes > Dress Shoes",
  "Bags & Handbags": "Apparel & Accessories > Handbags, Wallets & Cases > Handbags",
  "Bags & Backpacks": "Apparel & Accessories > Bags & Backpacks > Backpacks",
  "Kids' Bags & Backpacks": "Apparel & Accessories > Bags & Backpacks > Backpacks",
  Jewelry: "Apparel & Accessories > Jewelry",
  Watches: "Apparel & Accessories > Watches",
  Hats: "Apparel & Accessories > Hats",
  Belts: "Apparel & Accessories > Belts",
  Scarves: "Apparel & Accessories > Scarves & Wraps",
  Sunglasses: "Apparel & Accessories > Eyewear > Sunglasses",
  Wallets: "Apparel & Accessories > Handbags, Wallets & Cases > Wallets",
  Mirrors: "Home & Living > Home Decor > Mirrors",
  Rugs: "Home & Living > Rugs",
  "Lamps & Lighting": "Home & Living > Lighting > Lamps",
  Furniture: "Home & Living > Furniture",
  "Home Accents": "Home & Living > Home Decor > Decorative Accessories",
  Paintings: "Media Types > Images > Fine Art Images > Paintings",
  Prints: "Media Types > Images > Fine Art Images > Prints",
  Posters: "Media Types > Images > Fine Art Images > Prints > Posters",
  Photographs: "Media Types > Images > Fine Art Images > Photographs",
  Sculptures: "Media Types > Images > Fine Art Images > Sculptures",
};

/** Google taxonomy path for a stored category value, or null when unknown. */
export function googleProductCategory(category) {
  const sub = String(category || "").split("/").pop().trim();
  return GOOGLE_CATEGORY[sub] || null;
}

/** Schema.org condition item, from the grade a seller picked. */
function conditionRef(grade) {
  const g = String(grade || "").toLowerCase();
  if (g.includes("new") || g === "nwt" || g === "nwot") return "https://schema.org/NewCondition";
  if (g.includes("refurb")) return "https://schema.org/RefurbishedCondition";
  // Everything else on a resale site is used, including "Like New" — claiming
  // NewCondition for a pre-owned garment is the kind of mismatch Merchant
  // Center disapproves on sight.
  return "https://schema.org/UsedCondition";
}

/* ISO 3166-1 alpha-2, for the country a seller types in free text.
 *
 * The previous code took `.slice(0, 2)` of whatever the seller had written, so
 * "United States" shipped as `addressCountry: "UN"` — the United Nations. A
 * wrong country is worse than none: it puts the item's shipping origin on the
 * wrong continent for every crawler that reads it, and Merchant Center rejects
 * a shipping destination that does not exist.
 *
 * Sellers type the country however they like, so the common spellings are
 * matched, an already-ISO value is accepted as-is, and anything unrecognised
 * omits the shipping block entirely. Absent is a warning; wrong is a
 * disapproval. */
const COUNTRY_CODES = {
  "us": "US", "usa": "US", "u.s.": "US", "u.s.a.": "US", "united states": "US",
  "united states of america": "US", "america": "US",
  "gb": "GB", "uk": "GB", "u.k.": "GB", "united kingdom": "GB",
  "great britain": "GB", "england": "GB", "scotland": "GB", "wales": "GB",
  "canada": "CA", "ca": "CA",
  "australia": "AU", "au": "AU",
  "germany": "DE", "deutschland": "DE", "de": "DE",
  "france": "FR", "fr": "FR",
  "ireland": "IE", "ie": "IE",
  "netherlands": "NL", "the netherlands": "NL", "holland": "NL", "nl": "NL",
  "spain": "ES", "espana": "ES", "españa": "ES", "es": "ES",
  "italy": "IT", "italia": "IT", "it": "IT",
  "japan": "JP", "jp": "JP",
  "mexico": "MX", "mx": "MX",
  "new zealand": "NZ", "nz": "NZ",
  "sweden": "SE", "se": "SE",
  "norway": "NO", "no": "NO",
  "denmark": "DK", "dk": "DK",
  "finland": "FI", "fi": "FI",
  "switzerland": "CH", "ch": "CH",
  "austria": "AT", "at": "AT",
  "belgium": "BE", "be": "BE",
  "portugal": "PT", "pt": "PT",
  "poland": "PL", "pl": "PL",
};

/** Two-letter ISO code for a seller's free-text country, or null. */
export function countryCode(raw) {
  const v = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return null;
  if (COUNTRY_CODES[v]) return COUNTRY_CODES[v];
  // Already an ISO code — "US", "gb" — but only exactly two letters, so
  // "us" as the first word of a sentence cannot be mistaken for one.
  if (/^[a-z]{2}$/.test(v)) return v.toUpperCase();
  return null;
}

export function itemHead(l, origin) {
  const url = `${origin}/shop/${Number(l.id)}`;
  const title = `${l.title || "Listing"}${l.price ? ` · $${Number(l.price)}` : ""} — fashionistas.ai`;
  const desc = listingDescription(l);
  const image = l.photo_url || "https://fashionistas.ai/og.png";
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="product">`,
    `<meta property="og:site_name" content="fashionistas.ai">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
  ];
  const seller = (l.seller && (l.seller.display_name || l.seller.username)) || "";
  /* Product structured data a shopping crawler can actually use.

     The old block hardcoded `brand: fashionistas.ai` on every item — a Versace
     polo was declared as a fashionistas.ai product. That is not a cosmetic
     slip: Merchant Center rejects a brand that does not match the item, so the
     one attribute most likely to be present (sellers do type a brand) was the
     one being overwritten with a lie. Brand is now the seller's value, and it
     is omitted when there is none rather than filled with the site name.

     `identifier_exists: no` is the honest statement for one-of-a-kind used
     clothing: there is no GTIN/MPN to check, and saying so is what stops
     Google from disapproving the item for a missing identifier. */
  const brand = String(l.brand || "").trim();
  const gpc = googleProductCategory(l.category);
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title || "Listing",
    image: l.photo_url || undefined,
    description: desc || undefined,
    sku: `fash-${Number(l.id)}`,
    item_group_id: `fash-${Number(l.id)}`,
    color: l.color || undefined,
    size: l.size || undefined,
    material: l.material || undefined,
    condition: conditionRef(l.condition),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: l.price != null ? String(l.price) : undefined,
      availability: l.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      itemCondition: conditionRef(l.condition),
      seller: seller ? { "@type": "Person", name: seller } : undefined,
    },
  };
  // Only emit shipping when the country resolves to a real ISO code. A
  // shipping block naming a country that does not exist is a disapproval, and
  // the old `.slice(0, 2)` turned "United States" into "UN".
  const shipTo = countryCode(l.ship_country);
  if (shipTo) {
    product.offers.shippingDetails = {
      "@type": "OfferShippingDetails",
      shippingDestination: { "@type": "DefinedRegion", addressCountry: shipTo },
    };
  }
  // Only emit what is actually known. A brand of "fashionistas.ai", an empty
  // size or a guessed taxonomy is worse than no tag at all.
  if (brand) product.brand = { "@type": "Brand", name: brand.slice(0, 80) };
  if (gpc) product.google_product_category = gpc;
  tags.push(`<script type="application/ld+json">${jsonForScript(product)}</script>`);
  {
    const crumbs = [["Home", origin + "/"], ["Shop", origin + "/shop"]];
    const r = resolveCategory(l.category, l.title);
    if (r) {
      const sl = (x) => String(x).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      crumbs.push([r.dept, `${origin}/shop/c/${sl(r.dept)}`], [r.sub, `${origin}/shop/c/${sl(r.dept)}/${sl(r.sub)}`]);
    }
    crumbs.push([String(l.title || "Item"), url]);
    tags.push(`<script type="application/ld+json">${jsonForScript({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c[0], item: c[1] })) })}</script>`);
  }
  return tags.join("\n");
}

/**
 * One owner per tag kind.
 *
 * The shell ships its own site-wide <title>, canonical, description and social
 * tags. Appending ours beside them leaves two <title>s and two conflicting
 * canonicals — crawlers ignore both or pick the wrong one — so each kind is
 * stripped from the shell ONLY when this head supplies a replacement. When ours
 * doesn't cover a kind (a 404 page has no product card), the shell's tag
 * survives untouched.
 */
const KINDS = [
  ["title", /<title>[\s\S]*?<\/title>/gi, /<title>/i],
  ["canonical", /<link[^>]*rel="canonical"[^>]*>/gi, /rel="canonical"/i],
  ["description", /<meta[^>]*name="description"[^>]*>/gi, /name="description"/i],
  ["og", /<meta[^>]*property="og:[^"]*"[^>]*>/gi, /property="og:/i],
  ["twitter", /<meta[^>]*name="twitter:[^"]*"[^>]*>/gi, /name="twitter:/i],
  ["robots", /<meta[^>]*name="robots"[^>]*>/gi, /name="robots"/i],
];

export function injectHead(html, head, opts = {}) {
  const titleTag = (head.match(/<title>[\s\S]*?<\/title>/i) || [""])[0];
  const rest = head.replace(/<title>[\s\S]*?<\/title>/i, "").trim();
  let out = html;
  for (const [name, shellRe, mineRe] of KINDS) {
    // noindex counts as "we supply robots": the shell's "index, follow" has to
    // go even though the head string itself doesn't carry a robots tag.
    if (mineRe.test(head) || (name === "robots" && !!opts.noindex)) out = out.replace(shellRe, "");
  }
  if (titleTag) out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${titleTag}`);
  if (opts.noindex) {
    // The shell's "index, follow" would contradict a noindex — replace it.
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n<meta name="robots" content="noindex">`);
  }
  if (rest && /<\/head>/i.test(out)) return out.replace(/<\/head>/i, `${rest}\n</head>`);
  return rest ? `${rest}\n${out}` : out;
}

/**
 * Server-rendered, crawlable body content. /shop and /shop/<id> used to ship the
 * homepage body byte-for-byte (only the <head> differed), so Google saw every
 * item page as a duplicate of "/" and dropped it. This puts the item's real
 * text, photo and links into the HTML itself, at the <!--SSR-SEO--> marker.
 * Once the app view is on screen it renders the same item itself, so the block
 * is hidden then (still in the DOM, links still crawlable) to avoid showing it twice.
 */
const e2 = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const wrap = (inner) => `<style>html.h-app body .ssr-seo{display:none}</style><section class="ssr-seo" style="max-width:1080px;margin:24px auto;padding:0 18px;color:var(--ink,#111)">${inner}</section>`;
export function itemBody(l, more = []) {
  const facts = [l.brand, l.size && `Size ${l.size}`, l.condition && `Condition: ${l.condition}`, l.category, l.color].filter(Boolean).map(e2).join(" · ");
  const img = l.photo_url ? `<img src="${e2(l.photo_url)}" alt="${e2(l.title || "Item for sale")}" width="480" height="480" loading="lazy" style="max-width:100%;height:auto;border-radius:12px">` : "";
  const links = more.filter((m) => m && m.id && m.id !== l.id).slice(0, 12).map((m) => `<li><a href="/shop/${Number(m.id)}">${e2(m.title || "Item")}${m.price ? ` · $${Number(m.price)}` : ""}</a></li>`).join("");
  return wrap(`<nav aria-label="Breadcrumb" style="font-size:13px"><a href="/">Home</a> › <a href="/shop">Shop</a></nav>
<h1>${e2(l.title || "Listing")}</h1>${l.price ? `<p style="font-size:20px;font-weight:800">$${Number(l.price)}</p>` : ""}${img}
${facts ? `<p>${facts}</p>` : ""}${l.description ? `<p>${e2(String(l.description).slice(0, 1200))}</p>` : ""}
<p><a href="/try-on/">Try it on with your own photo</a></p>${links ? `<h2>More in the shop</h2><ul>${links}</ul>` : ""}`);
}
export function shopBody(items = []) {
  const li = items.filter((m) => m && m.id).map((m) => `<li><a href="/shop/${Number(m.id)}">${e2(m.title || "Item")}${m.price ? ` · $${Number(m.price)}` : ""}</a></li>`).join("");
  return wrap(`<h1>Shop secondhand clothing, decor and more</h1><p>Everything for sale on fashionistas.ai, listed by real sellers. Open any item to try it on with your own photo.</p>${li ? `<ul>${li}</ul>` : ""}<p><a href="/guide/">How to sell on Poshmark, eBay, Depop and more</a></p>`);
}
export function injectBody(html, block) {
  return String(html).includes("<!--SSR-SEO-->") ? String(html).replace("<!--SSR-SEO-->", block) : String(html).replace(/<\/body>/i, `${block}</body>`);
}
