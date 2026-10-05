// config/api-flags.js — kill switches for the OFFICIAL marketplace APIs.
//
// WHY THESE EXIST AND WHY THEY ARE FALSE
// The product posts through the seller's own logged-in browser session (the
// extension / in-app WebView). That needs no API key at all and is the default
// path for every shop.
//
// eBay and Etsy additionally offer official APIs. When we enable them, they
// become "Connect eBay" / "Connect Etsy" OAuth buttons — the seller authorises
// their own account once, and no key is ever shown to or typed by a user. The
// credentials are OURS, held server-side as environment variables, never in the
// extension bundle.
//
// They are off because:
//   - they are not needed to post (browser session already does it),
//   - they require app registrations we have deliberately not created,
//   - turning one on must never silently change what a seller experiences.
//
// Flip one to true only when the server-side OAuth flow is implemented AND the
// corresponding env vars are set. Nothing here reads a key from the client.

export const EBAY_API_ENABLED = false;
export const ETSY_API_ENABLED = false;

/** Server-side env vars the API path needs. Absence => API stays unavailable. */
export const API_ENV_REQUIRED = {
  ebay: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_REFRESH_TOKEN"],
  etsy: ["ETSY_API_KEY", "ETSY_TOKEN"]
};

export function apiEnabled(shop) {
  if (shop === "ebay") return EBAY_API_ENABLED === true;
  if (shop === "etsy") return ETSY_API_ENABLED === true;
  return false;
}
