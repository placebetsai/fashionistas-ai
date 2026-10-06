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
 *     GPU_PROVIDER=modal       <- implemented, this repo (free $30/mo credit)
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
import { modalProvider } from "./modal.js";

/**
 * Bump when the cache-key recipe changes — that is, when the SAME four inputs
 * would now produce a DIFFERENT canonical image.
 *
 * v2 (2026-10-05): the render moved off the Gradio Space to RunPod and the
 * product default is now steps=20 instead of 30. A v1 key therefore points at a
 * 30-step Space render, which is not the image this route promises today, so
 * every v1 cache entry is deliberately orphaned rather than served.
 */
export const CACHE_VERSION = "fashn-vton-1.5|runpod|steps20|v2";

/**
 * THE REGISTRY — adding a provider is: 1 import + 1 line here.
 * Nothing else in the repo branches on provider names except this map.
 *
 * Null prototype on purpose. GPU_PROVIDER is attacker-uncontrolled but
 * operator-controlled, and a normal object literal inherits `constructor`,
 * `toString`, `__proto__`… so `REGISTRY["constructor"]` returns Object and the
 * lookup below would resolve a non-provider instead of failing closed.
 * Object.create(null) makes every lookup an own-property lookup.
 */
const REGISTRY = Object.freeze(
  Object.assign(Object.create(null), {
    modal: modalProvider, // free $30/mo credit — the default we deploy with
    runpod: runpodProvider,
    // vast:    vastProvider,     // functions/api/_tryon/vast.js
    // salad:   saladProvider,    // functions/api/_tryon/salad.js
    // selfhosted: selfHostedProvider,
  })
);

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

/**
 * The env value is NEVER reflected into a response body or an error message.
 *
 * GPU_PROVIDER is an operator-set string, but an operator can paste anything
 * into it — including a credential, which would then be readable by whoever
 * triggers a try-on. There is no value worth the risk: the supported set is a
 * compile-time constant, so the message can always name that instead. Both
 * messages below are fixed strings; the configured value appears nowhere.
 */
const NOT_SET = "gpu_provider_not_configured";
const NOT_KNOWN = "gpu_provider_unknown";

/** Normalized, lower-cased GPU_PROVIDER. "" when unset. Never throws. */
export function providerName(env) {
  const raw = env && env.GPU_PROVIDER;
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toLowerCase();
}

/**
 * Resolve GPU_PROVIDER to a provider module.
 *
 * FAILS CLOSED, both ways:
 *   unset            -> TryonError 503 gpu_provider_not_configured
 *   set but unknown  -> TryonError 503 gpu_provider_unknown
 *
 * There is no fallback provider, no "default to runpod", and no degraded local
 * render: an unconfigured deployment must say so rather than quietly produce a
 * different (and cheaper, worse) image than the button promises.
 *
 * Neither message contains the configured value — see NOT_SET above.
 */
export function resolveProvider(env) {
  const name = providerName(env);
  const supported = `Supported: ${SUPPORTED_PROVIDERS.join(", ")}.`;
  if (!name) {
    throw new TryonError(
      503,
      NOT_SET,
      `GPU_PROVIDER is not set, so photoreal try-on is disabled. ${supported}`
    );
  }
  // Own-property lookup only (null-proto registry), so "constructor" and
  // "__proto__" are unknown names, not inherited objects.
  if (!Object.prototype.hasOwnProperty.call(REGISTRY, name)) {
    throw new TryonError(503, NOT_KNOWN, `GPU_PROVIDER is not a supported try-on provider. ${supported}`);
  }
  return REGISTRY[name];
}

/**
 * Every registry entry must implement the whole contract before it is used.
 * `id` is checked against the registry key so a module cannot answer under a
 * name the route never asked for.
 */
