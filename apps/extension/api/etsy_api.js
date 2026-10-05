// api/etsy_api.js — official Etsy Open API v3 path. DISABLED BY DEFAULT.
//
// This is NOT how we post. Posting goes through the seller's own logged-in
// browser session (adapters/etsy.js), which needs no credentials at all.
//
// This module exists so the API path is real code behind a flag rather than
// something someone invents later. It is unreachable while ETSY_API_ENABLED is
// false, and even then it runs SERVER-SIDE only: credentials are env vars, never
// shipped in the extension bundle, never shown to a user.
//
// Intended later use: a "Connect Etsy" OAuth button. Seller authorises their own
// account; we hold a token server-side. Users see no key.

import { ETSY_API_ENABLED, API_ENV_REQUIRED } from "../config/api-flags.js";

const CREATE_LISTING_URL = "https://openapi.etsy.com/v3/application/listings";

function requireEnv(env) {
  return (API_ENV_REQUIRED.etsy || []).filter((k) => !env || !env[k]);
}

export function isAvailable(env) {
  if (ETSY_API_ENABLED !== true) return { ok: false, reason: "flag_disabled" };
  const missing = requireEnv(env);
  if (missing.length) return { ok: false, reason: "missing_env", missing };
  return { ok: true };
}

/**
 * Posts a listing through Etsy's official API.
 * Throws with code "api_disabled" while the flag is false — deliberately
 * un-runnable so nobody can quietly depend on it.
 */
export async function postListing(env, listing) {
  const avail = isAvailable(env);
  if (!avail.ok) {
    const err = new Error(`Etsy API unavailable: ${avail.reason}${avail.missing ? " " + avail.missing.join(",") : ""}`);
    err.code = avail.reason === "flag_disabled" ? "api_disabled" : "api_not_configured";
    throw err;
  }
  // Real implementation: POST CREATE_LISTING_URL with x-api-key header plus the
  // seller's OAuth token, then upload images via /listings/{id}/images.
  // Not written because the flag is false and no credentials exist — writing it
  // blind would be unverifiable code.
  throw Object.assign(new Error("Etsy API path not implemented"), { code: "not_implemented" });
}

export default { isAvailable, postListing };
