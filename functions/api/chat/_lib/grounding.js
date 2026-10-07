/**
 * Grounding for /api/chat — what the stylist is ALLOWED to talk about, and
 * the proof that it did.
 *
 * GROUNDING IS ENFORCED IN TWO PLACES, NOT IN THE PROMPT:
 *   1. Deterministic scope gate, BEFORE any model call. A question that is
 *      none of: the user's own listings, this repo's fee table, Connect /
 *      Multilist / extension setup, try-on modes, listing-from-photo, the
 *      $14.99 plan, or published shop how-to facts — gets a structured
 *      refusal and the model is never invoked.
 *   2. Citation validation, AFTER the model call. Every source the model
 *      names is resolved against the sources this server actually supplied.
 *      An id the model invented is dropped; if nothing valid survives, the
 *      answer is a 502 — an ungrounded answer is never returned.
 *
 * The response always carries `sources` built from OUR objects (listings
 * from D1, fee rows from functions/api/_lib/fees.js, site facts from this
 * module + the marketplaces catalogue), never from the model's copy.
 */

import { MARKETPLACES } from "../../marketplaces.js";
import { findMarketplace, isVerified, modelNote, round2, takeHome } from "../../_lib/fees.js";
import { BREAKDOWN_IDS } from "../../listing/_lib/schema.js";

export const ALLOWED_TOPICS = [
  "your_listings",
  "marketplace_fees",
  "connect_shops",
  "chrome_extension",
  "try_on",
  "listing_from_photo",
  "pricing_plan",
  "how_to_list",
];

/* ------------------------------------------------------------- scope gate */

// Fee/take-home vocabulary. `keep`/`net` only count next to a price or a fee
// word, so "should I keep this jacket" is not mistaken for a fee question.
const FEE_RE =
  /\b(fees?|commission|payouts?|take[- ]home|what\s+(?:do|i)\s+(?:keep|net)|how\s+much\s+(?:do|i)\s+(?:keep|net)|net\s+(?:me|profit|out)|profit|charges?|percent(?:age)?|earnings)\b/i;
const MONEY_CONTEXT_RE = /\b(keep|net|sell|sale|price|profit|fee|fees|payout|earn|earnings)\b/i;

const LISTING_RE =
  /\b(?:my|our|this|the)\s+(?:listing|listings|closet|item|items|wardrobe|inventory|clothes|jacket|dress|shirt|blouse|jeans|pants|trousers|skirt|coat|sweater|hoodie|shoes|sneakers|boots|bag|purse)\b|\bcloset\b|\b(?:should|can)\s+i\s+(?:price|list|sell)\b|\bprice\s+(?:this|it|my|the)\b|\b(?:rewrite|write|draft|improve)\b|\b(?:titles?|descriptions?|hashtags?)\b/i;

