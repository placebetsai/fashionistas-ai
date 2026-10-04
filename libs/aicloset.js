/**
 * Closet pricing model (lane 5).
 *
 * Fee percentages mirror the approximate model this repo publishes on
 * /api/marketplaces (also shown by /api/fees/estimate and /api/fees/compare)
 * and are common US-seller approximations, not legal fee schedules. Take-home
 * is always:
 *
 *     net = sale_price - marketplace_fee - assumed_seller_paid_shipping
 *
 * Nothing here invents item data. Prices only ever come from the caller (an LLM
 * estimate or a value the seller typed) and are labelled by price_source.
 */

export const SHOP_ORDER = [
  "ebay",
  "etsy",
  "poshmark",
  "mercari",
  "depop",
  "vinted",
  "grailed",
  "facebook",
];

/**
 * pct    -> fee as a fraction of the sale price
 * fixed  -> flat per-order fee in USD
 * ship   -> shipping the SELLER is assumed to pay (conservative: worst realistic case)
 */
export const FEE_TABLE = {
  ebay: {
    label: "eBay",
    pct: 0.136,
    fixed: 0.4,
    ship: 8.99,
    note: "13.6% final value fee + $0.40 per order (US, most categories, 2026); seller-paid USPS Ground Advantage assumed.",
  },
  etsy: {
    label: "Etsy",
    pct: 0.095,
    fixed: 0.25,
    ship: 5.99,
    note: "6.5% transaction fee + ~3% payment processing + $0.25 per order ($0.20 listing fee not counted); seller-paid shipping assumed.",
  },
  poshmark: {
    label: "Poshmark",
    pct: 0.2,
    fixed: 0,
    ship: 7.67,
    note: "20% of the sale, or $2.95 when the sale is under $15; seller-paid flat-rate label assumed.",
  },
  mercari: {
    label: "Mercari",
    pct: 0.1,
    fixed: 0,
    ship: 6.49,
    note: "~10% selling fee (payment processing can apply on some sales); seller-paid shipping assumed.",
  },
  depop: {
    label: "Depop",
    pct: 0.033,
    fixed: 0.45,
    ship: 5.99,
    note: "0% commission (removed 2024) + 3.3% payment processing + $0.45 per order; seller-paid shipping assumed.",
  },
  vinted: {
    label: "Vinted",
    pct: 0,
    fixed: 0,
    ship: 4.99,
    note: "0% seller fee in most regions (buyers pay buyer protection); shipping assumed seller-offered so the number never overstates what you keep.",
  },
  grailed: {
    label: "Grailed",
    pct: 0.09,
    fixed: 0.49,
    ship: 7.99,
    note: "9% commission (6% + $1.99 min under $120) + 3.49% + $0.49 processing; seller-paid shipping assumed.",
  },
  facebook: {
    label: "Facebook Marketplace",
    pct: 0.10,
    fixed: 0,
    ship: 7.99,
    note: "10% fee on shipped orders (0% for local pickup); shipping assumed.",
  },
  kidizen: {
    label: "Kidizen",
    pct: 0.12,
    fixed: 0.5,
    ship: 6.99,
    note: "12% + $0.50 per transaction; seller-paid shipping assumed.",
  },
  vestiaire: {
    label: "Vestiaire Collective",
    pct: 0.15,
    fixed: 0,
    ship: 14.0,
    note: "12% selling fee + 3% payment processing (US, 2026); seller-paid shipping to authentication centre assumed.",
  },
  whatnot: {
    label: "Whatnot",
    pct: 0.109,
    fixed: 0.3,
    ship: 0,
    note: "8% commission + 2.9% + $0.30 payment processing; shipping is buyer-paid.",
  },
};

