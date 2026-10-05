// sales/sold-selectors.js — THE selector source for sale detection (Phase 2).
//
// Discipline is the same one config/selectors.js enforces on adapters/*.js:
// this file is DATA ONLY. sales/saleskit.js — the code that actually walks the
// DOM — contains ZERO selectors; everything it touches arrives on the SEL
// argument, and `soldSelFor()` / `withSoldSel()` are what put this block on it:
//
//     import { withSoldSel } from "./sales/sold-selectors.js";
//     const SEL = withSoldSel(selectorsFor(shop), shop);   // SEL.sold = below
//
// WHY THIS IS NOT INSIDE config/selectors.js
//   config/* is owned by another workstream and is READ-ONLY for this build.
//   Every entry below is shaped to drop straight in as `SHOPS.<shop>.sold =
//   SOLD_SELECTORS.<shop>` later: the keys are the same style of candidate
//   LIST, nothing else in the system has to change, and `soldSelFor()` already
//   prefers `SEL.sold` when the config carries it. After such a merge, run
//     node apps/extension/scripts/build-selectors-bundle.mjs
//   and the existing selector-source test keeps bundle and source honest.
//
// PROVENANCE — READ THIS BEFORE BELIEVING A SELECTOR
//   NOT PROVEN against a live marketplace page. Every list below is a
//   candidate list written from the marketplaces' public markup conventions,
//   marked NOT PROVEN exactly like the eBay/Etsy create-form selectors in
//   config/selectors.js. They are exercised offline by
//   apps/extension/__tests__/sales.test.mjs against DOM fixtures; a real
//   logged-in closet has never been scanned by this code (no marketplace
//   session exists in CI, and scraping runs only in the seller's own browser).
//   When one is confirmed or corrected against a real page, edit it HERE —
//   never in saleskit.js.

/** The six marketplaces this phase detects sales on. */
export const SALES_SHOPS = ["poshmark", "mercari", "depop", "grailed", "ebay", "etsy"];

/**
 * `sold` block per shop.
 *
 *   listUrl  page that lists the seller's OWN listings (opened in the user's
 *            own logged-in tab — never fetched by our servers)
 *   login    candidates that prove the page is asking for a credential
 *   item     one node per listing card
 *   link     the anchor inside a card that carries the listing URL
 *   title    where the listing title lives
 *   price    where the price lives
 *   status   a node whose TEXT states the listing state (sold vs live). If its
 *            text matches neither known word, the DOM changed => strike.
 *   sold     a node that POSITIVELY marks a sold item (badge/class/testid)
 *   active   a node that positively marks a still-live item
 *   date     a <time datetime> or equivalent carrying the sale date
 */
