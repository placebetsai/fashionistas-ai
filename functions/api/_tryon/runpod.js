/**
 * RunPod Serverless client for FASHN VTON v1.5.
 *
 * Implements the provider contract documented in ./provider.js:
 *     { id, label, metered, run(input), probe(input), costUsd(env) }
 *
 * Env (all read from the Pages function env — never hardcoded, never logged):
 *     RUNPOD_ENDPOINT_ID        required   e.g. "12ab34cd-…"
 *     RUNPOD_API_KEY            required   SECRET (Pages → Settings → Secrets)
 *     RUNPOD_API_BASE           optional   default https://api.runpod.ai/v2
 *     RUNPOD_TIMEOUT_MS         optional   default 150000, clamped 30s..300s
 *     RUNPOD_COST_PER_RUN_USD   optional   ESTIMATE, default 0.01
 *
 * Endpoint settings this client assumes (see services/runpod/README.md):
 *     GPU tier 24 GB (L4 / A5000 / 3090), flex billing,
 *     min workers 0, max workers 1, idle timeout 5s.
 *
 * Protocol (RunPod v2 REST, server-to-server):
 *     POST {base}/{endpointId}/run            {"input":{…}}  -> {id, status}
 *     GET  {base}/{endpointId}/status/{jobId}               -> {status, output, delayTime, executionTime}
 *     GET  {base}/{endpointId}/health                        -> {healthy: bool}
 *     every request:  authorization: Bearer <RUNPOD_API_KEY>
 *
 * Failure mapping (the route answers exactly this status):
 *     413 input too large          429 RunPod rate limited us
 *     502 upstream broke           503 not configured / auth rejected / no worker
 *     504 queue or run timed out
 *
 * NOTHING here ever puts the API key or a raw upstream body into an error
 * message. Upstream detail is logged server-side (sliced) and replaced with a
 * stable machine code for the caller.
 *
 * TIMING / COLD vs WARM — reported on every call:
 *     ms       wall clock for the whole submit+poll round trip
 *     queueMs  RunPod delayTime — time spent waiting for a worker
 *     execMs   RunPod executionTime — time inside the worker
 *     cold     queueMs >= COLD_START_MS (the worker had to boot)
 * A null queueMs/cold means RunPod did not report timing (unknown, not warm).
 */

import { TryonError, sniffImageType } from "./http.js";

const DEFAULT_API_BASE = "https://api.runpod.ai/v2";
const DEFAULT_TIMEOUT_MS = 150_000;
const MIN_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_POLL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 10_000;
/** Queue wait at or above this = the worker had to cold start. */
const COLD_START_MS = 5_000;
/** ESTIMATE for one ~30s 24GB flex run — override once real invoices exist. */
const DEFAULT_COST_USD = 0.01;
/** Combined decoded input cap: RunPod bodies are JSON, base64 costs 4/3. */
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

export const STEPS_DEFAULT = 20;
export const STEPS_MIN = 10;
export const STEPS_MAX = 50;
export const CATEGORIES = Object.freeze(["tops", "bottoms", "one-pieces"]);
export const PHOTO_TYPES = Object.freeze(["model", "flat-lay"]);

const TERMINAL_FAILED = new Set(["FAILED", "CANCELLED", "ABORTED"]);
const TERMINAL_TIMEOUT = new Set(["TIMED_OUT"]);

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

