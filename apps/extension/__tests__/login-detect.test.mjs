// apps/extension/__tests__/login-detect.test.mjs
//
// Run:  node --test apps/extension/__tests__/*.mjs
//
// Covers libs/login-detect.js — the single source of truth behind the Connect
// screen's green "Connected" badge — plus the guarantee that the extension's
// shipped copy cannot drift from it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { REASONS, detectLogin, normalizePath, isSignInPath, hasNotFoundText } from "../../../libs/login-detect.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, "..", "..", "..");
const SRC = path.join(REPO, "libs", "login-detect.js");
const GEN = path.join(REPO, "apps", "extension", "content", "login-detect.js");
const BUILDER = path.join(REPO, "apps", "extension", "scripts", "build-login-detect.mjs");

const CONNECTED_SIGNALS = { logout: true, avatar: false, sellBtn: false };

/* ---------------------------------------------------------- bounced */

test("sent to a sign-in page => not connected (bounced)", () => {
  const r = detectLogin({
    requestedPath: "/sell",
    finalPath: "https://www.mercari.com/login/?login_callback=%2Fsell%2F",
    signals: CONNECTED_SIGNALS,
  });
  assert.equal(r.connected, false);
  assert.equal(r.reason, "bounced");
});

test("eBay's DLL sign-in endpoint counts as a sign-in page", () => {
  assert.equal(
    isSignInPath("/ws/eBayISAPI.dll?SignIn&UsingSSL=1&ru=https%3A%2F%2Fwww.ebay.com%2Flstng"),
    true
  );
  const r = detectLogin({
    requestedPath: "/lstng",
    finalPath: "/ws/eBayISAPI.dll?SignIn&ru=x",
    signals: {},
  });
  assert.equal(r.connected, false);
  assert.equal(r.reason, "bounced");
});

test("every marketplace's real login path is recognised", () => {
  for (const p of [
    "/login",
    "/login/",
    "/signin",
    "/auth/login/",
    "/users/sign_up",
    "/join",
    "/signup",
    "/your/shops/me/signin",
  ]) {
    assert.equal(isSignInPath(p), true, `${p} should be a sign-in path`);
  }
  for (const p of ["/sell", "/products/add", "/lstng", "/create_listing", "/"]) {
    assert.equal(isSignInPath(p), false, `${p} should NOT be a sign-in path`);
  }
});

test("a trailing slash is not a bounce", () => {
  assert.equal(normalizePath("/products/add/"), normalizePath("/products/add"));
  const r = detectLogin({ requestedPath: "/products/add/", finalPath: "/products/add", signals: CONNECTED_SIGNALS });
  assert.equal(r.connected, true, "normalising the slash must not invent a bounce");
  assert.equal(r.reason, "connected");
});

/* --------------------------------------------------------- soft-404 */

test("Etsy's soft-404 on the requested path => not connected", () => {
  const r = detectLogin({
    requestedPath: "/your/shops/me/listings/create",
    finalPath: "/your/shops/me/listings/create",
    signals: { controlCount: 0, bodyText: "Uh oh! Sorry, the page you were looking for was not found." },
  });
  assert.equal(r.connected, false);
  assert.equal(r.reason, "soft_404");
});

// REGRESSION: this is the exact page that previously reported FILLED with 0 of
// 12 fields — same requested and final path, no password field, no redirects,
// wording that matched no naive "page not found" pattern.
test("regression: the Etsy 404 that faked a pass is still refused", () => {
  const r = detectLogin({
    requestedPath: "/your/shops/me/tools/listings/create",
    finalPath: "/your/shops/me/listings/create",
    signals: {
      hasPasswordField: false,
      logout: false,
      avatar: false,
      sellBtn: false,
      controlCount: 1,
      bodyText: "Etsy Search for items or shops Sorry, the page you were looking for was not found. Go back to Etsy.com",
    },
  });
  assert.equal(r.connected, false, "a 404 must never read as connected");
  assert.equal(r.reason, "soft_404");
});

test("a 404 wins even when the header still shows a logged-in avatar", () => {
  const r = detectLogin({
    requestedPath: "/sell",
    finalPath: "/gone",
    signals: { avatar: true, logout: true, bodyText: "page not found", controlCount: 2 },
  });
  assert.equal(r.connected, false, "positive signals must not rescue a 404");
  assert.equal(r.reason, "soft_404");
});

/* ---------------------------------------------------------- no_form */

test("zero form controls => not connected (no_form)", () => {
  const r = detectLogin({
    requestedPath: "/create",
    finalPath: "/create",
    signals: { controlCount: 0 },
  });
  assert.equal(r.connected, false);
  assert.equal(r.reason, "no_form");
});

test("an UNREPORTED control count is skipped, not treated as 'no form'", () => {
  // undefined <= 0 is false, so a consumer that simply cannot count must not
  // be handed a confident negative.
  const r = detectLogin({ requestedPath: "/create", finalPath: "/create", signals: {} });
  assert.equal(r.connected, false);
  assert.equal(r.reason, "unknown");
});

/* -------------------------------------------------------- login_form */

test("a password field means the site is still asking for one", () => {
  const r = detectLogin({
    requestedPath: "/login",
    finalPath: "/login",
    signals: { hasPasswordField: true, controlCount: 4 },
  });
  assert.equal(r.connected, false);
  assert.equal(r.reason, "login_form");
});

/* --------------------------------------------------------- connected */

