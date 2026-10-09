/**
 * "Buyers can't find shit" — they couldn't, because nothing was findable:
 *
 *   1. Items had NO URL. openMarketItem() re-rendered the screen and never
 *      touched history, so /shop/147 was a 404: not linkable, not shareable,
 *      not bookmarkable, not crawlable.
 *   2. document.title was never set per item, so every listing looked
 *      identical to a crawler.
 *   3. The sitemap listed only static pages — zero item URLs.
 *
 * These lock the three fixes: real /shop/<id> addresses in the SPA, a
 * server-rendered head for the crawler, and a sitemap that contains items.
 * Source-level against the shipped files (plus pure unit tests for the head
 * builder, which is the part Google actually reads).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { indexSource } from "./helpers/index-source.mjs";
import { itemHead, injectHead, listingDescription } from "../functions/_lib/item-meta.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = indexSource(ROOT);
const shopFn = readFileSync(join(ROOT, "functions", "shop", "[[id]].js"), "utf8");
const sitemapFn = readFileSync(join(ROOT, "functions", "sitemap.xml.js"), "utf8");

const fixture = {
  id: 147,
  title: "Vintage denim jacket",
  price: 68,
  condition: "Excellent",
  size: "M",
  category: null,
  photo_url: "https://fashionistas-api.fashionistas1979.workers.dev/api/images/u/89/jacket.jpg",
  status: "active",
  seller: { username: "tryonqaef0007", display_name: "tryonqaef0007" },
};

test("opening an item writes a real URL — pushState to /shop/<id>", () => {
  assert.match(src, /function itemPath\(id\)\{ return "\/shop\/" \+ Number\(id\); \}/);
  assert.match(src, /history\[(?:fn|"replaceState"|'replaceState')\]|history\.pushState\(/);
  assert.match(src, /history\["?replaceState"?\]|\bhistory\.replaceState\(/);
  // called on success, only with the caller's mode
  const open = src.slice(src.indexOf("async function openMarketItem(id, opts){"), src.indexOf("function buySheet(id){"));
  assert.match(open, /setItemUrl\(id, m, opts\.url\)/);
  assert.match(open, /dropItemUrl\(\)/, "a dead item must not keep its dead URL");
});

test("the document title follows the item, with the price", () => {
  assert.match(src, /document\.title = m\.title \+ \(m\.price \? " · " \+ money\(m\.price\) : ""\) \+ " — fashionistas\.ai"/);
  assert.match(src, /meta\[property="og:url"\]/, "open graph url moves too");
});

test("a cold /shop/<id> opens that item, guest or not", () => {
  assert.match(src, /function itemFromPath\(\)/);
  assert.match(src, /const m = \(location\.pathname \|\| ""\)\.match\(\/\^\\\/shop\\\/\(\\d\+\)\\\/\?\$\/\)/);
  assert.match(src, /enterBrowse\("shop"\); openMarketItem\(id, \{ url: "replace" \}\)/);
  assert.match(src, /window\.addEventListener\("popstate"/, "the back button works");
  assert.match(src, /if \(!routePath\(\)\) homeOrAuth\(\);/, "deep link beats the sign-in screen");
  // leaving the item restores a shareable shop URL (exact source, no regex fog)
  assert.ok(
    src.includes('if (v === "shop" && (location.pathname || "").replace(/\\/$/, "") !== "/shop")'),
    "go('shop') normalises the address bar to /shop"
  );
});

test("the shop route serves a head for a live item, 404 for a dead one", () => {
  assert.match(shopFn, /import \{ itemHead, injectHead \} from "\.\.\/_lib\/item-meta\.js";/);
  assert.match(shopFn, /env\.ASSETS\.fetch/, "shell comes from the asset layer");
  assert.match(shopFn, /status: missing \? 404 : 200/, "an honest status code");
  assert.match(shopFn, /status: 404/, "non-numeric ids are 404");
  assert.match(shopFn, /\/api\/market\//, "listing comes from the public market API");
});

test("itemHead carries title, price, description, image and Product schema", () => {
  const head = itemHead(fixture, "https://fashionistas.ai");
  assert.match(head, /<title>Vintage denim jacket · \$68 — fashionistas\.ai<\/title>/);
  assert.match(head, /rel="canonical" href="https:\/\/fashionistas\.ai\/shop\/147"/);
  assert.match(head, /property="og:type" content="product"/);
  assert.match(head, /property="og:image" content="https:\/\/fashionistas-api[^"]+jacket\.jpg"/);
  assert.match(head, /application\/ld\+json/);
  const ld = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld["@type"], "Product");
  assert.equal(ld.name, "Vintage denim jacket");
  assert.equal(ld.offers.price, "68");
  assert.equal(ld.offers.priceCurrency, "USD");
  assert.equal(ld.offers.availability, "https://schema.org/InStock");
  assert.equal(ld.offers.seller.name, "tryonqaef0007");
  assert.equal(ld.offers.url, "https://fashionistas.ai/shop/147");
});

test("a title cannot break out of its tag or the JSON-LD script", () => {
  const nasty = itemHead({ ...fixture, title: `Cool <script>alert(1)</script> "jacket"` }, "https://fashionistas.ai");
  assert.ok(!/<title>[^<]*<script>/i.test(nasty.split("</script>")[0]), "title is escaped");
  const json = nasty.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.ok(!json.includes("</script>"), "raw </script> must not appear in the JSON blob");
  assert.equal(JSON.parse(json).name, `Cool <script>alert(1)</script> "jacket"`, "content survives intact");
});

test("injectHead swaps the shell title and appends before </head>", () => {
  const shell = `<!doctype html><html><head><meta charset="utf-8"><title>site default</title><link rel="x"></head><body><div id="app"></div></body></html>`;
  const head = itemHead(fixture, "https://fashionistas.ai");
  const out = injectHead(shell, head);
  assert.ok(!out.includes("<title>site default</title>"), "shell title is replaced, not duplicated");
  assert.match(out, /<title>Vintage denim jacket · \$68 — fashionistas\.ai<\/title>/);
  assert.ok(out.indexOf("application/ld+json") < out.indexOf("</head>"), "schema lands inside <head>");
  assert.match(injectHead(shell, head, { noindex: true }), /<meta name="robots" content="noindex">/);
});

test("description falls back to facts when the listing has no blurb", () => {
  assert.equal(
    listingDescription(fixture),
    "Vintage denim jacket · Condition: Excellent · Size M"
  );
  assert.equal(listingDescription({ ...fixture, description: "  hand stitched  " }), "hand stitched");
  assert.equal(listingDescription(null), "");
});

test("the sitemap lists live items as /shop/<id>", () => {
  assert.match(sitemapFn, /\/shop\/\$\{Number\(it\.id\)\}/);
  assert.match(sitemapFn, /<\/urlset>/, "appends into the existing urlset");
  assert.match(sitemapFn, /api\/market/, "reads the public market feed");
  assert.match(sitemapFn, /ASSETS\.fetch/, "keeps the hand-written page entries");
});
