// selector-source.js — where selector config comes from, and how we survive
// it being unavailable.
//
//   bundled  -> selectors.bundled.json, shipped inside the extension (always there)
//   cache    -> chrome.storage.local copy of the last good remote doc
//   remote   -> https://fashionistas.ai/selectors.json (versioned)
//
// ORDER OF PREFERENCE: fresh remote > fresh cache > bundled. Bundled is the
// floor, never the ceiling — a marketplace changing its layout should be a
// server-side JSON edit, not an extension release.
//
// HARD RULES encoded here:
//   * a remote doc is NEVER applied unless it validates — garbage must not be
//     able to break every adapter at once,
//   * a remote doc may ADD or TIGHTEN selectors but can never drop a shop the
//     bundled copy knows about (a bad push cannot blind us to Poshtmark),
//   * any network/parse/storage failure silently lands on bundled, because a
//     working-but-stale selector beats no selector at all.
//
// Everything is injected (fetch, storage, clock) so tests can drive failure
// paths without a real network or chrome.storage.

export const SELECTORS_URL = "https://fashionistas.ai/selectors.json";
export const SCHEMA = 1;
export const CACHE_KEY = "selectors:cache";
export const CACHE_TTL_MS = 6 * 3600 * 1000; // revalidate every 6h

/** How deep config may nest. Real config reaches 4 (shops -> fields -> x). */
export const MAX_DEPTH = 6;

