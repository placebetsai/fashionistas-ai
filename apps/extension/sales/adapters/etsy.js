// sales/adapters/etsy.js — Etsy sale detection.
// ZERO selectors live here: every selector comes from sales/sold-selectors.js
// through the SEL argument (the same discipline adapters/etsy.js follows for
// form filling), so a layout change is a one-file fix in the selector source.
//
// Etsy is read through the seller's OWN logged-in browser session — the same
// as every other shop here. The Open API v3 path (api/etsy_api.js) is parked
// behind ETSY_API_ENABLED and is NOT used by sale detection: no API key is
// requested, stored or transmitted.
//
// "Sold out" (quantity 0) is the signal, NOT the all-time "N sales" counter —
// a live listing with one past sale can still sell again and must not be
// treated as sold.
//
// HARD RULES: detection only. Never clicks, never navigates, NEVER throws.

export function scanSold(SEL, opts) {
  const K = globalThis.__fashSales;
  if (!K) {
    return {
      shop: "etsy", status: "skipped", reason: "saleskit_missing",
      items: [], needsInput: [], report: [],
      counts: { found: 0, readable: 0, unreadable: 0, sold: 0 },
      state: (opts && opts.state) || { failures: {}, gaveUp: [] },
      signals: null, href: ""
    };
  }
  return K.scanSold("etsy", SEL, opts);
}
