// sales/prompt.js — "Sold on X — delete from Y?" and its one-tap confirm.
//
// This is the ONLY user-facing decision in Phase 2. Detection is automatic;
// deletion never is. The model returned here is deliberately UI-free (plain
// JSON + one async function) so index.html — which is owned by another
// workstream and must not be edited for this feature — can render it however
// it likes:
//
//     import { buildPrompt } from "./apps/extension/sales/index.js";
//
//     const prompt = buildPrompt(sale, { shops: connectedShops, enqueue });
//     render({ title: prompt.title, options: prompt.options });   // seller ticks Y
//     await prompt.confirm();          // one tap => enqueues the existing delist
//
// Contract of the model:
//   { id, kind, title, detail, source, options[], confirm(id?) }
//     options[]  — the OTHER connected shops. The shop the item sold on is
//                  never in the list (you do not delete the sale itself).
//     confirm()  — every option   |  confirm(id) — just that one.
//                  Never throws; returns
//                  {ok, results:{shop:{outcome,detail}}, entries[]}
//                  with outcome ∈ ok | failed | skipped (sales/delist.js).

import { SHOPS } from "../config/selectors.js";
import { runDelist } from "./delist.js";

/** Human label for a shop key; falls back to the key itself. */
export function labelOf(shop, labels) {
  if (labels && labels[shop]) return String(labels[shop]);
  const cfg = SHOPS[shop];
  return (cfg && cfg.label) || String(shop || "");
}

function joinList(names) {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function detailOf(sale) {
  const bits = [];
  if (sale && sale.title) bits.push(String(sale.title));
  if (sale && sale.price != null && sale.currency) bits.push(`${sale.currency} ${sale.price}`);
  else if (sale && sale.price != null) bits.push(`$${sale.price}`);
  if (sale && sale.soldAtText) bits.push(String(sale.soldAtText));
  else if (sale && sale.soldAt) bits.push(String(sale.soldAt));
  return bits.join(" · ");
}

/**
 * Build the prompt model for one sale.
 *
 * @param {object}   sale   a sale event (registry.makeSaleEvent output)
 * @param {object}   opts
 * @param {string[]} opts.shops   every connected shop (the sold shop is
 *                                removed from the options automatically)
 * @param {Function} [opts.confirm] override the confirm implementation
 * @param {Function} [opts.enqueue] injected delist enqueuer (sales/delist.js)
 * @param {Function} [opts.log]     injected audit sink
 * @param {object}   [opts.labels]  override shop labels
 * @param {number|Function} [opts.now]
 * @returns {{id:string, kind:string, title:string, detail:string,
 *            source:object, options:object[], confirm:Function}}
 */
export function buildPrompt(sale, opts = {}) {
  const { shops = [], labels = null, now } = opts;
  const soldShop = (sale && sale.shop) || "";
  const source = { id: soldShop, label: labelOf(soldShop, labels) };

  const seen = new Set();
  const options = [];
  for (const raw of shops) {
    const id = String(raw || "").trim();
    if (!id || id === soldShop || seen.has(id)) continue;
    seen.add(id);
    options.push({ id, label: labelOf(id, labels), checked: true });
  }

  const title = options.length
    ? `Sold on ${source.label} — delete from ${joinList(options.map((o) => o.label))}?`
    : `Sold on ${source.label} — no other shops connected`;

  const run = opts.confirm || ((ids) =>
    runDelist({ sale, shops: ids, enqueue: opts.enqueue || null, log: opts.log || null, now }));

  async function confirm(optionId) {
    if (optionId === undefined || optionId === null) {
      if (!options.length) return { ok: false, error: "no_other_shops", results: {}, entries: [] };
      return run(options.map((o) => o.id));
    }
    const id = String(optionId);
    if (!options.some((o) => o.id === id)) {
      return { ok: false, error: "unknown_option", optionId: id, results: {}, entries: [] };
    }
    return run([id]);
  }

  return {
    id: sale && sale.key ? `sale:${sale.key}` : "sale:unknown",
    kind: "delist-after-sale",
    title,
    detail: detailOf(sale),
    source,
    options,
    confirm
  };
}

export default { buildPrompt, labelOf };
