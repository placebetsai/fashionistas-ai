// api/ebay_api.js — official eBay Sell API path. DISABLED BY DEFAULT.
//
// This is NOT how we post. Posting goes through the seller's own logged-in
// browser session (adapters/ebay.js), which needs no credentials at all.
//
// This module exists so the API path is real code behind a flag rather than
// something someone invents later. It is unreachable while EBAY_API_ENABLED is
// false, and even then it runs SERVER-SIDE only: credentials are env vars, never
// shipped in the extension bundle, never shown to a user.
//
// Intended later use: a "Connect eBay" OAuth button. Seller authorises their own
// account; we hold a refresh token server-side. Users see no key.

import { EBAY_API_ENABLED, API_ENV_REQUIRED } from "../config/api-flags.js";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SELL_ITEM_URL = "https://api.ebay.com/sell/inventory/v1/inventory_item";

function requireEnv(env) {
  const missing = (API_ENV_REQUIRED.ebay || []).filter((k) => !env || !env[k]);
  return missing;
}

export function isAvailable(env) {
  if (EBAY_API_ENABLED !== true) return { ok: false, reason: "flag_disabled" };
  const missing = requireEnv(env);
  if (missing.length) return { ok: false, reason: "missing_env", missing };
  return { ok: true };
}

/**
 * Posts a listing through eBay's official API.
 * Throws with code "api_disabled" while the flag is false — deliberately
 * un-runnable so nobody can quietly depend on it.
 */
export async function postListing(env, listing) {
  const avail = isAvailable(env);
  if (!avail.ok) {
    const err = new Error(`eBay API unavailable: ${avail.reason}${avail.missing ? " " + avail.missing.join(",") : ""}`);
    err.code = avail.reason === "flag_disabled" ? "api_disabled" : "api_not_configured";
    throw err;
  }
  // Real implementation: POST token_url (client_credentials / user refresh
  // token) then PUT SELL_ITEM_URL/{sku}. Not written because the flag is false
  // and no credentials exist — writing it blind would be unverifiable code.
  throw Object.assign(new Error("eBay API path not implemented"), { code: "not_implemented" });
}

export default { isAvailable, postListing };
