/**
 * Proves findD1() in functions/api/_tryon/ledger.js actually finds the D1
 * binding Cloudflare Pages hands it.
 *
 * Why this exists: findD1() used to walk `Object.values(env)`. In production
 * that returns [] even though `env.DB` resolves, so findD1 returned null and
 * every caller silently did nothing:
 *   - logRun()            -> no cost_ledger row, ever (table never created)
 *   - creditBalance()     -> 0, so every paid try-on answered 402 not_entitled
 *   - monthSpendUsd()     -> 0, so MAX_MONTHLY_TRYON_SPEND was never armed
 *   - credit decrement    -> never ran
 * The subscription path used getDB(env) by NAME, which is why Pro worked and
 * credits did not — that asymmetry is the bug these tests pin down.
 *
 * Offline: no Cloudflare account, no network. The bindings are plain stubs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findD1 } from "../functions/api/_tryon/ledger.js";

/** Minimal shape of a D1 binding as far as findD1 cares. */
const d1Stub = (label) => ({
  label,
  prepare: () => ({ run: async () => {}, bind: () => ({ first: async () => null }) }),
  batch: async () => [],
});

test("finds a D1 binding that is not enumerable (the production case)", () => {
  const db = d1Stub("DB");
  const env = {};
  Object.defineProperty(env, "DB", { value: db, enumerable: false });

  // Document the symptom: the old scan literally cannot see this binding.
  assert.equal(Object.values(env).length, 0, "Object.values(env) is empty");
  assert.equal(findD1(env), db, "findD1 must reach it by property access");
});

test("prefers the primary DB binding over another D1 that sorts first", () => {
  const primary = d1Stub("DB");
  const other = d1Stub("EBAY_DB");
  // Insertion order puts EBAY_DB first, so a blind scan would return it.
  const env = { EBAY_DB: other, DB: primary };

  assert.equal(Object.values(env)[0], other, "scan order would pick the wrong one");
  assert.equal(findD1(env), primary, "named lookup must win");
});

test("falls back to the generic scan for a binding named anything else", () => {
  const odd = d1Stub("MY_WEIRD_DB");
  assert.equal(findD1({ MY_WEIRD_DB: odd }), odd, "unnamed bindings still resolve");
});

test("ignores objects that are not D1 (KV, R2, vars)", () => {
  const env = {
    CACHE: { get: () => {}, put: () => {} },
    IMAGES: { put: () => {}, get: () => {} },
    STRIPE_SECRET_KEY: "sk_test_x",
    DB: d1Stub("DB"),
  };
  assert.equal(findD1(env).label, "DB", "only the D1 binding is returned");
});

test("returns null when there is no D1 at all", () => {
  assert.equal(findD1(null), null, "null env");
  assert.equal(findD1(undefined), null, "undefined env");
  assert.equal(findD1({}), null, "empty env");
  assert.equal(findD1({ CACHE: { get: () => {} } }), null, "only KV");
  assert.equal(findD1({ HALF: { prepare: () => {} } }), null, "prepare without batch is not D1");
});
