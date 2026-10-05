// sales/adapters/index.js — the per-marketplace sale-detection adapters.
//
// Same shape as ADAPTERS in queue.js: `SALES_ADAPTERS[shop].scanSold(SEL, opts)`.
// Each member is a thin, import-free wrapper over globalThis.__fashSales so it
// can be handed straight to chrome.scripting.executeScript({ func }) — exactly
// how queue.js runs the form adapters (runInTab).
//
// Only the six marketplaces of this phase are listed. A shop that is not here
// is reported as {status:"skipped", reason:"unsupported_shop"} by the driver,
// never as an error.

import * as poshmark from "./poshmark.js";
import * as mercari from "./mercari.js";
import * as depop from "./depop.js";
import * as grailed from "./grailed.js";
import * as ebay from "./ebay.js";
import * as etsy from "./etsy.js";

export const SALES_ADAPTERS = {
  poshmark,
  mercari,
  depop,
  grailed,
  ebay,
  etsy
};

export { poshmark, mercari, depop, grailed, ebay, etsy };
