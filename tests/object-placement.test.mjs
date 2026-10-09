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
const html = readFileSync(join(ROOT, "index.html"), "utf8");
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
  // The card-level button must also cover every mode.
  const card = bundle.slice(bundle.indexOf("function marketCardTry(m){"), bundle.indexOf("function marketCard(m, i){"));
  assert.doesNotMatch(card, /return "";/);
  assert.match(card, /See it on my counter/);
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

test("a counter item starts mid-frame, a floor item stays on the floor", () => {
  assert.match(room, /const yFrac = \(\) => \(mode === "table" \? 0\.46 : 0\.78\);/);
  assert.match(room, /defaultFloorPose\(cv\.width, cv\.height, itemImg, yFrac\(\)\)/);
  assert.match(placer, /export function defaultFloorPose\(W, H, itemImg, yFrac = 0\.78\)/);
  assert.match(placer, /counter or tabletop/);
});
