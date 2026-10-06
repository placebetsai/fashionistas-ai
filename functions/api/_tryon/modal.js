/**
 * Modal client for FASHN VTON v1.5 (services/fashn-modal/app.py).
 *
 * Implements the provider contract documented in ./provider.js:
 *     { id, label, metered, run(input), probe(input), costUsd(env) }
 *
 * WHY THIS PROVIDER
 *   RunPod needs a paid account; Modal's Starter plan carries $30/month of
 *   free compute and the FASHN service in this repo already deploys to it
 *   (`modal deploy services/fashn-modal/app.py`). Same weights, same handler,
 *   zero spend while under the free credit.
 *
 * Env (all read from the Pages function env — never hardcoded, never logged):
 *     MODAL_ENDPOINT           required   the deployed HTTPS URL (*.modal.run)
 *     MODAL_TOKEN              optional   SECRET, sent as bearer if the
 *                                         endpoint is locked down
 *     MODAL_TIMEOUT_MS         optional   default 180000, clamped 30s..300s
 *     MODAL_COST_PER_RUN_USD   optional   ESTIMATE, default 0.002
 *
 * Protocol (HTTPS, server-to-server):
 *     POST {MODAL_ENDPOINT}          JSON {person,garment,category,photo_type,
 *                                          steps,guidance?,seed?}
 *                                    -> 200 image/webp (RAW BYTES)
 *                                       headers: x-fashn-ms, x-fashn-seed
 *     GET  {MODAL_ENDPOINT}/healthz  -> 200 {"ok":true,"model":…}
 *
 * The service answers a FAILED run as JSON {ok:false,error,detail} — the raw
 * body is therefore re-sniffed: PNG/WebP magic bytes mean success, anything
 * else is decoded as an error envelope. Never trust a 200 by status alone.
 *
 * Failure mapping (the route answers exactly this status):
 *     413 input too large           429 upstream rate limited us
 *     502 upstream broke / bad body 503 not configured / auth rejected / cold
 *     504 request timed out
 *
 * NOTHING here ever puts MODAL_TOKEN or a raw upstream body into an error
 * message. Upstream detail is logged server-side (sliced) and replaced with a
 * stable machine code for the caller.
 */

import { TryonError, sniffImageType } from "./http.js";

const DEFAULT_TIMEOUT_MS = 180_000;
const MIN_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const REQUEST_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 15_000;
/**
 * Modal scale-to-zero (min_containers=0, scaledown_window=60) means the first
 * call after an idle period boots the container and pulls the weights layer.
 * Anything slower than this almost certainly paid a cold start.
 */
const COLD_START_MS = 5_000;
/** ESTIMATE: L4 @ $0.000222/s * ~9s of work + boot amortised. */
const DEFAULT_COST_USD = 0.002;
/** Combined decoded input cap — the service enforces 12 MB PER image. */
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

export const STEPS_DEFAULT = 20;
export const STEPS_MIN = 10;
export const STEPS_MAX = 50;
export const CATEGORIES = Object.freeze(["tops", "bottoms", "one-pieces"]);
export const PHOTO_TYPES = Object.freeze(["model", "flat-lay"]);

/* ------------------------------------------------------------------ *
 * base64 — Workers has btoa but no Buffer; Buffer is fine in node tests.
 * ------------------------------------------------------------------ */

