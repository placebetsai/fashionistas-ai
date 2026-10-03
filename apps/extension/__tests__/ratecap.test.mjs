// ratecap.test.mjs — unit tests for the per-account posting caps.
//
//   run:  node --test apps/extension/__tests__/
//
// These are the tests that must pass before we ever let the extension post:
// a wrong cap either throttles the seller (too high) or silently stops their
// listings from going out (too low). Nothing here touches chrome.* — ratecap.js
// is deliberately pure so every branch, including a day rolling over, is
// reachable in a test.

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CAP,
  POST_CAPS,
  HOUR_MS,
  DAY_MS,
  capFor,
  capKey,
  capOverrideKey,
  checkCap,
  prune,
  retryAfterSeconds
} from "../ratecap.js";

const NOW = 1760000000000; // fixed clock: Fri Oct 10 2025-ish; no flake

/* ------------------------------------------------------------------ config */

test("every shipped adapter declares both an hourly and a daily cap", () => {
  const shops = Object.keys(POST_CAPS);
  assert.equal(shops.length, 9, "all 9 adapters must have caps");
  for (const shop of shops) {
    const c = POST_CAPS[shop];
    assert.ok(Number.isInteger(c.perHour) && c.perHour >= 1, `${shop} perHour`);
    assert.ok(Number.isInteger(c.perDay) && c.perDay >= 1, `${shop} perDay`);
    assert.ok(c.perDay >= c.perHour, `${shop}: daily cap must be >= hourly cap`);
  }
});

test("an unknown shop falls back to the default cap, never to unlimited", () => {
  assert.deepEqual(capFor("bonanza", null, null), DEFAULT_CAP);
  assert.ok(capFor("bonanza", null, null).perDay > 0, "never 0, never Infinity");
});

test("shop config (postsPerHour/postsPerDay) overrides the shipped table", () => {
  const got = capFor("poshmark", null, { postsPerHour: 9, postsPerDay: 7 });
  assert.deepEqual(got, { perHour: 9, perDay: 7 });
});

test("a runtime override wins over config — a cap can be tightened live", () => {
  const got = capFor("poshmark", { perHour: 1, perDay: 2 }, { postsPerHour: 4, postsPerDay: 40 });
  assert.deepEqual(got, { perHour: 1, perDay: 2 });
});

test("limits are clamped to at least 1 — 0 or a bad value never means 'unlimited'", () => {
  assert.deepEqual(capFor("poshmark", { perHour: 0, perDay: -5 }, null), { perHour: 1, perDay: 1 });
  assert.deepEqual(capFor("poshmark", null, { postsPerHour: "lots" }), {
    perHour: POST_CAPS.poshmark.perHour,
    perDay: POST_CAPS.poshmark.perDay
  });
});

/* -------------------------------------------------------- per-account keys */

test("caps are keyed per account — one seller's usage never blocks another", () => {
  const a = capKey("poshmark", "user-1");
  const b = capKey("poshmark", "user-2");
  assert.notEqual(a, b);
  assert.equal(a, "cap:user-1:poshmark");
  assert.equal(capKey("poshmark", null), "cap:default:poshmark");
  assert.equal(capKey("poshmark", ""), "cap:default:poshmark", "blank is default");
  assert.notEqual(capOverrideKey("poshmark"), capKey("poshmark", "default"), "override namespace differs");
});

/* ---------------------------------------------------------------- decisions */

test("under both limits: posts are allowed, with windows counted separately", () => {
  // 5 posts crammed into the last 5 minutes -> hourly binds even though the
  // daily allowance is nearly untouched.
  const burst = Array.from({ length: 5 }, (_, i) => NOW - i * 60000);
  const v = checkCap({ stamps: burst, now: NOW, perHour: 4, perDay: 40 });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "hourly_cap");
  assert.equal(v.hourUsed, 5);
  assert.equal(v.dayUsed, 5, "daily window sees them too, and is nowhere near 40");

  // One post 3h ago: inside the 24h daily window, outside the 60min hourly one.
  const v2 = checkCap({ stamps: [NOW - 3 * HOUR_MS], now: NOW, perHour: 4, perDay: 40 });
  assert.equal(v2.ok, true, "one post, 3h ago, 4/h and 40/d allows it");
  assert.equal(v2.hourUsed, 0, "3h is outside the hourly window");
  assert.equal(v2.dayUsed, 1, "3h is inside the daily window");
});

test("hourly cap blocks at exactly the limit and reports exact counts", () => {
  const stamps = [NOW - 60000, NOW - 120000, NOW - 180000, NOW - 240000];
  const v = checkCap({ stamps, now: NOW, perHour: 4, perDay: 40 });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "hourly_cap");
  assert.deepEqual(
    { hourUsed: v.hourUsed, dayUsed: v.dayUsed, hourLimit: v.hourLimit, dayLimit: v.dayLimit },
    { hourUsed: 4, dayUsed: 4, hourLimit: 4, dayLimit: 40 }
  );
});

test("daily cap blocks even when the hourly window is empty", () => {
  // 40 posts spread across the last 24h, none in the last hour
  const stamps = Array.from({ length: 40 }, (_, i) => NOW - HOUR_MS - i * 30 * 60000);
  const v = checkCap({ stamps, now: NOW, perHour: 4, perDay: 40 });
  assert.equal(v.ok, false, "40/40 used today must block");
  assert.equal(v.reason, "daily_cap", "daily is the binding constraint here");
  assert.equal(v.hourUsed, 0, "hourly window is genuinely clear");
  assert.equal(v.dayUsed, 40);
});

