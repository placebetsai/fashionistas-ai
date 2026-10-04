/**
 * GET /api/marketplaces — the public, read-only catalogue of shops.
 *
 * No auth, no D1, no env, no outbound call: a logged-out visitor can see which
 * marketplaces exist, and the handler reads nothing that could leak a secret.
 * Everything is a static literal whose source is named below.
 *
 * WHAT `autoPost` MEANS — capability, not achievement.
 *   `autoPost: true` means THIS REPO CONTAINS SERVER-SIDE CODE that can create
 *   a listing without the user copying and pasting (the eBay Sell Inventory
 *   and Etsy Open API paths behind /api/list/*). `autoPost: false` means
 *   posting goes through the user's own signed-in browser session via the
 *   extension, because those nine shops expose no seller API we can call.
 *   It does NOT mean a listing has been published anywhere: NO REAL
 *   MARKETPLACE POST HAS EVER BEEN EXECUTED — the extension has never been
 *   loaded in a real browser profile, the eBay path only ever talks to eBay's
 *   SANDBOX host, and the Etsy path creates a draft. Read every
 *   `autoPost: true` as "the code exists", never as "it shipped a listing".
 *
 * SOURCES (all in-repo; nothing here is guessed):
 *   id, name, signup, createListing  apps/extension/config/selectors.js
 *                                    (SHOPS for the nine adapter-backed
 *                                    shops, SESSION_ONLY_SHOPS for eBay +
 *                                    Etsy). createListing for eBay/Etsy is the
 *                                    "list it" link their own guide page uses.
 *   docsUrl                          only directories that really exist under
 *                                    guide/ — poshmark, ebay, mercari, etsy.
 *                                    Absent means there is no page; we do not
 *                                    link a URL we have not shipped.
 *   feePct, feeFixed, feeNote        the approximate US-seller fee model this
 *                                    repo publishes. /api/fees/estimate and
 *                                    /api/fees/compare (functions/api/fees/)
 *                                    serve the same numbers, so the
 *                                    catalogue and the calculator cannot
 *                                    drift apart. Approximate — never a live
 *                                    quote from any platform.
 *
 * Response:
 *   { ok: true, count, schema, generatedAt, caveat, marketplaces: [...] }
 *   schema 1 — bump only on a breaking shape change.
 *
 * Method: GET/HEAD return the catalogue; OPTIONS -> 204 with an Allow header
 * and everything else -> 405, matching the convention in functions/api/color.js.
 */

import { json } from "./_lib/auth.js";

const SCHEMA = 1;

const CAVEAT =
  "autoPost reports capability this repo's code provides, not verified results: " +
  "no real marketplace post has ever been executed (the extension has never been " +
  "loaded in a real browser profile; eBay calls only its sandbox API; Etsy creates " +
  "a draft). feePct/feeFixed/feeNote are the approximate model served by " +
  "/api/fees/estimate and /api/fees/compare, not live quotes from any platform.";

/**
 * The catalogue. `method: "extension"` = posting runs in the user's own
 * browser session through the extension adapter; `method: "api"` = posting is
 * driven server-side by /api/list/*. `requiresApiKey` = that server path needs
 * credentials configured on this Pages project; the extension shops need none.
 * `docsUrl` is a site-relative path and is present only where guide/ has a
 * real index.html.
 *
 * `MARKETPLACES` is exported (not just used in place) so that
 * functions/api/_lib/fees.js can compute /api/fees/* from this exact array.
 * One table, two consumers: the catalogue and the fee calculator cannot drift.
 */
