/**
 * Shared fee maths for POST /api/fees/estimate and POST /api/fees/compare.
 *
 * WHY THIS FILE EXISTS: the homepage has two buttons — "See what I'd keep"
 * (one shop) and "Compare all shops" (all of them) — and both must return the
 * same number for the same price, and the same numbers GET /api/marketplaces
 * publishes. The only way to guarantee that is to derive the figures from the
 * ONE catalogue this repo ships (functions/api/marketplaces.js) instead of
 * restating rates here: a second table is how a fee page and a fee API drift.
 * That is also why this module contains no rate literal of its own, with one
 * exception — Poshmark's flat/percentage tier, which the flat `feePct` +
 * `feeFixed` fields of the catalogue cannot express.
 *
 * `feePct` / `feeFixed` / `feeNote` are an approximate US-seller model this
 * repo publishes, not a live quote from any platform. Callers must keep that
 * caveat in the `note` they return, and must set `verified` from
 * `isVerified()` rather than asserting it themselves.
 */

import { MARKETPLACES } from "../marketplaces.js";

/** Poshmark (US): a flat $2.95 on sales under $15, 20% at $15 and above. */
const POSHMARK_FLAT = 2.95;
const POSHMARK_TIER = 15;
const POSHMARK_PCT = 20;

/** Round to cents without ever disguising a non-finite input as a number. */
export function round2(n) {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 100) / 100;
}

/**
 * Catalogue lookup, case- and whitespace-insensitive.
 * Returns the marketplace or null — never a partial/derived object, so a
 * caller cannot accidentally treat a guess as published data.
 */
export function findMarketplace(platform) {
  if (typeof platform !== "string") return null;
  const key = platform.trim().toLowerCase();
  if (!key) return null;
  return MARKETPLACES.find((m) => m.id === key) || null;
}

/** Every catalogue id, quoted back in a 400 so a client can correct itself. */
export function marketplaceIds() {
  return MARKETPLACES.map((m) => m.id);
}

/**
 * Strict `price` coercion: a number, or a string that really is one.
 * Everything else (null, true, {}, [], "", "abc", Infinity-shaped values the
 * caller cannot send as JSON) comes back as NaN and is rejected downstream.
 */
export function parsePrice(raw) {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim() !== "") return Number(raw);
  return NaN;
}

/** "13.6%" not "13.600000000000001%" — trim trailing zeros for display. */
function pct(n) {
  return String(round2(n));
}

/**
 * Break one shop's model into displayable lines for one price.
 *
 * Returns [] when the shop takes nothing (Vinted is 0% for sellers), which
 * the consumer renders as "no seller fee" / "Platform fees $0.00" — an empty
 * array is the honest shape, never [null] and never a fabricated line.
 */
export function feeLines(m, price) {
  if (m.id === "poshmark") {
    return price < POSHMARK_TIER
      ? [{ label: "Poshmark flat fee (under $15)", amount: round2(POSHMARK_FLAT) }]
      : [{ label: `Poshmark fee (${POSHMARK_PCT}%)`, amount: round2((price * POSHMARK_PCT) / 100) }];
  }

  const lines = [];
  const pctPart = Number(m.feePct);
  const fixedPart = Number(m.feeFixed);

  if (Number.isFinite(pctPart) && pctPart > 0) {
    lines.push({
      label: `${m.name} fee (${pct(pctPart)}%)`,
      amount: round2((price * pctPart) / 100),
    });
  }
  if (Number.isFinite(fixedPart) && fixedPart > 0) {
    lines.push({
      label: `${m.name} per-order fee`,
      amount: round2(fixedPart),
    });
  }
  return lines;
}

/**
 * Lines, total taken, what the seller keeps, and that as a share of price.
 * `takeRate` is a percentage (0-100 and up), because the consumer uses it as
 * both "You keep X%" and a bar width.
 */
export function takeHome(m, price) {
  const lines = feeLines(m, price);
  const fees = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const net = round2(price - fees);
  const takeRate = round2((net / price) * 100);
  return { lines, fees, net, takeRate };
}

/**
 * `verified` — true only when the figure came from a fee model this repo
 * actually publishes, i.e. the catalogue entry carries its own written model.
 * Anything else is an estimate and must come back false.
 */
export function isVerified(m) {
  return Boolean(m && typeof m.feeNote === "string" && m.feeNote.trim());
}

/** The note for one shop: the catalogue's own wording, plus its provenance. */
export function modelNote(m) {
  return (
    `${m.feeNote} — approximate model published by this repo at /api/marketplaces, ` +
    "not a live quote; the shop shows the exact figure on its own earnings preview."
  );
}

/** The note for a whole-catalogue comparison. */
export const COMPARE_NOTE =
  "All figures use the approximate fee model published by this repo at /api/marketplaces, " +
  "not live quotes from any platform. Confirm each shop's current rate on your own " +
  "earnings or payout screen before you price.";
