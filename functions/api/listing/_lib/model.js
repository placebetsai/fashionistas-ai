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
 *   MODEL_PROVIDER=workers_ai    Cloudflare Workers AI binding (env.AI). Free,
 *                                no API keys, runs @cf/meta/llama-3.3-70b-instruct-fp8-fast
 *                                on this account. Enabled automatically when
 *                                env.AI && typeof env.AI.run === "function" and
 *                                no explicit MODEL_PROVIDER overrides it.
 *   MODEL_PROVIDER=disabled      refuse everything (503), useful as a hard stop.
 *   unset                        503 model_not_configured. FAIL CLOSED BY DEFAULT:
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

/** Resolve runtime config from env. Never throws, never guesses a secret. */
export function modelConfig(env) {
  const e = env || {};
  const raw = e.MODEL_PROVIDER == null ? "" : String(e.MODEL_PROVIDER).trim();
  const provider = raw.toLowerCase();
  const timeoutMs =
    Number(e.MODEL_TIMEOUT_MS) > 0 ? Number(e.MODEL_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
  const strip = (u) => String(u).replace(/\/+$/, "");

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
    if (provider === "workers_ai") {
      // Explicit workers_ai requires the binding to be present
      if (e.AI && typeof e.AI.run === "function") {
        return {
          configured: true,
          provider: "workers_ai",
          model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          timeoutMs,
        };
      }
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
      reason: `unknown MODEL_PROVIDER "${raw}" (expected ollama, openai, workers_ai or disabled).`,
    };
  }

  // No explicit MODEL_PROVIDER: auto-detect Workers AI binding
  if (e.AI && typeof e.AI.run === "function") {
    return {
      configured: true,
      provider: "workers_ai",
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      timeoutMs,
    };
  }

  return {
    configured: false,
    provider: null,
    timeoutMs,
    reason:
      "MODEL_PROVIDER is not set. Set MODEL_PROVIDER=ollama for local dev or " +
      "MODEL_PROVIDER=openai for a hosted model; Workers AI is auto-detected from env.AI; nothing is assumed.",
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
        response_format: { type: "json_object" },
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
 * @param {object} env  Pages env (MODEL_* config lives here)
 * @param {{system: string, prompt: string, temperature?: number}} req
 * @returns {Promise<object>} a plain JSON object, never prose
 * @throws {ModelError}
 */
export async function completeJSON(env, { system, prompt, temperature = 0.2 }) {
  const cfg = modelConfig(env);
  if (!cfg.configured) {
    throw new ModelError(cfg.reason, { status: 503, code: "model_not_configured" });
  }
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
  const content =
    cfg.provider === "ollama"
      ? await callOllama(cfg, messages, temperature)
      : cfg.provider === "openai"
        ? await callOpenAI(cfg, messages, temperature)
        : await callWorkersAI(cfg, messages, temperature, env);
  return parseModelJSON(content);
}
