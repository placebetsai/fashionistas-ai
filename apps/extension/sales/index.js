// sales/index.js — the one import the rest of the system needs.
//
//   import { buildPrompt } from "./sales/index.js";          (index.html UI)
//   const sales = await import(chrome.runtime.getURL("sales/index.js"));
//                                                             (background.js)
//
// index.html is owned by another workstream: it renders prompt.title +
// prompt.options and calls prompt.confirm() on the seller's tap. background.js
// drives scanAllShops() in the seller's own logged-in tabs. Nothing here runs
// on a server; nothing here stores a password.

export { SALES_SHOPS, SOLD_SELECTORS, soldSelFor, withSoldSel } from "./sold-selectors.js";
export {
  scanAndRecord,
  runShopScan,
  scanAllShops,
  loadState,
  saveState,
  chromeStorage,
  resolveDetectLogin,
  STATE_KEY,
  SALES_PATH,
} from "./driver.js";
export { saleKey, makeSaleEvent, acceptNew, pushEvent, emptyState } from "./registry.js";
export { STRIKE_LIMIT, isParked, noteFailure, noteSuccess, reportLine } from "./failures.js";
export { buildPrompt, labelOf } from "./prompt.js";
export {
  OUTCOMES,
  DELISTABLE_SHOPS,
  runDelist,
  createDelistLog,
  createDelistEnqueuer,
} from "./delist.js";
export { SALES_ADAPTERS } from "./adapters/index.js";
