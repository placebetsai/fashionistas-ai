/**
 * GET/HEAD /api/tryon/image/[uuid] — streams a stored try-on object from R2.
 *
 * Ids look like 9f3c…a1  (result, PNG stored as tryon/{uuid}.png),
 *            9f3c…a1.jpg (result in another format),
 *       src-9f3c…a1.jpg  (an uploaded input Replicate fetched from us).
 *
 * The check curls this with -sI and expects `content-type: image/…`.
 */

import { json, typeForExt } from "../../_tryon/http.js";
import { tryonBucket } from "../../_tryon/r2.js";

const ID_RE = /^(?:src-)?[0-9a-f]{32}(?:\.(?:png|jpe?g|jpeg|webp|gif))?$/i;

function isHead(request) {
  return String((request && request.method) || "GET").toUpperCase() === "HEAD";
}

async function serve(context) {
  const params = (context && context.params) || {};
  let raw = "";
  try {
    raw = decodeURIComponent(String(params.uuid || ""));
  } catch {
    raw = "";
  }

  if (!ID_RE.test(raw)) {
    return json({ error: "invalid image id", code: "invalid_image_id" }, 400);
  }

  const bucket = tryonBucket((context && context.env) || {});
  if (!bucket) {
    return json(
      { error: "TRYON_BUCKET R2 binding not configured", code: "missing_tryon_bucket" },
      503
    );
  }

  // Bare uuid → the PNG result key used by POST /api/tryon.
  const key = `tryon/${/\.(png|jpe?g|webp|gif)$/i.test(raw) ? raw : raw + ".png"}`;

  let object;
  try {
    object = await bucket.get(key);
  } catch (err) {
    return json(
      {
        error: "R2 read failed: " + ((err && err.message) || "unknown").slice(0, 200),
        code: "r2_read_failed",
      },
      502
    );
  }

  if (!object) {
    return json({ error: "image not found", code: "not_found" }, 404);
  }

  const meta = object.httpMetadata || {};
  const ext = key.slice(key.lastIndexOf(".") + 1);
  const contentType = meta.contentType || typeForExt(ext);
  const isSource = raw.startsWith("src-");

  const headers = {
    "content-type": contentType,
    "cache-control": isSource
      ? "private, no-store"
      : "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  };
  if (typeof object.size === "number") {
    headers["content-length"] = String(object.size);
  }

  if (isHead(context.request)) {
    try {
      if (object.body && typeof object.body.cancel === "function") {
        await object.body.cancel();
      }
    } catch {
      /* nothing to release */
    }
    return new Response(null, { status: 200, headers });
  }

  return new Response(object.body, { status: 200, headers });
}

export async function onRequestGet(context) {
  try {
    return await serve(context);
  } catch (err) {
    console.log(`[tryon-image] unexpected_error ${((err && err.message) || String(err)).slice(0, 300)}`);
    return json(
      { error: ((err && err.message) || "internal error").slice(0, 300), code: "internal_error" },
      500
    );
  }
}

export async function onRequestHead(context) {
  return onRequestGet(context);
}