export function toBase64(bytes) {
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/* ------------------------------------------------------------------ *
 * config
 * ------------------------------------------------------------------ */

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function intEnv(env, key, fallback, min, max) {
  const n = Number(env && env[key]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function costEnv(env) {
  const n = Number(env && env.MODAL_COST_PER_RUN_USD);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_COST_USD;
  // Never report more than the spend ceiling, or a cost guard could refuse a
  // run the budget would have allowed.
  const cap = Number(env && env.MAX_MONTHLY_TRYON_SPEND);
  return Number.isFinite(cap) && cap > 0 ? Math.min(n, cap) : n;
}

/** Fails closed: an unset endpoint is 503, never a silent retry against "". */
function config(env) {
  const endpoint = str(env && env.MODAL_ENDPOINT).replace(/\/+$/, "");
  if (!endpoint) {
    throw new TryonError(
      503,
      "gpu_not_configured",
      "The GPU provider is not configured (MODAL_ENDPOINT is unset)."
    );
  }
  if (!/^https:\/\//i.test(endpoint)) {
    throw new TryonError(503, "gpu_not_configured", "MODAL_ENDPOINT must be an https:// URL.");
  }
  return {
    endpoint,
    token: str(env.MODAL_TOKEN),
    timeoutMs: intEnv(env, "MODAL_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
    costUsd: costEnv(env),
  };
}

function headers(cfg, extra = {}) {
  const h = { "content-type": "application/json", accept: "image/*, application/json", ...extra };
  // Only attach the bearer when one exists — an empty Authorization header
  // would make some gateways reject a request that was otherwise fine.
  if (cfg.token) h.authorization = `Bearer ${cfg.token}`;
  return h;
}

function isTimeout(err) {
  return (
    err &&
    (err.name === "TimeoutError" ||
      err.name === "AbortError" ||
      /timeout|timed out|aborted/i.test(String(err.message || "")))
  );
}

/** Never echo an upstream body or the endpoint's token into user-facing text. */
function logUpstream(msg, status) {
  try {
    console.error(`[tryon/modal] ${String(msg).slice(0, 200)} (status ${status})`);
  } catch {
    /* logging must never be the reason a run fails */
  }
}

const isImageType = (t) => typeof t === "string" && /^image\//i.test(t);

/* ------------------------------------------------------------------ *
 * run()
 * ------------------------------------------------------------------ */

function validateInput(input) {
  const person = input.personImage;
  const garment = input.garmentImage;
  if (!(person instanceof Uint8Array) || !person.length) {
    throw new TryonError(400, "missing_person", "A person photo is required.");
  }
  if (!(garment instanceof Uint8Array) || !garment.length) {
    throw new TryonError(400, "missing_garment", "A garment photo is required.");
  }
  if (person.length + garment.length > MAX_INPUT_BYTES) {
    throw new TryonError(413, "input_too_large", "The combined photos exceed the 12 MB limit.");
  }
  const category = String(input.category || "");
  if (!CATEGORIES.includes(category)) {
    throw new TryonError(422, "bad_category", `category must be one of ${CATEGORIES.join(", ")}.`);
  }
  const mode = String(input.mode || "model");
  if (!PHOTO_TYPES.includes(mode)) {
    throw new TryonError(422, "bad_photo_type", `photo type must be one of ${PHOTO_TYPES.join(", ")}.`);
  }
  const stepsRaw = input.steps;
  const steps =
    stepsRaw === undefined || stepsRaw === null ? STEPS_DEFAULT : Number(stepsRaw);
  if (!Number.isInteger(steps) || steps < STEPS_MIN || steps > STEPS_MAX) {
    throw new TryonError(422, "bad_steps", `steps must be an integer from ${STEPS_MIN} to ${STEPS_MAX}.`);
  }
  return { person, garment, category, mode, steps, seed: input.seed, guidance: input.guidance };
}

/**
 * One try-on.
 *
 * @returns {Promise<{bytes:Uint8Array,type:string,ms:number,cold:boolean|null,
 *                    queueMs:number|null,costUsd:number,jobId:string|null}>}
 */
export async function run(input = {}) {
  const cfg = config(input.env || {});
  const fetchImpl = input.fetch || globalThis.fetch;
  const v = validateInput(input);

  const body = {
    person: toBase64(v.person),
    garment: toBase64(v.garment),
    category: v.category,
    photo_type: v.mode,
    steps: v.steps,
  };
  if (v.guidance !== undefined && v.guidance !== null && Number.isFinite(Number(v.guidance))) {
    body.guidance = Number(v.guidance);
  }
  if (v.seed !== undefined && v.seed !== null && Number.isFinite(Number(v.seed))) {
    body.seed = Number(v.seed);
  }

  const started = Date.now();
  let res;
  try {
    res = await fetchImpl(cfg.endpoint, {
      method: "POST",
      headers: headers(cfg),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (err) {
    const ms = Date.now() - started;
    if (isTimeout(err)) {
      throw new TryonError(
        504,
        "gpu_timeout",
        `The GPU did not answer within ${Math.round(cfg.timeoutMs / 1000)}s. Retry shortly.`
      );
    }
    logUpstream(`fetch failed: ${err && err.message}`, 0);
    throw new TryonError(503, "gpu_unreachable", "The GPU service could not be reached.");
  }

  const ms = Date.now() - started;
  const cold = ms >= COLD_START_MS;

  if (!res.ok) {
    logUpstream(`HTTP ${res.status}`, res.status);
    if (res.status === 413) throw new TryonError(413, "input_too_large", "The photos exceed the size limit.");
    if (res.status === 429) throw new TryonError(429, "gpu_rate_limited", "The GPU service is rate limiting us. Retry shortly.");
    if (res.status === 401 || res.status === 403) {
      throw new TryonError(503, "gpu_auth_failed", "The GPU service rejected our credentials.");
    }
    if (res.status >= 500) {
      throw new TryonError(502, "gpu_upstream", "The GPU service failed to render. Retry shortly.");
    }
    throw new TryonError(502, "gpu_upstream", "The GPU service rejected the request.");
  }

  const raw = new Uint8Array(await res.arrayBuffer());
  if (!raw.length) {
    throw new TryonError(502, "gpu_empty_result", "The GPU returned no image.");
  }

  // A 200 with a JSON body is a FAILED run dressed as a success — the service
  // answers errors as {ok:false,error,detail}. Sniff, never trust the status.
  const sniffed = sniffImageType(raw);
  if (!isImageType(sniffed)) {
    let detail = "";
    try {
      detail = JSON.parse(new TextDecoder().decode(raw)).error || "";
    } catch {
      /* not JSON either — fall through to the generic code */
    }
    logUpstream(`non-image 200 body: ${String(detail).slice(0, 120)}`, 200);
    if (/quota/i.test(detail)) {
      throw new TryonError(429, "tryon_quota_exhausted", "The GPU quota is exhausted. Try again later.");
    }
    if (/busy/i.test(detail)) {
      throw new TryonError(503, "gpu_busy", "The GPU is busy with another render. Retry shortly.");
    }
    if (/timed out|timeout/i.test(detail)) {
      throw new TryonError(504, "gpu_timeout", "The render timed out. Retry shortly.");
    }
    throw new TryonError(502, "gpu_bad_body", "The GPU did not return an image.");
  }

  const reported = Number(res.headers.get("x-fashn-ms"));
  return {
    bytes: raw,
    type: sniffed,
    ms: Number.isFinite(reported) && reported > 0 ? Math.round(reported) : ms,
    cold,
    // Modal does not report queue time separately; null means "unknown",
    // which the contract distinguishes from a measured warm run.
    queueMs: null,
    costUsd: cfg.costUsd,
    jobId: res.headers.get("x-fashn-seed") || null,
  };
}

/* ------------------------------------------------------------------ *
 * probe(): health/cost probe — the route exposes this for operators.
 * ------------------------------------------------------------------ */

export async function probe(input = {}) {
  const env = input.env || {};
  const cfg = config(env);
  const fetchImpl = input.fetch || globalThis.fetch;
  const started = Date.now();

  let res;
  try {
    res = await fetchImpl(`${cfg.endpoint}/healthz`, {
      method: "GET",
      headers: headers(cfg),
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
  } catch (err) {
    return {
      provider: "modal",
      ok: false,
      ms: Date.now() - started,
      detail: isTimeout(err) ? "health_timeout" : "unreachable",
    };
  }

  const ms = Date.now() - started;
  if (!res.ok) {
    logUpstream(`health HTTP ${res.status}`, res.status);
    return { provider: "modal", ok: false, ms, detail: `http_${res.status}` };
  }
  const body = await res.json().catch(() => null);
  const healthy = !(body && body.ok === false);
  return { provider: "modal", ok: healthy, ms, detail: healthy ? "ready" : "unhealthy" };
}

/** ESTIMATED cost of one run (USD). Overridable via MODAL_COST_PER_RUN_USD. */
export function costUsd(env) {
  return costEnv(env || {});
}

/**
 * The registry entry. `metered:true` is what arms MAX_MONTHLY_TRYON_SPEND:
 * a metered provider never gets a free pass just because no row exists yet.
 */
export const modalProvider = Object.freeze({
  id: "modal",
  label:
    "Modal Starter — FASHN VTON v1.5 on L4, scale to zero " +
    "(min_containers 0, max 2, idle 60s); $30/mo free credit covers the first runs",
  metered: true,
  run,
  probe,
  costUsd,
});

export default modalProvider;