function assertContract(name, provider) {
  for (const key of PROVIDER_CONTRACT) {
    if (provider[key] === undefined || provider[key] === null) {
      throw new TryonError(
        503,
        "gpu_provider_misconfigured",
        `Provider "${name}" does not implement "${key}".`
      );
    }
  }
  if (typeof provider.run !== "function" || typeof provider.probe !== "function") {
    throw new TryonError(503, "gpu_provider_misconfigured", `Provider "${name}" run/probe must be functions.`);
  }
  if (provider.id !== name) {
    throw new TryonError(
      503,
      "gpu_provider_misconfigured",
      `Provider "${name}" reports id "${String(provider.id).slice(0, 24)}".`
    );
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
  assertContract(provider.id, provider);

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
  assertContract(provider.id, provider);
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
 *   - order-independent: the field RECORD is built here from named fields and
 *     serialized through sorted keys, so the hash cannot depend on the order a
 *     caller happened to list them in. It is a fixed schema, not a merge of
 *     caller-supplied keys, so a caller cannot inject or omit a field.
 *   - sensitive: changing ANY one of the 4 inputs changes the hash
 *   - unambiguous: fields are length-prefixed, so no combination of
 *     category/mode text can imitate a different split of the same characters
 *
 * Deliberately NOT in the key: steps, seed, guidance. The cache stores the
 * canonical render of "this person + this garment + this category + this
 * photo type"; a different sampler setting must not spend GPU money to
 * re-derive a result we already have. Changing the recipe bumps
 * CACHE_VERSION instead.
 * ------------------------------------------------------------------ */

/**
 * Uint8Array|string -> 64 lowercase hex chars.
 *
 * Works on Workers (WebCrypto) and on Node >= 18 (globalThis.crypto), which is
 * why the tests can call this with no shim and no dependency.
 */
export async function sha256Hex(value) {
  const c = globalThis.crypto;
  if (!c || !c.subtle || typeof c.subtle.digest !== "function") {
    throw new TryonError(500, "no_sha256", "This runtime has no SHA-256 (WebCrypto) available.");
  }
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  if (!(bytes instanceof Uint8Array) || !bytes.length) {
    throw new TryonError(400, "cache_key_empty", "cacheKey cannot hash an empty value.");
  }
  const digest = await c.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function requireBytes(value, field) {
  if (!(value instanceof Uint8Array) || value.length === 0) {
    throw new TryonError(400, `cache_key_${field}`, `cacheKey requires ${field} image bytes.`);
  }
}

/**
 * Canonical, unambiguous serialization of a flat string record.
 *
 * `name.length:value` per field, joined with "\n". The length prefix is what
 * makes it injective: without it, {category:"a\nmode:b", mode:""} and
 * {category:"a", mode:"b"} would produce the same bytes and therefore the same
 * cache key for two different renders.
 */
function canonicalRecord(fields) {
  return Object.keys(fields)
    .sort()
    .map((k) => {
      const v = String(fields[k]);
      return `${k.length}:${k}=${v.length}:${v}`;
    })
    .join("\n");
}

/**
 * @returns {Promise<string>} 64-char lowercase hex.
 *
 * The four inputs are read BY NAME from the argument, so `cacheKey(a, b)` and
 * `cacheKey({garment:b, mode:m, category:c, person:a})` are the same call.
 */
export async function cacheKey({ person, garment, category, mode } = {}) {
  requireBytes(person, "person");
  requireBytes(garment, "garment");
  const fields = {
    version: CACHE_VERSION,
    category: String(category === undefined || category === null ? "" : category),
    mode: String(mode === undefined || mode === null ? "" : mode),
    person: await sha256Hex(person),
    garment: await sha256Hex(garment),
  };
  return sha256Hex(canonicalRecord(fields));
}

/** Exported for the tests: the exact bytes the cache key hashes. */
export async function cacheKeySource({ person, garment, category, mode } = {}) {
  requireBytes(person, "person");
  requireBytes(garment, "garment");
  return canonicalRecord({
    version: CACHE_VERSION,
    category: String(category === undefined || category === null ? "" : category),
    mode: String(mode === undefined || mode === null ? "" : mode),
    person: await sha256Hex(person),
    garment: await sha256Hex(garment),
  });
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
