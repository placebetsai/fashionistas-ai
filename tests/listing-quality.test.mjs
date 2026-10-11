/**
 * "they look like shit, the listings arent clear, u cant post your feeds … and
 * buyers cant find anythign i list".
 *
 * Four separate complaints, one root: the shop collected less than a buyer
 * needs and then threw away what it did collect.
 *
 *   1. The hand-add sheet was the only form that did not ask for brand,
 *      colour or material, so a listing typed by hand was permanently thinner
 *      than one created any other way.
 *      2. The buyer's item page showed Size / Condition / Category and nothing
 *         else, while the API was already returning brand, colour, material
 *      and where it ships from. The data existed; the page dropped it.
 *   3. Product JSON-LD hardcoded `brand: fashionistas.ai` on every item — a
 *      Versace polo was declared a fashionistas.ai product, which Merchant
 *      Center disapproves on sight.
 *   4. Search matched title and description only, so the brand typed into the
 *      Brand field was invisible to it: typing "Versace" returned nothing.
 *
 * These lock all four, against the files actually shipped.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { indexSource } from "./helpers/index-source.mjs";
import { itemHead, listingDescription, countryCode } from "../functions/_lib/item-meta.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const src = indexSource(ROOT);

const listing = {
  id: 148,
  title: "Blue Versace Polo Shirt",
  price: 45,
  condition: "Good",
  size: "L",
  category: "Men/Tops",
  brand: "Versace",
  color: "Blue",
  material: "Cotton",
  ship_city: "Austin",
  ship_country: "United States",
  local_pickup: 1,
  description: "Barely worn. Smoke free home.",
  photo_url: "https://fashionistas-api.fashionistas1979.workers.dev/api/images/u/89/polo.jpg",
  status: "active",
  seller: { id: 7, username: "seller2026", display_name: "Israel" },
};

/* ── 1. The seller's own forms ─────────────────────────────────────────── */

test("both listing forms ask for brand, colour and material", () => {
  for (const id of ["f-brand", "f-color", "f-material"]) {
    assert.ok(src.includes(`id="${id}"`), `main form is missing ${id}`);
  }
  for (const id of ["m-brand", "m-color", "m-material"]) {
    assert.ok(src.includes(`id="${id}"`), `hand-add sheet is missing ${id}`);
  }
});

test("and actually send them — a field nobody reads is not a fix", () => {
  // The main form.
  assert.match(src, /brand:\s*val\("f-brand"\)/);
  assert.match(src, /color:\s*val\("f-color"\)/);
  assert.match(src, /material:\s*val\("f-material"\)/);
  // The hand-add sheet, which is the one that was silently dropping all three.
  const manual = src.slice(src.indexOf("async function saveManual(){"), src.indexOf("function openSheet("));
  assert.match(manual, /brand:\s*mv\("m-brand"\)/);
  assert.match(manual, /color:\s*mv\("m-color"\)/);
  assert.match(manual, /material:\s*mv\("m-material"\)/);
});

/* ── 2. What the buyer is shown ────────────────────────────────────────── */

test("the buyer's item page shows the detail the API already returns", () => {
  const item = src.slice(src.indexOf("function openMarketItem(id, opts){"), src.indexOf("function editFromItem(id){"));
  // Before this fix the list was literally Size / Condition / Category.
  for (const label of ["Brand", "Size", "Colour", "Material", "Condition", "Department"]) {
    assert.ok(item.includes(`["${label}"`), `item page no longer shows ${label}`);
  }
  // Where it ships from, which is the other question asked before an offer.
  assert.match(item, /Ships from/);
  assert.match(item, /m\.ship_city/);
  assert.match(item, /m\.ship_country/);
  // And the one-of-a-kind line next to the buy button.
  assert.match(item, /One of a kind/);
});

test("a junk value never reaches the buyer as a fact", () => {
  // The regex that blanks "n/a", "not visible", "unknown" has to survive in
  // the item page's own clean(), because the AI used to write all three into
  // these fields (listing 143 shipped with size literally reading
  // "not visible").
  const item = src.slice(src.indexOf("function openMarketItem(id, opts){"), src.indexOf("function editFromItem(id){"));
  assert.match(item, /not visible/);
  assert.match(item, /unknown/i);
});

/* ── 3. What a crawler is told ─────────────────────────────────────────── */

