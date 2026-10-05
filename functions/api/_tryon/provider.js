/**
 * GPU provider interface for photoreal try-on (POST /api/tryon/hd).
 *
 * WHY THIS FILE EXISTS
 * The try-on backend used to be welded to one transport (a Gradio/SSE call
 * against a public HuggingFace Space) baked straight into the route. That
 * Space is dead for us — anonymous ZeroGPU quota answers
 * `tryon_quota_exhausted` — so the transport is now behind THIS interface and
 * the route only knows `GPU_PROVIDER`.
 *
 * SWITCHING PROVIDERS IS A CONFIG CHANGE
 *
 *     GPU_PROVIDER=runpod      <- implemented, this repo
 *     GPU_PROVIDER=vast        <- one new file (_tryon/vast.js) + one line below
 *     GPU_PROVIDER=salad       <- ditto
 *     GPU_PROVIDER=selfhosted  <- ditto
 *
 * Every provider module must export the same shape (see PROVIDER_CONTRACT):
 *
 *     export const xProvider = {
 *       id: "x",                      // registry key, [a-z0-9_-]+
 *       label: "...",                 // human description, no secrets
 *       metered: true|false,          // does a run cost money?
 *       run(input)   -> { bytes, type, ms, cold, queueMs, costUsd, jobId },
 *       probe(input) -> { provider, ok, ms, detail },
 *       costUsd(env) -> number,       // ESTIMATED USD for one run
 *     };
 *
 * `run(input)` receives:
 *     personImage  Uint8Array   person photo bytes
 *     garmentImage Uint8Array   garment photo bytes
 *     category     string       "tops" | "bottoms" | "one-pieces" (FASHN vocab)
 *     mode         string       "model" | "flat-lay"
 *     steps        number       10..50
 *     seed         number|undefined
 *     guidance     number|undefined
 *     env          object       Pages function env (bindings + vars)
 *     fetch        function     optional fetch override (tests / DI)
 *
 * Failure contract: throw TryonError (from ./http.js) with the exact HTTP
 * status the route should answer — 429 rate limited, 502 upstream broke,
 * 503 not configured / no capacity, 504 timed out. Messages must never
 * contain an API key, a raw upstream body, or a filesystem path.
 *
 * This module has no side effects and performs no I/O at import time, so it
 * is safe to import from node:test.
 */

import { TryonError } from "./http.js";
import { runpodProvider } from "./runpod.js";

/** Bump when the cache-key recipe changes (invalidates every cached render). */
export const CACHE_VERSION = "fashn-vton-1.5|v1";

/**
 * THE REGISTRY — adding a provider is: 1 import + 1 line here.
 * Nothing else in the repo branches on provider names except this map.
 */
const REGISTRY = Object.freeze({
  runpod: runpodProvider,
  // vast:    vastProvider,     // functions/api/_tryon/vast.js
  // salad:   saladProvider,    // functions/api/_tryon/salad.js
  // selfhosted: selfHostedProvider,
});

/** Providers a config value may legitimately name, in preference order. */
export const SUPPORTED_PROVIDERS = Object.freeze(Object.keys(REGISTRY));

/** The shape every registry value must satisfy. Used by the tests. */
export const PROVIDER_CONTRACT = Object.freeze(["id", "label", "metered", "run", "probe", "costUsd"]);

/**
 * What a successful `run()` must hand back. `type` is the sniffed MIME of
 * `bytes`; the contract says PNG, the route still re-sniffs before storing.
 */
export const RUN_RESULT_CONTRACT = Object.freeze([
  "bytes",
  "type",
  "ms",
  "cold",
  "queueMs",
  "costUsd",
  "jobId",
]);

// A provider name comes straight from an env var. Echoing an arbitrary env
// value back into an HTTP response is how secrets leak, so anything that is
// not a plausible provider id is redacted instead of reflected.
const SAFE_NAME = /^[a-z0-9_-]{1,24}$/;

function displayName(name) {
  return SAFE_NAME.test(name) ? name : "«redacted»";
}

/** Normalized, lower-cased GPU_PROVIDER. "" when unset. Never throws. */
export function providerName(env) {
  const raw = env && env.GPU_PROVIDER;
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toLowerCase();
}

/**
 * Resolve GPU_PROVIDER to a provider module.
 * FAILS CLOSED: unset -> 503, unknown -> 503. Never leaks the raw value.
 */
export function resolveProvider(env) {
  const name = providerName(env);
  if (!name) {
    throw new TryonError(
      503,
      "gpu_provider_not_configured",
      "GPU_PROVIDER is not set, so photoreal try-on is disabled. Set it to one of: " +
        SUPPORTED_PROVIDERS.join(", ") +
        "."
    );
  }
  const provider = REGISTRY[name];
  if (!provider) {
    throw new TryonError(
      503,
      "gpu_provider_unknown",
      `GPU_PROVIDER "${displayName(name)}" is not a supported try-on provider. ` +
        `Supported: ${SUPPORTED_PROVIDERS.join(", ")}.`
    );
  }
  return provider;
}

