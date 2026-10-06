/**
 * Seller-written listing fallback — used when no model is configured.
 *
 * Why this exists: `POST /api/listing` returned 503 `model_not_configured`
 * whenever MODEL_PROVIDER was unset, so on a $0 deployment a seller could not
 * save a listing AT ALL — not even one they typed themselves. Every field the
 * listing schema needs is derivable from the seller's own input, and the
 * six-shop fee breakdown is local math (`buildBreakdown`), so the model is an
 * enhancer, never a gate.
 *
 * It never invents a price. If the seller did not give one we refuse with a
 * precise error instead of guessing what their item is worth.
 *
 * Verified against the live schema before this was written:
 *   - required: title 1-80, description 10-4000, category 1-60, condition
 *     enum, price 1-10000, tags 1-15 items of 1-40 chars
 *   - brand / colour / size blank -> "Unbranded" / "Unspecified" / "Unspecified"
 *   - hashtags are derived from tags by validateListing when omitted
 */

import { parsePrice, round2 } from "../../_lib/fees.js";

const MAX_TITLE = 80;

/** Words too generic to make a useful tag. */
const STOP_WORDS = new Set([
  "the", "and", "for", "you", "your", "with", "this", "that", "from", "are",
  "was", "were", "has", "have", "had", "but", "not", "all", "any", "can",
  "will", "would", "could", "should", "about", "into", "over", "under",
  "than", "then", "them", "they", "their", "there", "here", "when", "what",
  "which", "who", "why", "how", "out", "get", "got", "its", "it's", "let",
  "our", "own", "per", "one", "two", "new", "also", "very", "just", "only",
  "size", "item", "used", "worn", "wear", "sell", "selling", "sale", "ship",
  "shipping", "free", "fast", "please", "dm", "open", "offer", "offers",
  "price", "pics", "photo", "photos", "condition", "brand", "colour",
  "color", "made", "make", "model", "type", "good", "great", "nice", "like",
  "still", "available", "condition", "excellent",
]);

/**
 * Ordered most-specific-first: "dress shoes" must land on Shoes, "leather
 * jacket" on Outerwear, "jean shorts" on Bottoms.
 */
const CATEGORY_RULES = [
  [/\b(sneakers?|trainers?|boots?|shoes?|heels?|loafers?|sandals?|flip[- ]flops?|espadrilles?|mules?)\b/, "Shoes"],
  [/\b(bags?|purses?|handbags?|backpacks?|totes?|clutches?|wallets?)\b/, "Bags"],
  [/\b(jackets?|coats?|parkas?|puffers?|blazers?|hoodies?|sweatshirts?|sweaters?|cardigans?|gilets?)\b/, "Outerwear"],
  [/\b(suits?|tuxedos?|tailoring)\b/, "Suits"],
  [/\b(dress(?:es)?|gowns?|jumpsuits?|rompers?|playsuits?)\b/, "Dresses"],
  [/\b(jeans?|trousers?|pants?|shorts?|culottes?|leggings?|chinos?|skirts?)\b/, "Bottoms"],
  [/\b(shirts?|t-?shirts?|tees?|blouses?|tops?|tank[- ]?tops?|camisoles?|polos?|knitwear)\b/, "Tops"],
  [/\b(hats?|caps?|beanies?|scarves?|belts?|gloves?|jewellery|jewelry|necklaces?|rings?|bracelets?|sunglasses?|watches?)\b/, "Accessories"],
  [/\b(bras?|underwear|lingerie|boxers?|briefs?|socks?)\b/, "Underwear"],
  [/\b(bikinis?|swimwear|swimsuits?|trunks?|boardshorts?)\b/, "Swimwear"],
];

const str = (v) => (typeof v === "string" ? v.trim() : "");

/** Best-effort category from the seller's own words. "Clothing" is the floor. */
export function deriveCategory(text) {
  const src = String(text || "").toLowerCase();
  for (const [re, name] of CATEGORY_RULES) if (re.test(src)) return name;
  return "Clothing";
}

/**
 * Tags are just the distinctive words of the seller's own listing — never
 * invented attributes. Falls back to the category so `tags` (required, min 1)
 * is always satisfiable.
 */
export function deriveTags({ title, description, brand, colour, category }) {
  const src = [title, brand, colour, category, description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  const seen = new Set();
  const tags = [];
  for (const raw of src.split(/\s+/)) {
    if (tags.length >= 15) break;
    if (raw.length < 3 || raw.length > 40) continue;
    if (STOP_WORDS.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    tags.push(raw);
  }
  if (!tags.length) tags.push(String(category).toLowerCase().slice(0, 40));
  if (!tags.length) tags.push("fashion");
  return tags;
}

/** Deterministic, honest title: seller's own fields, no adjective stuffing. */
export function composeTitle({ brand, colour, category, size }) {
  const parts = [];
  if (brand && brand !== "Unbranded") parts.push(brand);
  if (colour && colour !== "Unspecified") parts.push(colour);
  parts.push(category);
  if (size && size !== "Unspecified") parts.push(`size ${size}`);
  const title = parts.join(" ").replace(/\s+/g, " ").trim();
  return title.slice(0, MAX_TITLE) || "Listing";
}

const fail = (status, error, detail) => ({ ok: false, status, body: { ok: false, error, detail } });

/**
 * Build a schema-valid listing straight from the seller's input.
 *
 * @returns {ok:true, value} | {ok:false, status, body}
 */
export function localListing(item) {
  const src = item && typeof item === "object" ? item : {};
  const description = str(src.description) || str(src.photo_alt);
  if (!description) {
    return fail(
      422,
      "missing_item_description",
      "item.description (or item.photo_alt) is required so there is something to write about."
    );
  }

  // Never invent a price — that is the one thing only the seller knows.
  if (src.price === undefined || src.price === null || src.price === "") {
    return fail(
      422,
      "price_required",
      "No AI writer is configured on this deployment, so the listing is saved exactly as you " +
        "wrote it. Add item.price (1 - 10000) and it will save."
    );
  }
  const price = parsePrice(src.price);
  if (!Number.isFinite(price) || price <= 0 || price > 10000) {
    return fail(400, "invalid_price", "item.price must be a number > 0 and <= 10000.");
  }

  const brand = str(src.brand) || "Unbranded";
  const colour = str(src.colour) || "Unspecified";
  const size = str(src.size) || "Unspecified";
  const condition = str(src.condition) || "good";
  const category =
    str(src.category) ||
    deriveCategory(`${str(src.title_hint)} ${str(src.description)} ${str(src.photo_alt)}`);
  const title =
    str(src.title_hint).slice(0, MAX_TITLE) ||
    composeTitle({ brand, colour, category, size });
  const tags = deriveTags({ title, description, brand, colour, category });

  return {
    ok: true,
    value: {
      title,
      description: description.slice(0, 4000),
      category,
      condition,
      brand,
      colour,
      size,
      price: round2(price),
      tags,
    },
  };
}
