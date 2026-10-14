/** Category landing pages: /shop/c/<dept>[/<sub>] — only for categories that hold real listings. */
import { DEPARTMENTS, CATEGORIES, resolveCategory } from "./categories.js";
export const slug = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function catUrl(dept, sub) { return "/shop/c/" + slug(dept) + (sub ? "/" + slug(sub) : ""); }
export function fromSlug(path) {
  const [d, s] = String(path || "").split("/").filter(Boolean);
  const dept = DEPARTMENTS.find((x) => slug(x) === d);
  if (!dept) return null;
  if (!s) return { dept, sub: "" };
  const row = CATEGORIES.find((c) => c.dept === dept && slug(c.sub) === s);
  return row ? { dept, sub: row.sub } : null;
}
export function inCategory(m, c) {
  const r = resolveCategory(m && m.category, m && m.title);
  return !!r && r.dept === c.dept && (!c.sub || r.sub === c.sub);
}
/** Every dept and dept/sub that has at least one live listing, with counts. */
export function liveCategories(items) {
  const map = new Map();
  for (const m of items || []) {
    const r = resolveCategory(m && m.category, m && m.title);
    if (!r) continue;
    for (const k of [r.dept, r.dept + "/" + r.sub]) map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([k, n]) => { const [dept, sub] = k.split("/"); return { dept, sub: sub || "", n, url: catUrl(dept, sub) }; });
}
