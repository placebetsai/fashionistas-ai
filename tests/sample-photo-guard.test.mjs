/**
 * The wizard's "No photo handy? Try a sample" button loads our own stock
 * illustration (/sample-jacket.jpg) into the photo tray so a visitor can walk
 * the flow without a camera. `submit()` uploaded PHOTOS[0] as photo_url with no
 * check on `hint`, so the sample could be published as a real listing — and it
 * was: live listing id=147 "Vintage denim jacket" ($68) served bytes that were
 * md5-identical to /sample-jacket.jpg (be648bd8908fa7ab6e46186fe7fb7398), while
 * two more flat illustrations sat in the shop beside it.
 *
 * These tests pin the guard's BEHAVIOUR, not just its spelling: the real block
 * of code is lifted out of listing-wizard.js and executed against synthetic
 * photo trays. A comment that mentions "sample" cannot pass these.
 *
 * Also pins the honesty of the affiliate card: those hrefs are each shop's own
 * SEARCH url for the query, so the copy may not claim a cross-listing.
 *
 * Source-level (offline, no browser): these read the shipped files themselves.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const wizard = readFileSync(join(ROOT, "listing-wizard.js"), "utf8");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const bundlePath = html.match(/<script src="\/(assets\/app\.[0-9a-f]+\.js)" defer><\/script>/)[1];
const bundle = readFileSync(join(ROOT, bundlePath), "utf8");

const MARK = "var coverIsSample";
const END = "BUSY = true;";

/** Run the shipped guard block against a photo tray, recording what it says. */
function runGuard(photos) {
  const start = wizard.indexOf(MARK);
  const end = wizard.indexOf(END, start);
  assert.ok(start > -1, "the sample guard must exist in listing-wizard.js");
  assert.ok(end > start, "the guard must sit inside submit() before BUSY is set");
  const body = wizard.slice(start, end);
  const said = [];
  const fn = new Function("PHOTOS", "say", "save", "renderStep", body);
  const tray = photos.map((hint) => ({ hint }));
  // Read the tray from OUTSIDE: the refuse path ends in `return;`, so anything
  // appended after the body would never run on exactly the path that matters.
  fn(tray, (...a) => said.push(a[0]), () => {}, () => {});
  return { order: tray.map((p) => p.hint || "real"), said };
}

const SAMPLE = "sample";
const REAL = "";

test("a sample-only tray is refused before anything is uploaded", () => {
  const { order, said } = runGuard([SAMPLE, SAMPLE]);
  assert.deepEqual(order, [SAMPLE, SAMPLE], "the tray is left alone");
  assert.equal(said.length, 1, "the seller is told why, exactly once");
  assert.match(said[0], /sample photo, not your item/i);
  assert.doesNotMatch(said[0], /✓|Listed/, "and never claims success");
});

test("a real cover photo is untouched — the guard must not nag honest sellers", () => {
  const { said } = runGuard([REAL, SAMPLE]);
  assert.deepEqual(said, [], "nothing to report when the lead photo is real");
});

test("sample first, real photo later: the real photo is promoted to cover", () => {
  const { order, said } = runGuard([SAMPLE, REAL]);
  assert.deepEqual(order, ["real", "sample"], "the seller's own photo now leads");
  assert.equal(said.length, 1);
  assert.match(said[0], /moved down/i, "the swap is announced, not silent");
});

test("the guard runs before the upload and before BUSY is set", () => {
  const start = wizard.indexOf(MARK);
  const end = wizard.indexOf(END, start);
  assert.ok(start > -1 && end > start);
  const guard = wizard.slice(start, end);
  assert.match(guard, /realIdx/, "it inspects every photo, not just index 0");
  // Ordering is the whole point: a guard that runs after uploadB64 has already
  // put the stock image on the CDN.
  const uploadAt = wizard.indexOf("var up = (cov && cov.src) ? uploadB64");
  assert.ok(uploadAt > -1, "submit() still uploads the cover photo");
  assert.ok(start < uploadAt, "guard must precede the upload");
  assert.ok(end < uploadAt, "and must have finished before it");
});

test("the sample button still exists — it is allowed, just not publishable", () => {
  assert.match(wizard, /No photo handy\? Try a sample/);
  assert.match(wizard, /hint: \/sample-jacket\/i\.test/);
});

test("the affiliate card no longer claims a cross-listing we do not have", () => {
  assert.doesNotMatch(bundle, /Also listed on /, "the button said what the link does not do");
  assert.doesNotMatch(bundle, /Can't find it here\? It may be listed on these shops/);
  assert.doesNotMatch(bundle, /Other marketplaces may also have this item/);
  assert.doesNotMatch(bundle, /Updated for your search\./);
  // The replacement must still describe a search, and keep the honest tooltip.
  assert.match(bundle, /Search \$\{escapeHtml\(p\.n\)\} ↗/);
  assert.match(bundle, /searched for what you typed/);
  assert.match(bundle, /we don't post there for you/);
});

test("every affiliate href is built from the shopper's own query", () => {
  // The term line sits above `const rows`, so it is read from the bundle.
  assert.match(bundle, /const term = \(S\.marketQ\|\|""\)\.trim\(\)/, "term is what they typed");
  assert.match(bundle, /taxLabel\(S\.marketCat\) \|\| "vintage clothing"/, "or the department they opened");
  const row = bundle.slice(bundle.indexOf("const rows = ["), bundle.indexOf("].map(p => `"));
  assert.match(row, /_nkw=\$\{q\}/, "eBay searches the query");
  assert.match(row, /search\?q=\$\{q\}/, "Etsy/Depop search the query");
});
