/**
 * "u cant post your feeds to google merchant or tik tok" — there was nothing
 * to post. The site had one JSON-LD block per item and a sitemap; neither is a
 * product feed, and the JSON-LD declared every brand to be "fashionistas.ai",
 * which Merchant Center would disapprove on sight.
 *
 * These lock the two routes that replace it, at the level a crawler actually
 * cares about: the bytes they emit.
 *
 *   • a Google Merchant feed in RSS 2.0 + the `g:` namespace, with the
 *     attributes a one-of-a-kind used garment needs (identifier_exists=no,
 *     condition=used, a two-decimal `45.00 USD` price, gender/age_group
 *     derived from the department) and with no empty tags at all, because an
 *     empty tag is a "Missing value" disapproval rather than a no-op;
 *   • a TikTok Catalog feed with TikTok's own column names (sku_id, not id;
 *     "in stock", not "in_stock"), RFC 4180 quoting and a UTF-8 BOM.
 *
 * Both renderers are pure functions, so this asserts on real output rather
 * than on the source of the code that produces it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderGoogleFeed, genderOf, ageGroupOf } from "../functions/feed/google.xml.js";
import { renderTikTokFeed, cell, COLUMNS } from "../functions/feed/tiktok.csv.js";
import { googleProductCategory, listingDescription } from "../functions/_lib/item-meta.js";

const ORIGIN = "https://fashionistas.ai";

/** Exactly the shape /api/market hands back. */
const market = [
  {
    id: 148, title: "Blue Versace Polo Shirt", price: 45, condition: "Good",
    size: "L", category: "Men/Tops", photo_url: "https://img.example/polo.jpg",
    status: "active", brand: "Versace", color: "Blue", material: "Cotton",
    ship_city: "Austin", ship_country: "United States", local_pickup: false,
    description: "Barely worn. Smoke free home.",
    seller: { id: 7, username: "seller2026", display_name: "Israel" },
  },
  {
    // A QA row: sold, and the sort of listing the feed must still describe
    // honestly rather than hide, so the crawler stops offering it.
    id: 143, title: "Vintage denim jacket", price: 68, condition: "Like New",
    size: "M", category: "Women's Clothing/Coats & Jackets",
    photo_url: "https://img.example/jacket.jpg", status: "sold",
    brand: null, color: null, material: null, description: "",
    seller: { id: 8, username: "seller2026", display_name: "Israel" },
  },
  {
    // A photo-less listing. Shop hides these and so must the feed — a product
    // whose image 404s is a disapproval, not a thin listing.
    id: 999, title: "No photo yet", price: 5, condition: "Good", size: "",
    category: "Women/Tops", photo_url: null, status: "active", brand: "",
    color: "", material: "", description: "", seller: { username: "x" },
  },
];

const visible = market.filter((l) => l.photo_url);

/* ── A minimal, strict RFC 4180 reader. TikTok's importer is one of these. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", i = 0, quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  while (i < s.length) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { quoted = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ── Google Merchant ───────────────────────────────────────────────────── */

test("the Google feed is real RSS with the g: namespace on the root element", () => {
  const xml = renderGoogleFeed(ORIGIN, market);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0" xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0">/);
  assert.match(xml, /<\/rss>\n$/);
  // No stray characters before the declaration — a BOM here is a parse error.
  assert.equal(xml.codePointAt(0), 0x3c);
});

test("every item carries the attributes Merchant Center requires", () => {
  const xml = renderGoogleFeed(ORIGIN, market);
  const items = xml.split("    <item>\n").slice(1);
  assert.equal(items.length, visible.length, "photo-less rows must be dropped");
  for (const item of items) {
    for (const req of ["id", "title", "description", "link", "image_link", "price", "availability"]) {
      assert.match(item, new RegExp(`<g:${req}>[^<]+</g:${req}>`), `missing ${req}`);
    }
    assert.match(item, /<g:link>https:\/\/fashionistas\.ai\/shop\/\d+<\/g:link>/);
  }
});

test("a used item never claims to be new, and never claims a GTIN it lacks", () => {
  const xml = renderGoogleFeed(ORIGIN, market);
  const items = xml.split("    <item>\n").slice(1);
  for (const item of items) {
    // "Like New" is a pre-owned garment. NewCondition is a policy hit.
    assert.match(item, /<g:condition>used<\/g:condition>/);
    assert.doesNotMatch(item, /<g:condition>new<\/g:condition>/);
    // One-of-a-kind resale: there is no identifier, and saying so is what
    // stops the whole item being disapproved for a missing one.
    assert.match(item, /<g:identifier_exists>no<\/g:identifier_exists>/);
  }
});

