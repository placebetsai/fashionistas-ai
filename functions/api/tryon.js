/**
 * POST /api/tryon — AI virtual try-on (IDM-VTON on Replicate) → R2 → URL.
 *
 * Request: multipart/form-data
 *   person      (file, required)  full-body photo
 *   garment     (file, required)  garment photo
 *   garment2    (file, optional)  bottom — chains on top of garment
 *   garment3    (file, optional)  outerwear — chains on top of garment2
 *   previews    (int, optional)   default 3, max 6 (each preview = 1 model run
 *                                 per garment in the chain)
 *   seed        (int), crop (bool), category/2/3, description/2/3
 *
 * Response 200: { ok, url, urls[], previews, garments, runs, ... }
 *   "url" is always present (first successful preview).
 * Failures: non-2xx { error, code } — never a placeholder image.
 *
 * Required env: REPLICATE_API_TOKEN (Replicate), TRYON_BUCKET (R2 binding).
 * Without them this endpoint honestly answers 503 instead of pretending.
 */

import { requireAuth } from "./_lib/auth.js";
import { json, TryonError, errorResponse, toTryonError, sniffImageType, extForType } from "./_tryon/http.js";
import { parseTryonForm } from "./_tryon/multipart.js";
import { requireBucket, putImage, sourceKey, resultKey } from "./_tryon/r2.js";
import { runTryon, MODEL_ID, MODEL_VERSION, COST_PER_RUN_USD } from "./_tryon/replicate.js";
import { logCost } from "./_tryon/ledger.js";

const BUDGET_MS = 120_000;
const MAX_RUNS = 6;
const OUTPUT_TIMEOUT_MS = 30_000;

/** Upload an input image to R2 and hand back a URL Replicate can fetch. */
async function hostInput(request, bucket, part) {
  const key = sourceKey(part.type);
  return putImage(bucket, request, key, part.bytes, part.type);
}

