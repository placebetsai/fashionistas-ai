/**
 * Paid photoreal try-on providers for /api/tryon/hd.
 *
 * Choice (2026-10-07, see docs/AGENT_HANDOFF.md):
 *   1. replicate  prunaai/p-image-try-on  — $0.015 / image (first garment),
 *                 commercial licence, ~5-15 s.  env REPLICATE_API_TOKEN
 *   2. fashn      FASHN API tryon-v1.6     — credit priced (fal lists the same
 *                 model at $0.075 / image), 5-17 s. env FASHN_API_KEY
 *   3. hf         free FASHN VTON 1.5 HF Space (anonymous ZeroGPU quota) —
 *                 handled by hd.js itself as the fallback.
 * TRYON_PROVIDER (optional) forces one of replicate|fashn|hf.
 *
 * Every provider is async: submit() returns { done, bytesUrl } or { done:false, id };
 * poll(id) returns the same shape. hd.js turns not-done into a 202 + job id and
 * the browser polls GET /api/tryon/hd?job=<id>.
 */

export const PAID = {
  // Self-hosted FASHN VTON 1.5 (Apache-2.0) on Modal, L4, scale-to-zero.
  // ~$0.000301/s while a container is up -> ~$0.007 warm render, ~$0.04 for an
  // isolated cold one (boot + render + 60 s idle). Covered by Modal Starter's
  // $30/month free credit; MODAL_MONTHLY_CAP_USD (default 30) keeps it there.
  modal: { costUsd: 0.01, model: "modal/fashn-vton-1.5", capEnv: "MODAL_MONTHLY_CAP_USD", capDefault: 30 },
  replicate: { costUsd: 0.015, model: "prunaai/p-image-try-on" },
  fashn: { costUsd: 0.075, model: "fashn/tryon-v1.6" },
};

export const DEFAULT_MODAL_URL = "https://fashionistas1979--fashn-vton-api.modal.run";

/** Cheapest first: Modal (free credit) is used before the HF Space by hd.js. */
export function modalReady(env) {
  return !!(env && env.MODAL_PROXY_KEY && env.MODAL_PROXY_SECRET) && String((env && env.TRYON_PROVIDER) || "") !== "hf";
}

export async function modalRun(env, { personBytes, garmentBytes, category, seed, steps }) {
  const url = String(env.FASHN_MODAL_URL || DEFAULT_MODAL_URL).replace(/\/+$/, "");
  const cat = FASHN_CAT[category] || "tops";
  let res;
  try {
    res = await fetch(`${url}/tryon`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Modal-Key": env.MODAL_PROXY_KEY,
        "Modal-Secret": env.MODAL_PROXY_SECRET,
      },
      body: JSON.stringify({
        person: b64(personBytes), garment: b64(garmentBytes), category: cat,
        photo_type: "model", steps: Math.max(10, Math.min(50, steps || 20)), seed: seed || 42,
        segmentation_free: true,
      }),
      signal: AbortSignal.timeout(145000), // Modal cuts web requests at 150 s
    });
  } catch (e) {
    throw err(/timeout/i.test(String(e && (e.name + e.message))) ? "timeout" : "provider_failed", `modal unreachable: ${String(e && e.message).slice(0, 120)}`);
  }
  if (res.status === 401 || res.status === 403) throw err("provider_auth", "modal proxy auth rejected", res.status);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !/^image\//.test(ct)) {
    const t = await res.text().catch(() => "");
    throw err(res.status === 504 ? "timeout" : "provider_failed", `modal HTTP ${res.status}: ${t.slice(0, 160)}`, res.status);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export function pickProviders(env) {
  const forced = String((env && env.TRYON_PROVIDER) || "").toLowerCase().trim();
  const have = [];
  if (env && env.REPLICATE_API_TOKEN) have.push("replicate");
  if (env && env.FASHN_API_KEY) have.push("fashn");
  if (forced === "hf") return [];
  if (forced && have.includes(forced)) return [forced, ...have.filter((p) => p !== forced)];
  return have;
}

function b64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function dataUri(bytes, type) {
  return `data:${type || "image/jpeg"};base64,${b64(bytes)}`;
}
function sniff(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}
function err(code, msg, status) {
  return Object.assign(new Error(msg), { code, status });
}

