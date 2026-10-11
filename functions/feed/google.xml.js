/**
 * GET /feed/google.xml — Google Merchant Center product feed.
 *
 * WHY THIS FILE EXISTS
 * The owner's complaint was literal: "u cant post your feeds to google merchant
 * or tik tok". Before this route there was no feed of any kind — the only
 * product markup on the site was a single JSON-LD block per item, and that
 * block declared every product's brand to be "fashionistas.ai". Merchant
 * Center cannot be fed from a sitemap (a sitemap lists URLs; a product feed
 * lists products), so nothing here could ever have been submitted.
 *
 * FORMAT
 * RSS 2.0 with the `g:` namespace — the format Merchant Center's "Scheduled
 * fetch" expects when you register a feed URL. Served as a Pages Function
 * rather than a static file so it always reflects the live catalogue: sold
 * items leave the feed the moment they sell, which matters because a stale
 * `in_stock` on an item that sold is the single most common disapproval.
 *
 * ONE-OF-A-KIND USED CLOTHING
 * Every item here is used and none has a GTIN. Two consequences, both handled:
 *   • `g:identifier_exists` is `no`, which tells Google not to expect a GTIN
 *     or MPN. Inventing one is a disapproval; omitting the flag is a warning.
 *   • `g:condition` is always `used`, including for "Like New" — that grade
 *     describes a pre-owned garment, and claiming `new` is a policy hit.
 *
 * Apparel also requires `g:color`, `g:size`, `g:gender` and `g:age_group`.
 * Color and size come from the listing; gender and age group are derived from
 * the department rather than left blank, because a blank is a disapproval.
 *
 * ITEMS WITHOUT A PHOTO ARE LEFT OUT ON PURPOSE. Google disapproves a product
 * whose image it cannot fetch, and a photo-less card is exactly the junk this
 * shop already hides from its own Shop grid. Same rule, same reason.
 *
 * TO TURN IT ON
 * Merchant Center → Settings → Data sources → Add product source →
 * "Add products from a file" → enter
 *   https://fashionistas.ai/feed/google.xml
 * and keep it on Scheduled fetch. The domain still has to be verified once
 * (an HTML file or meta tag works — no DNS access needed on Cloudflare Pages).
 */
import { fetchMarket, itemUrl, plain } from "../_lib/feed-market.js";
import { googleProductCategory } from "../_lib/item-meta.js";

const esc = (s) =>
  plain(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** A tag Merchant Center ignores when the value is missing. Empty tags are a
    "Missing value" disapproval, so absence has to be total. */
const g = (name, value) => {
  const v = esc(value);
  return v ? `      <g:${name}>${v}</g:${name}>\n` : "";
};

/* Gender and age group are REQUIRED for anything under Apparel & Accessories,
   and there is no way to say "unknown" — a blank is a disapproval. The
   department is the only signal a listing carries, so that is what is used.
   Kids and everything outside clothing fall back to unisex/kids rather than
   guessing a gender a child's garment does not have. */
export function genderOf(category) {
  const dept = String(category || "").split("/")[0];
  if (dept === "Women") return "female";
  if (dept === "Men") return "male";
  return "unisex";
}
export const ageGroupOf = (category) =>
  String(category || "").split("/")[0] === "Kids" ? "kids" : "adult";

/** Feed value: `45.00 USD`. Google rejects a bare number, and a number with no
    two decimals is parsed as a different currency amount. */
const price = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? `${n.toFixed(2)} USD` : "";
};

/**
 * The feed body. Pure, so tests can assert on real XML instead of only on the
 * source of the function that produces it.
 */
export function renderGoogleFeed(origin, market) {
  const items = market
    .filter((l) => l && l.id && l.photo_url)
    .map((l) => {
      const url = itemUrl(origin, l.id);
      // `id` has to be stable across fetches, or every poll looks like a full
      // catalogue replacement and Google reprocesses the whole account. The
      // listing id is the only stable key this shop has.
      const gid = `fash-${l.id}`;
      let out = "    <item>\n";
      out += g("id", gid);
      out += g("title", l.title);
      out += g("description",
        l.description || `${l.title}${l.condition ? ` — condition: ${l.condition}` : ""}`);
      out += g("link", url);
      out += g("image_link", l.photo_url);
      out += g("price", price(l.price));
      out += g("availability", l.status === "active" ? "in_stock" : "out_of_stock");
      out += g("condition", "used");
      out += g("identifier_exists", "no");
      out += g("brand", l.brand);
      out += g("color", l.color);
      out += g("size", l.size);
      out += g("material", l.material);
      out += g("gender", genderOf(l.category));
      out += g("age_group", ageGroupOf(l.category));
      out += g("item_group_id", gid);
      out += g("google_product_category", googleProductCategory(l.category));
      out += `      <g:adult>no</g:adult>\n`;
      out += "    </item>\n";
      return out;
    })
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n' +
    "  <channel>\n" +
    "    <title>fashionistas.ai</title>\n" +
    `    <link>${esc(origin)}</link>\n` +
    "    <description>One-of-a-kind used clothing and objects listed by real sellers.</description>\n" +
    items +
    "  </channel>\n" +
    "</rss>\n"
  );
}

export async function onRequestGet(context) {
  const { request } = context;
  const origin = new URL(request.url).origin;
  const market = await fetchMarket();

  return new Response(renderGoogleFeed(origin, market), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Crawler-only cache: a browser has no business here, and a long shared
      // cache would keep serving sold items after they sell.
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
