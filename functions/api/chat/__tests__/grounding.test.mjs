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
  ALLOWED_TOPICS,
  buildRefusal,
  classifyScope,
  extractPrice,
  extractShopId,
  feeSources,
  mentionsListings,
  siteSources,
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
  assert.deepEqual(buildRefusal(scope.reason).allowedTopics, ALLOWED_TOPICS);
  assert.ok(ALLOWED_TOPICS.includes("try_on"));
  assert.ok(ALLOWED_TOPICS.includes("how_to_list"));
});

test("crypto and medical questions stay out of scope", () => {
  assert.equal(classifyScope("Should I buy Bitcoin this week?", LISTINGS).reason, "out_of_scope");
  assert.equal(classifyScope("What dosage of ibuprofen for a headache?", LISTINGS).reason, "out_of_scope");
});

test("a fee question resolves to the fee topic and pulls out the price", () => {
  const scope = classifyScope("If I sell at $48, what do I keep on Poshmark?", LISTINGS);
  assert.equal(scope.ok, true);
  assert.deepEqual(scope.topics, ["marketplace_fees"]);
  assert.equal(scope.price, 48);
  assert.equal(scope.shop, "poshmark");
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

test("Depop how-to is in scope as how_to_list", () => {
  const scope = classifyScope("How do I list on Depop?", LISTINGS);
  assert.equal(scope.ok, true);
  assert.ok(scope.topics.includes("how_to_list"));
  assert.equal(scope.shop, "depop");
  assert.equal(extractShopId("Depop how-to please"), "depop");
});

test("try-on Instant vs Photoreal is in scope", () => {
  const scope = classifyScope("What's the difference between Instant and Photoreal try-on?", LISTINGS);
  assert.equal(scope.ok, true);
  assert.ok(scope.topics.includes("try_on"));
  const sites = siteSources(scope.topics, "try-on help");
  assert.ok(sites.some((s) => s.id === "try_on"));
  assert.ok(sites.find((s) => s.id === "try_on").facts.some((f) => /Photoreal/i.test(f)));
});

test("Connect shops and Chrome extension / Sell everywhere are in scope", () => {
  const a = classifyScope("How do I connect my shops?", LISTINGS);
  assert.ok(a.ok && a.topics.includes("connect_shops"));
  const b = classifyScope("How do I install the Chrome extension for Sell everywhere?", LISTINGS);
  assert.ok(b.ok);
  assert.ok(b.topics.includes("chrome_extension"));
  const sites = siteSources(b.topics, b.topics.join(" "));
  assert.ok(sites.some((s) => s.id === "chrome_extension"));
  const extFacts = sites.find((s) => s.id === "chrome_extension").facts.join("\n");
  assert.match(extFacts, /Load unpacked/i);
  assert.match(extFacts, /Stripe/i);
});

test("listing from photo and $14.99 plan are in scope", () => {
  const photo = classifyScope("How do I list from a photo?", LISTINGS);
  assert.ok(photo.ok && photo.topics.includes("listing_from_photo"));
  const plan = classifyScope("What does the $14.99 plan include?", LISTINGS);
  assert.ok(plan.ok && plan.topics.includes("pricing_plan"));
  const sites = siteSources(plan.topics, "pricing");
  assert.ok(sites.some((s) => s.id === "pricing_plan"));
  assert.ok(sites.find((s) => s.id === "pricing_plan").facts.some((f) => /14\.99/.test(f)));
});

test("siteSources for Depop how-to includes catalogue + guide facts, no fake posted claim", () => {
  const sites = siteSources(["how_to_list"], "How do I list on Depop?");
  const depop = sites.find((s) => s.id === "shop_depop");
  assert.ok(depop, "shop_depop site row present");
  assert.equal(depop.type, "site");
  assert.ok(depop.facts.some((f) => /first 4/.test(f) || /4–5 words/.test(f) || /4-5 words/.test(f)));
  assert.ok(depop.facts.some((f) => /3\.3%/.test(f)));
  assert.ok(depop.urls.some((u) => u.includes("/guide/depop/") || u.includes("depop.com")));
  const blob = JSON.stringify(sites);
  assert.equal(/it posted|Stripe_pk|sk_live/i.test(blob), false);
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

test("a cited site id resolves to the supplied site fact", () => {
  const sites = siteSources(["try_on"], "try-on help");
  const res = validateChatAnswer(
    {
      answer: "Photoreal needs Pro; Instant is an on-device overlay.",
      sources: [{ type: "site", id: "try_on" }],
    },
    sites
  );
  assert.equal(res.ok, true);
  assert.equal(res.sources[0].id, "try_on");
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
