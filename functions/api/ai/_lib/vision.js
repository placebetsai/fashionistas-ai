/**
 * Vision identify helpers for POST /api/ai/analyze.
 * Prefer Workers AI / Groq vision; never invent a clothing ID when models fail.
 */

import { normalizeIdentify } from "../../../../libs/identify-fill.js";

export const VISION_PROMPT = `You are a fashion resale expert looking at ONE clothing-item photo.

Reply with ONLY one raw JSON object using double quotes. No markdown, no code fences, no prose before or after.

Required keys:
  type        short specific item name (e.g. "denim jacket", "dress shirt", "sneakers", "maxi dress")
  brand       visible brand name, or "" if you cannot read one — never invent a designer
  color       primary colour
  condition   exactly one of: Poor, Fair, Good, Excellent (never Unknown)
  category    exactly one of: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories
  priceMin    number — low end of fair US resale USD
  priceMax    number — high end of fair US resale USD
  confidence  0-100
  sizeHint    size label if readable on a tag, else "" (never write "not visible" or "unknown")
  material    fabric if you can tell (Denim, Cotton, Leather, Wool, …), else ""
  note        one short honest observation (fit, wash, hardware); empty string if nothing useful

Category rules (critical):
  - jackets, coats, blazers, parkas, puffers, hoodies, cardigans → Outerwear (never Tops)
  - denim / jean jackets → type "denim jacket", category Outerwear, material Denim
  - dress shirts / button-downs → Tops (not Dresses)
  - dresses / gowns / jumpsuits → Dresses
  - jeans / trousers / shorts / skirts → Bottoms
  - sneakers / boots / heels / sandals → Shoes
  - bags / hats / belts / jewellery → Accessories

Be specific and honest. Prefer "" over a guess for brand, sizeHint, and material.`;

/** Tolerant JSON object extract from model text. */
export function parseVisionJSON(raw) {
  if (raw == null) return null;
  const unwrap = (v) => {
    if (typeof v === "string") {
      const t = v.trim();
      if (!t) return null;
      try {
        return unwrap(JSON.parse(t));
      } catch {
        return null;
      }
    }
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
    return null;
  };
  if (typeof raw !== "string") return unwrap(raw);

  const fence = raw.replace(/```[a-z]*\s*/gi, "").replace(/```/g, "").trim();
  const whole = unwrap(fence);
  if (whole) return whole;
  const m = fence.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const candidates = [
    m[0],
    m[0].replace(/\\"/g, '"'),
    m[0].replace(/'/g, '"'),
    m[0].replace(/,\s*([}\]])/g, "$1"),
    m[0].replace(/([{,]\s*)([A-Za-z_][\w -]*)\s*:/g, '$1"$2":'),
  ];
  for (const c of candidates) {
    const v = unwrap(c);
    if (v) return v;
  }
  return null;
}

function visionOk(parsed) {
  return !!(parsed && (parsed.type || parsed.category));
}

async function runScout(env, imageB64, prompt = VISION_PROMPT) {
  if (!(env && env.AI && typeof env.AI.run === "function")) return null;
  const r = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } },
        ],
      },
    ],
    max_tokens: 400,
  });
  const text = typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? r);
  return parseVisionJSON(text);
}

async function runGroqVision(env, imageB64, prompt = VISION_PROMPT) {
  const key = String((env && env.GROQ_API_KEY) || "").trim();
  if (!key) return null;
  const ask = () =>
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: 400,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(28000),
    });
  let res = await ask();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 3500));
    res = await ask();
  }
  if (!res.ok) {
    // Fallback model id used historically on the API worker.
    const alt = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        max_tokens: 400,
        temperature: 0.2,
        reasoning_effort: "none",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: "data:image/jpeg;base64," + imageB64 } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(28000),
    });
    if (!alt.ok) return null;
    const aj = await alt.json();
    return parseVisionJSON(aj?.choices?.[0]?.message?.content || "");
  }
  const gj = await res.json();
  return parseVisionJSON(gj?.choices?.[0]?.message?.content || "");
}

async function runLlamaVision(env, imageB64, prompt = VISION_PROMPT) {
  if (!(env && env.AI && typeof env.AI.run === "function")) return null;
  const r = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
    prompt,
    image: imageB64,
    max_tokens: 400,
  });
  let text = "";
  try {
    text = typeof r === "string" ? r : JSON.stringify(r);
    if (r?.response) text = typeof r.response === "string" ? r.response : JSON.stringify(r.response);
  } catch {
    text = JSON.stringify(r);
  }
  return parseVisionJSON(text);
}

/**
 * Identify a garment from base64 image bytes.
 * @returns {{ ok:true, value } | { ok:false, error, detail? }}
 */
export async function identifyFromImage(env, imageB64, opts = {}) {
  const hint = typeof opts.hint === "string" ? opts.hint.trim() : "";
  // Demo / seller hints only steer the prompt — never override a real model read.
  const prompt = hint
    ? VISION_PROMPT + `\n\nSeller/context hint (use only if it matches the photo): ${hint.slice(0, 120)}`
    : VISION_PROMPT;
  const attempts = [
    ["workers_ai_scout", () => runScout(env, imageB64, prompt)],
    ["groq_vision", () => runGroqVision(env, imageB64, prompt)],
    ["workers_ai_llama32", () => runLlamaVision(env, imageB64, prompt)],
  ];
  const failures = [];
  for (const [name, fn] of attempts) {
    try {
      const parsed = await fn();
      if (visionOk(parsed)) {
        const value = normalizeIdentify({ source: "ai", ...parsed, note: parsed.note || "" });
        value.model = name;
        return { ok: true, value };
      }
      failures.push(`${name}: unparseable`);
    } catch (err) {
      failures.push(`${name}: ${(err && err.message) || err}`);
    }
  }
  return {
    ok: false,
    error: "could not read the photo",
    detail: failures.join(" | ") || "vision model unavailable",
  };
}

export { normalizeIdentify };
