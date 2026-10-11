/**
 * GET /feed/tiktok.csv — TikTok Catalog Manager product feed.
 *
 * READ THIS BEFORE TRYING TO SELL ON TIKTOK SHOP
 * TikTok Shop US prohibits secondhand goods. Pre-owned Apparel is invite-only
 * and limited to authenticated designer pieces over $50 with a certificate, so
 * a general resale catalogue cannot list there at all — no file format changes
 * that, and Seller Center's bulk uploader only accepts TikTok's own .xlsx
 * template, which this is not.
 *
 * What DOES work without any TikTok approval is TikTok's Ads Catalog: it takes
 * a data feed by URL exactly like Google Merchant Center, and it advertises
 * YOUR site — the buyer clicks through to fashionistas.ai. That is what this
 * file is for. Add it in Ads Manager → Catalog → Data sources → Scheduled
 * fetch. It needs an ad account, not a Shop approval.
 *
 * FORMAT
 * The catalog's required column set, in TikTok's own order and spelling:
 *   sku_id, title, description, availability, condition, price, link,
 *   image_link, brand
 * plus the recommended resale columns: item_group_id, google_product_category,
 * size, color, gender.
 *
 * Note `sku_id`, not `id` — a Google feed is not drop-in here, which is why
 * this is a separate route rather than content negotiation on the other one.
 * `condition` is `used` for every row: both accurate and the only legal value
 * for this catalogue.
 *
 * If a real TikTok Shop account is ever approved, this file does NOT serve it:
 * Seller Center wants the category-specific .xlsx template, downloaded per leaf
 * category, not CSV.
 *
 * Items without a photo are left out, same as the Google feed — a row with no
 * image is rejected on import and only produces a screen of errors.
 */
import { fetchMarket, itemUrl, plain } from "../_lib/feed-market.js";
import { googleProductCategory } from "../_lib/item-meta.js";

/* TikTok's parser is strict about quoting, so every field is quoted and inner
   quotes are doubled per RFC 4180. A newline inside a description would break
   the row, so descriptions are flattened. Exported for the tests. */
export const cell = (v) => `"${
  plain(v, 5000).replace(/"/g, '""').replace(/\s*\n+\s*/g, " ")
}"`;

export const COLUMNS = [
  "sku_id", "title", "description", "availability", "condition", "price",
  "link", "image_link", "brand", "item_group_id", "google_product_category",
  "size", "color", "gender",
];

function genderOf(category) {
  const dept = String(category || "").split("/")[0];
  if (dept === "Women") return "female";
  if (dept === "Men") return "male";
  return "unisex";
}

/** TikTok prices are a bare decimal; there is no currency column in the feed. */
const price = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : "";
};

/** The feed body. Pure, so tests can parse the CSV the catalog would receive. */
export function renderTikTokFeed(origin, market) {
  const rows = market
    .filter((l) => l && l.id && l.photo_url)
    .map((l) =>
      [
        `fash-${l.id}`,                                   // sku_id
        l.title,
        l.description || `${l.title}${l.condition ? ` — condition: ${l.condition}` : ""}`,
        // TikTok's vocabulary is spelled differently to Google's, and it does
        // not accept "in_stock".
        l.status === "active" ? "in stock" : "out of stock",
        "used",
        price(l.price),
        itemUrl(origin, l.id),
        l.photo_url,
        l.brand,                                          // blank is legal here
        `fash-${l.id}`,                                   // item_group_id
        googleProductCategory(l.category),
        l.size,
        l.color,
        genderOf(l.category),
      ]
        .map(cell)
        .join(",")
    );

  // The BOM is deliberate: without it Excel and TikTok both read UTF-8 as the
  // system codepage, so an accent in a brand name turns to mojibake and the
  // row is rejected.
  return "\uFEFF" + [COLUMNS.map(cell).join(","), ...rows].join("\r\n") + "\r\n";
}

export async function onRequestGet(context) {
  const { request } = context;
  const origin = new URL(request.url).origin;
  const market = await fetchMarket();

  return new Response(renderTikTokFeed(origin, market), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
      "Content-Disposition": 'attachment; filename="fashionistas-tiktok-catalog.csv"',
    },
  });
}
