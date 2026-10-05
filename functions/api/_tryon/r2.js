/**
 * R2 storage helpers for /api/tryon (lane-3).
 *
 * Bucket binding: env.TRYON_BUCKET (Pages → Settings → Functions → R2 bindings).
 * Object keys:
 *   tryon/{uuid}.{ext}        generated try-on results  → /api/tryon/image/{uuid}.{ext}
 *   tryon/src-{uuid}.{ext}    uploaded inputs we hand a remote model as a URL
 *   tryon/{cacheHash32}.png   content-addressed try-on cache (see _tryon/provider.js)
 *
 * All three key shapes are served by the EXISTING /api/tryon/image/{uuid} route:
 * the cache key is 32 hex chars + ".png", which is exactly the id that route
 * already accepts. A cache hit therefore needs no new route and no second copy.
 */

import { TryonError, extForType, randomHex, sniffImageType } from "./http.js";

const RESULT_PREFIX = "tryon/";

export function tryonBucket(env) {
  const bucket = env && env.TRYON_BUCKET;
  if (!bucket || typeof bucket.put !== "function" || typeof bucket.get !== "function") {
    return null;
  }
  return bucket;
}

export function requireBucket(env) {
  const bucket = tryonBucket(env);
  if (!bucket) {
    throw new TryonError(
      503,
      "missing_tryon_bucket",
      "TRYON_BUCKET R2 binding not configured"
    );
  }
  return bucket;
}

export function keyFor({ prefix = "", ext }) {
  return `${RESULT_PREFIX}${prefix}${randomHex()}.${ext}`;
}

/** Store bytes and return the absolute URL a model (or a browser) can fetch. */
export async function putImage(bucket, request, key, bytes, contentType) {
  try {
    await bucket.put(key, bytes, { httpMetadata: { contentType } });
  } catch (err) {
    throw new TryonError(
      502,
      "r2_write_failed",
      `Could not store ${key} in R2: ${((err && err.message) || "put failed").slice(0, 200)}`
    );
  }
  return publicUrl(request, key);
}

/**
 * Read one stored object. Used by the try-on cache to answer "have we already
 * rendered this exact request?" WITHOUT calling a GPU.
 *
 * @returns {Promise<{bytes:Uint8Array,type:string,size:number}|null>}
 *   null = miss (absent, or an R2 read error — a broken cache must degrade to a
 *   miss, never fail the user's render).
 */
export async function getImage(bucket, key) {
  let object = null;
  try {
    object = await bucket.get(key);
  } catch (err) {
    console.log(
      `[tryon-cache] read_failed ${((err && err.message) || "unknown").slice(0, 160)}`
    );
    return null;
  }
  if (!object || typeof object.arrayBuffer !== "function") return null;

  let bytes;
  try {
    bytes = new Uint8Array(await object.arrayBuffer());
  } catch (err) {
    console.log(
      `[tryon-cache] body_unreadable ${((err && err.message) || "unknown").slice(0, 160)}`
    );
    return null;
  }
  if (!bytes.length) return null;

  // Sniff rather than trust the stored metadata: a cache hit that hands back
  // something that is not an image is worse than a miss.
  const declared = (object.httpMetadata && object.httpMetadata.contentType) || "";
  const type = sniffImageType(bytes) || (/^image\//.test(declared) ? declared.split(";")[0].trim() : null);
  if (!type) return null;

  return { bytes, type, size: bytes.length };
}

/**
 * Store a rendered image under its content-addressed cache key.
 * Fire-and-forget on failure: the user already has their image, and losing the
 * cache write only costs money on the next identical request.
 */
export async function putCached(bucket, key, bytes, contentType = "image/png") {
  try {
    await bucket.put(key, bytes, { httpMetadata: { contentType } });
    return true;
  } catch (err) {
    console.log(
      `[tryon-cache] write_failed ${((err && err.message) || "unknown").slice(0, 160)}`
    );
    return false;
  }
}

/** Same shape as publicUrl, from a context object. */
export function keyUrl(context, key) {
  return publicUrl((context && context.request) || context, key);
}

/** "tryon/src-ab12….jpg" → "https://host/api/tryon/image/src-ab12….jpg" */
export function publicUrl(request, key) {
  const slash = key.indexOf("/");
  const file = slash >= 0 ? key.slice(slash + 1) : key;
  let origin;
  try {
    origin = new URL(request.url).origin;
  } catch {
    origin = "https://fashionistas.ai";
  }
  return `${origin}/api/tryon/image/${file}`;
}

/** Result key for a stored object, e.g. "tryon/9f…c2.png". */
export function resultKey(bytesType) {
  return keyFor({ ext: extForType(bytesType) });
}

/** Key for an uploaded input image ("src-" keeps it distinct in listings). */
export function sourceKey(bytesType) {
  return keyFor({ prefix: "src-", ext: extForType(bytesType) });
}