export function feeFor(shopId, price) {
  const f = FEE_TABLE[shopId];
  if (!f || typeof price !== "number" || !Number.isFinite(price)) return null;
  if (shopId === "poshmark") {
    const raw = price < 15 ? 2.95 : price * f.pct;
    return round2(raw);
  }
  return round2(price * f.pct + f.fixed);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Assumed seller-paid shipping per shop (USD), part of every take-home figure. */
export function shippingAssumed() {
  const out = {};
  for (const id of SHOP_ORDER) out[id] = FEE_TABLE[id].ship;
  return out;
}

/**
 * Take-home for every shop at a given sale price.
 * Returns null for every shop when no price exists (never a made-up number).
 */
export function takehome(price, opts = {}) {
  const priceNum =
    typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
  if (priceNum === null) {
    const nulls = {};
    for (const id of SHOP_ORDER) nulls[id] = null;
    return nulls;
  }
  const out = {};
  for (const id of SHOP_ORDER) {
    const f = FEE_TABLE[id];
    const fee = feeFor(id, priceNum);
    const ship =
      opts.sellerPaysShipping === false ? 0 : typeof opts.ship === "number" ? opts.ship : f.ship;
    out[id] = round2(priceNum - fee - ship);
  }
  return out;
}

/** Honest, data-derived shop ranking — only possible once a price exists. */
export function rankShops(th, price) {
  const known = SHOP_ORDER.filter((id) => typeof th[id] === "number");
  if (!known.length || typeof price !== "number") return null;
  const best = known
    .slice()
    .sort((a, b) => th[b] - th[a])
    .slice(0, 3);
  return best.map((id) => ({
    shop: id,
    reason:
      `Keeps ${money(th[id])} of a ${money(price)} sale after ~${feePctLabel(id)} in fees ` +
      `and ${money(FEE_TABLE[id].ship)} assumed seller-paid shipping.`,
  }));
}

function feePctLabel(id) {
  const f = FEE_TABLE[id];
  if (f.pct === 0) return "0% seller fee";
  const pct = Math.round(f.pct * 1000) / 10;
  return `${pct}%${f.fixed ? ` + $${f.fixed.toFixed(2)}` : ""}`;
}

export function money(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}

/** Coarse, snake_case garment taxonomy. The LLM must pick from this list. */
export const CATEGORIES = [
  "tshirt",
  "blouse",
  "shirt",
  "sweater",
  "hoodie",
  "sweatshirt",
  "cardigan",
  "jacket",
  "coat",
  "blazer",
  "vest",
  "dress",
  "romper_jumpsuit",
  "skirt",
  "trousers",
  "jeans",
  "shorts",
  "leggings",
  "activewear",
  "swimwear",
  "underwear",
  "sleepwear",
  "socks",
  "handbag",
  "backpack",
  "wallet",
  "belt",
  "hat",
  "scarf",
  "gloves",
  "jewelry",
  "watch",
  "sunglasses",
  "sneakers",
  "boots",
  "heels",
  "flats",
  "sandals",
  "dress_shoes",
  "other",
];

const CATEGORY_SET = new Set(CATEGORIES);

export function normalizeCategory(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!v) return null;
  if (CATEGORY_SET.has(v)) return v;
  const noPlural = v.endsWith("s") ? v.slice(0, -1) : v;
  for (const c of CATEGORIES) {
    if (c === noPlural || c.startsWith(noPlural + "_") || noPlural.startsWith(c)) return c;
  }
  return null;
}

export function clampConfidence(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

/** Keep only shop ids we actually model, so reasons stay truthful. */
export function normalizeBestShops(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const seen = new Set();
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const shop = String(entry.shop || "")
      .trim()
      .toLowerCase();
    if (!SHOP_ORDER.includes(shop) || seen.has(shop)) continue;
    const reason = typeof entry.reason === "string" && entry.reason.trim() ? entry.reason.trim() : "";
    if (!reason) continue;
    seen.add(shop);
    out.push({ shop, reason: reason.slice(0, 240) });
    if (out.length === 3) break;
  }
  return out.length ? out : null;
}

/** Prices: keep a sane range and always label where they came from. */
export function normalizePrices(low, high) {
  let a = Number(low);
  let b = Number(high);
  if (!Number.isFinite(a) && !Number.isFinite(b)) return { price_low: null, price_high: null };
  if (!Number.isFinite(a)) a = b;
  if (!Number.isFinite(b)) b = a;
  a = Math.max(1, Math.min(5000, a));
  b = Math.max(1, Math.min(5000, b));
  if (a > b) [a, b] = [b, a];
  a = Math.round(a * 100) / 100;
  b = Math.round(b * 100) / 100;
  if (a === b) b = Math.round((a * 1.2 + 1) * 100) / 100;
  return { price_low: a, price_high: b };
}

/** Midpoint of the estimate range — the single price take-home is computed at. */
export function priceBasis(low, high) {
  if (typeof low !== "number" || typeof high !== "number") return null;
  return Math.round(((low + high) / 2) * 100) / 100;
}
