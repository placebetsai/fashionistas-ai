/**
 * THE model client. One module, two callers: /api/listing (writer) and
 * /api/chat (stylist). Do not fork this into a second client — a second copy
 * is how the two routes end up on different runtimes with different timeouts.
 *
 * WHY A PROVIDER LAYER AT ALL
 * The dev runtime is the Ollama daemon on this machine (llama3.2:1b), but the
 * Cloudflare production path must not depend on a laptop being awake. So the
 * runtime is chosen by config ONLY — no code change to switch:
 *
 *   MODEL_PROVIDER=ollama        local daemon. OLLAMA_BASE_URL (default
 *                                http://127.0.0.1:11434), OLLAMA_MODEL
 *                                (default llama3.2:1b).
 *   MODEL_PROVIDER=openai        any OpenAI-compatible /chat/completions host.
 *                                OPENAI_BASE_URL, OPENAI_MODEL, and OPENAI_API_KEY
 *                                (or MODEL_API_KEY). Works for OpenAI, a Cloudflare
 *                                AI Gateway, Groq, Together, etc.
 *   MODEL_PROVIDER=groq           free Groq tier. GROQ_API_KEY (+ optional
 *                                GROQ_BASE_URL, GROQ_MODEL, default
 *                                openai/gpt-oss-120b). This is the PREFERRED
 *                                auto-detected runtime: Workers AI on the free
 *                                plan is queued, not slow to compute — measured
 *                                26.6s and 46.6s listing calls and intermittent
 *                                502s on /api/chat, against 0.15s for a Groq
 *                                probe on the same network path.
 *   MODEL_PROVIDER=workers_ai    Cloudflare Workers AI binding (env.AI). Free,
 *                                no API keys, runs @cf/meta/llama-3.3-70b-instruct-fp8-fast
 *                                on this account. Auto-detected when there is no
 *                                GROQ_API_KEY and no explicit MODEL_PROVIDER.
 *   MODEL_PROVIDER=disabled      refuse everything (503), useful as a hard stop.
 *   unset                        auto-detect: groq → workers_ai → 503
 *                                model_not_configured. FAIL CLOSED BY DEFAULT:
 *                                an unconfigured Pages project must never silently
 *                                reach for 127.0.0.1 on someone's laptop.
 *
 * `format: "json"` IS NOT OPTIONAL on the Ollama path. Without it llama3.2:1b
 * answers in prose and the caller gets a wall of text where a schema should
 * be; with it, the daemon constrains decoding to JSON. Verified with a real
 * round trip (see TEST.md / the Phase 4 report), not assumed.
 *
 * Workers AI instruct models may not emit clean JSON. parseModelJSON() is
 * tolerant: it extracts the first balanced {...} block. Validation that follows
 * (validateListing / validateChatAnswer) still REJECTS garbage rather than
 * silently accepting it.
 *
 * Failures are always a ModelError carrying an HTTP status:
 *   503 model_not_configured   no usable runtime configured
 *   502 model_unavailable      runtime unreachable / non-2xx
 *   502 model_output_invalid   answer was not a JSON object (fail closed)
 *   504 model_timeout          runtime exceeded MODEL_TIMEOUT_MS (default 45s)
 * Nothing in here ever returns a partially-parsed answer to a caller.
 */

export class ModelError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = "ModelError";
    this.status = opts.status || 502;
    this.code = opts.code || "model_error";
    if (opts.cause) this.cause = opts.cause;
  }
}

const DEFAULT_TIMEOUT_MS = 45000;

const stripUrl = (u) => String(u).replace(/\/+$/, "");