test("prices are two decimals with an ISO currency, or the tag is absent", () => {
  const xml = renderGoogleFeed(ORIGIN, market);
  for (const m of xml.matchAll(/<g:price>([^<]*)<\/g:price>/g)) {
    assert.match(m[1], /^\d+\.\d{2} [A-Z]{3}$/, `bad price ${m[1]}`);
  }
  assert.match(xml, /<g:price>45\.00 USD<\/g:price>/);
  // A missing price must not render as an empty tag — that is a disapproval.
  assert.doesNotMatch(xml, /<g:price><\/g:price>/);
});

test("apparel gets a gender and an age group, derived from the department", () => {
  const xml = renderGoogleFeed(ORIGIN, market);
  assert.match(xml, /<g:gender>male<\/g:gender>/);
  assert.match(xml, /<g:age_group>adult<\/g:age_group>/);
  assert.equal(genderOf("Women/Tops"), "female");
  assert.equal(genderOf("Men/Tops"), "male");
  assert.equal(genderOf("Kids/Girls' Dresses"), "unisex");
  assert.equal(ageGroupOf("Kids/Girls' Dresses"), "kids");
  assert.equal(ageGroupOf(null), "adult");
});

test("a brand of null produces no brand tag, not an empty one", () => {
  const xml = renderGoogleFeed(ORIGIN, market);
  const jacket = xml.split("    <item>\n")[2];
  assert.doesNotMatch(jacket, /<g:brand>/);
  const polo = xml.split("    <item>\n")[1];
  assert.match(polo, /<g:brand>Versace<\/g:brand>/);
  // …and nothing anywhere in the feed claims the site is the brand.
  assert.doesNotMatch(xml, /<g:brand>\s*<\/g:brand>|<g:brand>fashionistas/i);
});

test("no empty g: tag ever ships — an empty tag is a disapproval", () => {
  const xml = renderGoogleFeed(ORIGIN, market);
  for (const m of xml.matchAll(/<g:([a-z_]+)>([\s\S]*?)<\/g:\1>/g)) {
    assert.ok(m[2].trim().length > 0, `<g:${m[1]}> is empty`);
  }
});

test("a sold item leaves the stock feed the moment it sells", () => {
  const xml = renderGoogleFeed(ORIGIN, market);
  const items = xml.split("    <item>\n").slice(1);
  assert.match(items[0], /<g:availability>in_stock<\/g:availability>/);
  assert.match(items[1], /<g:availability>out_of_stock<\/g:availability>/);
});

test("special characters in a title cannot break the XML", () => {
  const hostile = [{ ...market[0], title: "Kids' coats <wool> & \"cashmere\" &amp; more" }];
  const xml = renderGoogleFeed(ORIGIN, hostile);
  const title = xml.match(/<g:title>([\s\S]*?)<\/g:title>/)[1];
  // Escaping is by replacement, not by decoding, so a literal `&amp;` in a
  // seller's title becomes `&amp;amp;` — correct, because the parser will
  // read that back as the five characters they typed. What matters is that no
  // bare `<` survives to close a tag early.
  assert.equal(title, "Kids' coats &lt;wool&gt; &amp; \"cashmere\" &amp;amp; more");
  // The document must still be well-formed enough to yield exactly one item.
  assert.equal(xml.split("<item>").length - 1, 1);
  assert.equal(xml.split("</item>").length - 1, 1);
});

/* ── TikTok Catalog ────────────────────────────────────────────────────── */

test("the TikTok feed starts with a BOM and uses TikTok's own column names", () => {
  const csv = renderTikTokFeed(ORIGIN, market);
  assert.equal(csv.codePointAt(0), 0xfeff, "without the BOM Excel mangles accents");
  const rows = parseCsv(csv);
  assert.deepEqual(rows[0], COLUMNS);
  // The one that catches copying the Google feed: TikTok wants sku_id and
  // rejects a plain `id`.
  assert.ok(COLUMNS.includes("sku_id"));
  assert.ok(!COLUMNS.includes("id"));
});

