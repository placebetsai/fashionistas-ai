import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, DEPARTMENTS, SIZES, resolveCategory, shopCategory, shopLeaf } from "../functions/_lib/categories.js";
import { walkPath } from "../functions/_lib/etsy-taxonomy.js";

test("every row is complete and unique", () => {
  const seen = new Set();
  for (const c of CATEGORIES) {
    assert.ok(DEPARTMENTS.includes(c.dept), c.path);
    assert.ok(!seen.has(c.path), "dup " + c.path); seen.add(c.path);
    assert.match(c.ebay.id, /^\d+$/, c.path);
    assert.notEqual(c.ebay.id, "11450", "root id is not a leaf");
    assert.ok(c.etsy, c.path);
    assert.ok(c.size in SIZES, c.path);
    for (const k of ["depop", "poshmark", "mercari", "vinted"]) assert.ok(c.shops[k], k + " " + c.path);
  }
});
test("old flat + old tree values still resolve", () => {
  for (const v of ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Accessories", "Women's Clothing/Tops & Shirts", "Home & Decor/Wall Art & Paintings", "Kids & Baby/Baby & Toddler", "/tops"]) {
    assert.ok(resolveCategory(v), v);
  }
  assert.equal(resolveCategory("nonsense"), null);
});
test("per-shop lookups", () => {
  assert.equal(shopCategory("Men/Jeans", "ebay"), "11483");
  assert.equal(shopCategory("Kids/Girls' Dresses", "grailed"), null);
  assert.equal(shopLeaf("Women/Heels", "depop"), "Heels");
});
test("etsy path walk", () => {
  const tree = [{ id: 1, name: "Clothing", children: [{ id: 2, name: "Women's Clothing", children: [{ id: 3, name: "Dresses", children: [] }] }] }];
  assert.deepEqual(walkPath(tree, "Clothing > Women's Clothing > Dresses"), { id: 3, matched: "Dresses", exact: true });
  assert.equal(walkPath(tree, "Clothing > Men's Clothing").exact, false);
});
