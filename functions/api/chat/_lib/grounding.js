/**
 * Grounding for /api/chat — what the stylist is ALLOWED to talk about, and
 * the proof that it did.
 *
 * GROUNDING IS ENFORCED IN TWO PLACES, NOT IN THE PROMPT:
 *   1. Deterministic scope gate, BEFORE any model call. A question that is
 *      about neither the user's own listings nor this repo's fee table gets a
 *      structured refusal and the model is never invoked — so "what's the
 *      capital of France" cannot be answered from a 1B-param model's general
 *      knowledge, because it is never asked.
 *   2. Citation validation, AFTER the model call. Every source the model names
 *      is resolved against the sources this server actually supplied. An id
 *      the model invented is dropped; if nothing valid survives, the answer is
 *      a 502 — an ungrounded answer is never returned.
 *
 * The response always carries `sources` built from OUR objects (listings from
 * D1, fee rows from functions/api/_lib/fees.js), never from the model's copy,
 * so a citation in the response is by construction a real row.
 */

import { findMarketplace, isVerified, modelNote, round2, takeHome } from "../../_lib/fees.js";
import { BREAKDOWN_IDS } from "../../listing/_lib/schema.js";

export const ALLOWED_TOPICS = ["your_listings", "marketplace_fees"];

/* ------------------------------------------------------------- scope gate */

// Fee/take-home vocabulary. `keep`/`net` only count next to a price or a fee
// word, so "should I keep this jacket" is not mistaken for a fee question.
const FEE_RE =
  /\b(fees?|commission|payouts?|take[- ]home|what\s+(?:do|i)\s+(?:keep|net)|how\s+much\s+(?:do|i)\s+(?:keep|net)|net\s+(?:me|profit|out)|profit|charges?|percent(?:age)?|earnings)\b/i;
const MONEY_CONTEXT_RE = /\b(keep|net|sell|sale|price|profit|fee|fees|payout|earn|earnings)\b/i;

const LISTING_RE =
  /\b(?:my|our|this|the)\s+(?:listing|listings|closet|item|items|wardrobe|inventory|clothes|jacket|dress|shirt|blouse|jeans|pants|trousers|skirt|coat|sweater|hoodie|shoes|sneakers|boots|bag|purse)\b|\bcloset\b|\b(?:should|can)\s+i\s+(?:price|list|sell)\b|\bprice\s+(?:this|it|my|the)\b|\b(?:rewrite|write|draft|improve)\b|\b(?:titles?|descriptions?|hashtags?)\b/i;

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

/**
 * Decide scope before spending a model call.
 * @returns {{ok:true, topics:string[], price:number|null} | {ok:false, reason:string}}
 */
export function classifyScope(message, listings) {
  const msg = String(message || "").trim();
  if (!msg) return { ok: false, reason: "empty_message" };
  if (msg.length > 2000) return { ok: false, reason: "message_too_long" };

  const price = extractPrice(msg);
  const feeHit =
    FEE_RE.test(msg) || (price !== null && MONEY_CONTEXT_RE.test(msg));
  const listingHit = mentionsListings(msg, listings);

  const topics = [];
  if (listingHit) topics.push("your_listings");
  if (feeHit) topics.push("marketplace_fees");
  if (topics.length === 0) return { ok: false, reason: "out_of_scope" };
  return { ok: true, topics, price };
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

/* ------------------------------------------------------------- refusal */

export function buildRefusal(reason) {
  return {
    ok: true,
    refused: true,
    reason,
    answer:
      "I can only answer questions about your own listings (your closet) and the " +
      "marketplace fee table this app publishes — nothing else. Ask me what an item " +
      "of yours should be priced at, how a listing reads, or what you'd keep on " +
      "Poshmark, Mercari, Depop, Grailed, eBay or Etsy.",
    sources: [],
    allowedTopics: ALLOWED_TOPICS,
  };
}

/* ------------------------------------------------------------- model answer */

export const CHAT_SYSTEM_PROMPT = `You are the fashionistas.ai stylist. You answer ONE seller's questions about their OWN closet and about the marketplace fee table supplied in the context.

Hard rules:
  - Use ONLY the LISTINGS and FEES context blocks. No outside knowledge, no general fashion trivia, no web facts.
  - Reply with ONE JSON object and nothing else: {"answer": "...", "sources": [{"type": "listing", "id": 3}, {"type": "fee", "id": "poshmark"}]}
  - "sources" must list at least one context id you actually used: listing ids are numbers, fee ids are strings like "poshmark".
  - Every number you state must appear verbatim in LISTINGS or FEES. Never invent a listing, a brand, a price or a fee rate.
  - If the question is not answerable from the context, reply {"refused": true, "reason": "out_of_scope", "answer": "<one sentence saying you only cover this seller's listings and the fee table>", "sources": []}.`;

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
    const type = ref.type === "listing" || ref.type === "fee" ? ref.type : null;
    if (!type || ref.id === undefined || ref.id === null) continue;
    const hit = byKey.get(`${type}:${String(ref.id)}`);
    if (hit && !resolved.includes(hit)) resolved.push(hit);
  }
  if (resolved.length === 0) errors.push("sources must cite at least one supplied listing or fee row");

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
export function chatUserPrompt({ message, listings, fees, history }) {
  const blocks = [];
  blocks.push(`LISTINGS (the user's own items, ids are numbers):\n${JSON.stringify(listings, null, 1)}`);
  blocks.push(`FEES (the fee rows this app publishes):\n${JSON.stringify(fees, null, 1)}`);
  if (Array.isArray(history) && history.length) {
    blocks.push(`RECENT MESSAGES:\n${JSON.stringify(history.slice(-6), null, 1)}`);
  }
  blocks.push(`QUESTION:\n${message}`);
  return blocks.join("\n\n");
}