test("a logout link proves the session exists", () => {
  const r = detectLogin({ requestedPath: "/sell", finalPath: "/sell", signals: { logout: true, controlCount: 9 } });
  assert.equal(r.connected, true);
  assert.equal(r.reason, "connected");
});

test("avatar or a Sell control also proves it", () => {
  assert.equal(detectLogin({ requestedPath: "/x", finalPath: "/x", signals: { avatar: true, controlCount: 3 } }).connected, true);
  assert.equal(detectLogin({ requestedPath: "/x", finalPath: "/x", signals: { sellBtn: true, controlCount: 3 } }).connected, true);
});

test("only positive proof ever returns connected:true", () => {
  const ambiguous = [
    { requestedPath: "/sell", finalPath: "/sell" },
    { requestedPath: "/sell", finalPath: "/sell", signals: { controlCount: 12 } },
    { requestedPath: "/sell", finalPath: "/sell", signals: { controlCount: 12, bodyText: "Welcome to our marketplace" } },
    // redirected somewhere that is not a sign-in page and proves nothing
    { requestedPath: "/sell", finalPath: "/other" },
    { requestedPath: "/sell", finalPath: "/sell", signals: { hasPasswordField: false } },
  ];
  for (const input of ambiguous) {
    const r = detectLogin(input);
    assert.equal(r.connected, false, `must not claim connected from ${JSON.stringify(input)}`);
    assert.ok(Object.values(REASONS).includes(r.reason), `unknown reason ${r.reason}`);
  }
});

test("a reason code is always returned and always machine-readable", () => {
  const all = [
    { requestedPath: "/a", finalPath: "/login" },
    { requestedPath: "/a", finalPath: "/a", signals: { bodyText: "404 page not found" } },
    { requestedPath: "/a", finalPath: "/a", signals: { controlCount: 0 } },
    { requestedPath: "/a", finalPath: "/a", signals: { hasPasswordField: true } },
    { requestedPath: "/a", finalPath: "/a", signals: { logout: true } },
    { requestedPath: "/a", finalPath: "/a" },
  ];
  for (const input of all) {
    const r = detectLogin(input);
    assert.equal(typeof r.connected, "boolean");
    assert.ok(Object.values(REASONS).includes(r.reason), `${JSON.stringify(input)} -> ${r.reason}`);
    assert.ok(Array.isArray(r.trace) && r.trace.length > 0, "trace needed to audit the verdict");
  }
});

/* ------------------------------------------- no credential access */

test("the detector contains no code that could read a password", () => {
  const src = fs.readFileSync(SRC, "utf8");
  // A boolean named hasPasswordField is fine (presence, not value). Reading
  // .value or a type="password" selector would be a credential read.
  assert.equal(/\.value\b/.test(src), false, "must never read .value");
  assert.equal(/type\s*=\s*["']password["']/.test(src), false, "must never select the password input");
  assert.equal(/addEventListener\(\s*["'](keydown|input|keyup)/.test(src), false, "must never listen for keystrokes");
  assert.equal(/console\.(log|info|debug)[\s\S]{0,40}password/i.test(src), false, "must never log credentials");
});

/* ------------------------------------- generated copy stays in sync */

test("the shipped extension copy matches libs/login-detect.js", () => {
  const res = spawnSync(process.execPath, [BUILDER, "--check"], { encoding: "utf8" });
  assert.equal(res.status, 0, `stale generated copy:\n${res.stdout}${res.stderr}`);
});

test("the generated copy is a valid classic script that exposes the API", () => {
  const code = fs.readFileSync(GEN, "utf8");
  assert.match(code, /GENERATED FILE/, "must carry the do-not-edit header");
  // Check for a module STATEMENT, not the word: the explanatory comments
  // legitimately mention `export`, and a substring match would fail on prose.
  assert.equal(/^export\s/m.test(code), false, "content scripts cannot use export statements");

  const ctx = { URL };
  vm.createContext(ctx);
  vm.runInContext(code, ctx); // throws if it does not parse as a classic script
  const api = ctx.__fashLoginDetect;
  assert.ok(api, "globalThis.__fashLoginDetect must be set");
  assert.equal(typeof api.REASONS, "object", "REASONS is a frozen map, not a function");
  assert.equal(Object.isFrozen(api.REASONS), true, "REASONS must not be mutable at runtime");
  for (const k of ["normalizePath", "isSignInPath", "hasNotFoundText", "detectLogin"]) {
    assert.equal(typeof api[k], "function", `missing ${k}`);
  }

  // Behaviour is identical to the source module, not just present.
  const verdict = api.detectLogin({ requestedPath: "/a", finalPath: "/a", signals: { logout: true, controlCount: 2 } });
  assert.deepEqual(
    { connected: verdict.connected, reason: verdict.reason },
    { connected: true, reason: "connected" }
  );
});

test("the shipped copy has no credential reads either", () => {
  const code = fs.readFileSync(GEN, "utf8");
  assert.equal(/\.value\b/.test(code), false);
  assert.equal(/type\s*=\s*["']password["']/.test(code), false);
});

/* ------------------------------------------------ helpers */

test("hasNotFoundText tolerates empty and non-string input", () => {
  assert.equal(hasNotFoundText(undefined), false);
  assert.equal(hasNotFoundText(null), false);
  assert.equal(hasNotFoundText(""), false);
  assert.equal(hasNotFoundText(42), false);
  assert.equal(hasNotFoundText("Sorry, the page you were looking for was not found."), true);
});
