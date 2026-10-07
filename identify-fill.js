/**
 * Photo → AI identify → listing form fill.
 *
 * Pure helpers used by:
 *   - functions/api/ai/analyze.js  (server normalize after vision)
 *   - index.html                   (client belt-and-suspenders + form map)
 *   - tests/identify-fill.test.mjs
 *
 * Honesty rules:
 *   - Never invent a brand. "Unknown" becomes blank.
 *   - Never put "not visible" in the size box.
 *   - Category follows the ITEM TYPE when they conflict (a jacket is Outerwear
 *     even if the model said Tops).
 *   - Price anchors only kick in when the model range is absurd for the
 *     category — they do not invent a price from thin air when the model
 *     returned nothing.
 */

export const IDENTIFY_CATEGORIES = [
  "Tops",
  "Bottoms",
  "Dresses",
  "Outerwear",
  "Shoes",
  "Accessories",
];

/** Resale USD anchors used when the model range is empty or absurd. */
export const PRICE_ANCHORS = {
  Outerwear: { lo: 25, hi: 120, mid: 55 },
  Dresses: { lo: 18, hi: 75, mid: 35 },
  Tops: { lo: 10, hi: 45, mid: 22 },
  Bottoms: { lo: 15, hi: 70, mid: 35 },
  Shoes: { lo: 20, hi: 110, mid: 48 },
  Accessories: { lo: 8, hi: 60, mid: 24 },
};

/**
 * Most-specific-first: type text wins over a flat category guess.
 * "dress shirt" stays Tops; "jean jacket" / "denim jacket" → Outerwear.
 */
const TYPE_CATEGORY_RULES = [
  [/\b(jean|denim)\s*jacket\b|\bjacket\b|\bcoat\b|\bparka\b|\bpuffer\b|\bblazer\b|\bwindbreaker\b|\btrench\b|\bovercoat\b|\banorak\b|\bgilet\b|\bvest\b(?!\s*top)/, "Outerwear"],
  [/\bhoodie\b|\bsweatshirt\b|\bcardi(?:gan)?\b|\bpullover\b|\bcropped\s+hoodie\b/, "Outerwear"],
  [/\b(?:dresses|gown|jumpsuit|romper|playsuit)\b|\bdress\b(?!\s+shirt)/, "Dresses"],
  [/\bsneakers?\b|\btrainers?\b|\bboots?\b|\bheels?\b|\bsandals?\b|\bloafers?\b|\bshoes?\b|\bespadrille\b|\bmule\b/, "Shoes"],
  [/\bbag\b|\bpurse\b|\bhandbag\b|\bbackpack\b|\btote\b|\bclutch\b|\bwallet\b/, "Accessories"],
  [/\bhat\b|\bcap\b|\bbeanie\b|\bscarf\b|\bbelt\b|\bsunglasses?\b|\bwatch\b|\bjewellery\b|\bjewelry\b|\bnecklace\b|\bbracelet\b|\bring\b/, "Accessories"],
  [/\bjean\b|\bdenim\b(?!\s*jacket)|\bpant\b|\btrouser\b|\bshort\b|\bskirt\b|\blegging\b|\bchino\b|\bcyclette\b/, "Bottoms"],
  [/\bshirt\b|\bt-?shirt\b|\btee\b|\bblouse\b|\btop\b|\btank\b|\bcami\b|\bpolo\b|\bsweater\b(?!\s*jacket)/, "Tops"],
];

const MATERIAL_RULES = [
  [/\bdenim\b|\bjean\b/, "Denim"],
  [/\bleather\b|\bsuede\b/, "Leather"],
  [/\bwool\b|\bcashmere\b/, "Wool"],
  [/\blinen\b/, "Linen"],
  [/\bsilk\b|\bsatin\b/, "Silk"],
  [/\bcotton\b/, "Cotton"],
  [/\bpolyester\b|\bnylon\b|\bpoly\b/, "Synthetic"],
  [/\bknit\b|\bjersey\b/, "Knit"],
  [/\bvelvet\b|\bcorduroy\b/, "Corduroy"],
];

