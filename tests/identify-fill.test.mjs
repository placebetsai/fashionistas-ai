/**
 * Photo → identify → listing form fill quality.
 * Pins the repairs for: jacket misfiled as Tops, "not visible" size,
 * Unknown brand/condition, missing material, absurd Outerwear prices.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  normalizeIdentify,
  listingFieldsFromIdentify,
  categoryFromText,
  inferMaterial,
} from "../libs/identify-fill.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const pub = readFileSync(join(ROOT, "identify-fill.js"), "utf8");
const lib = readFileSync(join(ROOT, "libs/identify-fill.js"), "utf8");

test("public identify-fill.js matches libs/identify-fill.js", () => {
  assert.equal(pub, lib);
  assert.match(html, /identify-fill\.js/);
});

test("index wires Pages analyze first then workers.dev fallback", () => {
  assert.match(html, /function identifyPhoto/);
  assert.match(html, /fetch\("\/api\/ai\/analyze"/);
  assert.match(html, /api\("\/api\/ai\/analyze"/);
  assert.match(html, /IdentifyFill\.listingFieldsFromIdentify/);
  assert.match(html, /IdentifyFill\.normalizeIdentify/);
});

test("categoryFromText: jackets are Outerwear, dress shirts are Tops", () => {
  assert.equal(categoryFromText("jean jacket"), "Outerwear");
  assert.equal(categoryFromText("denim jacket"), "Outerwear");
  assert.equal(categoryFromText("leather blazer"), "Outerwear");
  assert.equal(categoryFromText("dress shirt"), "Tops");
  assert.equal(categoryFromText("summer dress"), "Dresses");
  assert.equal(categoryFromText("white sneakers"), "Shoes");
});

test("normalizeIdentify repairs the live sample-jacket failure shape", () => {
  // Measured 2026-10-06 against fashionistas-api: dress shirt / Tops / $5-20 /
  // Unknown / not visible — wrong for the shipped sample-jacket.jpg.
  const raw = {
    source: "ai",
    brand: "Unknown",
    category: "Tops",
    color: "blue",
    condition: "Unknown",
    confidence: 50,
    priceMax: 20,
    priceMin: 5,
    sizeHint: "not visible",
    type: "denim jacket",
    note: "",
  };
  const n = normalizeIdentify(raw);
  assert.equal(n.category, "Outerwear");
  assert.equal(n.brand, "");
  assert.equal(n.sizeHint, "");
  assert.equal(n.condition, "Good");
  assert.equal(n.material, "Denim");
  assert.ok(n.priceMin >= 25, "Outerwear floor");
  assert.ok(n.priceMax >= n.priceMin);
});

test("listingFieldsFromIdentify fills title, desc, price, material", () => {
  const fields = listingFieldsFromIdentify({
    type: "denim jacket",
    category: "Tops",
    color: "blue",
    brand: "Unknown",
    condition: "Unknown",
    priceMin: 5,
    priceMax: 20,
    sizeHint: "not visible",
    confidence: 70,
  });
  assert.match(fields.title, /Denim Jacket/i);
  assert.equal(fields.category, "Outerwear");
  assert.equal(fields.material, "Denim");
  assert.equal(fields.sizeHint, "");
  assert.equal(fields.brand, "");
  assert.ok(Number(fields.price) >= 25);
  assert.match(fields.description, /Material:\s*Denim/i);
  assert.match(fields.description, /Condition:\s*Good/i);
  assert.equal(fields._conf, 70);
});

test("inferMaterial reads fabric from type text", () => {
  assert.equal(inferMaterial("blue denim jacket"), "Denim");
  assert.equal(inferMaterial("lamb leather coat"), "Leather");
  assert.equal(inferMaterial("mystery item"), "");
});

test("Pages analyze route + vision prompt exist", () => {
  const route = readFileSync(join(ROOT, "functions/api/ai/analyze.js"), "utf8");
  const vision = readFileSync(join(ROOT, "functions/api/ai/_lib/vision.js"), "utf8");
  assert.match(route, /identifyFromImage/);
  assert.match(vision, /Outerwear \(never Tops\)/);
  assert.match(vision, /normalizeIdentify/);
  assert.match(vision, /VISION_PROMPT/);
});
