/**
 * Homography math for the wall placer (no canvas required).
 */
import assert from "node:assert/strict";
import test from "node:test";

const { computeHomography, applyH, invertH, defaultWallCorners } = await import("../see-in-space/placer.js");

test("identity-ish map of unit square to axis-aligned rect", () => {
  const dst = [
    { x: 10, y: 20 },
    { x: 110, y: 20 },
    { x: 110, y: 80 },
    { x: 10, y: 80 },
  ];
  const H = computeHomography(dst);
  const p0 = applyH(H, 0, 0);
  const p1 = applyH(H, 1, 0);
  const p2 = applyH(H, 1, 1);
  const p3 = applyH(H, 0, 1);
  assert.ok(Math.abs(p0.x - 10) < 1e-6 && Math.abs(p0.y - 20) < 1e-6);
  assert.ok(Math.abs(p1.x - 110) < 1e-6 && Math.abs(p1.y - 20) < 1e-6);
  assert.ok(Math.abs(p2.x - 110) < 1e-6 && Math.abs(p2.y - 80) < 1e-6);
  assert.ok(Math.abs(p3.x - 10) < 1e-6 && Math.abs(p3.y - 80) < 1e-6);
});

test("invertH round-trips a point", () => {
  const dst = [
    { x: 100, y: 50 },
    { x: 400, y: 80 },
    { x: 380, y: 300 },
    { x: 80, y: 280 },
  ];
  const H = computeHomography(dst);
  const Hi = invertH(H);
  const mid = applyH(H, 0.5, 0.5);
  const back = applyH(Hi, mid.x, mid.y);
  assert.ok(Math.abs(back.x - 0.5) < 1e-6);
  assert.ok(Math.abs(back.y - 0.5) < 1e-6);
});

test("defaultWallCorners stay inside the canvas", () => {
  const c = defaultWallCorners(800, 600);
  assert.equal(c.length, 4);
  for (const p of c) {
    assert.ok(p.x >= 0 && p.x <= 800);
    assert.ok(p.y >= 0 && p.y <= 600);
  }
});