test("every row has exactly one cell per column — no description can break it", () => {
  const rows = parseCsv(renderTikTokFeed(ORIGIN, market));
  for (const row of rows) assert.equal(row.length, COLUMNS.length, JSON.stringify(row));
  // A newline inside a description is the classic row-breaker.
  const noisy = [{ ...market[0], description: 'Line one\nLine two, with a comma and a "quote"' }];
  const parsed = parseCsv(renderTikTokFeed(ORIGIN, noisy));
  assert.equal(parsed[1].length, COLUMNS.length);
  assert.match(parsed[1][2], /Line one Line two/);
});

test("TikTok's values are in TikTok's spelling", () => {
  const rows = parseCsv(renderTikTokFeed(ORIGIN, market));
  const polo = Object.fromEntries(COLUMNS.map((c, i) => [c, rows[1][i]]));
  assert.equal(polo.sku_id, "fash-148");
  assert.equal(polo.availability, "in stock");
  assert.notEqual(polo.availability, "in_stock");
  assert.equal(polo.condition, "used");
  assert.equal(polo.price, "45.00");            // bare decimal, no currency
  assert.equal(polo.link, "https://fashionistas.ai/shop/148");
  assert.equal(polo.item_group_id, "fash-148");
  assert.equal(polo.gender, "male");
});

test("every feed row links to its own item page, never the shop home", () => {
  const xml = renderGoogleFeed(ORIGIN, market);
  for (const m of xml.matchAll(/<g:link>([^<]*)<\/g:link>/g)) {
    assert.match(m[1], /^https:\/\/fashionistas\.ai\/shop\/\d+$/);
  }
  const rows = parseCsv(renderTikTokFeed(ORIGIN, market));
  for (const row of rows.slice(1)) {
    assert.match(row[COLUMNS.indexOf("link")], /^https:\/\/fashionistas\.ai\/shop\/\d+$/);
  }
});

test("quoting is RFC 4180", () => {
  assert.equal(cell("plain"), '"plain"');
  assert.equal(cell('say "hi"'), '"say ""hi"""');
  assert.equal(cell(null), '""');
  assert.equal(cell(undefined), '""');
});

/* ── Both ──────────────────────────────────────────────────────────────── */

test("a photo-less listing never reaches either feed", () => {
  assert.doesNotMatch(renderGoogleFeed(ORIGIN, market), /999|No photo yet/);
  assert.doesNotMatch(renderTikTokFeed(ORIGIN, market), /999|No photo yet/);
});

test("an empty catalogue is a valid empty feed, not an error page", () => {
  const xml = renderGoogleFeed(ORIGIN, []);
  assert.match(xml, /<rss version="2\.0"/);
  assert.equal(xml.split("<item>").length - 1, 0);
  const rows = parseCsv(renderTikTokFeed(ORIGIN, []));
  assert.equal(rows.length, 1, "headers only");
  assert.deepEqual(rows[0], COLUMNS);
});

test("Google's taxonomy covers the departments the shop actually draws", () => {
  assert.match(googleProductCategory("Women/Tops"), /^Apparel & Accessories/);
  assert.match(googleProductCategory("Men/Sneakers"), /^Apparel & Accessories > Shoes/);
  assert.match(googleProductCategory("Home/Mirrors"), /^Home & Living/);
  assert.match(googleProductCategory("Art/Paintings"), /Fine Art/);
  // The retired Worker vocabulary must not be the thing that gets mapped —
  // that is the same bug as the category round-trip, one layer along.
  assert.match(googleProductCategory("Women's Clothing/Coats & Jackets"), /Coats & Jackets/);
  // An unmapped leaf omits the tag rather than guessing one.
  assert.equal(googleProductCategory("Women/Something Invented"), null);
  assert.equal(googleProductCategory(null), null);
});

test("the search description leads with the brand a shopper types", () => {
  // A listing with no seller-written description still has to say what it is:
  // brand and colour come first, because those are the two words a shopper
  // actually types, and both were missing before.
  const d = listingDescription({ ...market[0], description: "" });
  assert.match(d, /Versace/);
  assert.match(d, /Blue/);
  assert.match(d, /Cotton/);
  assert.ok(d.length <= 155);
  // With a description, the seller's own words win — the metadata is a
  // fallback, never a rewrite of what they wrote.
  assert.equal(listingDescription(market[0]), "Barely worn. Smoke free home.");
  // The hardcoded site name is gone from the description path entirely.
  assert.doesNotMatch(d, /fashionistas\.ai/);
});
