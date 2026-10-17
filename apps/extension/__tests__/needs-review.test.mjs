// needs-review.test.mjs — the ONLY two moments the seller is allowed a tap.
//
//   run:  node --test apps/extension/__tests__/needs-review.test.mjs
//
// WHY THIS MATTERS:
//   The whole product promise is "connect once, then feed", which is only
//   honest if the extension keeps its mouth shut about everything it CAN do on
//   its own. A CAPTCHA and a category we refuse to guess under are the only two
//   walls a human crosses. Everything else is our bug, not the seller's.
//
//   The second half matters just as much: a CAPTCHA must never be retried.
//   Three attempts against a shop's anti-bot is not resilience, and every one
//   of them is a worse thing to do to the seller's account than stopping.

import test from "node:test";
import assert from "node:assert/strict";

// queue.js reads no chrome.* at import time; initSelectors() only runs inside
// tick(). The stub keeps the module graph happy in a plain node process.
globalThis.chrome = {
  storage: { local: { get: async () => ({}), set: async () => {} } },
  alarms: { create: () => {} },
  tabs: {},
  scripting: {}
};

const { isHumanWall } = await import("../queue.js");

test("a CAPTCHA is a human wall", () => {
  assert.equal(isHumanWall("captcha_required"), true);
});

test("needs_review (with its field list) is a human wall", () => {
  assert.equal(isHumanWall("needs_review:category"), true);
  assert.equal(isHumanWall("needs_review:seller_category,brand"), true);
});

test("everything else is ours, not the seller's", () => {
  for (const e of [
    "max_attempts_reached",
    "missing_fields:title",
    "submit_failed",
    "not_logged_in",
    "listing_url_not_captured",
    "unknown_shop:ebay",
    "formkit_missing",
    "",
    null,
    undefined
  ]) {
    assert.equal(isHumanWall(e), false, String(e) + " must NOT ask the seller");
  }
});

test("a shop-named captcha variant is still recognised", () => {
  assert.equal(isHumanWall("captcha_recaptcha"), true);
});