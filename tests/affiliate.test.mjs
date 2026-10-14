import { test } from "node:test";
import assert from "node:assert/strict";
import { affiliateUrl } from "../functions/_lib/affiliate.js";
test("off without ids", () => { assert.deepEqual(affiliateUrl("https://www.ebay.com/itm/123", {}), { url: "https://www.ebay.com/itm/123", affiliate: false }); });
test("EPN params added only with a valid campid", () => {
  const r = affiliateUrl("https://www.ebay.com/itm/123", { EPN_CAMPID: "5338000000" }); assert.equal(r.affiliate, true); assert.ok(r.url.includes("campid=5338000000") && r.url.startsWith("https://www.ebay.com/itm/123?"));
  assert.equal(affiliateUrl("https://www.ebay.com/itm/1", { EPN_CAMPID: "abc" }).affiliate, false);
});
test("Amazon tag; other hosts untouched", () => {
  assert.ok(affiliateUrl("https://www.amazon.com/dp/B0X", { AMAZON_TAG: "fash-20" }).url.endsWith("tag=fash-20"));
  assert.equal(affiliateUrl("https://poshmark.com/listing/x", { EPN_CAMPID: "5338000000", AMAZON_TAG: "fash-20" }).affiliate, false);
});