test("Product JSON-LD names the item's real brand, and omits it when there is none", () => {
  assert.match(itemHead(listing, "https://fashionistas.ai"), /"name":"Versace"/);
  assert.match(itemHead(listing, "https://fashionistas.ai"), /"brand":\{"@type":"Brand","name":"Versace"\}/);

  // The hardcoded site name is gone. A brand of null must be ABSENT, not
  // filled in with the site — an invented brand is a disapproval, a missing
  // one is only a warning. The site legitimately still appears as the item's
  // own URL, so the assertion is about the brand object, not the string.
  const json = JSON.parse(
    itemHead({ ...listing, brand: null }, "https://fashionistas.ai")
      .match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
  );
  assert.equal(json.brand, undefined);
  assert.equal(JSON.stringify(json).includes('"@type":"Brand"'), false);
});

test("the shipping country is a real ISO code, not the first two letters typed", () => {
  // The old code did `.slice(0, 2)`, which shipped "United States" to every
  // crawler as `addressCountry: "UN"` — the United Nations. A shipping
  // destination that does not exist is a disapproval.
  const json = JSON.parse(
    itemHead(listing, "https://fashionistas.ai").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
  );
  assert.equal(json.offers.shippingDetails.shippingDestination.addressCountry, "US");
  assert.equal(countryCode("United States"), "US");
  assert.equal(countryCode("uk"), "GB");
  assert.equal(countryCode("DE"), "DE");
  assert.equal(countryCode("Atlantis"), null);
  assert.equal(countryCode(""), null);
  // A country we cannot name is left out entirely rather than invented.
  const unknown = JSON.parse(
    itemHead({ ...listing, ship_country: "Atlantis" }, "https://fashionistas.ai")
      .match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
  );
  assert.equal(unknown.offers.shippingDetails, undefined);
});

test("the Product block carries the attributes a shopping crawler needs", () => {
  const json = JSON.parse(
    itemHead(listing, "https://fashionistas.ai").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
  );
  assert.equal(json.color, "Blue");
  assert.equal(json.size, "L");
  assert.equal(json.material, "Cotton");
  assert.equal(json.item_group_id, "fash-148");
  assert.equal(json.google_product_category, "Apparel & Accessories > Clothing > Shirts & Tops");
  // Resale: nothing here is new, whatever the seller's grade says.
  assert.equal(json.condition, "https://schema.org/UsedCondition");
  assert.equal(json.offers.itemCondition, "https://schema.org/UsedCondition");
  assert.equal(json.offers.availability, "https://schema.org/InStock");
  assert.equal(json.offers.priceCurrency, "USD");
  assert.equal(json.offers.price, "45");
});

test("a sold item reads as sold to a crawler, not as in stock", () => {
  const json = JSON.parse(
    itemHead({ ...listing, status: "sold" }, "https://fashionistas.ai")
      .match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
  );
  assert.equal(json.offers.availability, "https://schema.org/SoldOut");
});

test("a seller-written description is what a search result shows", () => {
  assert.equal(listingDescription(listing), "Barely worn. Smoke free home.".slice(0, 155));
  // With no description, the facts a shopper types still make the snippet.
  const d = listingDescription({ ...listing, description: "" });
  assert.match(d, /Versace/);
  assert.match(d, /Condition: Good/);
  assert.match(d, /Size L/);
  assert.ok(d.length <= 155);
});

test("a listing page cannot smuggle script through the JSON-LD block", () => {
  const hostile = { ...listing, title: "</script><script>alert(1)</script>" };
  const head = itemHead(hostile, "https://fashionistas.ai");
  const body = head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(body, /<\/script>/);
  assert.match(body, /\\u003c/);
});

/* ── 4. Being findable ─────────────────────────────────────────────────── */

test("search covers every field a seller fills in", () => {
  // The Shop grid's own filter. Before this it searched title, description,
  // category and the seller's handle — so typing "Versace" returned an empty
  // grid while the Versace polo sat in S.market with brand set.
  const grid = src.slice(src.indexOf("function marketRows(){"), src.indexOf("function marketGridHtml("));
  for (const field of ["m.brand", "m.color", "m.material", "m.size"]) {
    assert.ok(grid.includes(field), `the Shop grid does not search ${field}`);
  }
  // The seller's own handle and display name, which is how a buyer who was
  // told about a shop actually looks for it.
  assert.ok(grid.includes("m.seller"));
});

test("the feed reads the same public endpoint the shop does", () => {
  // Feeds that talk to a different source than the storefront can disagree
  // about what is for sale, which is how a sold item stays advertised.
  const feed = readFileSync(fileURLToPath(new URL("../functions/_lib/feed-market.js", import.meta.url)), "utf8");
  assert.match(feed, /\/api\/market/);
  // And it must never throw: a feed that 500s teaches the crawler to stop
  // coming back, and one bad deploy would cost the whole catalogue its
  // listings. An empty file is a no-op import; a 500 is a fault.
  assert.match(feed, /catch/);
  assert.match(feed, /return \[\];/);
});
