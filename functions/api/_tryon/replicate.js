/**
 * Replicate client for IDM-VTON (lane-3).
 *
 * Token comes ONLY from context.env.REPLICATE_API_TOKEN — never hardcoded,
 * never logged. Version is pinned (Replicate "version" field on
 * POST /v1/predictions) so the input schema below cannot drift.
 *
 * Pinned schema (cuuupid/idm-vton @ 0513734a…): required {garm_img, human_img}
 * (URI), optional {garment_des, mask_img, category, seed, steps, crop,
 * force_dc, mask_only}. Note the garment key is `garm_img`, not `garment_img`.
 */

import { TryonError } from "./http.js";

export const MODEL_ID = "cuuupid/idm-vton";
export const MODEL_VERSION =
  "0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";
/** Replicate lists ~$0.023 per IDM-VTON run (A100 80GB). Estimate only. */
export const COST_PER_RUN_USD = 0.023;

const PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";
const POLL_INTERVAL_MS = 1500;
const REQUEST_TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

function upstreamDetail(data) {
  if (!data) return "";
  if (typeof data.detail === "string") return data.detail.slice(0, 300);
  if (Array.isArray(data.detail)) return JSON.stringify(data.detail).slice(0, 300);
  if (data.error) return String(data.error).slice(0, 300);
  if (data.raw) return String(data.raw).slice(0, 300);
  return "";
}

function isTimeout(err) {
  return !!err && (err.name === "TimeoutError" || err.name === "AbortError");
}

export async function createPrediction({ token, input, deadline }) {
  if (Date.now() >= deadline) {
    throw new TryonError(
      504,
      "tryon_timeout",
      "Try-on exceeded the 120s budget before IDM-VTON could start."
    );
  }

  let res;
  try {
    res = await fetch(PREDICTIONS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ version: MODEL_VERSION, input }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (isTimeout(err)) {
      throw new TryonError(
        504,
        "replicate_unreachable",
        "Replicate did not answer within 15s while starting the try-on."
      );
    }
    throw new TryonError(
      502,
      "replicate_unreachable",
      "Could not reach Replicate: " + ((err && err.message) || "network error").slice(0, 200)
    );
  }

  const data = await readJson(res);

  if (!res.ok) {
    const detail = upstreamDetail(data);
    if (res.status === 401 || res.status === 403) {
      throw new TryonError(
        503,
        "replicate_token_rejected",
        `REPLICATE_API_TOKEN was rejected by Replicate (HTTP ${res.status})${
          detail ? ": " + detail : ". Check https://replicate.com/account/api-tokens"
        }`
      );
    }
    if (res.status === 404 || res.status === 422) {
      throw new TryonError(
        502,
        "replicate_prediction_invalid",
        `Replicate refused the IDM-VTON prediction (HTTP ${res.status})${
          detail ? ": " + detail : ""
        }`.trim()
      );
    }
    throw new TryonError(
      502,
      "replicate_create_failed",
      `Replicate create-prediction failed (HTTP ${res.status})${detail ? ": " + detail : ""}`
    );
  }

  if (!data || typeof data.id !== "string" || !data.id) {
    throw new TryonError(
      502,
      "replicate_no_prediction_id",
      "Replicate did not return a prediction id."
    );
  }
  return data;
}

export async function waitForPrediction({ token, id, deadline }) {
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    let res = null;
    let transient = false;

    try {
      res = await fetch(`${PREDICTIONS_URL}/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      if (isTimeout(err) && Date.now() >= deadline) break;
      transient = true;
    }

    if (transient || (res && (res.status === 429 || res.status >= 500))) {
      // Rate limit / upstream hiccup: keep polling until the budget runs out.
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const data = await readJson(res);

    if (!res.ok) {
      const detail = upstreamDetail(data);
      throw new TryonError(
        res.status === 401 || res.status === 403 ? 503 : 502,
        "replicate_poll_failed",
        `Replicate prediction poll failed (HTTP ${res.status})${detail ? ": " + detail : ""}`
      );
    }

    const status = data && data.status;
    if (status === "succeeded") return data;
    if (status === "failed" || status === "canceled") {
      throw new TryonError(
        502,
        "tryon_model_failed",
        `IDM-VTON ${status}: ${((data && data.error) || "no error detail").toString().slice(0, 300)}`
      );
    }

    await sleep(POLL_INTERVAL_MS);
    if (attempt > 400) break;
  }

  throw new TryonError(
    504,
    "tryon_timeout",
    "Try-on exceeded the 120s budget while waiting for IDM-VTON."
  );
}

/**
 * Run one IDM-VTON prediction: create → poll → return the output image URL.
 * @returns {Promise<{outputUrl: string, predictionId: string, ms: number}>}
 */
export async function runTryon({ token, input, deadline }) {
  const started = Date.now();
  const created = await createPrediction({ token, input, deadline });
  const done = await waitForPrediction({ token, id: created.id, deadline });

  const output = Array.isArray(done.output) ? done.output[0] : done.output;
  if (typeof output !== "string" || !output) {
    throw new TryonError(
      502,
      "tryon_no_output",
      "IDM-VTON finished without returning an image URL."
    );
  }

  return { outputUrl: output, predictionId: created.id, ms: Date.now() - started };
}
