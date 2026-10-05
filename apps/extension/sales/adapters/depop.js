// sales/adapters/depop.js — Depop sale detection.
// ZERO selectors live here: every selector comes from sales/sold-selectors.js
// through the SEL argument (the same discipline adapters/depop.js follows for
// form filling), so a layout change is a one-file fix in the selector source.
//
// KNOWN GAP (NOT PROVEN): Depop's own-listings page is
// /profile/<username>/products/ and the username is not known before the tab
// is open — see the `listUrl` note in sales/sold-selectors.js. Until one real
// logged-in probe fixes it, a wrong entry URL surfaces as
// {status:"skipped", reason:"no_listings"} — an honest skip, never a throw.
//
// HARD RULES: detection only. Never clicks, never navigates, NEVER throws.

export function scanSold(SEL, opts) {
  const K = globalThis.__fashSales;
  if (!K) {
    return {
      shop: "depop", status: "skipped", reason: "saleskit_missing",
      items: [], needsInput: [], report: [],
      counts: { found: 0, readable: 0, unreadable: 0, sold: 0 },
      state: (opts && opts.state) || { failures: {}, gaveUp: [] },
      signals: null, href: ""
    };
  }
  return K.scanSold("depop", SEL, opts);
}
