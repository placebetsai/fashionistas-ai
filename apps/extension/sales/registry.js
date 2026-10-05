// sales/registry.js — sale events: shape, identity and IDEMPOTENCY.
//
// A sale event is the unit the whole Phase-2 flow hangs off: it is what the
// scanner produces, what POST /api/sales persists, and what the one-tap prompt
// is built from.
//
// IDEMPOTENCY IS THE POINT OF THIS FILE. The same closet is scanned every
// minute of every day; a listing that sold once must produce ONE event, not
// one per scan. Identity is therefore derived, never generated:
//
//     key = `${shop}:${listingRef}`      (listingRef = the listing's URL path)
//
// so the same listing always collides, and two different listings on two
// different shops never do. The server upserts on the same identity
// (functions/api/sales/_shared.js), which makes a re-post from a second device
// idempotent too.

/** Hard cap on locally retained events (chrome.storage.local is not infinite). */
export const MAX_EVENTS = 200;
/** Hard cap on remembered keys — high enough that a real closet never re-fires. */
export const MAX_SEEN = 2000;

/** Derive the stable identity of a sale. Returns null when it cannot be one. */
export function saleKey(shop, listingRef) {
  const s = String(shop || "").trim();
  const r = String(listingRef || "").trim();
  if (!s || !r) return null;
  return `${s}:${r}`;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Build a sale event from one scanned item.
 * @param {object} raw {shop, listingRef, listingUrl, title, price, currency,
 *                      soldAt, soldAtText}
 * @param {number} [now] epoch ms (injectable so tests are deterministic)
 * @returns {object|null} null when the item has no identity — an event we
 *          cannot de-duplicate is worse than no event at all.
 */
export function makeSaleEvent(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object") return null;
  const key = saleKey(raw.shop, raw.listingRef);
  if (!key) return null;
  return {
    key,
    shop: String(raw.shop).trim(),
    listingRef: String(raw.listingRef).trim(),
    listingUrl: strOrNull(raw.listingUrl),
    title: strOrNull(raw.title),
    price: numOrNull(raw.price),
    currency: strOrNull(raw.currency),
    soldAt: strOrNull(raw.soldAt),
    soldAtText: strOrNull(raw.soldAtText),
    detectedAt: new Date(Number.isFinite(now) ? now : Date.now()).toISOString(),
    source: strOrNull(raw.source) || "scan"
  };
}

/**
 * Keep only events nobody has seen yet, and remember them.
 * Mutates `state.seen`; returns both halves so a caller can persist the state
 * and act on the fresh events without a second pass.
 *
 * @param {object[]} events
 * @param {object}   state  {seen: string[]}
 * @returns {{fresh: object[], seen: string[]}}
 */
export function acceptNew(events, state) {
  const st = state && typeof state === "object" ? state : {};
  const seen = new Set(Array.isArray(st.seen) ? st.seen : []);
  const fresh = [];
  for (const e of events || []) {
    if (!e || !e.key || seen.has(e.key)) continue;
    seen.add(e.key);
    fresh.push(e);
  }
  const next = Array.from(seen);
  st.seen = next.slice(-MAX_SEEN);
  return { fresh, seen: st.seen };
}

/** Retain an event locally (newest first, capped). Mutates `state.events`. */
export function pushEvent(state, event) {
  const st = state && typeof state === "object" ? state : {};
  if (!Array.isArray(st.events)) st.events = [];
  if (event && event.key && !st.events.some((e) => e && e.key === event.key)) {
    st.events.unshift(event);
    st.events = st.events.slice(0, MAX_EVENTS);
  }
  return st.events;
}

/** Fresh, empty scanner state — what loadState() falls back to. */
export function emptyState() {
  return { seen: [], events: [], failures: {}, gaveUp: [], report: [] };
}

export default { saleKey, makeSaleEvent, acceptNew, pushEvent, emptyState, MAX_EVENTS, MAX_SEEN };