const BAD_SIZE = /^(not\s*visible|unknown|n\/?a|none|unspecified|hard\s*to\s*tell|can'?t\s*tell|illegible|unclear|-|—|–|\.|\s*)$/i;
const BAD_BRAND = /^(unknown|n\/?a|none|unbranded|unspecified|not\s*sure|illegible|-|—|–|\.|\s*)$/i;
const BAD_COND = /^(unknown|n\/?a|none|unspecified|-|—|–|\.|\s*)$/i;

const COND_OK = new Set(["Poor", "Fair", "Good", "Excellent"]);

function str(v) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function num(v) {
  const n = typeof v === "number" ? v : parseFloat(String(v || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** Map free text (type + note + category) onto one of IDENTIFY_CATEGORIES. */
export function categoryFromText(text) {
  const t = String(text || "").toLowerCase();
  for (const [re, cat] of TYPE_CATEGORY_RULES) {
    if (re.test(t)) return cat;
  }
  const raw = str(text);
  const hit = IDENTIFY_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  return hit || "";
}

export function inferMaterial(text) {
  const t = String(text || "").toLowerCase();
  for (const [re, mat] of MATERIAL_RULES) {
    if (re.test(t)) return mat;
  }
  return "";
}

export function normalizeCondition(value) {
  const v = str(value);
  if (!v || BAD_COND.test(v)) return "Good";
  const titled = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
  if (COND_OK.has(titled)) return titled;
  const aliases = {
    new: "Excellent",
    "like new": "Excellent",
    "new with tags": "Excellent",
    "new without tags": "Excellent",
    nwot: "Excellent",
    "gently used": "Good",
    used: "Good",
    worn: "Fair",
    damaged: "Poor",
    "well worn": "Poor",
  };
  const key = v.toLowerCase().replace(/[_-]+/g, " ");
  return aliases[key] || "Good";
}

/**
 * Sanitize + repair one /api/ai/analyze payload so the listing form can fill
 * every field it already has with sensible values.
 *
 * @returns {object} same shape the Snap UI expects, plus optional `material`
 */
export function normalizeIdentify(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const type = str(src.type) || "Clothing item";
  const note = str(src.note);
  const color = str(src.color);
  const blob = [type, src.category, color, note, src.material].filter(Boolean).join(" ");

  let category = categoryFromText(type) || categoryFromText(blob);
  if (!category) {
    const flat = str(src.category);
    category =
      IDENTIFY_CATEGORIES.find((c) => c.toLowerCase() === flat.toLowerCase()) || "Tops";
  }

  let brand = str(src.brand);
  if (!brand || BAD_BRAND.test(brand)) brand = "";

  let sizeHint = str(src.sizeHint || src.size);
  if (!sizeHint || BAD_SIZE.test(sizeHint)) sizeHint = "";

  const condition = normalizeCondition(src.condition);

  let material = str(src.material);
  if (!material) material = inferMaterial(blob);

  let priceMin = num(src.priceMin);
  let priceMax = num(src.priceMax);
  const anchor = PRICE_ANCHORS[category] || PRICE_ANCHORS.Tops;

  // Empty range → use category anchor (honest "typical resale", not a fake ID).
  if (!Number.isFinite(priceMin) && !Number.isFinite(priceMax)) {
    priceMin = anchor.lo;
    priceMax = anchor.hi;
  } else {
    if (!Number.isFinite(priceMin)) priceMin = Number.isFinite(priceMax) ? Math.round(priceMax * 0.6) : anchor.lo;
    if (!Number.isFinite(priceMax)) priceMax = Math.max(priceMin, anchor.mid);
    if (priceMax < priceMin) {
      const t = priceMin;
      priceMin = priceMax;
      priceMax = t;
    }
    // Absurd: e.g. Outerwear at $5–20 while type says jacket → lift to anchor.
    const tooLowForCat = priceMax < anchor.lo;
    if (tooLowForCat) {
      priceMin = anchor.lo;
      priceMax = anchor.hi;
    }
    // Clamp to sane resale bounds.
    priceMin = Math.max(1, Math.min(10000, Math.round(priceMin)));
    priceMax = Math.max(priceMin, Math.min(10000, Math.round(priceMax)));
  }

  let confidence = num(src.confidence);
  if (!Number.isFinite(confidence)) confidence = 50;
  if (confidence > 0 && confidence <= 1) confidence = Math.round(confidence * 100);
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return {
    source: src.source || "ai",
    type,
    brand,
    color,
    condition,
    category,
    priceMin,
    priceMax,
    confidence,
    sizeHint,
    material,
    note,
  };
}

function titleCase(s) {
  return String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Map a normalized identify result onto the listing form payload
 * `renderListingForm` already understands.
 */
export function listingFieldsFromIdentify(ai) {
  const a = normalizeIdentify(ai || {});
  const brand = a.brand;
  const lo = a.priceMin;
  const hi = a.priceMax;
  const mid = lo && hi ? Math.round((lo + hi) / 2) : lo || hi || "";
  const kind = String(a.type || "item").toLowerCase();
  const descParts = [
    [a.color, brand, kind].filter(Boolean).join(" ").replace(/^./, (c) => c.toUpperCase()) + ".",
    a.material ? "Material: " + a.material + "." : "",
    a.sizeHint ? "Size " + a.sizeHint + "." : "",
    "Condition: " + (a.condition || "Good") + ".",
    a.note || "",
    "Smoke-free home. Open to reasonable offers.",
  ].filter(Boolean);

  const title = titleCase(
    [brand, a.color, a.type || "Clothing item"].filter(Boolean).join(" ")
  ).slice(0, 80);

  return {
    title,
    category: a.category || "Tops",
    condition: a.condition || "Good",
    price: mid,
    brand,
    color: a.color || "",
    material: a.material || "",
    description: descParts.join(" "),
    priceMin: undefined,
    priceMax: a.priceMax,
    sizeHint: a.sizeHint || "",
    _conf: a.confidence,
  };
}

export default { normalizeIdentify, listingFieldsFromIdentify, categoryFromText, inferMaterial, normalizeCondition, PRICE_ANCHORS, IDENTIFY_CATEGORIES };