test("one more post than the daily cap blocks; one less allows", () => {
  const base = Array.from({ length: 39 }, (_, i) => NOW - HOUR_MS - i * 30 * 60000);
  assert.equal(checkCap({ stamps: base, now: NOW, perHour: 4, perDay: 40 }).ok, true,
    "39/40 still allowed");
  assert.equal(checkCap({ stamps: [...base, NOW - 2 * HOUR_MS], now: NOW, perHour: 4, perDay: 40 }).ok, false,
    "40/40 blocks");
});

test("daily cap takes precedence over hourly when both are exhausted", () => {
  const stamps = Array.from({ length: 40 }, (_, i) => NOW - 30000 - i * 300000);
  const v = checkCap({ stamps, now: NOW, perHour: 4, perDay: 40 });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "daily_cap", "report the bigger blocker first");
});

/* ------------------------------------------------------------ window maths */

test("prune drops timestamps older than 24h and anything in the future", () => {
  const stamps = [
    NOW - DAY_MS - 1,       // 24h + 1ms ago -> out
    NOW - DAY_MS + 1,       // just inside 24h -> in
    NOW - HOUR_MS,          // in
    NOW + 60000,            // future (clock skew) -> out
    "nope",  // not a number -> out
    null
  ];
  const kept = prune(stamps, NOW);
  assert.equal(kept.length, 2);
  assert.ok(kept.every((t) => typeof t === "number" && t > NOW - DAY_MS && t <= NOW));
});

test("posts roll off daily allowance once they age past 24h", () => {
  const stamps = Array.from({ length: 40 }, (_, i) => NOW - DAY_MS - 1 - i * 60000);
  const v = checkCap({ stamps, now: NOW, perHour: 4, perDay: 40 });
  assert.equal(v.ok, true, "yesterday's posts no longer count against today");
  assert.equal(v.dayUsed, 0);
});

test("posts roll off the hourly window after 60 minutes", () => {
  const stamps = Array.from({ length: 4 }, (_, i) => NOW - HOUR_MS - 1 - i * 60000);
  const v = checkCap({ stamps, now: NOW, perHour: 4, perDay: 40 });
  assert.equal(v.ok, true, "40-minute-old posts are outside the hour");
  assert.equal(v.hourUsed, 0);
});

/* ---------------------------------------------------------------- retries */

test("retryAfterSeconds waits for the right window (rolling 1h / 24h)", () => {
  const hourly = [NOW - 60000, NOW - 120000, NOW - 180000, NOW - 240000];
  // A slot frees when the OLDEST of the 4 in-window posts turns 60min old:
  // the oldest here is 240s in, so 3600 - 240 = 3360s from now.
  const rh = retryAfterSeconds({ stamps: hourly, now: NOW, perHour: 4, perDay: 40 });
  assert.equal(rh, 3360, "hourly retry waits for the oldest post to age out");
  assert.ok(rh > 0 && rh <= 3600, `hourly retry ${rh}s must be inside 1h`);

  // Daily is a rolling 24h window: a slot frees when the OLDEST of the 40
  // ages out of it, not 24h from now. Oldest is NOW - 3600s - 39*1800s =
  // NOW - 73800s, so it clears in 86400 - 73800 = 12600s.
  const daily = Array.from({ length: 40 }, (_, i) => NOW - HOUR_MS - i * 30 * 60000);
  const rd = retryAfterSeconds({ stamps: daily, now: NOW, perHour: 4, perDay: 40 });
  assert.equal(rd, 12600, "daily retry waits for the oldest post to leave the 24h window");
  assert.ok(rd > 0 && rd < 86400, `daily retry ${rd}s must be inside 24h`);

  assert.equal(retryAfterSeconds({ stamps: [], now: NOW, perHour: 4, perDay: 40 }), 0, "no wait when allowed");
});

/* ---------------------------------------------------- end-to-end simulation */

test("a full day of posting stops exactly at the daily cap, then recovers", () => {
  const PER_DAY = POST_CAPS.vinted.perDay; // 60
  let stamps = [];
  let posted = 0;

  // 70 attempts, one every 20 minutes, all inside a single 24h window so the
  // rolling cap cannot hand back allowance mid-run. 20min spacing keeps hourly
  // usage at 3/4, so the DAILY cap is the constraint under test.
  const ATTEMPTS = 70;
  for (let i = 0; i < ATTEMPTS; i++) {
    const now = NOW + i * 20 * 60000;
    const caps = capFor("vinted", null, null);
    if (checkCap({ stamps, now, ...caps }).ok) {
      stamps = [...prune(stamps, now), now];
      posted++;
    }
  }
  assert.equal(posted, PER_DAY, `stopped at the ${PER_DAY}/day cap after ${ATTEMPTS} attempts`);
  assert.equal(ATTEMPTS - posted, 10, "the 10 attempts over the cap were blocked");

  // Everything ages past 24h -> the allowance refreshes and posting resumes.
  const later = NOW + ATTEMPTS * 20 * 60000 + 25 * HOUR_MS;
  assert.equal(checkCap({ stamps, now: later, ...capFor("vinted") }).ok, true,
    "allowance refreshes the next day");
});
