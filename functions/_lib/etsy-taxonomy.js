/**
 * Resolve an Etsy seller-taxonomy id from our table's Etsy path
 * ("Clothing > Women's Clothing > Dresses") using Etsy's live tree
 * (GET /v3/application/seller-taxonomy/nodes, x-api-key only — no user token).
 * The tree is cached per isolate. Returns { id, matched, exact } or null.
 * Never falls back to a fixed id: a wrong Etsy category is worse than asking.
 */
import { resolveCategory } from "./categories.js";

let TREE = null, TREE_AT = 0;
const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

export async function etsyTree(apiKey, fetchImpl = fetch) {
  if (TREE && Date.now() - TREE_AT < 6 * 3600e3) return TREE;
  const r = await fetchImpl("https://openapi.etsy.com/v3/application/seller-taxonomy/nodes", { headers: { "x-api-key": apiKey, Accept: "application/json" } });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  TREE = (d && d.results) || null; TREE_AT = Date.now();
  return TREE;
}

export function walkPath(tree, etsyPath) {
  if (!Array.isArray(tree) || !etsyPath) return null;
  const parts = String(etsyPath).split(">").map(norm).filter(Boolean);
  let level = tree, node = null, depth = 0;
  for (const want of parts) {
    const kids = level || [];
    const hit = kids.find((n) => norm(n.name) === want) || kids.find((n) => norm(n.name).startsWith(want) || want.startsWith(norm(n.name)));
    if (!hit) break;
    node = hit; depth++; level = hit.children || [];
  }
  return node ? { id: Number(node.id), matched: node.name, exact: depth === parts.length } : null;
}

export async function etsyTaxonomyFor(category, apiKey, fetchImpl) {
  const row = resolveCategory(category);
  if (!row || !row.etsy || !apiKey) return null;
  const tree = await etsyTree(apiKey, fetchImpl).catch(() => null);
  return walkPath(tree, row.etsy);
}