const CONNECT_RE =
  /\b(?:connect(?:ing|ed)?|verify\s+session|i'?ve\s+connected|needs?\s+account|ready\s+to\s+guide|unverified)\b.{0,40}\b(?:shop|shops|account|marketplace|extension)?|\b(?:connect|connecting)\s+(?:my\s+)?(?:shops?|accounts?|marketplaces?)\b|\bhow\s+(?:do\s+i|to)\s+connect\b/i;

const EXTENSION_RE =
  /\b(?:chrome\s+extension|crosslister|load\s+unpacked|sell\s+everywhere|multilist|fashionistas\s+extension|extension\s+zip|fash_ext)\b|\b(?:install|set\s*up|setup)\s+(?:the\s+)?(?:chrome\s+)?extension\b|\bextension\s+(?:install|setup|connect)\b/i;

const TRYON_RE =
  /\b(?:try[- ]?ons?|try\s+it\s+on|photoreal|instant\s+(?:mode|overlay|try)|virtual\s+try[- ]?on|on[- ]device\s+overlay)\b|\b(?:instant|photoreal)\s+vs\b|\bvs\.?\s+(?:instant|photoreal)\b/i;

const LISTING_PHOTO_RE =
  /\b(?:list(?:ing)?\s+from\s+(?:a\s+)?photo|from\s+(?:a\s+)?photo|snap\s+(?:a\s+)?(?:photo|pic)|photo\s+to\s+(?:a\s+)?list(?:ing)?|identify\s+(?:this|my|an?\s+)?(?:item|garment|piece|photo)|one\s+photo|photograph\s+(?:my\s+)?(?:closet|item|garment))\b|\bhow\s+(?:do\s+i|to)\s+(?:list|sell)\s+(?:from\s+)?(?:a\s+)?photo\b/i;

const PRICING_PLAN_RE =
  /\b(?:14\.99|\$14(?:\.99)?|pro\s+plan|subscription|monthly\s+plan|what\s+(?:does|do)\s+(?:it|this|fashionistas(?:\.ai)?)\s+cost|how\s+much\s+(?:does|is)\s+(?:it|fashionistas|pro|the\s+plan)|pricing\s+page|cancel\s+anytime)\b/i;

const SHOP_NAMES_RE =
  /\b(poshmark|mercari|depop|vinted|grailed|ebay|etsy|facebook(?:\s+marketplace)?|kidizen|vestiaire(?:\s+collective)?|whatnot)\b/i;

const HOW_TO_LIST_RE =
  /\bhow\s+(?:do\s+i|to)\s+(?:list|sell|post|publish)\b|\b(?:list|sell|post|publish)\s+(?:on|to|in)\s+\w+\b|\b(?:listing|selling)\s+(?:on|to)\s+\w+\b|\b(?:depop|ebay|etsy|poshmark|mercari|vinted|grailed|facebook|kidizen|vestiaire|whatnot)\s+(?:how[- ]?to|guide|walkthrough|listing|tips?)\b|\bhow[- ]?to\s+(?:list|sell|use)\s+(?:on\s+)?(?:depop|ebay|etsy|poshmark|mercari|vinted|grailed|facebook|kidizen|vestiaire|whatnot)\b/i;

const STOPWORDS = new Set([
  "about", "after", "again", "against", "being", "below", "between", "brand", "color",
  "colour", "condition", "could", "doing", "down", "during", "each", "from", "have",
  "into", "item", "items", "listing", "listings", "price", "prices", "should", "size",
  "some", "that", "their", "them", "then", "these", "they", "this", "those", "using",
  "want", "what", "when", "where", "which", "with", "would", "your", "women", "mens",
]);

function tokens(text) {
  const found = String(text || "").toLowerCase().match(/[a-z0-9']{4,}/g) || [];
  return found.filter((t) => !STOPWORDS.has(t));
}

/**
 * Does the question touch one of the user's own items?
 * Two signals, either is enough: explicit closet wording, or a real token
 * overlap with a listing's title/brand/category (so "what about the Levi's
 * jacket" is in scope even without the word "my").
 */
export function mentionsListings(message, listings) {
  if (LISTING_RE.test(message)) return true;
  if (!Array.isArray(listings) || listings.length === 0) return false;
  const msgTokens = new Set(tokens(message));
  if (msgTokens.size === 0) return false;
  for (const l of listings) {
    const hay = [l.title, l.brand, l.category, l.name].filter(Boolean).join(" ");
    for (const t of tokens(hay)) if (msgTokens.has(t)) return true;
  }
  return false;
}

/** "at $48", "USD 30", "price it at 48" -> 48. Nothing -> null. */
export function extractPrice(message) {
  const msg = String(message || "");
  const patterns = [
    /(?:\$|usd\s*)\s*(\d+(?:\.\d{1,2})?)/i,
    /(\d+(?:\.\d{1,2})?)\s*(?:usd|dollars?)\b/i,
    /\bprice\s+(?:it\s+|this\s+|my\s+)?(?:at|to|around|near)?\s*\$?\s*(\d+(?:\.\d{1,2})?)\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(msg);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n <= 10000) return round2(n);
    }
  }
  return null;
}

/** Which catalogue shop id (if any) the message names. */
export function extractShopId(message) {
  const m = SHOP_NAMES_RE.exec(String(message || ""));
  if (!m) return null;
  const raw = m[1].toLowerCase();
  if (raw.startsWith("facebook")) return "facebook";
  if (raw.startsWith("vestiaire")) return "vestiaire";
  return raw;
}

/**
 * Decide scope before spending a model call.
 * @returns {{ok:true, topics:string[], price:number|null, shop:string|null} | {ok:false, reason:string}}
 */
export function classifyScope(message, listings) {
  const msg = String(message || "").trim();
  if (!msg) return { ok: false, reason: "empty_message" };
  if (msg.length > 2000) return { ok: false, reason: "message_too_long" };

  const price = extractPrice(msg);
  const shop = extractShopId(msg);
  const feeHit =
    FEE_RE.test(msg) || (price !== null && MONEY_CONTEXT_RE.test(msg));
  const listingHit = mentionsListings(msg, listings);
  const connectHit = CONNECT_RE.test(msg);
  const extensionHit = EXTENSION_RE.test(msg);
  const tryOnHit = TRYON_RE.test(msg);
  const photoHit = LISTING_PHOTO_RE.test(msg);
  const planHit = PRICING_PLAN_RE.test(msg);
  // Shop how-to: explicit how-to / list-on wording, or a shop name next to
  // guide vocabulary. Do NOT treat bare "sell" + shop as how-to — fee questions
  // say "sell at $48 on Poshmark" and must stay marketplace_fees-only.
  const howToHit =
    HOW_TO_LIST_RE.test(msg) ||
    (shop !== null &&
      /\b(?:how(?:[- ]?to)?|guide|walkthrough|steps?|setup|title|hashtags?|photos?|shipping)\b/i.test(msg));

  const topics = [];
  if (listingHit) topics.push("your_listings");
  if (feeHit) topics.push("marketplace_fees");
  if (connectHit) topics.push("connect_shops");
  if (extensionHit) topics.push("chrome_extension");
  if (tryOnHit) topics.push("try_on");
  if (photoHit) topics.push("listing_from_photo");
  if (planHit) topics.push("pricing_plan");
  if (howToHit) topics.push("how_to_list");
  if (topics.length === 0) return { ok: false, reason: "out_of_scope" };
  return { ok: true, topics, price, shop };
}

/* ------------------------------------------------------------- fee sources */

/**
 * The fee rows this question is allowed to quote. With a price we compute the
 * take-home through _lib/fees.js; without one we still hand over the published
 * fee model for each shop, with `price: null` so nothing is pre-computed from
 * a number we do not have.
 */
export function feeSources(price, ids = BREAKDOWN_IDS) {
  return ids.map((id) => {
    const m = findMarketplace(id);
    if (!m) throw new Error(`marketplace catalogue is missing "${id}"`);
    if (price === null || price === undefined) {
      return {
        type: "fee",
        id: m.id,
        name: m.name,
        price: null,
        verified: isVerified(m),
        note: modelNote(m),
        feeNote: m.feeNote || null,
        feePct: Number.isFinite(Number(m.feePct)) ? Number(m.feePct) : null,
        feeFixed: Number.isFinite(Number(m.feeFixed)) ? Number(m.feeFixed) : null,
      };
    }
    const t = takeHome(m, price);
    return {
      type: "fee",
      id: m.id,
      name: m.name,
      price: round2(price),
      verified: isVerified(m),
      lines: t.lines,
      fees: t.fees,
      net: t.net,
      takeRate: t.takeRate,
      note: modelNote(m),
    };
  });
}

/* ------------------------------------------------------------- site facts */

/**
 * Static product / setup facts copied from published pages and docs in this
 * repo. Never invent Stripe keys, never claim a listing "posted", never invent
 * a Chrome Web Store ID (FASH_EXT_IDS is empty until publish).
 *
 * Sources:
 *   /pricing/                          $14.99/mo Pro
 *   /try-on/                           Photoreal vs Instant
 *   index.html FAQ + Multilist copy    photo → Sell everywhere, 11 shops
 *   docs/MULTILIST-ONE-CLICK.md        Load unpacked + Verify session path
 *   docs/MULTILIST_CONNECT.md          Connect status model
 *   /guide/<shop>/                     shop how-to bullets (where shipped)
 *   functions/api/marketplaces.js      signup / createListing / feeNote
 */
const GUIDE_HOWTO = {
  depop: {
    docsUrl: "/guide/depop/",
    steps: [
      "Open Depop sell form (app Sell button or web); photos come first.",
      "Depop has no separate title field — the first 4–5 words of the description are the title in search/grid (brand, item, colour, size).",
      "Fill structured fields: category, brand, size, colour, condition — search matches those fields.",
      "Add relevant hashtags sparingly; list measurements and named flaws in the description.",
      "US fee model this app publishes: 0% seller commission + 3.3% + $0.45 processing (approximate).",
      "Signup/create links come from the marketplaces catalogue; fashionistas.ai Connect opens those guides — we never collect Depop passwords.",
    ],
  },
  ebay: {
    docsUrl: "/guide/ebay/",
    steps: [
      "Connect eBay via Multilist → Connect (optional BYO OAuth / Create on eBay API path needs real keys — never invent them).",
      "Extension path: stay logged into eBay in Chrome, Verify session, then Sell everywhere.",
      "Guide page: /guide/ebay/",
    ],
  },
  etsy: {
    docsUrl: "/guide/etsy/",
    steps: [
      "Connect Etsy via Multilist → Connect; server API create needs secrets — extension multilist does not.",
      "Guide page: /guide/etsy/",
    ],
  },
  poshmark: {
    docsUrl: "/guide/poshmark/",
    steps: [
      "Multilist → Connect → open Poshmark signup / create-listing, stay logged in, Verify session.",
      "Guide page: /guide/poshmark/",
    ],
  },
  mercari: {
    docsUrl: "/guide/mercari/",
    steps: [
      "Multilist → Connect → open Mercari signup / sell form, stay logged in, Verify session.",
      "Guide page: /guide/mercari/",
    ],
  },
  vinted: {
    docsUrl: "/guide/vinted/",
    steps: [
      "Multilist → Connect → open Vinted register / items/new, stay logged in, Verify session.",
      "Guide page: /guide/vinted/",
    ],
  },
  grailed: {
    docsUrl: "/guide/grailed/",
    steps: [
      "Multilist → Connect → open Grailed signup / sell, stay logged in, Verify session.",
      "Guide page: /guide/grailed/",
    ],
  },
  facebook: {
    docsUrl: "/guide/facebook/",
    steps: [
      "Multilist → Connect → Facebook Marketplace create item; stay logged in, Verify session.",
      "Guide page: /guide/facebook/",
    ],
  },
};

const PRODUCT_FACTS = [
  {
    id: "pricing_plan",
    topics: ["pricing_plan"],
    title: "fashionistas.ai Pro pricing",
    facts: [
      "Pro is $14.99 per month (USD), billed monthly, cancel anytime.",
      "No per-listing fee and no cut of marketplace sales — you keep what the shop pays you.",
      "Pro includes Sell everywhere, live per-shop status, fee take-home while pricing, and virtual try-on.",
      "Details: https://fashionistas.ai/pricing/",
    ],
  },
  {
    id: "listing_from_photo",
    topics: ["listing_from_photo"],
    title: "List from one photo",
    facts: [
      "Promise: photograph your closet / take one photo → AI item ID, price suggestion, fee take-home → Sell everywhere to connected shops.",
      "In the app: snap or upload a photo to draft a listing (title, description, tags, price) via POST /api/listing — then Multilist posts.",
      "Seller checklist also covers connect shops → photo set → price with fee calculator → Sell everywhere (/guide/).",
      "Do not claim a listing already posted — status chips (queued/posting/posted) only after a real extension or API job.",
    ],
  },
  {
    id: "connect_shops",
    topics: ["connect_shops", "chrome_extension"],
    title: "Connect shops (Multilist)",
    facts: [
      "Multilist → Connect opens a guidance panel per marketplace. We never invent API credentials, never take marketplace passwords, never fake auto account creation.",
      "Status model (local): Needs account → Ready to guide → Unverified (manual I've connected) → Connected (extension Verify session saw a live session).",
      "For each shop: open Connect → signup / create-listing URL → create account if needed → stay logged in in this Chrome profile → Verify session.",
      "Shops with extension adapters include Poshmark, Mercari, Depop, Vinted, Grailed, Facebook, Kidizen, Vestiaire, Whatnot, eBay, Etsy.",
      "Stored locally as fash_connect_v1. See docs/MULTILIST_CONNECT.md.",
    ],
  },
  {
    id: "chrome_extension",
    topics: ["chrome_extension", "connect_shops"],
    title: "Chrome Crosslister + Sell everywhere",
    facts: [
      "One-click path uses the Fashionistas Crosslister Chrome extension — posts in your browser session; no marketplace API keys and no Stripe required for multilist.",
      "Chrome Web Store ID is not published yet (FASH_EXT_IDS is empty on purpose). Supported today: download /chrome-store/fashionistas-extension-v1.0.1.zip → chrome://extensions → Developer mode → Load unpacked → folder with manifest.json.",
      "Keep browsing https://fashionistas.ai in that same Chrome profile; Re-check / auto-detect stores the extension id. Advanced: paste the 32-character ID from Chrome → Extensions → Details.",
      "Then: Multilist → tick shops → Sell everywhere. Live status: queued → posting → posted (View URL when captured) or failed / capped.",
      "Without the extension: eBay/Etsy server /api/list/* need Stripe + secrets (402/503 when empty); other shops get clipboard + open-form handoff.",
      "Never invent Stripe keys or claim a post succeeded without a real posted status. See docs/MULTILIST-ONE-CLICK.md.",
    ],
  },
  {
    id: "try_on",
    topics: ["try_on"],
    title: "Virtual try-on: Photoreal vs Instant",
    facts: [
      "Open /try-on/: add a photo of the person and a photo of the garment, then Try it on.",
      "Photoreal · Pro: full render (fabric/drape/light), posts to /api/tryon/hd; needs Pro or a try-on credit; takes about a minute or two.",
      "Instant · experimental overlay: on-device browser warp/composite for placement only — not photoreal; photos stay on the device; free.",
      "If Photoreal returns 402, Instant overlay remains available on-device.",
      "Download, save or share the render when it completes.",
    ],
  },
  {
    id: "shops_overview",
    topics: ["how_to_list", "connect_shops", "chrome_extension", "listing_from_photo"],
    title: "Eleven marketplaces overview",
    facts: [
      "Eleven shops: Poshmark, Mercari, Depop, Vinted, Grailed, eBay, Etsy, Facebook Marketplace, Kidizen, Vestiaire Collective, Whatnot.",
      "Connect each shop once, then Sell everywhere posts to the ones you tick and shows queued / posting / posted.",
      "Catalogue signup and create-listing URLs are published by GET /api/marketplaces — use those, do not invent URLs or keys.",
    ],
  },
];

function shopSiteFact(m) {
  const guide = GUIDE_HOWTO[m.id] || null;
  const facts = [
    `${m.name} catalogue id: ${m.id}.`,
    `Posting method in this app: ${m.method}${m.autoPost ? " (server autoPost capability exists — not proof a live post ran)" : " (extension / browser session)"}.`,
    m.feeNote ? `Published fee note: ${m.feeNote} (approximate US model, not a live quote).` : null,
    m.signup ? `Signup URL from catalogue: ${m.signup}` : null,
    m.createListing ? `Create-listing URL from catalogue: ${m.createListing}` : null,
    guide ? `Seller guide: ${guide.docsUrl}` : m.docsUrl ? `Seller guide: ${m.docsUrl}` : null,
    ...(guide ? guide.steps : []),
    "Connect via Multilist → Connect; Verify session with the Chrome extension for Connected status.",
  ].filter(Boolean);
  return {
    type: "site",
    id: `shop_${m.id}`,
    topic: "how_to_list",
    shop: m.id,
    name: m.name,
    title: `How to list / connect — ${m.name}`,
    facts,
    urls: [guide?.docsUrl || m.docsUrl, m.signup, m.createListing].filter(Boolean),
  };
}

/**
 * Site / guide / product rows the model may cite for the active topics.
 * Always returns OUR objects; never model-invented URLs or keys.
 */
export function siteSources(topics, message) {
  const set = new Set(Array.isArray(topics) ? topics : []);
  const shopId = extractShopId(message);
  const out = [];
  const seen = new Set();

  const push = (row) => {
    if (!row || seen.has(row.id)) return;
    seen.add(row.id);
    out.push(row);
  };

  for (const fact of PRODUCT_FACTS) {
    if (fact.topics.some((t) => set.has(t))) {
      push({
        type: "site",
        id: fact.id,
        topic: fact.topics[0],
        title: fact.title,
        facts: fact.facts.slice(),
      });
    }
  }

  if (set.has("how_to_list") || set.has("connect_shops")) {
    if (shopId) {
      const m = MARKETPLACES.find((x) => x.id === shopId);
      if (m) push(shopSiteFact(m));
    } else if (set.has("how_to_list")) {
      // No shop named: give the overview shops that have guide pages.
      for (const id of ["depop", "ebay", "etsy", "poshmark", "mercari"]) {
        const m = MARKETPLACES.find((x) => x.id === id);
        if (m) push(shopSiteFact(m));
      }
    }
  }

  return out;
}

/* ------------------------------------------------------------- refusal */

export function buildRefusal(reason) {
  return {
    ok: true,
    refused: true,
    reason,
    answer:
      "I can help with your closet listings, marketplace fee take-home, connecting shops, " +
      "the Chrome Crosslister / Sell everywhere setup, try-on (Photoreal vs Instant), " +
      "listing from a photo, the $14.99/mo plan, and how to list on supported shops — " +
      "nothing outside that (no crypto, medical, or general trivia). Ask about Depop setup, " +
      "try-on modes, fees, or Multilist Connect.",
    sources: [],
    allowedTopics: ALLOWED_TOPICS,
  };
}

/* ------------------------------------------------------------- model answer */

export const CHAT_SYSTEM_PROMPT = `You are the fashionistas.ai stylist. You answer ONE seller's questions using ONLY the context blocks supplied below (LISTINGS, FEES, SITE).

Hard rules:
  - Use ONLY LISTINGS, FEES, and SITE context. No outside knowledge, no general trivia, no invented URLs, API keys, Stripe keys, or "it posted" claims.
  - Reply with ONE JSON object and nothing else: {"answer": "...", "sources": [{"type": "listing", "id": 3}, {"type": "fee", "id": "poshmark"}, {"type": "site", "id": "try_on"}]}
  - "sources" must list at least one context id you actually used: listing ids are numbers, fee ids are strings like "poshmark", site ids are strings like "try_on" or "shop_depop".
  - Every number you state must appear verbatim in LISTINGS, FEES, or SITE. Never invent a listing, brand, price, fee rate, Chrome Web Store ID, or successful post.
  - Be conversational and practical. Prefer step lists for Connect / extension / how-to-list questions.
  - If the question is not answerable from the context, reply {"refused": true, "reason": "out_of_scope", "answer": "<one sentence on what you cover>", "sources": []}.`;

const SOURCE_TYPES = new Set(["listing", "fee", "site"]);

/**
 * Validate the model's answer against the sources WE supplied.
 * @returns {{ok:true, answer:string, sources:object[]} |
 *           {ok:true, refused:true, reason:string} |
 *           {ok:false, code:string, errors:string[]}}
 */
export function validateChatAnswer(raw, sources) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, code: "model_output_invalid", errors: ["answer must be a JSON object"] };
  }
  if (raw.refused === true) {
    return { ok: true, refused: true, reason: typeof raw.reason === "string" && raw.reason ? raw.reason : "model_refused" };
  }

  const errors = [];
  const answer = typeof raw.answer === "string" ? raw.answer.trim() : "";
  if (!answer) errors.push("answer must be a non-empty string");
  else if (answer.length > 4000) errors.push("answer must be at most 4000 characters");

  const byKey = new Map(sources.map((s) => [`${s.type}:${String(s.id)}`, s]));
  const refs = Array.isArray(raw.sources) ? raw.sources : Array.isArray(raw.sourceRefs) ? raw.sourceRefs : [];
  const resolved = [];
  for (const ref of refs) {
    if (!ref || typeof ref !== "object") continue;
    const type = SOURCE_TYPES.has(ref.type) ? ref.type : null;
    if (!type || ref.id === undefined || ref.id === null) continue;
    const hit = byKey.get(`${type}:${String(ref.id)}`);
    if (hit && !resolved.includes(hit)) resolved.push(hit);
  }
  if (resolved.length === 0) errors.push("sources must cite at least one supplied listing, fee, or site row");

  if (errors.length) {
    return {
      ok: false,
      code: errors.some((e) => e.startsWith("sources")) ? "ungrounded_answer" : "model_output_invalid",
      errors,
    };
  }
  return { ok: true, answer, sources: resolved };
}

/** What the model is fed: our rows, and nothing else. */
export function chatUserPrompt({ message, listings, fees, sites, history }) {
  const blocks = [];
  blocks.push(`LISTINGS (the user's own items, ids are numbers):\n${JSON.stringify(listings || [], null, 1)}`);
  blocks.push(`FEES (the fee rows this app publishes):\n${JSON.stringify(fees || [], null, 1)}`);
  blocks.push(`SITE (product / Connect / extension / try-on / shop how-to facts):\n${JSON.stringify(sites || [], null, 1)}`);
  if (Array.isArray(history) && history.length) {
    blocks.push(`RECENT MESSAGES:\n${JSON.stringify(history.slice(-6), null, 1)}`);
  }
  blocks.push(`QUESTION:\n${message}`);
  return blocks.join("\n\n");
}
