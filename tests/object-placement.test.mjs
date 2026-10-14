/**
 * "People should be able to try objects in their own setting" — the room
 * placer used to be unreachable for anything that wasn't wall art or furniture:
 *
 *   - placementCtaHtml() returned "" for every unclassified object, so a
 *     coffee maker's item page showed NO preview button at all;
 *   - the room page only knew Wall and Floor, so a counter/tabletop object had
 *     nowhere to go.
 *
 * Now: a `table` mode (counter, tabletop, shelf), and the item-page CTA is
 * never empty — every listing gets a way into /see-in-space/.
 *
 * Source-level: these read the shipped files themselves.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { inferPlacementMode, placementCtas, PLACEMENT_MODES } from "../see-in-space/placement-mode.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "classic.html"), "utf8");
const bundlePath = html.match(/<script src="\/(assets\/app\.[0-9a-f]+\.js)" defer><\/script>/)[1];
const bundle = readFileSync(join(ROOT, bundlePath), "utf8");
const room = readFileSync(join(ROOT, "see-in-space/index.html"), "utf8");
const placer = readFileSync(join(ROOT, "see-in-space/placer.js"), "utf8");

test("countertop objects infer to the table mode", () => {
  assert.ok(PLACEMENT_MODES.includes("table"));
  assert.equal(inferPlacementMode({ title: "Keurig Silver Coffee Maker" }), "table");
  assert.equal(inferPlacementMode({ category: "Home", title: "Ceramic vase" }), "table");
  assert.equal(inferPlacementMode({ title: "Bluetooth speaker" }), "table");
  assert.equal(inferPlacementMode({ category: "Home & Decor", description: "Scented candle set" }), "table");
});

test("the old classifications still win before table", () => {
  assert.equal(inferPlacementMode({ title: "Framed art print" }), "wall");
  assert.equal(inferPlacementMode({ title: "Persian rug 5x8" }), "floor");
  assert.equal(inferPlacementMode({ title: "Floor lamp" }), "floor");
  assert.equal(inferPlacementMode({ category: "Women's Clothing/Dresses", title: "Silk dress" }), "clothing");
  assert.equal(inferPlacementMode({ title: "xyzzy widget 12" }), "none", "unknown stays unknown — no fake claims");
});

test("an explicit placement_mode of table is honoured", () => {
  assert.equal(inferPlacementMode({ placement_mode: "table", title: "Silk dress" }), "table");
});

test("table CTAs say counter and never claim photoreal", () => {
  const ctas = placementCtas("table");
  assert.ok(ctas.some((c) => /counter/i.test(c.label)));
  assert.ok(ctas.every((c) => !/photoreal/i.test(c.label)));
  assert.ok(ctas.every((c) => /preview|free|Instant|overlay/i.test(c.tip)));
  assert.ok(ctas.every((c) => c.href.startsWith("/see-in-space/")));
});

test("the item page CTA is never empty — objects lose their entry point no more", () => {
  const fn = bundle.slice(bundle.indexOf("function placementCtaHtml(item){"), bundle.indexOf("async function openMarketItem"));
  assert.doesNotMatch(fn, /return "";/, "the old early-return that hid the button for objects");
  assert.match(fn, /mode === "table"/);
  assert.match(fn, /See it on my counter/);
  assert.match(fn, /never an empty string/i);
  // The tile-level button is deliberately gone. A search result is a list of
  // things, not a thing you are trying on, and seven of them at once read as
  // noise — the owner's words were "on the search screen, what the fuck are
  // you trying on". Every mode is still reachable, from the item itself,
  // which is where placementCtaHtml() runs (asserted above).
  assert.doesNotMatch(bundle, /marketCardTry\(/, "the shop/search tile must not carry a try-on button");
  assert.doesNotMatch(bundle, /ux-try-link/, "same, by class: the tile CTA is gone");
});

test("the classifier in the bundle knows table too", () => {
  const fn = bundle.slice(bundle.indexOf("function inferPlacementMode(item){"), bundle.indexOf("function placementCtaHtml(item){"));
  assert.match(fn, /e === "table"/, "explicit placement_mode");
  assert.match(fn, /coffee\\s\*makers?/, "countertop object regex");
  assert.match(fn, /return "table";/);
});

test("the room page offers Counter alongside Wall and Floor", () => {
  assert.match(room, /id="mode-table" data-mode="table">Counter<\/button>/);
  assert.match(room, /\$\("mode-table"\)\.onclick = \(\) => setMode\("table"\);/);
  assert.match(room, /const normMode = \(v\) => \(v === "floor" \|\| v === "table"\) \? v : "wall";/);
  assert.match(room, /Your wall, floor or counter/);
  assert.match(room, /on the wall, the floor, or your counter/);
});

test("counter mode behaves like a surface: drag, scale/rotate, AR on a plane", () => {
  // floor-controls (scale + rotate) must be visible for any non-wall mode
  assert.match(room, /\$\("floor-controls"\)\.hidden = mode === "wall";/);
  // pointer dragging works on surfaces, not only the old literal "floor"
  assert.match(room, /if \(mode !== "wall" && ev\.target === cv\) \{/);
  // WebXR horizontal plane: counter AR is labelled floor to the browser
  assert.match(room, /setAttribute\("ar-placement", mode === "wall" \? "wall" : "floor"\)/);
  // the hint text names the counter
  assert.match(room, /Drag it onto your counter/);
});

test("the room page never trusts a poisoned cross-origin image cache", () => {
  // The item page caches the photo with a plain <img> (no Origin -> no ACAO),
  // the room page's crossOrigin load reuses that entry and dies with a CORS
  // error. The loader must go to the network and hand bytes over as a blob.
  const fn = placer.slice(placer.indexOf("export async function loadImageFromUrl"));
  assert.match(fn, /fetch\(url, \{ cache: "reload", mode: "cors" \}\)/);
  assert.match(fn, /URL\.createObjectURL\(await resp\.blob\(\)\)/);
  assert.match(fn, /fall through to the direct image path/);
  assert.match(room, /await loadImageFromUrl\(/, "callers still await it");
});

test("try-on never trusts a poisoned cross-origin image cache either", () => {
  // The exact bug the room page above already fixed, one page over, where it
  // was never applied. The shop grid's <img> tags fetch the listing photo with
  // NO Origin header; the Worker used to send no `Vary: Origin` on that
  // variant either, so the browser's cache held one copy for both — and the
  // try-on page's CORS fetch was handed the copy without
  // Access-Control-Allow-Origin. It died with `TypeError: Failed to fetch`,
  // the garment station stayed empty, and the page told the shopper to upload
  // the very item they had just clicked on.
  //
  // Measured on prod 2026-10-11:
  //   fetch(src)                -> TypeError: Failed to fetch
  //   fetch(src, {cache:"no-store"}) -> 200 image/jpeg
  //   fetch(src, {cache:"reload"})   -> 200 image/jpeg
  const tryon = readFileSync(join(ROOT, "try-on/index.html"), "utf8");
  const fn = tryon.slice(tryon.indexOf("(function preloadItem(){"), tryon.indexOf("Seller flow: the item is ALREADY"));
  assert.ok(fn.length > 0, "preloadItem must still be in the page");
  assert.match(fn, /cache: "no-store"/, "must bypass the poisoned cache entry");
  assert.match(fn, /setFile\("garment"/, "the garment is still preloaded, not asked for");
  assert.match(fn, /loadShopStrip\(\)/,
    "a failed preload falls back to the shop strip — never an empty station telling them to re-upload");
  assert.doesNotMatch(fn, /save it from the listing and add it here/,
    "the old message asked the shopper to re-upload the item they had just clicked");
});

test("a counter item starts mid-frame, a floor item stays on the floor", () => {
  assert.match(room, /const yFrac = \(\) => \(mode === "table" \? 0\.46 : 0\.78\);/);
  assert.match(room, /defaultFloorPose\(cv\.width, cv\.height, itemImg, yFrac\(\)\)/);
  assert.match(placer, /export function defaultFloorPose\(W, H, itemImg, yFrac = 0\.78\)/);
  assert.match(placer, /counter or tabletop/);
});