/** Download the model output, sniff the real type, store it, build the URL. */
async function storeResult(request, bucket, outputUrl) {
  let res;
  try {
    res = await fetch(outputUrl, { signal: AbortSignal.timeout(OUTPUT_TIMEOUT_MS) });
  } catch (err) {
    throw new TryonError(
      502,
      "tryon_output_unreachable",
      "Could not download the IDM-VTON result: " +
        ((err && err.message) || "network error").slice(0, 200)
    );
  }
  if (!res.ok) {
    throw new TryonError(
      502,
      "tryon_output_download_failed",
      `Downloading the IDM-VTON result failed (HTTP ${res.status}).`
    );
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) {
    throw new TryonError(502, "tryon_output_empty", "IDM-VTON returned an empty image.");
  }
  const declared = (res.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
  const type = sniffImageType(bytes) || (declared.startsWith("image/") ? declared : null);
  if (!type) {
    throw new TryonError(
      502,
      "tryon_output_not_image",
      "IDM-VTON result was not a recognizable image."
    );
  }

  const key = resultKey(type);
  await putImage(bucket, request, key, bytes, type);

  const uuidWithExt = key.slice(key.indexOf("/") + 1);
  const uuid = uuidWithExt.replace(/\.[^.]+$/, "");
  const ext = extForType(type);
  // PNG (the model's normal output) maps to the bare /api/tryon/image/{uuid}.
  const url = ext === "png" ? `/api/tryon/image/${uuid}` : `/api/tryon/image/${uuidWithExt}`;

  return { url, key, type, size: bytes.length };
}

/**
 * One preview = one full garment chain (top → bottom → outerwear), each step
 * feeding the previous output back in as the new person image.
 */
async function runPreview({ request, bucket, token, form, hosted, index, deadline, stats }) {
  const seed =
    form.seed === null
      ? undefined
      : Math.min(2147483646, form.seed + index);

  let humanImg = hosted.personUrl;
  let lastPredictionId = "";

  for (const step of hosted.garments) {
    const input = {
      human_img: humanImg,
      garm_img: step.url,
      category: step.category,
      crop: form.crop,
    };
    if (seed !== undefined) input.seed = seed;
    if (step.description) input.garment_des = step.description;

    const run = await runTryon({ token, input, deadline });
    stats.runs += 1;
    stats.runMs += run.ms;
    lastPredictionId = run.predictionId;
    humanImg = run.outputUrl;
  }

  const stored = await storeResult(request, bucket, humanImg);
  return { ...stored, predictionId: lastPredictionId, index };
}

function firstReason(settled) {
  for (const s of settled) {
    if (s.status === "rejected") return s.reason;
  }
  return null;
}

function reasonMessage(reason) {
  if (reason && typeof reason.message === "string" && reason.message) {
    return reason.message.slice(0, 300);
  }
  try {
    return String(reason).slice(0, 300);
  } catch {
    return "unknown error";
  }
}

async function handlePost(context) {
  const env = (context && context.env) || {};
  const request = context.request;
  const started = Date.now();
  const deadline = started + BUDGET_MS;
  const stats = { runs: 0, runMs: 0 };

  const rec = {
    route: "/api/tryon",
    runs: 0,
    previews: 0,
    garments: 0,
    runMs: 0,
    durationMs: 0,
    status: "error",
    error: null,
  };

  let response;

  try {
    const form = await parseTryonForm(request);
    rec.previews = form.previews;
    rec.garments = form.garments.length;

    const token = typeof env.REPLICATE_API_TOKEN === "string" ? env.REPLICATE_API_TOKEN.trim() : "";
    if (!token) {
      throw new TryonError(
        503,
        "missing_replicate_api_token",
        "REPLICATE_API_TOKEN not configured"
      );
    }

    const bucket = requireBucket(env);

    const personUrl = await hostInput(request, bucket, form.person);
    const garments = [];
    for (const g of form.garments) {
      garments.push({
        url: await hostInput(request, bucket, g.file),
        category: g.category,
        description: g.description,
      });
    }
    const hosted = { personUrl, garments };

    // Bound total model runs: previews x garment-chain length <= MAX_RUNS.
    const chains = form.garments.length;
    const previews = Math.max(1, Math.min(form.previews, Math.floor(MAX_RUNS / chains) || 1));
    rec.previews = previews;

    const settled = await Promise.allSettled(
      Array.from({ length: previews }, (_, index) =>
        runPreview({ request, bucket, token, form, hosted, index, deadline, stats })
      )
    );

    const ok = [];
    const errors = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") ok.push(s.value);
      else errors.push(`preview${i + 1}: ${reasonMessage(s.reason)}`);
    });

    if (!ok.length) {
      throw firstReason(settled) || new TryonError(502, "tryon_failed", "Try-on failed.");
    }

    const urls = ok.map((o) => o.url);
    const durationMs = Date.now() - started;
    rec.runs = stats.runs;
    rec.runMs = stats.runMs;
    rec.durationMs = durationMs;
    rec.status = "ok";

    const body = {
      ok: true,
      url: urls[0],
      urls,
      previews,
      requestedPreviews: form.requestedPreviews,
      garments: chains,
      model: MODEL_ID,
      version: MODEL_VERSION,
      seedBase: form.seed,
      crop: form.crop,
      runs: stats.runs,
      runMs: stats.runMs,
      estimatedCostUsd: Number((stats.runs * COST_PER_RUN_USD).toFixed(4)),
      durationMs,
    };
    if (errors.length) body.errors = errors;

    response = { status: 200, body };
  } catch (err) {
    const e = toTryonError(err);
    rec.runs = stats.runs;
    rec.runMs = stats.runMs;
    rec.durationMs = Date.now() - started;
    rec.status = "error";
    rec.error = e.message;
    response = {
      status: e.status,
      body: { error: e.message, code: e.code },
    };
  }

  let ledger = { mode: "console", reason: "not_attempted" };
  try {
    ledger = await logCost(env, rec);
  } catch (err) {
    console.log(
      `[tryon-cost] logger_failed ${((err && err.message) || "unknown").slice(0, 200)}`
    );
  }
  response.body.ledger =
    ledger.mode === "d1" ? "d1" : `console:${ledger.reason || "no_d1_binding_in_pages_env"}`;

  return json(response.body, response.status);
}

export async function onRequestPost(context) {
  // Auth gate: no valid session token → 401, on every non-OPTIONS method.
  if (context.request.method !== "OPTIONS") {
    const __gate = await requireAuth(context.request, context.env);
    if (__gate.response) return __gate.response;
    context.__user = __gate.user;
  }
  try {
    return await handlePost(context);
  } catch (err) {
    // Last-resort guard: still a real error, never a fake image.
    console.log(`[tryon] unexpected_error ${((err && err.message) || String(err)).slice(0, 300)}`);
    return errorResponse(err);
  }
}

export async function onRequestGet(context) {
  // Auth gate: no valid session token → 401, on every non-OPTIONS method.
  if (context.request.method !== "OPTIONS") {
    const __gate = await requireAuth(context.request, context.env);
    if (__gate.response) return __gate.response;
    context.__user = __gate.user;
  }
  return json({
    ok: true,
    endpoint: "/api/tryon",
    method: "POST",
    contentType: "multipart/form-data",
    fields: {
      person: "file, required — full-body photo",
      garment: "file, required — garment photo",
      garment2: "file, optional — bottom, chained after garment",
      garment3: "file, optional — outerwear, chained after garment2",
      previews: "int, optional — default 3, max 6 (1 model run each)",
      seed: "int, optional — base seed, preview i uses seed+i",
      crop: "bool, optional — default true (recommended for non-3:4 photos)",
      category: "upper_body | lower_body | dresses — default upper_body",
      description: "optional garment description passed as garment_des",
    },
    model: MODEL_ID,
    version: MODEL_VERSION,
    costPerRunUsd: COST_PER_RUN_USD,
    requiresEnv: ["REPLICATE_API_TOKEN", "TRYON_BUCKET"],
    response: "{ url, urls[] } — /api/tryon/image/{uuid} streams the stored PNG",
  });
}
