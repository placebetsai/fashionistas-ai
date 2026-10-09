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
  const bits = [l.title, l.condition ? `Condition: ${l.condition}` : "", l.size ? `Size ${l.size}` : "", l.category || ""]
    .filter(Boolean);
  const s = bits.join(" · ").slice(0, 155);
  return s;
}

export function itemHead(l, origin) {
  const url = `${origin}/shop/${Number(l.id)}`;
  const title = `${l.title || "Listing"}${l.price ? ` · $${Number(l.price)}` : ""} — fashionistas.ai`;
  const desc = listingDescription(l);
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="product">`,
    `<meta property="og:site_name" content="fashionistas.ai">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
  ];
  if (l.photo_url) {
    tags.push(`<meta property="og:image" content="${esc(l.photo_url)}">`);
    tags.push(`<meta name="twitter:image" content="${esc(l.photo_url)}">`);
  }
  const seller = (l.seller && (l.seller.display_name || l.seller.username)) || "";
  tags.push(
    `<script type="application/ld+json">${jsonForScript({
      "@context": "https://schema.org",
      "@type": "Product",
      name: l.title || "Listing",
      image: l.photo_url || undefined,
      description: desc || undefined,
      sku: `fash-${Number(l.id)}`,
      brand: { "@type": "Brand", name: "fashionistas.ai" },
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "USD",
        price: l.price != null ? String(l.price) : undefined,
        availability: l.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
        seller: seller ? { "@type": "Person", name: seller } : undefined,
      },
    })}</script>`
  );
  return tags.join("\n");
}

/**
 * Replace the shell's <title> with the item's and append the rest just before
 * </head>. Keys on the shell's own marker so a double-inject can't stack.
 */
export function injectHead(html, head, opts = {}) {
  const titleTag = head.match(/<title>[\s\S]*?<\/title>/i);
  let out = titleTag ? html.replace(/<title>[\s\S]*?<\/title>/i, titleTag[0]) : html;
  if (opts.noindex && !/name="robots"/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n<meta name="robots" content="noindex">`);
  }
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, `${head}\n</head>`);
  return `${head}\n${out}`;
}