/** A value config may legally contain: JSON scalars, arrays, plain objects. */
function legalValue(v, depth, trail) {
  if (v === null) return null;
  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean") {
    if (t === "number" && !Number.isFinite(v)) return `bad_value:${trail}`;
    return null;
  }
  if (depth > MAX_DEPTH) return `depth:${trail}`;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const err = legalValue(v[i], depth + 1, `${trail}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  if (t === "object") {
    // only plain objects — a Date/Map/RegExp is a bug or an attack, not config
    if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) {
      return `bad_value:${trail}`;
    }
    for (const [k, val] of Object.entries(v)) {
      const err = legalValue(val, depth + 1, `${trail}.${k}`);
      if (err) return err;
    }
    return null;
  }
  return `bad_value:${trail}`; // function, symbol, undefined, bigint
}

/**
 * Validate a remote document before it is allowed to touch SHOPS.
 * Permissive about shape (numbers, nested `fields`/`buttons` groups are real),
 * strict about anything that is not JSON-safe or is structurally incomplete.
 */
export function validateSelectors(doc) {
  if (!doc || typeof doc !== "object") return { ok: false, error: "not_an_object" };
  if (doc.schema !== SCHEMA) return { ok: false, error: `schema:${doc.schema}!=${SCHEMA}` };
  if (!Number.isInteger(doc.version) || doc.version < 1) {
    return { ok: false, error: `version:${doc.version}` };
  }
  const shops = doc.shops;
  if (!shops || typeof shops !== "object") return { ok: false, error: "shops_missing" };
  if (Array.isArray(shops)) return { ok: false, error: "shops_missing" };
  const keys = Object.keys(shops);
  if (!keys.length) return { ok: false, error: "shops_empty" };
  for (const key of keys) {
    const s = shops[key];
    if (!s || typeof s !== "object" || Array.isArray(s)) return { ok: false, error: `shop_not_object:${key}` };
    if (typeof s.createUrl !== "string" || !/^https?:\/\//.test(s.createUrl)) {
      return { ok: false, error: `bad_createUrl:${key}` };
    }
    const err = legalValue(s, 0, key);
    if (err) return { ok: false, error: err };
  }
  return { ok: true, error: null };
}

/**
 * Merge: bundled shops are the floor. A remote shop only wins field-by-field,
 * so a doc missing `poshmark` (or missing its `title` selector) cannot remove
 * or blank out what we already shipped.
 */
function isEmpty(v) {
  return v === undefined || v === null || v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
}

function deepMerge(base, incoming) {
  const out = { ...base };
  for (const [field, val] of Object.entries(incoming)) {
    if (isEmpty(val)) continue; // never blank/erase a known selector
    const cur = out[field];
    const bothPlainObjects =
      cur && typeof cur === "object" && !Array.isArray(cur) &&
      val && typeof val === "object" && !Array.isArray(val);
    // nested groups (fields/buttons/signup) merge key-by-key; arrays replace
    out[field] = bothPlainObjects ? deepMerge(cur, val) : val;
  }
  return out;
}

export function mergeWithBundled(bundled, remote) {
  const out = JSON.parse(JSON.stringify(bundled));
  if (!remote || typeof remote !== "object") return out;
  for (const [key, incoming] of Object.entries(remote)) {
    if (!incoming || typeof incoming !== "object") continue;
    const base = out[key];
    if (!base) {
      out[key] = { ...incoming }; // a brand-new shop is allowed in
      continue;
    }
    out[key] = deepMerge(base, incoming);
  }
  return out;
}

function fresh(cache, now, ttl) {
  return !!(
    cache &&
    typeof cache === "object" &&
    Number.isInteger(cache.version) &&
    Number.isFinite(cache.fetchedAt) &&
    now - cache.fetchedAt < ttl &&
    validateSelectors(cache.doc).ok
  );
}

/**
 * Resolve the best available selector document.
 *
 * @returns {{shops:object, source:"remote"|"cache"|"bundled", version:number,
 *            error:string|null}}
 */
export async function loadSelectors({
  bundled,
  fetchImpl = globalThis.fetch,
  storage = null,
  url = SELECTORS_URL,
  now = Date.now(),
  ttl = CACHE_TTL_MS,
  forceRefresh = false
} = {}) {
  if (!bundled || typeof bundled !== "object") {
    throw new Error("loadSelectors: bundled copy is required");
  }
  const bundledVersion = Number.isInteger(bundled.version) ? bundled.version : 1;

  const readCache = async () => {
    if (!storage || !storage.get) return null;
    try {
      const got = await storage.get(CACHE_KEY);
      return got && typeof got === "object" ? got : null;
    } catch (e) {
      return null;
    }
  };
  const writeCache = async (doc, version) => {
    if (!storage || !storage.set) return false;
    try {
      await storage.set({ [CACHE_KEY]: { doc, version, fetchedAt: now } });
      return true;
    } catch (e) {
      return false;
    }
  };

  const cached = await readCache();
  const cacheUsable = fresh(cached, now, ttl);

  // 1) fresh cache is good enough unless a revalidation was explicitly asked for
  if (cacheUsable && !forceRefresh) {
    const merged = mergeWithBundled(bundled.shops || bundled, cached.doc.shops || {});
    return { shops: merged, source: "cache", version: cached.version, error: null };
  }

  // 2) go to the server
  if (typeof fetchImpl === "function") {
    try {
      const res = await fetchImpl(url, {
        cache: "no-cache",
        headers: { accept: "application/json", "x-selectors-schema": String(SCHEMA) }
      });
      if (res && res.ok) {
        const doc = await res.json();
        const v = validateSelectors(doc);
        if (v.ok) {
          await writeCache(doc, doc.version);
          const merged = mergeWithBundled(bundled.shops || bundled, doc.shops);
          return { shops: merged, source: "remote", version: doc.version, error: null };
        }
        // invalid payload: fall through, but say why
        return await fallback(cached, bundled, `invalid_remote:${v.error}`);
      }
      return await fallback(cached, bundled, `http_${res ? res.status : "?"}`);
    } catch (e) {
      return await fallback(cached, bundled, `fetch:${(e && e.message) || e}`);
    }
  }
  return await fallback(cached, bundled, "no_fetch");
}

async function fallback(cached, bundled, error) {
  if (fresh(cached, Date.now(), Infinity)) {
    const merged = mergeWithBundled(bundled.shops || bundled, cached.doc.shops || {});
    return { shops: merged, source: "cache", version: cached.version, error };
  }
  return {
    shops: bundled.shops || bundled,
    source: "bundled",
    version: Number.isInteger(bundled.version) ? bundled.version : 1,
    error
  };
}
