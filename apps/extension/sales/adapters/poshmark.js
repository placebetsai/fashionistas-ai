// sales/adapters/poshmark.js — Poshmark sale detection.
// ZERO selectors live here: every selector comes from sales/sold-selectors.js
// through the SEL argument (the same discipline adapters/poshmark.js follows
// for form filling), so a layout change is a one-file fix in the selector source.
//
// HARD RULES: detection only. This function reads the seller's own logged-in
// closet page and returns observations. It never clicks, never navigates, and
// NEVER throws — a wall or a redesign comes back as {status:"skipped"}.
//
// Serialization: this function is handed to chrome.scripting.executeScript
// ({func}), so its body must close over NOTHING. All shared logic lives behind
// globalThis.__fashSales (sales/saleskit.js, injected as a file first).

export function scanSold(SEL, opts) {
  const K = globalThis.__fashSales;
  if (!K) {
    return {
      shop: "poshmark", status: "skipped", reason: "saleskit_missing",
      items: [], needsInput: [], report: [],
      counts: { found: 0, readable: 0, unreadable: 0, sold: 0 },
      state: (opts && opts.state) || { failures: {}, gaveUp: [] },
      signals: null, href: ""
    };
  }
  return K.scanSold("poshmark", SEL, opts);
}
