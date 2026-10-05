/**
 * The listing writer's DECLARED output schema, its validator, and the
 * per-marketplace fee breakdown.
 *
 * TWO SOURCES OF TRUTH, BOTH DELIBERATE:
 *   - LISTING_JSON_SCHEMA documents exactly what this endpoint returns. The
 *     tests validate a sample item against it, so the declaration and the
 *     validator cannot drift apart unnoticed.
 *   - The fee breakdown is computed from functions/api/_lib/fees.js and the
 *     catalogue in functions/api/marketplaces.js. This file contains NO fee
 *     rate and does NO fee arithmetic of its own: a second table of rates is
 *     how a listing screen and /api/fees/compare start disagreeing.
 *
 * The model supplies copy (title, description, ...). The model NEVER supplies
 * a fee, a take-home number, or a take-rate — those are always recomputed
 * server-side from the price, so a hallucuated "Poshmark takes 30%" can never
 * reach a screen.
 */

import { findMarketplace, isVerified, modelNote, parsePrice, round2, takeHome } from "../../_lib/fees.js";

/** The six shops a listing breakdown is computed for (Phase 4 contract). */
export const BREAKDOWN_IDS = ["poshmark", "mercari", "depop", "grailed", "ebay", "etsy"];

/** Bump only on a breaking change to the listing/breakdown shape. */
export const LISTING_SCHEMA_VERSION = 1;

export const CONDITIONS = [
  "new_with_tags",
  "new_without_tags",
  "excellent",
  "good",
  "fair",
  "poor",
];

/**
 * Declared schema for one listing object as returned in `response.listing`.
 * Kept as a plain literal (no JSON-Schema library — package.json has none) but
 * shaped like JSON Schema so it can be read by humans and by the tests.
 */
export const LISTING_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "fashionistas.ai listing",
  type: "object",
  required: ["title", "description", "category", "condition", "brand", "colour", "size", "price", "tags", "hashtags"],
  additionalProperties: false,
  properties: {
    // D1 row id, added by the route (null if the insert could not be written).
    id: { type: ["integer", "null"] },
    title: { type: "string", minLength: 1, maxLength: 80 },
    description: { type: "string", minLength: 10, maxLength: 4000 },
    category: { type: "string", minLength: 1, maxLength: 60 },
    condition: { type: "string", enum: CONDITIONS },
    brand: { type: "string", minLength: 1, maxLength: 60 },
    colour: { type: "string", minLength: 1, maxLength: 40 },
    size: { type: "string", minLength: 1, maxLength: 30 },
    price: { type: "number", minimum: 1, maximum: 10000 },
    tags: {
      type: "array",
      minItems: 1,
      maxItems: 15,
      items: { type: "string", minLength: 1, maxLength: 40 },
    },
    hashtags: {
      type: "array",
      minItems: 1,
      maxItems: 15,
      items: { type: "string", minLength: 2, maxLength: 40, pattern: "^#" },
    },
  },
};

const CONDITION_ALIASES = {
  new: "new_with_tags",
  "new with tags": "new_with_tags",
  "new w tags": "new_with_tags",
  "new_with_tags": "new_with_tags",
  "tags attached": "new_with_tags",
  "new without tags": "new_without_tags",
  "new w/o tags": "new_without_tags",
  "new_without_tags": "new_without_tags",
  nwot: "new_without_tags",
  excellent: "excellent",
  "like new": "excellent",
  "very good": "excellent",
  pristine: "excellent",
  good: "good",
  "gently used": "good",
  used: "good",
  fair: "fair",
  acceptable: "fair",
  poor: "poor",
  damaged: "poor",
  "well worn": "poor",
};

/** Case/space/underscore-insensitive condition lookup, or null. */
export function normalizeCondition(value) {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!key) return null;
  if (CONDITION_ALIASES[key]) return CONDITION_ALIASES[key];
  const asSnake = key.replace(/\s+/g, "_");
  return CONDITION_ALIASES[asSnake] || null;
}

const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());

function asString(value, { field, min, max, errors }) {
  if (typeof value !== "string") {
    errors.push({ field, message: `${field} must be a string` });
    return null;
  }
  const t = value.trim();
  if (t.length < min) {
    errors.push({ field, message: `${field} must be at least ${min} characters` });
    return null;
  }
  if (t.length > max) {
    errors.push({ field, message: `${field} must be at most ${max} characters` });
    return null;
  }
  return t;
}

function asStringList(value, { field, maxItems, errors, required }) {
  let list = value;
  if (isBlank(list) && !required) return null;
  if (typeof list === "string") list = list.split(","); // "a, b" is a common model answer
  if (!Array.isArray(list)) {
    errors.push({ field, message: `${field} must be an array of strings` });
    return null;
  }
  const out = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (!t) continue;
    if (t.length > 40) {
      errors.push({ field, message: `${field} entry is longer than 40 characters: ${t.slice(0, 24)}…` });
      return null;
    }
    if (!out.includes(t)) out.push(t);
    if (out.length >= maxItems) break;
  }
  if (required && out.length === 0) {
    errors.push({ field, message: `${field} must contain at least one entry` });
    return null;
  }
  return out;
}

function hashtagFor(tag) {
  const slug = String(tag)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
  return slug ? `#${slug}` : null;
}