function assertContract(provider) {
  for (const key of PROVIDER_CONTRACT) {
    if (provider[key] === undefined || provider[key] === null) {
      throw new TryonError(
        503,
        "gpu_provider_misconfigured",
        `Provider "${displayName(provider.id)}" does not implement "${key}".`
      );
    }
  }
}

/**
 * Run one try-on on the configured provider.
 * Normalizes every provider's result to RUN_RESULT_CONTRACT so the route can
 * treat "the GPU said no" identically no matter who is behind it.
 *
 * @returns {Promise<{provider:string,bytes:Uint8Array,type:string,ms:number,
 *                    cold:boolean|null,queueMs:number|null,costUsd:number,
 *                    jobId:string|null}>}
 */
export async function runProvider(env, input) {
  const provider = resolveProvider(env);
  assertContract(provider);

  const out = await provider.run({ ...input, env });

  if (!out || !out.bytes || !out.bytes.length) {
    throw new TryonError(
      502,
      "gpu_empty_result",
      `Provider "${provider.id}" returned no image.`
    );
  }
  const bytes = out.bytes instanceof Uint8Array ? out.bytes : new Uint8Array(out.bytes);
  const type = typeof out.type === "string" && out.type ? out.type : "image/png";

  return {
    provider: provider.id,
    bytes,
    type,
    ms: Number.isFinite(Number(out.ms)) ? Math.max(0, Math.round(Number(out.ms))) : 0,
    cold: typeof out.cold === "boolean" ? out.cold : null,
    queueMs: Number.isFinite(Number(out.queueMs)) ? Math.max(0, Math.round(Number(out.queueMs))) : null,
    costUsd: Number.isFinite(Number(out.costUsd)) ? Math.max(0, Number(out.costUsd)) : provider.costUsd(env),
    jobId: typeof out.jobId === "string" && out.jobId ? out.jobId : null,
  };
}

/** Health/cost probe for the configured provider. Never throws for 4xx/5xx. */
export async function probeProvider(env, input = {}) {
  const provider = resolveProvider(env);
  assertContract(provider);
  try {
    const out = await provider.probe({ ...input, env });
    return {
      provider: provider.id,
      ok: !!(out && out.ok),
      ms: Number.isFinite(Number(out && out.ms)) ? Math.round(Number(out.ms)) : 0,
      detail: String((out && out.detail) || "").slice(0, 120),
    };
  } catch (err) {
    if (err instanceof TryonError) throw err;
    return { provider: provider.id, ok: false, ms: 0, detail: "probe_failed" };
  }
}

/** ESTIMATED USD the configured provider charges for one run. Never throws. */
export function providerCostUsd(env) {
  try {
    const provider = resolveProvider(env);
    const n = Number(provider.costUsd(env));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ *
 * Cache key — "have we already rendered this exact request?"
 *
 * SHA-256 over a canonical, KEY-SORTED record of exactly four inputs:
 *
 *     version | category | mode | person | garment
 *
 * Properties the tests assert:
 *   - stable:   same 4 inputs -> same 64-char hex, always
 *   - order-independent: the record is serialized with sorted keys, so the
 *     hash does not depend on the order the caller lists the fields
 *   - sensitive: changing ANY one of the 4 inputs changes the hash
 *
 * Deliberately NOT in the key: steps, seed, guidance. The cache stores the
 * canonical render of "this person + this garment + this category + this
 * photo type"; a different sampler setting must not spend GPU money to
 * re-derive a result we already have. Changing the recipe bumps
 * CACHE_VERSION instead.
 * ------------------------------------------------------------------ */

/** Uint8Array|string -> 64 lowercase hex chars. */
export async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function requireBytes(value, field) {
  if (!(value instanceof Uint8Array) || value.length === 0) {
    throw new TryonError(400, `cache_key_${field}`, `cacheKey requires ${field} image bytes.`);
  }
}

/** @returns {Promise<string>} 64-char lowercase hex. */
export async function cacheKey({ person, garment, category, mode }) {
  requireBytes(person, "person");
  requireBytes(garment, "garment");
  const fields = {
    version: CACHE_VERSION,
    category: String(category === undefined || category === null ? "" : category),
    mode: String(mode === undefined || mode === null ? "" : mode),
    person: await sha256Hex(person),
    garment: await sha256Hex(garment),
  };
  // Sorted keys => the same four inputs hash identically regardless of the
  // order they were passed in.
  const canonical = Object.keys(fields)
    .sort()
    .map((k) => `${k}:${fields[k]}`)
    .join("\n");
  return sha256Hex(canonical);
}

/**
 * R2 object key for a cache hash — and, deliberately, a key the existing
 * /api/tryon/image/{uuid} route already serves (32 hex chars + .png), so a
 * cache hit needs no second copy and no new route.
 *
 * Only PNG results are ever written under this key (see route), which is why
 * the extension is hardcoded.
 */
export function cacheObjectKey(hash) {
  const h = String(hash || "");
  if (!/^[0-9a-f]{64}$/.test(h)) {
    throw new TryonError(500, "cache_key_invalid", "Cache key is not a SHA-256 hex digest.");
  }
  return `tryon/${h.slice(0, 32)}.png`;
}