export const SOLD_SELECTORS = {
  poshmark: {
    label: "Poshmark",
    listUrl: "https://www.poshmark.com/mycloset",
    currency: "USD",
    login: ["input[type='password']", "form[action*='login' i]", "[data-testid='login-form']"],
    item: ["[data-testid='product-card']", "div.tile", ".pfeed-tile", "li.card"],
    link: ["a[href*='/listing/']"],
    title: ["[data-testid='product-title']", ".tile__title", ".pfeed__title", "img[alt]"],
    price: ["[data-testid='product-price']", ".tile__price", ".pfeed__price"],
    status: ["[data-testid='status']", ".listing-status", ".status-badge"],
    sold: ["[class*='sold']", "[data-testid*='sold']"],
    active: ["[data-testid='active']", "[class*='in-stock']"],
    date: ["time[datetime]", "[data-testid='sold-date']"]
  },

  mercari: {
    label: "Mercari",
    listUrl: "https://www.mercari.com/mypage/",
    currency: "USD",
    login: ["input[type='password']", "form[action*='login' i]", "[data-testid='login-form']"],
    item: ["[data-testid='item-cell']", "[data-testid='grid-item']", ".item-cell"],
    link: ["a[href*='/item/']"],
    title: ["[data-testid='item-name']", "img[alt]", ".item-name"],
    price: ["[data-testid='price']", "[data-testid='item-price']", ".price"],
    status: ["[data-testid='status']", ".status-label", ".listing-status"],
    sold: ["[data-testid='sold-badge']", "[class*='sold']"],
    active: ["[data-testid='available-badge']", "[class*='available']"],
    date: ["time[datetime]", "[data-testid='sold-date']"]
  },

  depop: {
    label: "Depop",
    // NOT PROVEN: Depop's own-listings page is /profile/<username>/products/.
    // The username is not known before the tab is open, so the profile root is
    // used as the entry point; if it 404s the scan reports skipped/no_listings
    // instead of guessing a username. Needs one real logged-in probe.
    listUrl: "https://www.depop.com/profile/",
    currency: "USD",
    login: ["input[type='password']", "form[action*='login' i]"],
    item: ["[data-cy='productTile']", "[data-testid='product-tile']", "li[class*='product']"],
    link: ["a[href*='/products/']"],
    title: ["[data-cy='product-title']", "img[alt]", "[data-testid='product-title']"],
    price: ["[data-cy='product-price']", "[data-testid='price']", ".price"],
    status: ["[data-cy='product-status']", ".listing-status", ".status"],
    sold: ["[class*='sold']", "[data-cy*='sold']"],
    active: ["[data-cy*='available']", "[class*='available']"],
    date: ["time[datetime]"]
  },

  grailed: {
    label: "Grailed",
    listUrl: "https://www.grailed.com/mygrailed",
    currency: "USD",
    login: ["input[type='password']", "form[action*='login' i]"],
    item: ["[data-testid='listing-card']", ".listing-card", "article[data-listing-id]"],
    link: ["a[href*='/listings/']"],
    title: ["[data-testid='listing-title']", ".listing-title", "img[alt]"],
    price: ["[data-testid='listing-price']", ".listing-price", ".price"],
    status: ["[data-testid='listing-status']", ".listing-status"],
    sold: ["[class*='sold']", "[data-testid*='sold']"],
    active: ["[data-testid='listing-active']", "[class*='active']"],
    date: ["time[datetime]"]
  },

  ebay: {
    label: "eBay",
    listUrl: "https://www.ebay.com/myebay/selling",
    currency: "USD",
    login: ["input[type='password']", "form[action*='Signin' i]", "[data-testid='signin-form']"],
    item: ["[data-testid='s-item']", ".s-item", "li[data-testid='item']"],
    link: ["a[href*='/itm/']"],
    title: ["[data-testid='s-item__title']", ".s-item__title", "img[alt]"],
    price: ["[data-testid='s-item__price']", ".s-item__price"],
    status: ["[data-testid='s-item__status']", ".s-item__status"],
    sold: ["[class*='s-item--sold']", "[data-testid*='sold']"],
    active: ["[data-testid='s-item--active']"],
    date: ["time[datetime]"]
  },

  etsy: {
    label: "Etsy",
    listUrl: "https://www.etsy.com/your/shops/me/tools/listings",
    currency: "USD",
    login: ["input[type='password']", "form[action*='signin' i]"],
    item: ["[data-testid='listing-card']", "tr[data-listing-id]", ".js-manage-listing"],
    link: ["a[href*='/listing/']"],
    title: ["[data-testid='listing-title']", "img[alt]", ".listing-title"],
    price: ["[data-testid='listing-price']", ".listing-price", ".price"],
    status: ["[data-testid='listing-state']", "[data-testid='listing-status']", ".listing-state"],
    // Etsy's honest sold signal is "Sold out" (a live listing with 1 sale is
    // NOT sold — it can still sell again), which is why sold includes it.
    sold: ["[class*='sold-out']", "[data-testid*='sold']"],
    active: ["[data-testid='active-state']", "[class*='active']"],
    date: ["time[datetime]"]
  }
};

/** The `sold` block for a shop, or null when this shop has no scan config. */
export function soldSelFor(shop) {
  return SOLD_SELECTORS[shop] || null;
}

/**
 * Put the `sold` block onto a normal SEL object (from config/selectors.js
 * selectorsFor()). `SEL.sold` already present (i.e. someone merged this into
 * config) wins — config stays the source of truth once that happens.
 */
export function withSoldSel(SEL, shop) {
  const base = SEL && typeof SEL === "object" ? SEL : {};
  return {
    ...base,
    shop: base.shop || shop,
    label: base.label || (SOLD_SELECTORS[shop] && SOLD_SELECTORS[shop].label) || shop,
    listingPattern: base.listingPattern || null,
    captcha: Array.isArray(base.captcha) ? base.captcha : [],
    sold: base.sold || SOLD_SELECTORS[shop] || null
  };
}

export default { SALES_SHOPS, SOLD_SELECTORS, soldSelFor, withSoldSel };
