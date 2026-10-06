/**
 * The seller-written listing path: what `POST /api/listing` does when no
 * MODEL_PROVIDER is configured.
 *
 * Regression pin for two production bugs:
 *   1. The route hard-503'd `model_not_configured`, so a seller could not save a
 *      listing they had typed themselves.
 *   2. Even with a model, the INSERT referenced columns (`colour`, `tags`,
 *      `hashtags`, `breakdown`, `model_provider`, `model_name`) that the live
 *      `listings` table did not have, so it threw and the catch returned null.
 *      Migration: migrations/0002_listing_writer_columns.sql
 *
 * The point of this file: whatever a seller types, the result must still satisfy
 * `validateListing` — otherwise the route answers 422 and nothing is saved.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { localListing, composeTitle, deriveCategory, deriveTags } from "../functions/api/listing/_lib/local.js";
import { validateListing } from "../functions/api/listing/_lib/schema.js";

const FULL = {
  description:
    "Worn twice, smoke-free home. Classic blue denim jacket with a corduroy collar, " +
    "button front, two chest pockets and a flattering boxy cut. Runs true to size.",
  title_hint: "Levi's blue denim jacket",
  brand: "Levi's",
  colour: "blue",
  size: "M",
  condition: "excellent",
  price: 68,
};

test("a full seller item produces a listing that passes validateListing", () => {
  const out = localListing(FULL);
  assert.equal(out.ok, true, JSON.stringify(out));
  const checked = validateListing(out.value);
  assert.equal(checked.ok, true, JSON.stringify(checked.errors));
  assert.equal(checked.value.price, 68);
  assert.equal(checked.value.brand, "Levi's");
  assert.ok(checked.value.tags.length >= 1 && checked.value.tags.length <= 15);
  assert.ok(checked.value.hashtags.length >= 1, "hashtags are derived from tags");
  assert.ok(checked.value.hashtags.every((h) => h.startsWith("#")));
});

test("no price is refused, never invented", () => {
  const { price, ...withoutPrice } = FULL;
  const out = localListing(withoutPrice);
  assert.equal(out.ok, false);
  assert.equal(out.status, 422);
  assert.equal(out.body.error, "price_required");
});

test("price out of range is refused", () => {
  assert.equal(localListing({ ...FULL, price: 0 }).body.error, "invalid_price");
  assert.equal(localListing({ ...FULL, price: 999999 }).body.error, "invalid_price");
});

test("no description at all is refused", () => {
  const out = localListing({ price: 20 });
  assert.equal(out.ok, false);
  assert.equal(out.body.error, "missing_item_description");
});

test("photo_alt alone is enough to write from", () => {
  const out = localListing({
    photo_alt: "A red wool coat on a hanger, double breasted with gold buttons",
    price: 120,
  });
  assert.equal(out.ok, true, JSON.stringify(out));
  const checked = validateListing(out.value);
  assert.equal(checked.ok, true, JSON.stringify(checked.errors));
});

test("blank brand / colour / size fall back to schema defaults", () => {
  const out = localListing({ description: "Simple cotton crew neck t-shirt, barely worn.", price: 15 });
  assert.equal(out.ok, true, JSON.stringify(out));
  const checked = validateListing(out.value);
  assert.equal(checked.ok, true, JSON.stringify(checked.errors));
  assert.equal(checked.value.brand, "Unbranded");
  assert.equal(checked.value.colour, "Unspecified");
  assert.equal(checked.value.size, "Unspecified");
  assert.equal(checked.value.condition, "good");
});

test("condition aliases the seller types are accepted", () => {
  for (const [given, expected] of [
    ["like new", "excellent"],
    ["New", "new_with_tags"],
    ["new with tags", "new_with_tags"],
    ["good", "good"],
    ["fair", "fair"],
  ]) {
    const out = localListing({ ...FULL, condition: given });
    assert.equal(out.ok, true, `${given}: ${JSON.stringify(out)}`);
    assert.equal(validateListing(out.value).value.condition, expected, given);
  }
});

test("an unrecognised condition fails validation with a clear error", () => {
  const out = localListing({ ...FULL, condition: "slightly loved" });
  assert.equal(out.ok, true, "the route turns this into a 422 invalid_item");
  const checked = validateListing(out.value);
  assert.equal(checked.ok, false);
  assert.ok(checked.errors.some((e) => e.field === "condition"));
});

test("category is derived from the seller's own words", () => {
  assert.equal(deriveCategory("worn twice, leather biker jacket"), "Outerwear");
  assert.equal(deriveCategory("barely worn air force running shoes"), "Shoes");
  assert.equal(deriveCategory("floral summer dress"), "Dresses");
  assert.equal(deriveCategory("high rise mom jeans"), "Bottoms");
  assert.equal(deriveCategory("silk camisole top"), "Tops");
  assert.equal(deriveCategory("quilted crossbody bag"), "Bags");
  assert.equal(deriveCategory("something unclassifiable"), "Clothing");
});

test("title is composed from real fields and never exceeds 80 chars", () => {
  const title = composeTitle({ brand: "Unbranded", colour: "Unspecified", category: "Outerwear", size: "XL" });
  assert.equal(title, "Outerwear size XL");
  const long = composeTitle({
    brand: "A".repeat(60),
    colour: "B".repeat(30),
    category: "Outerwear",
    size: "XL",
  });
  assert.ok(long.length <= 80, `was ${long.length}`);
});

test("tags are always present and never empty strings", () => {
  const tags = deriveTags({ title: "x", description: "a b c", brand: "Unbranded", colour: "blue", category: "Tops" });
  assert.ok(tags.length >= 1);
  assert.ok(tags.every((t) => typeof t === "string" && t.length >= 1 && t.length <= 40));
});

test("garbage input cannot produce an invalid listing", () => {
  const out = localListing({ description: "   ", price: "" });
  assert.equal(out.ok, false);
  assert.equal(localListing(null).body.error, "missing_item_description");
  assert.equal(localListing(undefined).body.error, "missing_item_description");
});
