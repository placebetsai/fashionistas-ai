// functions/api/listing/__tests__/fees.test.mjs
// Run: node --test functions/api/listing/__tests__/fees.test.mjs
//
// Proves that the listing endpoint carries a per-marketplace fee breakdown
// and take-home for each of poshmark, mercari, depop, grailed, ebay, etsy,
// derived entirely from functions/api/_lib/fees.js.

import test from "node:test";
import assert from "node:assert/strict";

import { takeHome, findMarketplace, round2 } from "../../_lib/fees.js";
import { buildBreakdown } from "../_lib/schema.js";

const SAMPLE_PRICE = 48;

/** The six Phase-4 marketplaces (in the order buildBreakdown produces them). */
const PHASE4_IDS = ["poshmark", "mercari", "depop", "grailed", "ebay", "etsy"];

test("takeHome computes net/fees/takeRate for all 6 Phase-4 marketplaces", () => {
  for (const id of PHASE4_IDS) {
    const m = findMarketplace(id);
    assert.ok(m, "marketplace " + id + " must exist in the catalogue");
    const t = takeHome(m, SAMPLE_PRICE);
    assert.ok(t, "takeHome must return a result for " + id);
    assert.ok(Number.isFinite(t.fees), id + ".fees must be finite");
    assert.ok(Number.isFinite(t.net), id + ".net must be finite");
    assert.ok(Number.isFinite(t.takeRate), id + ".takeRate must be finite");
    assert.ok(t.fees >= 0, id + ".fees must be non-negative");
    assert.ok(t.net >= 0, id + ".net must be non-negative");
    assert.ok(t.takeRate >= 0 && t.takeRate <= 100, id + ".takeRate must be in [0,100]");
    // net + fees = price (within rounding)
    const recovered = round2(t.fees + t.net);
    assert.equal(recovered, SAMPLE_PRICE, id + ": fees + net must equal price " + SAMPLE_PRICE);
  }
});

test("buildBreakdown produces correct output shape for all 6 marketplaces", () => {
  const breakdown = buildBreakdown(SAMPLE_PRICE, PHASE4_IDS);
  assert.equal(breakdown.length, PHASE4_IDS.length, "must produce one entry per marketplace");

  const idMap = new Map();
  for (const b of breakdown) {
    idMap.set(b.id, b);
  }

  for (const id of PHASE4_IDS) {
    const b = idMap.get(id);
    assert.ok(b, "must have an entry for " + id);
    assert.ok(Number.isFinite(b.price), id + ".price must be finite");
    assert.ok(Number.isFinite(b.fees), id + ".fees must be finite");
    assert.ok(Number.isFinite(b.net), id + ".net must be finite");
    assert.ok(Number.isFinite(b.takeRate), id + ".takeRate must be finite");
    assert.ok(Array.isArray(b.lines), id + ".lines must be an array");
    assert.ok(b.lines.length > 0, id + ".lines must not be empty");
    assert.ok(Number.isFinite(b.takeRate), id + ".takeRate must be finite");

    // Verify: fees + net = price
    const recovered = round2(b.fees + b.net);
    assert.equal(recovered, SAMPLE_PRICE, id + ": fees + net must equal price " + SAMPLE_PRICE);

    // Verify takeRate approx = net/price * 100
    const expectedRate = round2((b.net / SAMPLE_PRICE) * 100);
    assert.equal(b.takeRate, expectedRate, id + ": takeRate must be net/price*100");
  }
});

test("poshmark flat fee under \$15 is correct", () => {
  const m = findMarketplace("poshmark");
  const t = takeHome(m, 12);  // under the $15 tier
  assert.equal(t.fees, 2.95, "poshmark flat fee under \$15 should be \$2.95");
  assert.equal(t.net, round2(12 - 2.95), "poshmark net under \$15 should be \$9.05");
  // takeRate should be (9.05/12)*100
  assert.ok(Number.isFinite(t.takeRate), "takeRate must be finite");
});

test("poshmark percentage at \$15 and above is correct", () => {
  const m = findMarketplace("poshmark");
  const t = takeHome(m, 48);  // above the $15 tier
  // 20% of 48 = 9.6
  assert.equal(t.fees, 9.6, "poshmark 20% of \$48 should be \$9.60");
  assert.equal(t.net, round2(48 - 9.6), "poshmark net at \$48 should be \$38.40");
});

test("each marketplace lines array has correct labels and amounts", () => {
  const breakdown = buildBreakdown(SAMPLE_PRICE, PHASE4_IDS);
  const expectedLabelFor = {
    poshmark: "Poshmark fee (20%)",
    mercari: "Mercari fee (10%)",
    depop: "Depop fee (3.3%)",
    grailed: "Grailed fee (9%)",
    ebay: "eBay fee (13.6%)",
    etsy: "Etsy fee (9.5%)",
  };

  for (const b of breakdown) {
    const firstLineLabel = b.lines[0].label;
    const expected = expectedLabelFor[b.id];
    assert.ok(
      expected && firstLineLabel === expected,
      b.id + ".lines[0].label must be '" + expected + "', got: '" + firstLineLabel + "'"
    );
    assert.ok(
      Number.isFinite(b.lines[0].amount),
      b.id + ".lines[0].amount must be finite"
    );
  }
});