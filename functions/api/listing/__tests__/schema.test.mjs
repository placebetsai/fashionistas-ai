// functions/api/listing/__tests__/schema.test.mjs
//
// Run:  node --test functions/api/listing/__tests__/*.test.mjs
//
// Pure unit tests for the listing writer's declared schema and validator —
// no DB, no model, no network. The point is the contract: whatever
// LISTING_JSON_SCHEMA declares, validateListing() must actually produce, and
// garbage must come back as { ok:false } instead of a half-built listing.

import test from "node:test";
import assert from "node:assert/strict";

import {
  CONDITIONS,
  LISTING_JSON_SCHEMA,
  normalizeCondition,
  validateListing,
} from "../_lib/schema.js";

/** A model answer for a real-ish item. Used verbatim as "the sample item". */
export const SAMPLE_MODEL_OUTPUT = {
  title: "Levi's 501 Original Fit Jeans — Mid Wash Blue",
  description:
    "Classic Levi's 501 straight-leg jeans in a mid wash with a button fly and a comfortable high rise. Gently worn with no holes, stains or hem wear.",
  category: "Jeans",
  condition: "good",
  brand: "Levi's",
  colour: "blue",
  size: "28",
  price: 48,
  tags: ["levis 501", "straight leg jeans", "mid wash", "vintage denim", "high rise"],
  hashtags: ["#levis501", "#straightleg", "#vintagedenim"],
};

test("the sample item validates against the declared schema", () => {
  const res = validateListing(SAMPLE_MODEL_OUTPUT);
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.deepEqual(res.value, {
    title: SAMPLE_MODEL_OUTPUT.title,
    description: SAMPLE_MODEL_OUTPUT.description,
    category: "Jeans",
    condition: "good",
    brand: "Levi's",
    colour: "blue",
    size: "28",
    price: 48,
    tags: SAMPLE_MODEL_OUTPUT.tags,
    hashtags: SAMPLE_MODEL_OUTPUT.hashtags,
  });
});

test("every field the validator emits is declared (declaration cannot drift)", () => {
  const emitted = Object.keys(validateListing(SAMPLE_MODEL_OUTPUT).value).sort();
  const declared = Object.keys(LISTING_JSON_SCHEMA.properties)
    .filter((k) => k !== "id") // `id` is added by the route from D1, not by the model
    .sort();
  assert.deepEqual(emitted, declared);
  assert.deepEqual([...LISTING_JSON_SCHEMA.required].sort(), declared);
});

test("prose is rejected, not parsed", () => {
  const res = validateListing("Sure! Here's a great listing for your jeans.");
  assert.equal(res.ok, false);
  assert.equal(res.errors[0].field, "$");
});

test("a JSON object missing required fields fails closed with per-field errors", () => {
  const res = validateListing({ title: "Only a title", description: "too short" });
  assert.equal(res.ok, false);
  const fields = res.errors.map((e) => e.field);
  assert.ok(fields.includes("description"), "description under minLength is reported");
  assert.ok(fields.includes("condition"));
  assert.ok(fields.includes("price"));
  assert.ok(fields.includes("tags"));
  assert.equal(res.value, undefined, "no partial listing is ever returned");
});

test("missing brand/colour/size default to honest unknowns, never invented facts", () => {
  const res = validateListing({
    ...SAMPLE_MODEL_OUTPUT,
    brand: "  ",
    colour: undefined,
    size: null,
  });
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.equal(res.value.brand, "Unbranded");
  assert.equal(res.value.colour, "Unspecified");
  assert.equal(res.value.size, "Unspecified");
});

test("hashtags are derived from tags when the model omits them, and get a #", () => {
  const res = validateListing({ ...SAMPLE_MODEL_OUTPUT, hashtags: undefined });
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.deepEqual(res.value.hashtags, ["#levis501", "#straightlegjeans", "#midwash", "#vintagedenim", "#highrise"]);
});

test('tags arrive as "a, b, c" often enough to be normalised, and deduped', () => {
  const res = validateListing({ ...SAMPLE_MODEL_OUTPUT, tags: "levis, 501, levis, denim" });
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.deepEqual(res.value.tags, ["levis", "501", "denim"]);
});

test("price is coerced strictly: a numeric string passes, nonsense does not", () => {
  const asString = validateListing({ ...SAMPLE_MODEL_OUTPUT, price: "48" });
  assert.equal(asString.ok, true);
  assert.equal(asString.value.price, 48);

  for (const bad of ["abc", 0, -5, null, true, {}, 20000]) {
    const res = validateListing({ ...SAMPLE_MODEL_OUTPUT, price: bad });
    assert.equal(res.ok, false, `price ${JSON.stringify(bad)} must be rejected`);
    assert.ok(res.errors.some((e) => e.field === "price"));
  }
});

test("condition is case/space insensitive but refuses anything off-list", () => {
  assert.equal(normalizeCondition("Like New"), "excellent");
  assert.equal(normalizeCondition("NEW WITH TAGS"), "new_with_tags");
  assert.equal(normalizeCondition("gently used"), "good");
  assert.equal(normalizeCondition("brand new"), null);
  assert.equal(normalizeCondition(42), null);

  const res = validateListing({ ...SAMPLE_MODEL_OUTPUT, condition: "brand new" });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.field === "condition"));
  assert.deepEqual(CONDITIONS, [
    "new_with_tags",
    "new_without_tags",
    "excellent",
    "good",
    "fair",
    "poor",
  ]);
});

test("keys the model invented are dropped, not passed through to a marketplace", () => {
  const res = validateListing({
    ...SAMPLE_MODEL_OUTPUT,
    shipping: "free shipping!!!",
    fees: { poshmark: 30 },
  });
  assert.equal(res.ok, true);
  assert.equal("shipping" in res.value, false);
  assert.equal("fees" in res.value, false);
});

test("an over-long description is rejected rather than silently truncated", () => {
  const res = validateListing({ ...SAMPLE_MODEL_OUTPUT, description: "x".repeat(4001) });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.field === "description"));
});
