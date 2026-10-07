import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVisionJSON, VISION_PROMPT } from "../_lib/vision.js";
import { normalizeIdentify } from "../../../../libs/identify-fill.js";

test("parseVisionJSON unwraps fenced and messy model output", () => {
  const raw = '```json\n{"type":"denim jacket","category":"Outerwear","brand":"","color":"blue","condition":"Good","priceMin":30,"priceMax":80,"confidence":80,"sizeHint":"","material":"Denim","note":""}\n```';
  const p = parseVisionJSON(raw);
  assert.equal(p.type, "denim jacket");
  const n = normalizeIdentify(p);
  assert.equal(n.category, "Outerwear");
  assert.equal(n.material, "Denim");
});

test("VISION_PROMPT bans Unknown size and forces Outerwear for jackets", () => {
  assert.match(VISION_PROMPT, /never write "not visible"/i);
  assert.match(VISION_PROMPT, /never Tops/);
  assert.match(VISION_PROMPT, /denim \/ jean jackets/i);
});