export function fromBase64(text) {
  const raw = String(text).replace(/^data:[^,]*;base64,/i, "").replace(/\s+/g, "");
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return new Uint8Array(Buffer.from(raw, "base64"));
  }
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ *
 * config + transport
 * ------------------------------------------------------------------ */

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function config(env) {
  const endpointId = str(env && env.RUNPOD_ENDPOINT_ID);
  const apiKey = str(env && env.RUNPOD_API_KEY);
  if (!endpointId || !apiKey) {
    throw new TryonError(
      503,
      "gpu_not_configured",
      "The GPU provider is not configured (RUNPOD_ENDPOINT_ID / RUNPOD_API_KEY are unset)."
    );
  }
  return {
    endpointId,
    apiKey,
    base: str(env.RUNPOD_API_BASE) || DEFAULT_API_BASE,
    timeoutMs: intEnv(env, "RUNPOD_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
    costUsd: costEnv(env),
  };
}

function intEnv(env, key, fallback, min, max) {
  const n = Number(env && env[key]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function costEnv(env) {
  const n = Number(env && env.RUNPOD_COST_PER_RUN_USD);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COST_USD;
}

function headers(cfg) {
  return {
    authorization: `Bearer ${cfg.apiKey}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTimeout(err) {
  return !!err && (err.name === "TimeoutError" || err.name === "AbortError");
}

/** Log upstream detail server-side only — never into a response body. */
function logUpstream(where, detail) {
  const text = typeof detail === "string" ? detail : JSON.stringify(detail || "");
  console.log(`[runpod] ${where} ${text.slice(0, 400)}`);
}

/**
 * Only short, code-shaped strings survive into a client-visible message.
 * Anything else (tracebacks, paths, URLs) is dropped, not sanitized.
 */
function safeDetail(value) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";
  return /^[a-z0-9][a-z0-9 _.:\-]{0,59}$/i.test(s) ? s : "";
}

function mark(err, reachedGpu) {
  err.reachedGpu = reachedGpu;
  return err;
}

/** Map an HTTP status from the RunPod API onto our status + machine code. */
function submitHttpError(status) {
  if (status === 401 || status === 403) {
    return new TryonError(
      503,
      "gpu_auth_rejected",
      "The GPU provider rejected the API key (HTTP " + status + ")."
    );
  }
  if (status === 404) {
    return new TryonError(
      503,
      "gpu_endpoint_not_found",
      "The GPU endpoint was not found (HTTP 404). It is not deployed, or the endpoint id is wrong."
    );
  }
  if (status === 429) {
    return new TryonError(429, "gpu_rate_limited", "The GPU provider is rate limiting us (HTTP 429).");
  }
  if (status >= 500) {
    return new TryonError(503, "gpu_unavailable", `The GPU provider is unavailable (HTTP ${status}).`);
  }
  return new TryonError(502, "gpu_rejected", `The GPU provider refused the job (HTTP ${status}).`);
}

/* ------------------------------------------------------------------ *
 * input validation (fails locally, before we spend queue time)
 * ------------------------------------------------------------------ */

function validateInput(input) {
  const person = input.personImage;
  const garment = input.garmentImage;
  if (!(person instanceof Uint8Array) || !person.length || !(garment instanceof Uint8Array) || !garment.length) {
    throw new TryonError(400, "gpu_missing_image", "personImage and garmentImage are required.");
  }
  if (person.length + garment.length > MAX_INPUT_BYTES) {
    throw new TryonError(
      413,
      "gpu_input_too_large",
      "The combined images are too large for one GPU request (limit 12MB decoded)."
    );
  }
  const category = String(input.category || "");
  if (!CATEGORIES.includes(category)) {
    throw new TryonError(422, "gpu_bad_category", `category must be one of ${CATEGORIES.join(", ")}.`);
  }
  const mode = String(input.mode || "model");
  if (!PHOTO_TYPES.includes(mode)) {
    throw new TryonError(422, "gpu_bad_photo_type", `photo type must be one of ${PHOTO_TYPES.join(", ")}.`);
  }
  const stepsRaw = input.steps === undefined || input.steps === null ? STEPS_DEFAULT : Number(input.steps);
  const steps = Number.isFinite(stepsRaw) ? Math.round(stepsRaw) : NaN;
  if (!Number.isInteger(steps) || steps < STEPS_MIN || steps > STEPS_MAX) {
    throw new TryonError(422, "gpu_bad_steps", `steps must be an integer between ${STEPS_MIN} and ${STEPS_MAX}.`);
  }
  return {
    person: toBase64(person),
    garment: toBase64(garment),
    category,
    photo_type: mode,
    steps,
    seed: Number.isFinite(Number(input.seed)) ? Math.max(0, Math.round(Number(input.seed))) : 42,
    guidance: Number.isFinite(Number(input.guidance)) ? Number(input.guidance) : 1.5,
    segmentation_free: true,
  };
}

/* ------------------------------------------------------------------ *
 * run(): submit -> poll -> PNG
 * ------------------------------------------------------------------ */

async function submit(cfg, payload, fetchImpl) {
  const url = `${cfg.base}/${encodeURIComponent(cfg.endpointId)}/run`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: headers(cfg),
      body: JSON.stringify({ input: payload }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (isTimeout(err)) {
      throw mark(new TryonError(503, "gpu_unreachable", "The GPU provider did not answer while submitting the job."), false);
    }
    logUpstream("submit network error", (err && err.message) || err);
    throw mark(new TryonError(503, "gpu_unreachable", "Could not reach the GPU provider."), false);
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    logUpstream(`submit HTTP ${res.status}`, text);
    throw mark(submitHttpError(res.status), false);
  }

  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    logUpstream("submit unparseable body", text);
    body = null;
  }
  const id = body && typeof body.id === "string" ? body.id : "";
  if (!id) {
    logUpstream("submit returned no job id", text);
    throw mark(new TryonError(502, "gpu_no_job", "The GPU provider did not return a job id."), false);
  }
  return { id, status: String(body.status || "IN_QUEUE") };
}

/**
 * One status poll. Throws only for NON-retryable conditions; transient
 * failures (network blip, 429, 5xx) are reported as `{transient:true}` so the
 * caller keeps polling until the deadline.
 */
async function pollOnce(cfg, jobId, fetchImpl) {
  const url = `${cfg.base}/${encodeURIComponent(cfg.endpointId)}/status/${encodeURIComponent(jobId)}`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: headers(cfg),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    return { transient: true, why: isTimeout(err) ? "timeout" : "network" };
  }

  if (res.status === 429 || res.status >= 500) return { transient: true, why: `http_${res.status}` };
  if (res.status === 401 || res.status === 403) {
    throw mark(new TryonError(503, "gpu_auth_rejected", `The GPU provider rejected the API key (HTTP ${res.status}).`), true);
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    logUpstream(`status HTTP ${res.status}`, text);
    throw mark(new TryonError(502, "gpu_poll_failed", `The GPU job status lookup failed (HTTP ${res.status}).`), true);
  }
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { transient: true, why: "unparseable" };
  }
}

function outputError(output, jobId) {
  const detail = safeDetail(output && (output.error || output.detail || output.message));
  logUpstream(`job ${jobId} returned an error`, output && (output.error || output.detail || output));
  return new TryonError(
    502,
    "gpu_worker_error",
    detail
      ? `The GPU worker reported an error: ${detail}.`
      : "The GPU worker reported an error. See the function logs for the job id."
  );
}

function decodeOutput(output, jobId) {
  if (!output || typeof output !== "object") {
    logUpstream(`job ${jobId} completed without output`, output);
    throw new TryonError(502, "gpu_no_output", "The GPU job finished without an image.");
  }
  if (output.ok === false) throw outputError(output, jobId);
  if (typeof output.image !== "string" || !output.image) {
    logUpstream(`job ${jobId} output has no image`, Object.keys(output).join(","));
    throw new TryonError(502, "gpu_no_output", "The GPU job finished without an image.");
  }

  let bytes;
  try {
    bytes = fromBase64(output.image);
  } catch {
    throw new TryonError(502, "gpu_output_corrupt", "The GPU job returned an undecodable image.");
  }
  if (!bytes.length) throw new TryonError(502, "gpu_output_corrupt", "The GPU job returned an empty image.");
  if (sniffImageType(bytes) !== "image/png") {
    throw new TryonError(
      502,
      "gpu_output_not_image",
      "The GPU job did not return a PNG image."
    );
  }
  return bytes;
}

/**
 * Run one try-on on RunPod Serverless.
 *
 * @param {object} input see PROVIDER_CONTRACT in ./provider.js
 *   plus test/DI knobs: `fetch`, `sleep`, `timeoutMs`, `pollIntervalMs`
 *   (explicit overrides are NOT clamped — only env-derived values are).
 * @returns {Promise<{bytes:Uint8Array,type:string,ms:number,cold:boolean|null,
 *                    queueMs:number|null,costUsd:number,jobId:string}>}
 * @throws {TryonError} 413 / 429 / 502 / 503 / 504
 */
export async function run(input) {
  const env = input.env || {};
  const cfg = config(env);
  const fetchImpl = input.fetch || globalThis.fetch;
  const sleep = input.sleep || defaultSleep;
  const pollMs = Number.isFinite(Number(input.pollIntervalMs))
    ? Math.max(10, Number(input.pollIntervalMs))
    : DEFAULT_POLL_MS;
  const timeoutMs = Number.isFinite(Number(input.timeoutMs))
    ? Math.max(50, Number(input.timeoutMs))
    : cfg.timeoutMs;

  const payload = validateInput(input);
  const started = Date.now();
  const deadline = started + timeoutMs;

  const job = await submit(cfg, payload, fetchImpl); // throws with reachedGpu=false
  const jobId = job.id;
  // From here on a worker MAY be billed for us: every error carries the flag
  // so the ledger can record spend for failures that actually occupied a GPU.
  let lastStatus = job.status;
  let queueMs = null;
  let execMs = null;
  let polls = 0;

  try {
    for (;;) {
      let data;
      try {
        data = await pollOnce(cfg, jobId, fetchImpl);
      } catch (err) {
        throw mark(err, true);
      }

      if (data && data.transient) {
        if (Date.now() >= deadline) break;
        await sleep(pollMs);
        continue;
      }

      polls += 1;
      const status = String((data && data.status) || "").toUpperCase();
      if (status) lastStatus = status;
      if (Number.isFinite(data && data.delayTime)) queueMs = Math.max(0, Math.round(data.delayTime));
      if (Number.isFinite(data && data.executionTime)) execMs = Math.max(0, Math.round(data.executionTime));

      if (status === "COMPLETED") {
        const bytes = decodeOutput(data.output, jobId); // throws (502), reachedGpu
        return {
          bytes,
          type: "image/png",
          ms: Date.now() - started,
          // delayTime is the queue wait: >= COLD_START_MS means the worker
          // had to boot. null = RunPod did not report timing (unknown).
          cold: queueMs === null ? null : queueMs >= COLD_START_MS,
          queueMs,
          execMs,
          costUsd: cfg.costUsd,
          jobId,
          polls,
        };
      }

      if (TERMINAL_FAILED.has(status)) {
        logUpstream(`job ${jobId} ${status}`, data && (data.error || data.output));
        throw mark(
          new TryonError(
            502,
            "gpu_job_failed",
            `The GPU worker reported ${status.toLowerCase()} for job ${jobId}. See the function logs.`
          ),
          true
        );
      }
      if (TERMINAL_TIMEOUT.has(status)) {
        throw mark(
          new TryonError(504, "gpu_timeout", `The GPU worker timed out after ${Math.round(timeoutMs / 1000)}s.`),
          true
        );
      }

      if (Date.now() >= deadline) break;
      await sleep(pollMs);
    }
  } catch (err) {
    if (err && err.reachedGpu === undefined) mark(err, true);
    throw err;
  }

  const waited = Date.now() - started;
  if (lastStatus === "IN_QUEUE" || lastStatus === "") {
    // Still queued at the deadline: no worker ever picked it up — the
    // endpoint sits at min 0 workers and never scaled, or has no capacity.
    throw mark(
      new TryonError(
        503,
        "gpu_busy",
        `No GPU worker picked up the job within ${Math.round(waited / 1000)}s ` +
          "(min 0 workers, max 1). Retry shortly."
      ),
      true
    );
  }
  throw mark(
    new TryonError(
      504,
      "gpu_timeout",
      `The GPU job did not finish within ${Math.round(timeoutMs / 1000)}s (status ${lastStatus || "unknown"}).`
    ),
    true
  );
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
    res = await fetchImpl(`${cfg.base}/${encodeURIComponent(cfg.endpointId)}/health`, {
      method: "GET",
      headers: headers(cfg),
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
  } catch (err) {
    return {
      provider: "runpod",
      ok: false,
      ms: Date.now() - started,
      detail: isTimeout(err) ? "health_timeout" : "unreachable",
    };
  }

  const ms = Date.now() - started;
  if (!res.ok) {
    logUpstream(`health HTTP ${res.status}`, res.status);
    return { provider: "runpod", ok: false, ms, detail: `http_${res.status}` };
  }
  const body = await res.json().catch(() => null);
  const healthy = !(body && (body.healthy === false || body.status === "unhealthy"));
  return { provider: "runpod", ok: healthy, ms, detail: healthy ? "ready" : "unhealthy" };
}

/** ESTIMATED cost of one run (USD). Overridable via RUNPOD_COST_PER_RUN_USD. */
export function costUsd(env) {
  return costEnv(env);
}

/**
 * The registry entry. `metered:true` is what arms MAX_MONTHLY_TRYON_SPEND:
 * a metered provider never gets a free pass just because no row exists yet.
 */
export const runpodProvider = Object.freeze({
  id: "runpod",
  label:
    "RunPod Serverless — FASHN VTON v1.5 on 24GB (L4 / A5000 / 3090), flex billing, " +
    "min 0 / max 1 workers, idle 5s",
  metered: true,
  run,
  probe,
  costUsd,
});

export default runpodProvider;
