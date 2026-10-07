/**
 * POST /api/ai/analyze — photo → structured identify for the Snap listing fill.
 *
 * Same-origin Pages route so the Snap client is not stuck on the separate
 * fashionistas-api worker's weaker prompt. Auth is OPTIONAL: the convert funnel
 * (sample jacket + first photo) must work before a Pages session exists; the
 * workers.dev Bearer token is a different credential store. Rate-limit via KV
 * when CACHE is bound.
 *
 * Request:  { "image": "<base64 jpeg/png bytes>" }
 * Response: 200 { source:"ai", type, brand, color, condition, category,
 *                 priceMin, priceMax, confidence, sizeHint, material, note, model }
 *           400/415/422 input   429 rate   502 vision failed
 */

import { json } from "../_lib/auth.js";
import { identifyFromImage } from "./_lib/vision.js";

const ALLOW = "POST, OPTIONS";
const MAX_B64 = 6_000_000; // ~4.5MB binary
const RATE_PER_MIN = 20;

function cors(extra = {}) {
  return {
    allow: ALLOW,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": ALLOW,
    "access-control-allow-headers": "content-type, authorization",
    "cache-control": "no-store",
    ...extra,
  };
}

async function rateLimit(env, request) {
  const cache = env && (env.CACHE || env.FASHIONISTAS_KV);
  if (!cache || typeof cache.get !== "function") return true;
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "anon";
  const key = `ai-analyze:${ip}:${Math.floor(Date.now() / 60000)}`;
  try {
    const n = Number((await cache.get(key)) || 0);
    if (n >= RATE_PER_MIN) return false;
    await cache.put(key, String(n + 1), { expirationTtl: 120 });
    return true;
  } catch {
    return true;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (method !== "POST") {
    return json({ ok: false, error: "method_not_allowed", detail: "Use POST with { image }." }, 405, cors());
  }

  if (!(await rateLimit(env, request))) {
    return json({ ok: false, error: "rate_limited", detail: "Too many identify requests — try again in a minute." }, 429, cors());
  }

  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("json")) {
    return json(
      { ok: false, error: "unsupported_media_type", detail: "Content-Type must be application/json." },
      415,
      cors()
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ ok: false, error: "invalid_json", detail: String((err && err.message) || err) }, 400, cors());
  }

  const image = body && typeof body.image === "string" ? body.image.trim() : "";
  if (!image) {
    return json({ ok: false, error: "missing_image", detail: "image (base64) is required." }, 422, cors());
  }
  if (image.length < 100 || image.length > MAX_B64) {
    return json(
      { ok: false, error: "invalid_image", detail: "image must be base64-encoded image bytes (reasonable size)." },
      422,
      cors()
    );
  }
  // Strip data-URL prefix if a client sent one.
  const b64 = image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) {
    return json({ ok: false, error: "invalid_image", detail: "image must be base64." }, 422, cors());
  }

  const hint = body && typeof body.hint === "string" ? body.hint.trim() : "";
  const result = await identifyFromImage(env, b64.replace(/\s+/g, ""), { hint });
  if (!result.ok) {
    return json(
      { source: "error", error: result.error, note: result.detail || "vision model unavailable" },
      502,
      cors()
    );
  }

  return json({ ok: true, ...result.value }, 200, cors());
}

export const onRequestPost = onRequest;
