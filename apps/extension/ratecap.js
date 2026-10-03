// ratecap.js — per-account daily + hourly posting caps, one config per adapter.
//
// WHY THIS FILE IS PURE (no chrome.*, no I/O): the cap rules are the part most
// likely to be wrong and the part we must never get wrong — posting past a
// shop's tolerance gets the seller throttled or banned. Keeping them pure
// means `node --test` can exercise every branch, including the ones that only
// fire once a day has actually rolled over.
//
// Persistence is NOT here: queue.js writes the timestamps under `capKey()` into
// chrome.storage.local, so a restart never resets an account's allowance.
//
// CONFIGURABLE: edit POST_CAPS below (ships with the extension), or call
// setCapOverride() at runtime — overrides live under `capOverride:{shop}` and
// win over POST_CAPS, so a limit can be tightened without a release.

/** Default for any shop that does not declare its own limits. */
export const DEFAULT_CAP = { perHour: 4, perDay: 20 };

/**
 * Per-adapter limits. `perHour` is the burst ceiling, `perDay` the daily
 * allowance for ONE account on that shop. Deliberately conservative: these
 * match a human listing by hand, not a bot.
 */
export const POST_CAPS = {
  poshmark:  { perHour: 4, perDay: 40 },
  mercari:   { perHour: 4, perDay: 50 },
  depop:     { perHour: 4, perDay: 40 },
  vinted:    { perHour: 4, perDay: 60 },
  grailed:   { perHour: 3, perDay: 30 },
  facebook:  { perHour: 3, perDay: 25 },
  kidizen:   { perHour: 4, perDay: 30 },
  vestiaire: { perHour: 3, perDay: 25 },
  whatnot:   { perHour: 3, perDay: 20 }
};

export const HOUR_MS = 3600000;
export const DAY_MS = 86400000;

/** Storage key for an account's post timestamps on one shop. */
export function capKey(shop, account) {
  const acct = String(account || "default");
  return `cap:${acct}:${String(shop || "unknown")}`;
}

/** Storage key for a runtime override of one shop's limits. */
export function capOverrideKey(shop) {
  return `capOverride:${String(shop || "unknown")}`;
}

/**
 * Effective caps for a shop: runtime override -> POST_CAPS -> DEFAULT_CAP.
 * `cfg` is the shop's selectors config (it carries the legacy postsPerHour).
 */
export function capFor(shop, override, cfg) {
  const base = POST_CAPS[shop] || DEFAULT_CAP;
  const fromCfg = {};
  if (cfg && typeof cfg.postsPerHour === "number") fromCfg.perHour = cfg.postsPerHour;
  if (cfg && typeof cfg.postsPerDay === "number") fromCfg.perDay = cfg.postsPerDay;
  const merged = { ...DEFAULT_CAP, ...base, ...(fromCfg || {}), ...(override || {}) };
  return {
    perHour: Math.max(1, Math.floor(merged.perHour)),
    perDay: Math.max(1, Math.floor(merged.perDay))
  };
}

/** Drop anything outside the 24h window; returns a NEW array. */
export function prune(stamps, now) {
  const cutoff = now - DAY_MS;
  return (Array.isArray(stamps) ? stamps : []).filter(
    (t) => typeof t === "number" && t > cutoff && t <= now
  );
}

/**
 * The decision, with every number exposed for logging and tests.
 * `ok:false` means DO NOT post this time.
 */
export function checkCap({ stamps, now, perHour, perDay }) {
  const list = prune(stamps, now);
  const hourStamps = list.filter((t) => t > now - HOUR_MS);
  const hourUsed = hourStamps.length;
  const dayUsed = list.length;
  const hourLimit = Math.max(1, perHour | 0);
  const dayLimit = Math.max(1, perDay | 0);

  if (dayUsed >= dayLimit) {
    return { ok: false, reason: "daily_cap", hourUsed, dayUsed, hourLimit, dayLimit };
  }
  if (hourUsed >= hourLimit) {
    return { ok: false, reason: "hourly_cap", hourUsed, dayUsed, hourLimit, dayLimit };
  }
  return { ok: true, reason: null, hourUsed, dayUsed, hourLimit, dayLimit };
}

/** Seconds until the binding constraint frees up — used to schedule a retry. */
export function retryAfterSeconds({ stamps, now, perHour, perDay }) {
  const list = prune(stamps, now);
  const dayLimit = Math.max(1, perDay | 0);
  const hourLimit = Math.max(1, perHour | 0);
  const daySorted = [...list].sort((a, b) => a - b);
  if (daySorted.length >= dayLimit) {
    return Math.ceil((daySorted[daySorted.length - dayLimit] + DAY_MS - now) / 1000);
  }
  const hourSorted = list.filter((t) => t > now - HOUR_MS).sort((a, b) => a - b);
  if (hourSorted.length >= hourLimit) {
    return Math.ceil((hourSorted[hourSorted.length - hourLimit] + HOUR_MS - now) / 1000);
  }
  return 0;
}
