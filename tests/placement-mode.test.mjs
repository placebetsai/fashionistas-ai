/**
 * P0-B placement_mode inference + CTA wiring helpers.
 * Pure JS — no DOM / no paid APIs.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  inferPlacementMode,
  placementCtas,
  placementHref,
  PLACEMENT_MODES,
} from "../see-in-space/placement-mode.js";

test("PLACEMENT_MODES lists clothing|wall|floor|none", () => {
  assert.deepEqual([...PLACEMENT_MODES], ["clothing", "wall", "floor", "none"]);
});

test("explicit placement_mode wins over category text", () => {
  assert.equal(
    inferPlacementMode({ placement_mode: "floor", category: "Women's Clothing/Dresses", title: "Red dress" }),
    "floor"
  );
});

test("paintings / posters / prints → wall", () => {
  assert.equal(inferPlacementMode({ category: "Home", title: "Abstract canvas painting 24x36" }), "wall");
  assert.equal(inferPlacementMode({ title: "Vintage travel poster" }), "wall");
  assert.equal(inferPlacementMode("framed art print gallery wall"), "wall");
});

test("furniture / rugs → floor", () => {
  assert.equal(inferPlacementMode({ title: "Mid-century oak side table" }), "floor");
  assert.equal(inferPlacementMode({ category: "Furniture", description: "Blue velvet sofa" }), "floor");
  assert.equal(inferPlacementMode("Persian rug 5x8"), "floor");
});

test("apparel categories → clothing", () => {
  assert.equal(inferPlacementMode({ category: "Women's Clothing/Tops & Shirts", title: "Silk blouse" }), "clothing");
  assert.equal(inferPlacementMode({ category: "Shoes", title: "White sneakers" }), "clothing");
  assert.equal(inferPlacementMode({ category: "Men's Clothing/Outerwear", title: "Wool coat" }), "clothing");
});

test("empty / unknown → none", () => {
  assert.equal(inferPlacementMode({}), "none");
  assert.equal(inferPlacementMode({ title: "xyzzy widget 12" }), "none");
});

test("wall CTAs include See on my wall and never claim photoreal", () => {
  const ctas = placementCtas("wall");
  assert.ok(ctas.some((c) => /wall/i.test(c.label)));
  assert.ok(ctas.every((c) => !/photoreal/i.test(c.label)));
  assert.ok(ctas.every((c) => /preview|free|Instant|overlay/i.test(c.tip)));
});

test("clothing CTA routes to try-on", () => {
  const ctas = placementCtas("clothing");
  assert.equal(ctas.length, 1);
  assert.equal(ctas[0].href, "/try-on/");
  assert.match(ctas[0].label, /Try on/i);
});

test("placementHref packs item photo and mode", () => {
  const href = placementHref("/see-in-space/", {
    photoUrl: "https://cdn.example/a.jpg",
    title: "Blue sofa",
    mode: "floor",
    widthCm: 180,
    heightCm: 90,
  });
  assert.ok(href.startsWith("/see-in-space/?"));
  assert.ok(href.includes("mode=floor"));
  assert.ok(href.includes("item="));
  assert.ok(href.includes("w=180"));
  assert.ok(href.includes("h=90"));
});