const PROMPTS = {
  upper_body: "Dress the person in the top/outerwear from the garment image. Keep face, body, pose and background.",
  lower_body: "Dress the person in the trousers/skirt from the garment image. Keep face, body, pose and background.",
  dresses: "Dress the person in the dress from the garment image. Keep face, body, pose and background.",
};
const FASHN_CAT = { upper_body: "tops", lower_body: "bottoms", dresses: "one-pieces" };

/* ------------------------------------------------------------ replicate */
async function replicateSubmit(env, { personBytes, garmentBytes, category, seed }) {
  const res = await fetch("https://api.replicate.com/v1/models/prunaai/p-image-try-on/predictions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
      "content-type": "application/json",
      prefer: "wait=25",
    },
    body: JSON.stringify({
      input: {
        person_image: dataUri(personBytes, sniff(personBytes)),
        garment_images: [dataUri(garmentBytes, sniff(garmentBytes))],
        prompt: PROMPTS[category] || "",
        seed,
        output_format: "jpg",
      },
    }),
    signal: AbortSignal.timeout(40000),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 402) throw err("provider_no_credit", "Replicate account has no credit", 402);
  if (res.status === 401) throw err("provider_auth", "Replicate token rejected", 401);
  if (!res.ok) throw err("provider_failed", `replicate HTTP ${res.status}: ${String(body.detail || "").slice(0, 160)}`, res.status);
  return replicateShape(body);
}
function replicateShape(p) {
  if (p.status === "succeeded") {
    const o = Array.isArray(p.output) ? p.output[0] : p.output;
    if (!o) throw err("no_image", "replicate returned no output");
    return { done: true, url: o, id: p.id };
  }
  if (p.status === "failed" || p.status === "canceled") throw err("provider_failed", `replicate ${p.status}: ${String(p.error || "").slice(0, 160)}`);
  return { done: false, id: p.id, status: p.status };
}
async function replicatePoll(env, id) {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${env.REPLICATE_API_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw err("provider_failed", `replicate poll HTTP ${res.status}`);
  return replicateShape(await res.json());
}

/* ---------------------------------------------------------------- fashn */
async function fashnSubmit(env, { personBytes, garmentBytes, category, seed }) {
  const res = await fetch("https://api.fashn.ai/v1/run", {
    method: "POST",
    headers: { authorization: `Bearer ${env.FASHN_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model_name: "tryon-v1.6",
      inputs: {
        model_image: dataUri(personBytes, sniff(personBytes)),
        garment_image: dataUri(garmentBytes, sniff(garmentBytes)),
        category: FASHN_CAT[category] || "auto",
        seed,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 402 || /credit/i.test(String(body.error || ""))) throw err("provider_no_credit", "FASHN account has no credit", 402);
  if (res.status === 401) throw err("provider_auth", "FASHN key rejected", 401);
  if (!res.ok || !body.id) throw err("provider_failed", `fashn HTTP ${res.status}: ${String(body.error || body.message || "").slice(0, 160)}`, res.status);
  return { done: false, id: body.id, status: "starting" };
}
async function fashnPoll(env, id) {
  const res = await fetch(`https://api.fashn.ai/v1/status/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${env.FASHN_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  const p = await res.json().catch(() => ({}));
  if (!res.ok) throw err("provider_failed", `fashn poll HTTP ${res.status}`);
  if (p.status === "completed") {
    const o = Array.isArray(p.output) ? p.output[0] : p.output;
    if (!o) throw err("no_image", "fashn returned no output");
    return { done: true, url: o, id };
  }
  if (p.status === "failed" || p.status === "canceled") throw err("provider_failed", `fashn ${p.status}: ${JSON.stringify(p.error || "").slice(0, 160)}`);
  return { done: false, id, status: p.status || "processing" };
}

export async function paidSubmit(provider, env, args) {
  if (provider === "replicate") return replicateSubmit(env, args);
  if (provider === "fashn") return fashnSubmit(env, args);
  throw err("provider_unknown", provider);
}
export async function paidPoll(provider, env, id) {
  if (provider === "replicate") return replicatePoll(env, id);
  if (provider === "fashn") return fashnPoll(env, id);
  throw err("provider_unknown", provider);
}
export async function downloadResult(url) {
  if (/^data:/.test(url)) {
    const b = atob(url.split(",")[1]);
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw err("download_failed", `result download HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}