/**
 * Validate one model answer against LISTING_JSON_SCHEMA.
 *
 * Returns { ok: true, value } or { ok: false, errors } — never a half-built
 * listing. `value` is whitelisted field by field, so any extra keys the model
 * invented are dropped rather than passed through to a marketplace.
 *
 * Defaults are explicit and honest: a missing brand becomes "Unbranded" and a
 * missing colour/size becomes "Unspecified" — values that say "we don't know",
 * never a guess dressed up as a fact.
 */
export function validateListing(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: [{ field: "$", message: "model output must be a JSON object" }] };
  }
  // Tolerate { "listing": { ... } } wrapping, nothing deeper.
  const src =
    raw.listing && typeof raw.listing === "object" && !Array.isArray(raw.listing) ? raw.listing : raw;

  const title = asString(src.title, { field: "title", min: 1, max: 80, errors });
  const description = asString(src.description, { field: "description", min: 10, max: 4000, errors });
  const category = asString(src.category, { field: "category", min: 1, max: 60, errors });

  const condition = normalizeCondition(src.condition);
  if (!condition) {
    errors.push({
      field: "condition",
      message: `condition must be one of: ${CONDITIONS.join(", ")}`,
    });
  }

  const price = parsePrice(src.price);
  if (!Number.isFinite(price) || price <= 0 || price > 10000) {
    errors.push({ field: "price", message: "price must be a number between 0 and 10000" });
  }

  const tags = asStringList(src.tags, { field: "tags", maxItems: 15, errors, required: true });

  const brand = isBlank(src.brand) ? "Unbranded" : asString(src.brand, { field: "brand", min: 1, max: 60, errors });
  const colour = isBlank(src.colour) ? "Unspecified" : asString(src.colour, { field: "colour", min: 1, max: 40, errors });
  const size = isBlank(src.size) ? "Unspecified" : asString(src.size, { field: "size", min: 1, max: 30, errors });

  let hashtags = asStringList(src.hashtags, { field: "hashtags", maxItems: 15, errors, required: false });
  if (Array.isArray(tags) && (!hashtags || hashtags.length === 0)) {
    hashtags = tags.map(hashtagFor).filter(Boolean).slice(0, 15);
  }
  if (Array.isArray(hashtags)) {
    hashtags = hashtags.map((h) => (h.startsWith("#") ? h : hashtagFor(h))).filter(Boolean);
    if (hashtags.length === 0) {
      errors.push({ field: "hashtags", message: "hashtags must contain at least one entry" });
    }
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title,
      description,
      category,
      condition,
      brand,
      colour,
      size,
      price: round2(price),
      tags,
      hashtags,
    },
  };
}

/**
 * Fee + take-home for every requested shop at one price.
 *
 * Pure delegation to functions/api/_lib/fees.js: `takeHome()` gives lines,
 * total fees, net and take-rate; `isVerified()`/`modelNote()` carry the
 * provenance this repo insists on. A catalogue id that somehow vanishes is a
 * thrown Error, not a silently skipped row — a missing shop in a take-home
 * table is exactly the kind of gap that hides money.
 */
export function buildBreakdown(price, ids = BREAKDOWN_IDS) {
  const p = round2(price);
  return ids.map((id) => {
    const m = findMarketplace(id);
    if (!m) throw new Error(`marketplace catalogue is missing "${id}"`);
    const t = takeHome(m, p);
    return {
      id: m.id,
      name: m.name,
      price: p,
      verified: isVerified(m),
      lines: t.lines,
      fees: t.fees,
      net: t.net,
      takeRate: t.takeRate,
      note: modelNote(m),
    };
  });
}

/* ---------------------------------------------------------------------------
 * Prompt — what the model is told to produce.
 * ------------------------------------------------------------------------ */

export const LISTING_SYSTEM_PROMPT = `You are the listing writer inside fashionistas.ai, an app for casual sellers clearing their closet from a phone.

Reply with ONE JSON object and NOTHING else: no prose, no markdown, no code fences, no comments.

Required keys:
  title       string, 1-80 chars. Lead with brand + item type + one strong attribute.
  description string, 10-600 chars. 2-4 honest sentences: fabric, fit, condition, why it is worth buying.
  category    string, 1-60 chars. e.g. "Jackets", "Dresses", "Sneakers", "Jeans", "Bags".
  condition   exactly one of: new_with_tags, new_without_tags, excellent, good, fair, poor.
  brand       string. The brand given to you, or "Unbranded".
  colour      string. The primary colour given to you, or "Unspecified".
  size        string. The size given to you, or "Unspecified".
  price       number in USD, your recommended asking price.
  tags        array of 5-10 short search keywords, each under 40 characters.
  hashtags    array of 3-8 hashtags, each starting with #.

Rules:
  - Use only the facts supplied. Never invent measurements, flaws, authenticity,
    original price, discounts, or stock.
  - Never mention fees, shipping costs or payouts; the app computes those separately.
  - If a fact is missing, use "Unbranded", "Unspecified" or omit it rather than guessing.`;

/** The item as the model sees it. Only fields the caller actually sent. */
export function listingUserPrompt(item) {
  const facts = {};
  for (const key of ["description", "photo_alt", "title_hint", "brand", "colour", "size", "condition", "price"]) {
    const v = item ? item[key] : undefined;
    if (v === undefined || v === null) continue;
    const s = typeof v === "string" ? v.trim() : v;
    if (s === "" || s === undefined) continue;
    facts[key] = s;
  }
  return `Write the listing JSON for this item:\n${JSON.stringify(facts, null, 2)}`;
}