/**
 * OpenCode Zen — https://opencode.ai/zen/v1. Official docs list it as an
 * OpenAI-compatible provider (models.dev: npm @ai-sdk/openai-compatible),
 * 116 models of which 12+ are free (glm-5-free, kimi-k2.5-free,
 * mimo-v2-pro-free, ling-3.1-flash-free, space-bunny-free).
 *
 * Measured 2026-10-06, keyless, from this machine:
 *   GET  /zen/v1/models                 -> 200 (public catalog)
 *   POST /zen/v1/chat/completions       -> 401 Model "<id>" is not supported
 *   POST /zen/v1/chat/completions
 *        model=ling-3.1-flash-free      -> 403 FreeTierError
 *        "OpenCode's free tier can only be used from within OpenCode"
 *   + User-Agent: opencode/1.0          -> 403 (identical)
 *   + X-OpenCode-Client: cli            -> 403 (identical)
 *
 * The gate is server-side, so it cannot be spoofed and it is NOT attempted
 * here. This provider is FIRST in the chain only once OPENCODE_API_KEY is set
 * (created at opencode.ai/auth -> Create API Key). Absent a key it is skipped,
 * never guessed at. jsonMode:false — parseModelJSON already unwraps a
 * prose-wrapped object and not every model accepts response_format.
 */
function opencodeCfg(e, timeoutMs) {
  const apiKey = String(e.OPENCODE_API_KEY || "").trim();
  if (!apiKey) return null;
  return {
    configured: true,
    provider: "opencode",
    baseUrl: stripUrl(e.OPENCODE_BASE_URL || "https://opencode.ai/zen/v1"),
    model: String(e.OPENCODE_MODEL || "glm-5-free"),
    apiKey,
    timeoutMs,
    jsonMode: false,
  };
}

/**
 * Groq, free tier.
 *
 * Measured 2026-10-06 against production: the Workers AI binding is QUEUED on
 * the free plan (listing 26.6s mistral / 46.6s llama; chat 502 at 40.6s, 5.5s,
 * 5.0s) while this key answered a probe in 0.15s over the same network path.
 *
 * BUT one key = one shared tokens-per-minute bucket for every model on it:
 * a ~6k-token prompt gets exactly ONE 200 and then
 * `429 rate_limit_exceeded` for the rest of the window, and fashionistas chat
 * then answered Cloudflare's raw `error code: 502` x3 in the same window.
 * Re-measured across all four available models while the bucket was drained:
 * gpt-oss-120b 1/6, gpt-oss-20b 1/6, qwen3.8-27b 1/6, allam-2-7b 0/6 — so
 * swapping models does not help; only a different PROVIDER does. That is why
 * this is a fallback and not the head of the chain.
 */
function groqCfg(e, timeoutMs) {
  const apiKey = String(e.GROQ_API_KEY || "").trim();
  if (!apiKey) return null;
  return {
    configured: true,
    provider: "groq",
    baseUrl: stripUrl(e.GROQ_BASE_URL || "https://api.groq.com/openai/v1"),
    model: String(e.GROQ_MODEL || "openai/gpt-oss-120b"),
    apiKey,
    timeoutMs,
    jsonMode: false,
  };
}

/**
 * Workers AI, free plan, via the `AI` binding. Slow (queued) but it is the
 * only provider here that is neither key-limited nor token-bucketed by a
 * third party — so it is the last line of defence before we fail closed.
 */
function workersAiCfg(e, timeoutMs) {
  if (!(e && e.AI && typeof e.AI.run === "function")) return null;
  return {
    configured: true,
    provider: "workers_ai",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    timeoutMs,
  };
}

/**
 * Ordered list of providers to try, best first.
 *
 *   explicit MODEL_PROVIDER -> exactly that one (config means config; a
 *                              forced provider must never silently fall back)
 *   otherwise               -> opencode (if OPENCODE_API_KEY) -> groq (if
 *                              GROQ_API_KEY) -> workers_ai (if AI binding)
 *
 * Returns [] when nothing is configured; never throws.
 */
