// Shop filters have to match the category table. A women's-only chip row hid
// every men's and home listing the moment a shopper left All.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const index = readFileSync(new URL("index.html", root), "utf8");
const srcMatch = index.match(/src="\/assets\/(app\.[a-f0-9]+\.js)"/);
assert.ok(srcMatch, "index.html must point at a hashed app bundle");
const app = readFileSync(new URL("assets/" + srcMatch[1], root), "utf8");
const wizard = readFileSync(new URL("listing-wizard.js", root), "utf8");
const me = readFileSync(new URL("functions/api/auth/me.js", root), "utf8");

test("shop nav is the department table, plus Other for unfiled listings", () => {
  assert.match(app, /function marketNavHtml\(\)/);
  assert.match(app, /for \(const d of taxDepts\(\)\)/);
  assert.match(app, /__other__/);
  assert.doesNotMatch(app, /\["Women\/Jeans","Jeans"\]/);
});

test("a missing category is not silently filed as women's tops", () => {
  assert.doesNotMatch(wizard, /W\.f\.path = "Women\/Tops"/);
  assert.match(wizard, /Pick a department/);
});

test("pages session check accepts the same credential as the app", () => {
  assert.match(me, /requireAuth/);
  assert.doesNotMatch(me, /FROM sessions/);
});
