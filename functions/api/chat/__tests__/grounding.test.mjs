// functions/api/chat/__tests__/grounding.test.mjs
//
// Run:  node --test functions/api/chat/__tests__/*.test.mjs
//
// Pure unit tests for the chat scope gate and citation validator — the two
// things that make "grounded" more than a claim in a prompt. No DB, no model,
// no network: these functions decide what may be answered and prove the answer
// cites a row this server actually supplied.

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRefusal,
  classifyScope,
  extractPrice,
  feeSources,
  mentionsListings,
  validateChatAnswer,
} from "../_lib/grounding.js";
import { findMarketplace, takeHome } from "../../_lib/fees.js";

const LISTINGS = [
  {
    type: "listing",
    origin: "generated",
    id: 7,
    title: "Levi's 501 Original Fit Jeans — Mid Wash Blue",
    brand: "Levi's",
    category: "Jeans",
    price: 48,
  },
];

test("an unrelated question is out of scope before any model is involved", () => {
  const scope = classifyScope("What's the capital of France?", LISTINGS);
  assert.equal(scope.ok, false);
  assert.equal(scope.reason, "out_of_scope");
  assert.deepEqual(buildRefusal(scope.reason).sources, []);
  assert.deepEqual(buildRefusal(scope.reason).allowedTopics, ["your_listings", "marketplace_fees"]);
});

test("a fee question resolves to the fee topic and pulls out the price", () => {
  const scope = classifyScope("If I sell at $48, what do I keep on Poshmark?", LISTINGS);
  assert.equal(scope.ok, true);
  assert.deepEqual(scope.topics, ["marketplace_fees"]);
  assert.equal(scope.price, 48);
});

test("a question about the seller's own item resolves to the listing topic", () => {
  const scope = classifyScope("Should I list my jacket for more?", LISTINGS);
  assert.equal(scope.ok, true);
  assert.deepEqual(scope.topics, ["your_listings"]);
});

test("token overlap catches an item question that never says the word listing", () => {
  assert.equal(mentionsListings("is the raw denim worth more?", LISTINGS), false, "no overlap, no claim");
  assert.equal(mentionsListings("would the Levi's jeans sell faster at 40?", LISTINGS), true);
  const scope = classifyScope("would the Levi's jeans sell faster at 40?", LISTINGS);
  assert.equal(scope.ok, true);
  assert.ok(scope.topics.includes("your_listings"));
});

test("extractPrice reads the shapes a phone user actually types", () => {
  assert.equal(extractPrice("at $48 what do I keep?"), 48);
  assert.equal(extractPrice("sell it for USD 30"), 30);
  assert.equal(extractPrice("price it at 25"), 25);
  assert.equal(extractPrice("price it at $12.50"), 12.5);
  assert.equal(extractPrice("no money here at all"), null);
  assert.equal(extractPrice("year 2019 collection"), null);
});

test("fee sources without a price publish the model, with no invented arithmetic", () => {
  const rows = feeSources(null);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["poshmark", "mercari", "depop", "grailed", "ebay", "etsy"]
  );
  for (const row of rows) {
    assert.equal(row.type, "fee");
    assert.equal(row.price, null, "no price was given, so nothing is pre-computed");
    assert.equal(row.net, undefined);
    assert.equal(typeof row.feeNote, "string");
  }
});

test("fee sources with a price are exactly _lib/fees.js", () => {
  const rows = feeSources(48);
  for (const row of rows) {
    const expected = takeHome(findMarketplace(row.id), 48);
    assert.equal(row.price, 48);
    assert.equal(row.fees, expected.fees);
    assert.equal(row.net, expected.net);
    assert.equal(row.takeRate, expected.takeRate);
    assert.deepEqual(row.lines, expected.lines);
  }
});

test("a cited listing id resolves to OUR row, never the model's echo", () => {
  const res = validateChatAnswer(
    { answer: "Price it at $48.", sources: [{ type: "listing", id: "7" }] },
    LISTINGS
  );
  assert.equal(res.ok, true);
  assert.equal(res.sources.length, 1);
  assert.equal(res.sources[0], LISTINGS[0], "the returned object is the server's own row");
});

test("an id the model invented fails closed as ungrounded", () => {
  const res = validateChatAnswer(
    { answer: "Your other jacket is priced at $90.", sources: [{ type: "listing", id: 999 }] },
    LISTINGS
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, "ungrounded_answer");
});

test("no sources at all is ungrounded even when the prose looks confident", () => {
  const res = validateChatAnswer({ answer: "Denim is trending upwards this season." }, LISTINGS);
  assert.equal(res.ok, false);
  assert.equal(res.code, "ungrounded_answer");
});

test("a non-object answer and an empty answer are rejected", () => {
  assert.equal(validateChatAnswer("just prose", LISTINGS).ok, false);
  assert.equal(validateChatAnswer(["nope"], LISTINGS).code, "model_output_invalid");
  assert.equal(validateChatAnswer({ answer: "   ", sources: [{ type: "fee", id: "ebay" }] }, []).ok, false);
});

test("the model may refuse, and that is a structured outcome, not an error", () => {
  const res = validateChatAnswer({ refused: true, reason: "out_of_scope", answer: "no" }, LISTINGS);
  assert.equal(res.ok, true);
  assert.equal(res.refused, true);
  assert.equal(res.reason, "out_of_scope");
});