export const MARKETPLACES = [
  {
    id: "poshmark",
    name: "Poshmark",
    method: "extension",
    autoPost: false,
    requiresApiKey: false,
    docsUrl: "/guide/poshmark/",
    feePct: 20,
    feeFixed: null,
    feeNote: "20% at $15+; $2.95 flat under $15",
    signup: "https://www.poshmark.com/signup",
    createListing: "https://www.poshmark.com/create_listing",
  },
  {
    id: "mercari",
    name: "Mercari",
    method: "extension",
    autoPost: false,
    requiresApiKey: false,
    docsUrl: "/guide/mercari/",
    feePct: 10,
    feeFixed: null,
    feeNote: "10% selling fee",
    signup: "https://www.mercari.com/signup/",
    createListing: "https://www.mercari.com/sell/",
  },
  {
    id: "depop",
    name: "Depop",
    method: "extension",
    autoPost: false,
    requiresApiKey: false,
    feePct: 3.3,
    feeFixed: 0.45,
    feeNote: "0% commission (removed 2024) + 3.3% + $0.45 processing",
    signup: "https://www.depop.com/onboarding/interests/",
    createListing: "https://www.depop.com/products/add/",
  },
  {
    id: "vinted",
    name: "Vinted",
    method: "extension",
    autoPost: false,
    requiresApiKey: false,
    feePct: 0,
    feeFixed: null,
    feeNote: "0% seller fee in most countries",
    signup: "https://www.vinted.com/signup",
    createListing: "https://www.vinted.com/items/new",
  },
  {
    id: "grailed",
    name: "Grailed",
    method: "extension",
    autoPost: false,
    requiresApiKey: false,
    feePct: 9,
    feeFixed: 0.49,
    feeNote: "9% commission (6% under $120) + 3.49% + $0.49 processing",
    signup: "https://www.grailed.com/signup",
    createListing: "https://www.grailed.com/sell",
  },
  {
    id: "facebook",
    name: "Facebook Marketplace",
    method: "extension",
    autoPost: false,
    requiresApiKey: false,
    feePct: 10,
    feeFixed: null,
    feeNote: "10% on shipped orders; 0% local pickup",
    signup: "https://www.facebook.com/r/php",
    createListing: "https://www.facebook.com/marketplace/create/item",
  },
  {
    id: "kidizen",
    name: "Kidizen",
    method: "extension",
    autoPost: false,
    requiresApiKey: false,
    feePct: 12,
    feeFixed: 0.5,
    feeNote: "12% + $0.50 per transaction",
    signup: "https://www.kidizen.com/users/sign_up",
    createListing: "https://www.kidizen.com/sell/",
  },
  {
    id: "vestiaire",
    name: "Vestiaire Collective",
    method: "extension",
    autoPost: false,
    requiresApiKey: false,
    feePct: 15,
    feeFixed: null,
    feeNote: "12% selling fee + 3% payment processing (US)",
    signup: "https://www.vestiairecollective.com/signup/",
    createListing: "https://www.vestiairecollective.com/publish/",
  },
  {
    id: "whatnot",
    name: "Whatnot",
    method: "extension",
    autoPost: false,
    requiresApiKey: false,
    feePct: 10.9,
    feeFixed: 0.3,
    feeNote: "8% commission + 2.9% + $0.30 processing",
    signup: "https://www.whatnot.com/signup",
    createListing: "https://www.whatnot.com/sell",
  },
  {
    id: "ebay",
    name: "eBay",
    method: "api",
    autoPost: true,
    requiresApiKey: true,
    docsUrl: "/guide/ebay/",
    feePct: 13.6,
    feeFixed: 0.4,
    feeNote: "13.6% final value fee + $0.40 per order",
    signup: "https://signup.ebay.com/ws/eBayISAPI.dll?CreateV3",
    createListing: "https://www.ebay.com/sell",
  },
  {
    id: "etsy",
    name: "Etsy",
    method: "api",
    autoPost: true,
    requiresApiKey: true,
    docsUrl: "/guide/etsy/",
    feePct: 9.5,
    feeFixed: 0.25,
    feeNote: "6.5% transaction + ~3% processing + $0.25 per order",
    signup: "https://www.etsy.com/join",
    createListing: "https://www.etsy.com/sell",
  },
];

export async function onRequestGet() {
  // Fresh objects per request so a caller can never mutate our source table.
  const marketplaces = MARKETPLACES.map((m) => ({ ...m }));

  return json({
    ok: true,
    count: marketplaces.length,
    schema: SCHEMA,
    generatedAt: new Date().toISOString(),
    caveat: CAVEAT,
    marketplaces,
  });
}

export async function onRequest(context) {
  const method = (context.request.method || "GET").toUpperCase();
  const allow = "GET, HEAD, OPTIONS";

  // HEAD is a GET without a body — same answer, no payload.
  if (method === "HEAD") return onRequestGet(context);

  // OPTIONS -> 204 with Allow, matching the convention in functions/api/color.js
  // and the rest of this codebase. No CORS headers are emitted: there is no
  // cross-origin consumer (nothing in this repo sends Access-Control-*).
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { allow, "cache-control": "no-store" } });
  }

  if (method !== "GET") {
    return json(
      { ok: false, error: "method_not_allowed", detail: "Use GET." },
      405,
      { allow }
    );
  }
  return onRequestGet(context);
}
