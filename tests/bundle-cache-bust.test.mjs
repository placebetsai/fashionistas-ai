/**
 * The bundle is served `Cache-Control: public, max-age=31536000, immutable`
 * (see `_headers`), so the FILENAME is the only cache-buster there is. The
 * name is content-addressed: assets/app.<sha256(content)[0:12]>.js.
 *
 * Editing the bundle in place without renaming it ships the change to nobody:
 * the Cloudflare edge keeps serving the old body from its year-long cache (it
 * was a `cf-cache-status: HIT`, `age: 33136` while the origin already had the
 * new bytes), and every browser that visited before keeps its own copy for a
 * year. The deploy verifies green, the origin is correct, and users still see
 * the old code — the worst kind of "fixed".
 *
 * So the filename is pinned to the bytes. Change the code, get a new name, or
 * these fail.
 *
 * Source-level (offline, no network): these read the shipped files themselves.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "classic.html"), "utf8");
const headers = readFileSync(join(ROOT, "_headers"), "utf8");

const refs = [...html.matchAll(/<script src="\/(assets\/app\.[0-9a-f]+\.js)" defer><\/script>/g)].map((m) => m[1]);

test("index.html loads exactly one content-addressed bundle", () => {
  assert.equal(refs.length, 1, `expected one bundle script tag, found: ${refs.join(", ") || "none"}`);
});

test("the bundle name is the sha256 of its own bytes", () => {
  const path = refs[0];
  const named = path.match(/^assets\/app\.([0-9a-f]{12})\.js$/);
  assert.ok(named, `bundle must be content-addressed, got ${path}`);
  const actual = createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex").slice(0, 12);
  assert.equal(
    actual,
    named[1],
    `${path} holds bytes hashing to ${actual} — rename it and update index.html, or no returning visitor will ever receive this change`,
  );
});

test("no stale bundle is left in assets/ (a leftover is still served for a year)", () => {
  const found = readdirSync(join(ROOT, "assets")).filter((f) => /^app\.[0-9a-f]+\.js$/.test(f));
  assert.deepEqual(found, refs.map((r) => r.replace("assets/", "")), "one bundle file, and it is the one referenced");
});

test("the immutable rule still applies — renaming is the only escape", () => {
  assert.match(headers, /\/assets\/app\.\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  // If this ever becomes a short TTL the filename stops mattering, and the
  // test above is documenting a rule that no longer bites.
  assert.doesNotMatch(html, /assets\/app\.[0-9a-f]+\.js\?v=/, "no query-string busting — the name does the work");
});
