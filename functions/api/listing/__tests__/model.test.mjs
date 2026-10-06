/**
 * Tests for functions/api/listing/_lib/model.js — the model provider layer.
 * These tests verify config resolution, provider detection, and error handling
 * WITHOUT making real network calls. Real model round-trips are covered by
 * the manual TEST.md script (Phase 4 report).
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  ModelError,
  modelConfig,
  describeModel,
  parseModelJSON,
  completeJSON,
} from "../_lib/model.js";

describe("modelConfig() — provider resolution", () => {
  it("returns unconfigured when MODEL_PROVIDER is unset and no AI binding", () => {
    const cfg = modelConfig({});
    assert.strictEqual(cfg.configured, false);
    assert.strictEqual(cfg.provider, null);
    assert.match(cfg.reason, /MODEL_PROVIDER is not set/);
  });

  it("returns unconfigured when MODEL_PROVIDER=disabled", () => {
    const cfg = modelConfig({ MODEL_PROVIDER: "disabled" });
    assert.strictEqual(cfg.configured, false);
    assert.strictEqual(cfg.provider, "disabled");
    assert.match(cfg.reason, /MODEL_PROVIDER=disabled/);
  });

  it("returns ollama config when MODEL_PROVIDER=ollama", () => {
    const cfg = modelConfig({ MODEL_PROVIDER: "ollama", OLLAMA_MODEL: "llama3.2:3b" });
    assert.strictEqual(cfg.configured, true);
    assert.strictEqual(cfg.provider, "ollama");
    assert.strictEqual(cfg.model, "llama3.2:3b");
    assert.strictEqual(cfg.baseUrl, "http://127.0.0.1:11434");
  });

  it("returns openai config when MODEL_PROVIDER=openai with key", () => {
    const cfg = modelConfig({
      MODEL_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-4o",
    });
    assert.strictEqual(cfg.configured, true);
    assert.strictEqual(cfg.provider, "openai");
    assert.strictEqual(cfg.model, "gpt-4o");
    assert.strictEqual(cfg.apiKey, "sk-test");
  });

  it("returns unconfigured when MODEL_PROVIDER=openai without key", () => {
    const cfg = modelConfig({ MODEL_PROVIDER: "openai" });
    assert.strictEqual(cfg.configured, false);
    assert.strictEqual(cfg.provider, "openai");
    assert.match(cfg.reason, /neither OPENAI_API_KEY nor MODEL_API_KEY is set/);
  });

  it("returns workers_ai config when MODEL_PROVIDER=workers_ai and AI binding present", () => {
    const mockAI = { run: async () => ({ response: "test" }) };
    const cfg = modelConfig({ MODEL_PROVIDER: "workers_ai", AI: mockAI });
    assert.strictEqual(cfg.configured, true);
    assert.strictEqual(cfg.provider, "workers_ai");
    assert.strictEqual(cfg.model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  });

  it("returns unconfigured when MODEL_PROVIDER=workers_ai but no AI binding", () => {
    const cfg = modelConfig({ MODEL_PROVIDER: "workers_ai" });
    assert.strictEqual(cfg.configured, false);
    assert.strictEqual(cfg.provider, "workers_ai");
    assert.match(cfg.reason, /env.AI binding is not available/);
  });

  it("auto-detects workers_ai when no MODEL_PROVIDER but AI binding present", () => {
    const mockAI = { run: async () => ({ response: "test" }) };
    const cfg = modelConfig({ AI: mockAI });
    assert.strictEqual(cfg.configured, true);
    assert.strictEqual(cfg.provider, "workers_ai");
    assert.strictEqual(cfg.model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  });

  it("explicit MODEL_PROVIDER overrides auto-detection", () => {
    const mockAI = { run: async () => ({ response: "test" }) };
    const cfg = modelConfig({ MODEL_PROVIDER: "ollama", AI: mockAI });
    assert.strictEqual(cfg.provider, "ollama");
  });

  it("returns unconfigured for unknown provider", () => {
    const cfg = modelConfig({ MODEL_PROVIDER: "unknown_provider" });
    assert.strictEqual(cfg.configured, false);
    assert.strictEqual(cfg.provider, "unknown_provider");
    assert.match(cfg.reason, /unknown MODEL_PROVIDER/);
  });

  it("uses MODEL_API_KEY as fallback for openai", () => {
    const cfg = modelConfig({ MODEL_PROVIDER: "openai", MODEL_API_KEY: "sk-fallback" });
    assert.strictEqual(cfg.configured, true);
    assert.strictEqual(cfg.apiKey, "sk-fallback");
  });

  it("respects MODEL_TIMEOUT_MS", () => {
    const cfg = modelConfig({ MODEL_PROVIDER: "ollama", MODEL_TIMEOUT_MS: "120000" });
    assert.strictEqual(cfg.timeoutMs, 120000);
  });
});

describe("describeModel()", () => {
  it("returns provider and model from config", () => {
    const desc = describeModel({ provider: "ollama", model: "llama3.2:1b" });
    assert.deepStrictEqual(desc, { provider: "ollama", model: "llama3.2:1b" });
  });

  it("returns nulls for missing config", () => {
    const desc = describeModel(null);
    assert.deepStrictEqual(desc, { provider: null, model: null });
  });
});

describe("parseModelJSON() — tolerant JSON extraction", () => {
  it("parses clean JSON", () => {
    const out = parseModelJSON('{"title":"Test","price":48}');
    assert.deepStrictEqual(out, { title: "Test", price: 48 });
  });

  it("strips ```json fences", () => {
    const out = parseModelJSON('```json\n{"title":"Test"}\n```');
    assert.deepStrictEqual(out, { title: "Test" });
  });

  it("extracts first balanced {...} from prose", () => {
    const out = parseModelJSON('Here is your listing: {"title":"Test","price":48} hope that helps!');
    assert.deepStrictEqual(out, { title: "Test", price: 48 });
  });

  it("extracts outermost {...} when nested", () => {
    const out = parseModelJSON('{"outer": {"inner": "value"}}');
    assert.deepStrictEqual(out, { outer: { inner: "value" } });
  });

  it("rejects empty string", () => {
    assert.throws(
      () => parseModelJSON(""),
      { code: "model_output_invalid", message: /model returned no text/ }
    );
  });

  it("rejects prose without JSON", () => {
    assert.throws(
      () => parseModelJSON("This is just text"),
      { code: "model_output_invalid", message: /model output is not a JSON object/ }
    );
  });

  it("rejects array as top-level", () => {
    assert.throws(
      () => parseModelJSON('[{"a":1}]'),
      { code: "model_output_invalid", message: /model output is not a JSON object/ }
    );
  });

  it("rejects number as top-level", () => {
    assert.throws(
      () => parseModelJSON("42"),
      { code: "model_output_invalid", message: /model output is not a JSON object/ }
    );
  });

  it("rejects truncated JSON", () => {
    assert.throws(
      () => parseModelJSON('{"title": "Test"'),
      { code: "model_output_invalid", message: /model output is not a JSON object/ }
    );
  });
});

describe("completeJSON() — integration", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("throws ModelError 503 when unconfigured", async () => {
    await assert.rejects(
      completeJSON({}, { system: "sys", prompt: "prompt" }),
      { code: "model_not_configured", status: 503 }
    );
  });

  it("throws ModelError 500 when system or prompt empty", async () => {
    const mockAI = { run: async () => ({ response: "{}" }) };
    await assert.rejects(
      completeJSON({ AI: mockAI }, { system: "", prompt: "prompt" }),
      { code: "model_call_misuse", status: 500 }
    );
    await assert.rejects(
      completeJSON({ AI: mockAI }, { system: "sys", prompt: "" }),
      { code: "model_call_misuse", status: 500 }
    );
  });

  it("calls workers_ai and returns parsed JSON", async () => {
    const mockAI = {
      run: async (model, opts) => ({
        response: JSON.stringify({ title: "Test", price: 48 }),
      }),
    };
    const out = await completeJSON(
      { AI: mockAI, MODEL_PROVIDER: "workers_ai" },
      { system: "sys", prompt: "prompt" }
    );
    assert.deepStrictEqual(out, { title: "Test", price: 48 });
  });

  it("calls workers_ai with correct parameters", async () => {
    let captured = null;
    const mockAI = {
      run: async (model, opts) => {
        captured = { model, opts };
        return { response: '{"ok":true}' };
      },
    };
    await completeJSON(
      { AI: mockAI, MODEL_PROVIDER: "workers_ai" },
      { system: "system prompt", prompt: "user prompt", temperature: 0.5 }
    );
    assert.strictEqual(captured.model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    assert.strictEqual(captured.opts.temperature, 0.5);
    assert.match(captured.opts.prompt, /system prompt/);
    assert.match(captured.opts.prompt, /user prompt/);
    assert.strictEqual(captured.opts.max_tokens, 2048);
  });

  it("wraps workers_ai errors as ModelError", async () => {
    const mockAI = {
      run: async () => {
        throw new Error("AI service down");
      },
    };
    await assert.rejects(
      completeJSON({ AI: mockAI, MODEL_PROVIDER: "workers_ai" }, { system: "sys", prompt: "prompt" }),
      { code: "model_unavailable", status: 502, message: /workers_ai run failed/ }
    );
  });

  it("wraps workers_ai timeout as ModelError 504", async () => {
    const timeoutErr = new Error("timeout");
    timeoutErr.name = "TimeoutError";
    const mockAI = {
      run: async () => {
        throw timeoutErr;
      },
    };
    await assert.rejects(
      completeJSON({ AI: mockAI, MODEL_PROVIDER: "workers_ai", MODEL_TIMEOUT_MS: "100" }, { system: "sys", prompt: "prompt" }),
      { code: "model_timeout", status: 504 }
    );
  });

  it("throws on empty workers_ai response", async () => {
    const mockAI = {
      run: async () => ({ response: "" }),
    };
    await assert.rejects(
      completeJSON({ AI: mockAI, MODEL_PROVIDER: "workers_ai" }, { system: "sys", prompt: "prompt" }),
      { code: "model_output_invalid", status: 502, message: /empty response/ }
    );
  });

  it("throws on missing workers_ai response field", async () => {
    const mockAI = {
      run: async () => ({}),
    };
    await assert.rejects(
      completeJSON({ AI: mockAI, MODEL_PROVIDER: "workers_ai" }, { system: "sys", prompt: "prompt" }),
      { code: "model_output_invalid", status: 502, message: /empty response/ }
    );
  });
});

describe("ModelError", () => {
  it("carries status, code, and cause", () => {
    const cause = new Error("root cause");
    const err = new ModelError("failed", { status: 502, code: "test_code", cause });
    assert.strictEqual(err.name, "ModelError");
    assert.strictEqual(err.status, 502);
    assert.strictEqual(err.code, "test_code");
    assert.strictEqual(err.cause, cause);
  });

  it("defaults to 502/model_error", () => {
    const err = new ModelError("failed");
    assert.strictEqual(err.status, 502);
    assert.strictEqual(err.code, "model_error");
  });
});
// ---------------------------------------------------------------------------
// Groq — measured 2026-10-06 against the live site.
//
// Workers AI on the free plan is QUEUED, not slow to compute. Numbers from
// production after the binding landed:
//   POST /api/listing   26.6s  (mistral-7b)  then  46.6s (llama-3.3-70b-fast)
//   POST /api/chat      HTTP 502 twice at ~5s, once at 40.6s, then 200 at 10.9s
//
// Same account, same zero dollars: Groq answered GET /v1/models in 0.15s over
// the same network path. So the free Groq key must win the provider race and
// Workers AI stays as the fallback when the key is absent.
// ---------------------------------------------------------------------------
describe("modelConfig() — groq provider (free, preferred over Workers AI)", () => {
  it("is configured when GROQ_API_KEY is present", () => {
    const cfg = modelConfig({ GROQ_API_KEY: "gsk_test_not_a_real_key" });
    assert.strictEqual(cfg.configured, true);
    assert.strictEqual(cfg.provider, "groq");
    assert.strictEqual(cfg.model, "openai/gpt-oss-120b");
    assert.match(cfg.baseUrl, /groq\.com/);
  });

  it("prefers groq over the Workers AI binding", () => {
    const cfg = modelConfig({ GROQ_API_KEY: "gsk_test", AI: { run: async () => ({}) } });
    assert.strictEqual(cfg.provider, "groq");
  });

  it("an explicit MODEL_PROVIDER=workers_ai still forces the binding", () => {
    const cfg = modelConfig({
      MODEL_PROVIDER: "workers_ai",
      GROQ_API_KEY: "gsk_test",
      AI: { run: async () => ({}) },
    });
    assert.strictEqual(cfg.provider, "workers_ai");
    assert.strictEqual(cfg.model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  });

  it("falls back to workers_ai when there is no groq key", () => {
    const cfg = modelConfig({ AI: { run: async () => ({}) } });
    assert.strictEqual(cfg.provider, "workers_ai");
  });

  it("an empty GROQ_API_KEY is not a key", () => {
    const cfg = modelConfig({ GROQ_API_KEY: "   " });
    assert.strictEqual(cfg.configured, false);
  });

  it("MODEL_PROVIDER=disabled refuses even with a groq key", () => {
    const cfg = modelConfig({ MODEL_PROVIDER: "disabled", GROQ_API_KEY: "gsk_test" });
    assert.strictEqual(cfg.configured, false);
    assert.strictEqual(cfg.provider, "disabled");
  });

  it("unknown MODEL_PROVIDER still refuses loudly", () => {
    const cfg = modelConfig({ MODEL_PROVIDER: "wat", GROQ_API_KEY: "gsk_test" });
    assert.strictEqual(cfg.configured, false);
    assert.match(cfg.reason, /unknown MODEL_PROVIDER/);
  });
});

// ---------------------------------------------------------------------------
// PROVIDER FALLBACK — the fix for the outage measured on 2026-10-06.
//
// Causal chain, proven 1:1 against production:
//   Groq call #1                -> 200   chat -> 200 with a real answer
//   Groq call #2                -> 429 rate_limit_exceeded
//   Groq #2, #3, #4 (same org)  -> 429   chat -> raw "error code: 502" x3
//
// Every Groq model shares ONE tokens-per-minute bucket for this key, so
// swapping gpt-oss-120b for gpt-oss-20b or qwen3.8-27b bought nothing
// (measured: 1/6, 1/6, 1/6, 0/6 successes on the four available models while
// the bucket was empty). Workers AI has a SEPARATE free quota and was always
// available — just queued. So the chain must be groq -> workers_ai, and a
// single provider's rate limit must never be able to take the route down.
// ---------------------------------------------------------------------------
describe("completeJSON() — provider fallback (never a dead chatbot)", () => {
  const sys = { system: "You are a stylist.", prompt: "Answer as JSON: {\"answer\":\"x\"}" };

  it("falls back to workers_ai when groq answers 429", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ error: { code: "rate_limit_exceeded", message: "Rate limit reached" } }),
        { status: 429, headers: { "content-type": "application/json" } }
      );
    try {
      const meta = {};
      const out = await completeJSON(
        { GROQ_API_KEY: "gsk_test", AI: { run: async () => ({ response: '{"answer":"from workers_ai"}' }) } },
        { ...sys, meta }
      );
      assert.strictEqual(out.answer, "from workers_ai");
      assert.strictEqual(meta.provider, "workers_ai");
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("prefers groq and records which provider actually served", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"answer":"from groq"}' } }] }),
        { status: 200, headers: { "content-type": "application/json" } });
    try {
      const meta = {};
      const out = await completeJSON(
        { GROQ_API_KEY: "gsk_test", AI: { run: async () => ({ response: '{"answer":"ai"}' }) } },
        { ...sys, meta }
      );
      assert.strictEqual(out.answer, "from groq");
      assert.strictEqual(meta.provider, "groq");
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("fails with BOTH providers named when every one is down", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () => new Response("boom", { status: 500 });
    try {
      await assert.rejects(
        () => completeJSON(
          { GROQ_API_KEY: "gsk_test", AI: { run: async () => { throw new Error("ai unavailable"); } } },
          sys
        ),
        (err) => {
          assert.strictEqual(err.code, "model_unavailable");
          assert.match(err.message, /groq/);
          assert.match(err.message, /workers_ai/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("an EXPLICIT MODEL_PROVIDER does not silently fall back", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () => new Response("nope", { status: 503 });
    try {
      await assert.rejects(
        () => completeJSON(
          { MODEL_PROVIDER: "groq", GROQ_API_KEY: "gsk_test", AI: { run: async () => ({ response: '{"answer":"x"}' }) } },
          sys
        ),
        (err) => err instanceof ModelError && err.code === "model_unavailable"
      );
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("with only one provider available it still fails loudly", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () => new Response("x", { status: 500 });
    try {
      await assert.rejects(
        () => completeJSON({ GROQ_API_KEY: "gsk_test" }, sys),
        (err) => err.code === "model_unavailable"
      );
    } finally {
      globalThis.fetch = orig;
    }
  });
});
