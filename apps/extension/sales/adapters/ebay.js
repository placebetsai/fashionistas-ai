// sales/adapters/ebay.js — eBay sale detection.
// ZERO selectors live here: every selector comes from sales/sold-selectors.js
// through the SEL argument (the same discipline adapters/ebay.js follows for
// form filling), so a layout change is a one-file fix in the selector source.
//
// eBay is read through the seller's OWN logged-in browser session — the same
// as every other shop here. The official Sell API path (api/ebay_api.js) is
// parked behind EBAY_API_ENABLED and is NOT used by sale detection: no API key
// is requested, stored or transmitted.
//
// HARD RULES: detection only. Never clicks, never navigates, NEVER throws.

export function scanSold(SEL, opts) {
  const K = globalThis.__fashSales;
  if (!K) {
    return {
      shop: "ebay", status: "skipped", reason: "saleskit_missing",
      items: [], needsInput: [], report: [],
      counts: { found: 0, readable: 0, unreadable: 0, sold: 0 },
      state: (opts && opts.state) || { failures: {}, gaveUp: [] },
      signals: null, href: ""
    };
  }
  return K.scanSold("ebay", SEL, opts);
}
