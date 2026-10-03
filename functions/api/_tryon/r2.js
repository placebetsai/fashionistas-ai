/**
 * R2 storage helpers for /api/tryon (lane-3).
 *
 * Bucket binding: env.TRYON_BUCKET (Pages → Settings → Functions → R2 bindings).
 * Object keys:
 *   tryon/{uuid}.{ext}        generated try-on results  → /api/tryon/image/{uuid}.{ext}
 *   tryon/src-{uuid}.{ext}    uploaded inputs we hand Replicate as a hosted URL
 */

import { TryonError, extForType, randomHex } from "./http.js";

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

/** Store bytes and return the absolute URL Replicate (or a browser) can fetch. */
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