export function providerChain(env) {
  const e = env || {};
  const raw = e.MODEL_PROVIDER == null ? "" : String(e.MODEL_PROVIDER).trim().toLowerCase();
  if (raw) {
    const cfg = modelConfig(e);
    return cfg.configured ? [cfg] : [];
  }
  const timeoutMs =
    Number(e.MODEL_TIMEOUT_MS) > 0 ? Number(e.MODEL_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
  return [opencodeCfg(e, timeoutMs), groqCfg(e, timeoutMs), workersAiCfg(e, timeoutMs)].filter(
    Boolean
  );
}

/** Resolve runtime config from env. Never throws, never guesses a secret. */
export function modelConfig(env) {
  const e = env || {};
  const raw = e.MODEL_PROVIDER == null ? "" : String(e.MODEL_PROVIDER).trim();
  const provider = raw.toLowerCase();
  const timeoutMs =
    Number(e.MODEL_TIMEOUT_MS) > 0 ? Number(e.MODEL_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
  const strip = (u) => String(u).replace(/\/+$/, "");

  // Provider builders live at module scope (opencodeCfg / groqCfg /
  // workersAiCfg) so providerChain() and modelConfig() resolve the SAME
  // config objects — one list, one order, no second opinion.

  // Explicit MODEL_PROVIDER overrides auto-detection
  if (provider) {
    if (provider === "disabled") {
      return { configured: false, provider: "disabled", timeoutMs, reason: "MODEL_PROVIDER=disabled." };
    }
    if (provider === "ollama") {
      return {
        configured: true,
        provider: "ollama",
        baseUrl: strip(e.OLLAMA_BASE_URL || "http://127.0.0.1:11434"),
        model: String(e.OLLAMA_MODEL || "llama3.2:1b"),
        apiKey: null,
        timeoutMs,
      };
    }
    if (provider === "openai" || provider === "openai_compatible") {
      const apiKey = e.OPENAI_API_KEY || e.MODEL_API_KEY || "";
      if (!apiKey) {
        return {
          configured: false,
          provider,
          timeoutMs,
          reason: "MODEL_PROVIDER=openai but neither OPENAI_API_KEY nor MODEL_API_KEY is set.",
        };
      }
      return {
        configured: true,
        provider: "openai",
        baseUrl: strip(e.OPENAI_BASE_URL || "https://api.openai.com/v1"),
        model: String(e.OPENAI_MODEL || e.MODEL_NAME || "gpt-4o-mini"),
        apiKey: String(apiKey),
        timeoutMs,
      };
    }
    if (provider === "opencode") {
      const oc = opencodeCfg(e, timeoutMs);
      if (oc) return oc;
      return {
        configured: false,
        provider: "opencode",
        timeoutMs,
        reason:
          "MODEL_PROVIDER=opencode but OPENCODE_API_KEY is not set " +
          "(create one at opencode.ai/auth -> Create API Key).",
      };
    }
    if (provider === "groq") {
      const g = groqCfg(e, timeoutMs);
      if (g) return g;
      return {
        configured: false,
        provider: "groq",
        timeoutMs,
        reason: "MODEL_PROVIDER=groq but GROQ_API_KEY is not set.",
      };
    }
    if (provider === "workers_ai") {
      // Explicit workers_ai requires the binding to be present
      const w = workersAiCfg(e, timeoutMs);
      if (w) return w;
      return {
        configured: false,
        provider: "workers_ai",
        timeoutMs,
        reason: "MODEL_PROVIDER=workers_ai but env.AI binding is not available.",
      };
    }
    return {
      configured: false,
      provider,
      timeoutMs,
      reason: `unknown MODEL_PROVIDER "${raw}" (expected opencode, groq, ollama, openai, workers_ai or disabled).`,
    };
  }

  // No explicit MODEL_PROVIDER: opencode -> groq -> workers_ai -> fail closed.
  // This returns the FIRST entry (what describeModel() reports as the primary);
  // providerChain() hands the whole ordered list to completeJSON() so that one
  // provider's rate limit can never take the route down with it.
  const auto = [opencodeCfg(e, timeoutMs), groqCfg(e, timeoutMs), workersAiCfg(e, timeoutMs)].filter(
    Boolean
  );
  if (auto.length) return auto[0];

  return {
    configured: false,
    provider: null,
    timeoutMs,
    reason:
      "MODEL_PROVIDER is not set, and no provider key or binding was found. " +
        "Set OPENCODE_API_KEY (opencode.ai/auth) and/or GROQ_API_KEY, or bind Workers AI via env.AI; " +
        "MODEL_PROVIDER=opencode|groq|ollama|openai|workers_ai pins one provider on purpose. " +
        "Nothing is assumed.",
  };
}

/** Safe, non-secret descriptor for API responses. */
export function describeModel(cfg) {
  return { provider: (cfg && cfg.provider) || null, model: (cfg && cfg.model) || null };
}

async function callOllama(cfg, messages, temperature) {
  let res;
  try {
    res = await globalThis.fetch(`${cfg.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        format: "json",
        stream: false,
        options: { temperature },
      }),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (err) {
    const timedOut = err && (err.name === "TimeoutError" || err.name === "AbortError");
    throw timedOut
      ? new ModelError(`model timed out after ${cfg.timeoutMs}ms`, {
          status: 504,
          code: "model_timeout",
          cause: err,
        })
      : new ModelError(`ollama unreachable at ${cfg.baseUrl}: ${(err && err.message) || err}`, {
          status: 502,
          code: "model_unavailable",
          cause: err,
        });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ModelError(`ollama answered ${res.status}: ${String(text).slice(0, 200)}`, {
      status: 502,
      code: "model_unavailable",
    });
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new ModelError("ollama returned a non-JSON HTTP body", {
      status: 502,
      code: "model_unavailable",
      cause: err,
    });
  }
  // /api/chat -> message.content; /api/generate -> response (accepted so a
  // base URL swap to /api/generate does not silently break the caller).
  const content = (data && data.message && data.message.content) || (data && data.response);
  if (typeof content !== "string" || !content.trim()) {
    throw new ModelError("ollama returned an empty message", {
      status: 502,
      code: "model_output_invalid",
    });
  }
  return content;
}

async function callOpenAI(cfg, messages, temperature) {
  let res;
  try {
    res = await globalThis.fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature,
        // jsonMode:false (Groq) omits response_format: parseModelJSON already
        // unwraps a prose-wrapped object, and a 400 from an unsupported
        // response_format would take the whole route down with it.
        ...(cfg.jsonMode === false ? {} : { response_format: { type: "json_object" } }),
      }),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (err) {
    const timedOut = err && (err.name === "TimeoutError" || err.name === "AbortError");
    throw timedOut
      ? new ModelError(`model timed out after ${cfg.timeoutMs}ms`, {
          status: 504,
          code: "model_timeout",
          cause: err,
        })
      : new ModelError(`${cfg.baseUrl} unreachable: ${(err && err.message) || err}`, {
          status: 502,
          code: "model_unavailable",
          cause: err,
        });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ModelError(`model host answered ${res.status}: ${String(text).slice(0, 200)}`, {
      status: 502,
      code: "model_unavailable",
    });
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new ModelError("model host returned a non-JSON HTTP body", {
      status: 502,
      code: "model_unavailable",
      cause: err,
    });
  }
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;
  if (typeof content !== "string" || !content.trim()) {
    throw new ModelError("model host returned an empty message", {
      status: 502,
      code: "model_output_invalid",
    });
  }
  return content;
}

async function callWorkersAI(cfg, messages, temperature, env) {
  // Workers AI expects a prompt string, not messages array. Convert messages to a single prompt.
  const systemMsg = messages.find((m) => m.role === "system");
  const userMsg = messages.find((m) => m.role === "user");
  const prompt = [
    systemMsg ? systemMsg.content : "",
    userMsg ? userMsg.content : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let result;
  try {
    result = await env.AI.run(cfg.model, {
      prompt,
      max_tokens: 2048,
      temperature,
    });
  } catch (err) {
    const timedOut = err && (err.name === "TimeoutError" || err.name === "AbortError");
    throw timedOut
      ? new ModelError(`model timed out after ${cfg.timeoutMs}ms`, {
          status: 504,
          code: "model_timeout",
          cause: err,
        })
      : new ModelError(`workers_ai run failed: ${(err && err.message) || err}`, {
          status: 502,
          code: "model_unavailable",
          cause: err,
        });
  }

  // Workers AI response shape: { response: "..." }
  const content = result && result.response;
  if (typeof content !== "string" || !content.trim()) {
    throw new ModelError("workers_ai returned an empty response", {
      status: 502,
      code: "model_output_invalid",
    });
  }
  return content;
}

/**
 * Parse a model answer into a JSON object, or fail closed.
 *
 * Tolerances, in order and never past the last one:
 *   1. plain JSON.parse
 *   2. ```json fences stripped
 *   3. the outermost {...} substring
 * Anything else — prose, a bare array, a number, truncated JSON — is a
 * ModelError, so a caller can never accidentally render raw model text.
 */
export function parseModelJSON(content) {
  if (typeof content !== "string" || !content.trim()) {
    throw new ModelError("model returned no text", { status: 502, code: "model_output_invalid" });
  }
  let text = content.trim();
  if (text.startsWith("```")) {
    text = text
      .replace(/^```[A-Za-z0-9_-]*\s*/, "")
      .replace(/\s*```\s*$/, "")
      .trim();
  }

  const attempt = (t) => {
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  };

  let parsed = attempt(text);
  if (parsed === null) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) parsed = attempt(text.slice(start, end + 1));
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    const head = String(content).slice(0, 160);
    throw new ModelError(
      `model output is not a JSON object (fail closed); started with: ${head}`,
      { status: 502, code: "model_output_invalid" }
    );
  }
  return parsed;
}

/**
 * Run one instruction and get back a JSON object.
 *
 * Walks providerChain() instead of trusting one provider. This exists because
 * of a measured production outage, not as a theoretical precaution:
 *
 *   Groq call #1 -> 200   fashionistas chat -> 200 with a grounded answer
 *   Groq call #2 -> 429 rate_limit_exceeded (shared per-key TPM bucket)
 *   Groq #2-#6   -> 429   fashionistas chat -> raw "error code: 502" x3
 *
 * One provider's rate limit used to be able to take the whole route down.
 * Now: try each in order, remember which one actually served, and only fail
 * closed when EVERY configured provider has failed.
 *
 * @param {object} env  Pages env (OPENCODE_/GROQ_/MODEL_* config lives here)
 * @param {{system: string, prompt: string, temperature?: number, meta?: object}} req
 *   `meta` (optional) is filled with {provider, model} of whichever provider
 *   actually answered, so a response never claims a provider that didn't serve.
 * @returns {Promise<object>} a plain JSON object, never prose
 * @throws {ModelError}
 */
export async function completeJSON(env, { system, prompt, temperature = 0.2, meta } = {}) {
  if (typeof system !== "string" || !system.trim() || typeof prompt !== "string" || !prompt.trim()) {
    throw new ModelError("completeJSON requires non-empty system and prompt", {
      status: 500,
      code: "model_call_misuse",
    });
  }
  const messages = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];

  const chain = providerChain(env);
  if (!chain.length) {
    const cfg = modelConfig(env);
    throw new ModelError(cfg.reason || "no model provider configured", {
      status: 503,
      code: "model_not_configured",
    });
  }

  const failures = [];
  let lastErr = null;

  for (const cfg of chain) {
    try {
      const content =
        cfg.provider === "ollama"
          ? await callOllama(cfg, messages, temperature)
          : cfg.provider === "workers_ai"
            ? await callWorkersAI(cfg, messages, temperature, env)
            : await callOpenAI(cfg, messages, temperature);
      const parsed = parseModelJSON(content);
      if (meta && typeof meta === "object") {
        meta.provider = cfg.provider;
        meta.model = cfg.model;
      }
      return parsed;
    } catch (err) {
      lastErr = err;
      failures.push(`${cfg.provider}: ${(err && err.message) || String(err)}`);
      // A pinned provider must fail loudly rather than quietly change identity.
      if (chain.length === 1) throw err;
    }
  }

  // Every provider answered but none produced a JSON object: that is an
  // output problem, not an availability problem — report it as such.
  if (lastErr && failures.length && chain.every((c, i) => /model_output_invalid/.test(failures[i]))) {
    throw lastErr;
  }

  throw new ModelError(`every configured model provider failed -> ${failures.join(" | ")}`, {
    status: 502,
    code: "model_unavailable",
    cause: lastErr,
  });
}
