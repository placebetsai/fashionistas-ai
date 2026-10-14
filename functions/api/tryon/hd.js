/**
 * POST /api/tryon/hd — photoreal try-on backed by FASHN VTON v1.5.
 *
 * While checkout is closed, any signed-in account can run this. It is the
 * try-on: the model redraws the person wearing the garment. The on-device
 * sticker composite is not this route and is not offered as the result.
 *
 * BACKEND: FASHN VTON v1.5, Apache-2.0 (commercial use allowed).
 *   Replaces Leffa, which was retired on 2026-10-04 for three independent,
 *   measured reasons:
 *     1. Its training data (VITON-HD CC BY-NC 4.0, DressCode YNAP) is
 *        NON-COMMERCIAL -> charging for it was legally blocked.
 *     2. 10 steps took 1049.6s (17.5 min) and the output was visibly smeared.
 *     3. Its real default is 50 steps -> 81 min. No usable fast setting exists.
 *
 * The Space is called server-to-server with the Gradio 6.3 API:
 *   POST {space}/gradio_api/upload           -> ["/tmp/gradio/<hash>/<name>"]
 *   POST {space}/gradio_api/call/try_on      -> {"event_id": ...}
 *   GET  {space}/gradio_api/call/try_on/<id> -> SSE "event: complete" + "data: [...]"
 *
 * Request: multipart/form-data
 *   person    (file, required)  full-body photo
 *   garment   (file, required)  garment photo
 *   category  (str,  optional)  upper_body | lower_body | dresses (default upper_body)
 *   steps     (int,  optional)  sampling steps 10..50 (default 30)
 *   seed      (int,  optional)
 *
 * Response 200: { ok, url, type, size, model, category, steps, seed, ms,
 *                 entitled_via, credits_left, cost_usd, charged }
 * Failures:     401 no session · 429 daily cap · 405 wrong method
 *               422 bad category · 500 upstream bug
 *               503 not configured / over budget / QUOTA EXHAUSTED · 502 upstream failure
 *               Never a placeholder image.
 *
 * QUOTA IS A HARD FAILURE. The anonymous ZeroGPU quota on the public Space is
 * finite; when it runs out the Space answers `event: error` IMMEDIATELY, before
 * any GPU work. That maps to 503 `tryon_quota_exhausted`. There is deliberately
 * no fallback to the on-device composite — the user explicitly rejected that
 * result, and a silent degradation would be a lie about what the button does.
 *
 * Entitlement: a signed-in account, up to LAUNCH_DAILY_CAP renders a day.
 *   Pro and credits are not required while the site is free.
 *
 * MAX_MONTHLY_TRYON_SPEND (default 0) is a hard ceiling on METERED spend for
 * this route. FASHN runs are $0 metered, so the default admits them.
 *
 * Required env: TRYON_BUCKET (R2 binding).
 * Optional env: FASHN_SPACE_URL, FASHN_STEPS, FASHN_TIMEOUT_MS, FASHN_GUIDANCE
 *
 * Note: we deliberately do NOT reuse _tryon/ledger.js here. That module
 * hardcodes Replicate's MODEL_ID and `runs * $0.023`; using it would record
 * every $0 run as a charge and trip this route's own cap.
 */

import { requireAuth } from "../_lib/auth.js";
import { json, toTryonError, sniffImageType, extForType } from "../_tryon/http.js";
import { parseTryonForm } from "../_tryon/multipart.js";
import { requireBucket, putImage, resultKey, publicUrl } from "../_tryon/r2.js";
import { findD1 } from "../_tryon/ledger.js";
import { cacheKey, cacheObjectKey, runProvider } from "../_tryon/provider.js";
import { PAID, pickProviders, paidSubmit, paidPoll, downloadResult, modalReady, modalRun } from "../_tryon/vton-paid.js";

const LAUNCH_DAILY_CAP = 6;
const MODEL_VERSION = "fashn-vton-1.5";
const DEFAULT_SPACE = "https://fashn-ai-fashn-vton-1-5.hf.space";
const UPSTREAM_TIMEOUT_MS = 5 * 60 * 1000; // Space measured 12-27s; leave headroom
const COST_PER_RUN_USD = 0; // free Space: no per-call vendor charge
const ROUTE = "/api/tryon/hd";

// Route-level categories (what the client sends) -> FASHN categories (what the model takes).
const CATEGORIES = ["upper_body", "lower_body", "dresses"];
const FASHN_CATEGORY = {
  upper_body: "tops",
  lower_body: "bottoms",
  dresses: "one-pieces",
};

// Mirrors _tryon/ledger.js so cost_ledger stays one table across both routes.
const CREATE_LEDGER = `
CREATE TABLE IF NOT EXISTS cost_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route TEXT NOT NULL,
  model TEXT NOT NULL,
  version TEXT NOT NULL,
  runs INTEGER NOT NULL,
  previews INTEGER NOT NULL,
  garments INTEGER NOT NULL,
  estimated_cost_usd REAL,
  run_ms INTEGER,
  duration_ms INTEGER,
  status TEXT,
  error TEXT,
  created_at INTEGER NOT NULL
)`;

function methodOf(request) {
  return String((request && request.method) || "GET").toUpperCase();
}

/** Uint8Array -> base64 (Workers has btoa but no Buffer). */
function toBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function intField(raw, fallback, { min, max }) {
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function spaceUrl(env) {
  return String((env && env.FASHN_SPACE_URL) || DEFAULT_SPACE).replace(/\/+$/, "");
}

function launchKey(userId) {
  return `tryon:launch:${userId}:${new Date().toISOString().slice(0, 10)}`;
}

function launchCache(env) {
  return env && (env.CACHE || env.FASHIONISTAS_KV);
}

// Daily try-on tally lives in D1 (KV free tier = 1k writes/day, shared account-wide).
// Fail soft: if D1 is missing or errors, fall back to a read-only KV value / 0.
let tallyReady = false;
async function tallyDb(env) {
  const db = env && (env.DB || env.FASHIONISTAS_DB);
  if (!db) return null;
  if (!tallyReady) {
    await db.prepare("CREATE TABLE IF NOT EXISTS kv_counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, exp INTEGER NOT NULL)").run();
    tallyReady = true;
  }
  return db;
}

async function launchUses(env, userId) {
  const key = launchKey(userId);
  try {
    const db = await tallyDb(env);
    if (db) {
      const r = await db.prepare("SELECT n FROM kv_counters WHERE k=? AND exp>?").bind(key, Date.now()).first();
      return Number(r && r.n) || 0;
    }
  } catch {}
  try {
    const cache = launchCache(env);
    if (cache && typeof cache.get === "function") return Number(await cache.get(key)) || 0;
  } catch {}
  return 0;
}

async function bumpLaunch(env, userId) {
  try {
    const db = await tallyDb(env);
    if (!db) return;
    const exp = Date.now() + 36 * 3600e3;
    await db.prepare("INSERT INTO kv_counters (k,n,exp) VALUES (?1,1,?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN exp > ?3 THEN n + 1 ELSE 1 END, exp = CASE WHEN exp > ?3 THEN exp ELSE ?2 END")
      .bind(launchKey(userId), exp, Date.now()).run();
    if (Math.random() < 0.02) await db.prepare("DELETE FROM kv_counters WHERE exp < ?").bind(Date.now()).run();
  } catch {}
}

/** Append one run to cost_ledger with THIS route's economics (fashn, $0). */
async function recordRun(env, rec) {
  const record = {
    route: ROUTE,
    model: rec.model || "fashn",
    version: rec.model ? (PAID[rec.model] ? PAID[rec.model].model : rec.model) : MODEL_VERSION,
    runs: Number(rec.runs) || 1,
    previews: 1,
    garments: Number(rec.garments) || 1,
    estimated_cost_usd: Number.isFinite(Number(rec.cost)) ? Number(rec.cost) : COST_PER_RUN_USD,
    run_ms: Number(rec.ms) || 0,
    duration_ms: Number(rec.ms) || 0,
    status: rec.status || "ok",
    error: rec.error ? String(rec.error).slice(0, 300) : null,
    created_at: Date.now(),
  };
  console.log(`[tryon-hd-cost] ${JSON.stringify(record)}`);

  const d1 = findD1(env);
  if (!d1) return { mode: "console", reason: "no_d1_binding_in_pages_env" };
  try {
    await d1.prepare(CREATE_LEDGER).run();
    await d1
      .prepare(
        `INSERT INTO cost_ledger
           (route, model, version, runs, previews, garments,
            estimated_cost_usd, run_ms, duration_ms, status, error, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(
        record.route,
        record.model,
        record.version,
        record.runs,
        record.previews,
        record.garments,
        record.estimated_cost_usd,
        record.run_ms,
        record.duration_ms,
        record.status,
        record.error,
        record.created_at
      )
      .run();
    return { mode: "d1" };
  } catch (err) {
    console.log(`[tryon-hd-cost] d1_write_failed ${String((err && err.message) || "unknown").slice(0, 200)}`);
    return { mode: "console", reason: "d1_write_failed" };
  }
}

/** Positive try-on credit balance. 0 when the table is empty or absent. */
async function creditBalance(env, userId) {
  const d1 = findD1(env);
  if (!d1) return 0;
  try {
    await d1
      .prepare(
        `CREATE TABLE IF NOT EXISTS tryon_credits (
           user_id INTEGER PRIMARY KEY,
           balance INTEGER NOT NULL DEFAULT 0,
           updated_at TEXT DEFAULT CURRENT_TIMESTAMP
         )`
      )
      .run();
  } catch (err) {
    if (!/already exists/i.test(String((err && err.message) || err))) return 0;
  }
  try {
    const row = await d1.prepare(`SELECT balance FROM tryon_credits WHERE user_id = ? LIMIT 1`).bind(userId).first();
    const n = Number(row && row.balance);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function modalSpendUsd(env) {
  const d1 = findD1(env);
  if (!d1) return 0;
  const now = new Date();
  try {
    const row = await d1.prepare(`SELECT COALESCE(SUM(estimated_cost_usd),0) AS s FROM cost_ledger WHERE route = ? AND model = 'modal' AND created_at >= ?`)
      .bind(ROUTE, Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).first();
    return Number(row && row.s) || 0;
  } catch { return 0; }
}

async function monthSpendUsd(env) {
  const d1 = findD1(env);
  if (!d1) return 0;
  const now = new Date();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  try {
    const row = await d1
      .prepare(
        `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS spent
           FROM cost_ledger
          WHERE route = ? AND created_at >= ?`
      )
      .bind(ROUTE, monthStart)
      .first();
    const n = Number(row && row.spent);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function spendCap(env) {
  const n = Number(env && env.MAX_MONTHLY_TRYON_SPEND);
  // Absent / unset / invalid -> 0: no metered spend allowed. Fail closed.
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/* ------------------------------------------------------------------ *
 * FASHN Space transport
 * ------------------------------------------------------------------ */

export function fileData(path, name, space) {
  // Gradio rejects a bare {path}. It wants the full FileData shape its own
  // loader returns, or the call fails instantly with `event: error`.
  return {
    path,
    url: `${space}/gradio_api/file=${path}`,
    orig_name: name,
    mime_type: null,
    size: null,
    is_stream: false,
    meta: { _type: "gradio.FileData" },
  };
}

export async function uploadToSpace(space, name, bytes, timeoutMs) {
  const fd = new FormData();
  fd.append("files", new Blob([bytes], { type: "image/jpeg" }), name);
  let res;
  try {
    res = await fetch(`${space}/gradio_api/upload`, {
      method: "POST",
      body: fd,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    // Network / DNS / timeout. code must be set so the caller never has to
    // rely on falling through to a catch-all branch to pick the status.
    const e = new Error(`upload unreachable: ${String((cause && cause.message) || cause).slice(0, 120)}`);
    e.code = /timeout/i.test(String((cause && cause.name) || "") + String((cause && cause.message) || ""))
      ? "timeout"
      : "upload_failed";
    throw e;
  }
  if (!res.ok) throw Object.assign(new Error(`upload HTTP ${res.status}`), { code: "upload_failed" });
  const out = await res.json().catch(() => null);
  const path = Array.isArray(out) ? out[0] : null;
  if (!path) throw Object.assign(new Error("upload returned no path"), { code: "upload_failed" });
  return path;
}

/**
 * Drive one Gradio SSE stream to completion.
 * Gradio 6 sends `event: complete` with `data:` as a JSON ARRAY, not an object.
 * `event: error` arrives immediately with `data: null` — that is the quota signal.
 */
export async function readGradioResult(res, deadline) {
  if (!res.body) return { error: "empty_sse_body" };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let ev = null;
  try {
    for (;;) {
      if (Date.now() > deadline) return { error: "timeout" };
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, "");
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        if (line.startsWith("event:")) {
          ev = line.slice(6).trim();
          if (ev === "error") return { error: "space_error" };
          continue;
        }
        if (line.startsWith("data:")) {
          const body = line.slice(5).trim();
          if (ev === "error") return { error: body && body !== "null" ? body : "space_error" };
          if (ev === "complete") {
            try {
              return { data: JSON.parse(body) };
            } catch {
              return { error: "unparseable_result" };
            }
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* stream already closed */
    }
  }
  return { error: "stream_ended_without_result" };
}

/** Find the nested Gradio FileData anywhere in the result array. */
export function findFileData(node) {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findFileData(n);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === "object") {
    if (typeof node.path === "string" && /\/tmp\/gradio|\.png$|\.jpg$|\.webp$/i.test(node.path)) return node;
    for (const v of Object.values(node)) {
      const hit = findFileData(v);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Full try-on round trip against the Space.
 * Throws with `code` set so the caller can distinguish quota from a generic fault.
 */
export async function runFashn(env, { personBytes, garmentBytes, category, steps, seed, photoType }) {
  const space = spaceUrl(env);
  const timeoutMs = intField(env && env.FASHN_TIMEOUT_MS, UPSTREAM_TIMEOUT_MS, {
    min: 30_000,
    max: 10 * 60 * 1000,
  });
  const guidance = Number.isFinite(Number(env && env.FASHN_GUIDANCE)) ? Number(env.FASHN_GUIDANCE) : 1.5;
  const deadline = Date.now() + timeoutMs;

  const personPath = await uploadToSpace(space, "person.jpg", personBytes, timeoutMs);
  const garmentPath = await uploadToSpace(space, "garment.jpg", garmentBytes, timeoutMs);

  const payload = {
    data: [
      fileData(personPath, "person.jpg", space),
      fileData(garmentPath, "garment.jpg", space),
      FASHN_CATEGORY[category], // tops | bottoms | one-pieces
      photoType === "model" ? "model" : "flat-lay",
      steps,
      guidance,
      seed,
      true, // segmentation_free — maskless, better body preservation
    ],
  };

  const callRes = await fetch(`${space}/gradio_api/call/try_on`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!callRes.ok) {
    const err = new Error(`call HTTP ${callRes.status}`);
    err.code = callRes.status === 429 ? "quota_exhausted" : "call_failed";
    throw err;
  }
  const callBody = await callRes.json();
  const eventId = callBody && callBody.event_id;
  if (!eventId) {
    const err = new Error("call returned no event_id");
    err.code = "call_failed";
    throw err;
  }

  const sseRes = await fetch(`${space}/gradio_api/call/try_on/${eventId}`, {
    headers: { accept: "text/event-stream" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!sseRes.ok) {
    const err = new Error(`sse HTTP ${sseRes.status}`);
    err.code = "call_failed";
    throw err;
  }

  const out = await readGradioResult(sseRes, deadline);
  if (out.error) {
    const err = new Error(out.error);
    // The anonymous ZeroGPU quota is finite. Fail loudly; never degrade silently.
    err.code = /space_error|quota/i.test(out.error) ? "quota_exhausted" : out.error;
    throw err;
  }

  const fd = findFileData(out.data);
  if (!fd) {
    const err = new Error("result contained no image");
    err.code = "no_image";
    throw err;
  }

  const url = fd.url || `${space}/gradio_api/file=${fd.path}`;
  const imgRes = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!imgRes.ok) {
    const err = new Error(`image download HTTP ${imgRes.status}`);
    err.code = "download_failed";
    throw err;
  }
  return new Uint8Array(await imgRes.arrayBuffer());
}

/* ------------------------------------------------------------------ */

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-max-age": "86400",
    },
  });
}

// Pages Functions hand the handler exactly ONE argument: a context object
// ({ request, env, params, ... }). This handler used to declare (request, env),
// so `request` silently bound to the whole context, `request.headers` was
// undefined, and requireAuth threw a TypeError before it could ever answer 401.
// That single mismatch was the live "error code: 1101" on POST /api/tryon/hd.
// All 20 other handlers in functions/ already take (context); this now matches.
export async function onRequestPost(context) {
  const request = context.request;
  const env = context.env;

  // --- 1. who are you -------------------------------------------------
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  // --- 2. signed in is enough while checkout is closed ------------------
  // The render redraws the person in the garment. A sticker overlay is not a
  // substitute, so this route does not send anyone there. The daily cap is the
  // only limit: six renders per account, then it resets the next UTC day.
  const via = "launch";
  const credits = 0;
  const used = await launchUses(env, userId);
  if (used >= LAUNCH_DAILY_CAP) {
    return json(
      {
        ok: false,
        error: "tryon_daily_cap",
        detail: `You've used today's ${LAUNCH_DAILY_CAP} try-ons. They reset tomorrow.`,
        cap: LAUNCH_DAILY_CAP,
      },
      429
    );
  }

  // --- 3. inputs ------------------------------------------------------
  let form;
  try {
    form = await parseTryonForm(request);
  } catch (err) {
    const te = toTryonError(err);
    return json({ ok: false, error: te.code || "bad_request", detail: te.message }, te.status || 400);
  }

  const garment = form.garments && form.garments[0];
  if (!form.person || !garment) {
    return json(
      { ok: false, error: "missing_fields", detail: 'Both "person" and "garment" are required.' },
      400
    );
  }

  const photoType = form.photoType === "model" ? "model" : "flat-lay";
  const category = String(garment.category || "upper_body").trim().toLowerCase();
  if (!CATEGORIES.includes(category)) {
    return json(
      { ok: false, error: "bad_category", detail: `category must be one of ${CATEGORIES.join(", ")}` },
      422
    );
  }

  // FASHN is spec'd at 10..50 steps (20=fast, 30=balanced, 50=quality).
  const steps = intField(form.steps, 30, { min: 10, max: 50 });
  const seed = intField(form.seed, 42, { min: 0, max: 2 ** 31 - 1 });
  const bucket = requireBucket(env);

  // --- 4a. self-hosted Modal first: cheapest (free monthly credit) ---------
  const tried = [];
  if (modalReady(env)) {
    const cap = Number(env.MODAL_MONTHLY_CAP_USD);
    const modalCap = Number.isFinite(cap) && cap >= 0 ? cap : PAID.modal.capDefault;
    if ((await modalSpendUsd(env)) + PAID.modal.costUsd > modalCap) tried.push("modal:spend_cap");
    else {
      const tm = Date.now();
      try {
        const out = await modalRun(env, { personBytes: form.person.bytes, garmentBytes: garment.file.bytes, category, seed, steps: 20, photoType });
        return finalize(env, request, bucket, {
          bytes: out, ms: Date.now() - tm, via, userId, credits, category, steps: 20, seed, provider: "modal", cost: PAID.modal.costUsd,
        });
      } catch (e) {
        tried.push(`modal:${(e && e.code) || "error"}`);
        await recordRun(env, { ms: Date.now() - tm, status: (e && e.code) || "provider_error", garments: 1, error: String(e && e.message), model: "modal", cost: 0 });
      }
    }
  }

  // --- 5. call FASHN ---------------------------------------------------
  const t0 = Date.now();
  let bytes;
  try {
    bytes = await runFashn(env, {
      personBytes: form.person.bytes,
      garmentBytes: garment.file.bytes,
      category,
      steps,
      seed,
      photoType,
    });
  } catch (err) {
    const ms = Date.now() - t0;
    const code = err && err.code;
    await recordRun(env, { ms, status: code || "upstream_error", garments: 1, error: String(err && err.message) });
    tried.push(`hf:${code || "error"}`);

    // --- 5b. last resort: pay-per-use APIs, only if a key is configured -----
  for (const provider of pickProviders(env)) {
    // prunaai/p-image-try-on redraws the whole photo from a prompt. That is the
    // painted result. This route only returns a FASHN redraw.
    if (provider === "replicate") { tried.push("replicate:not_a_tryon"); continue; }
    const cost = PAID[provider].costUsd;
    if ((await monthSpendUsd(env)) + cost > spendCap(env)) { tried.push(`${provider}:spend_cap`); continue; }
    const tp = Date.now();
    try {
      const r = await paidSubmit(provider, env, {
        personBytes: form.person.bytes, garmentBytes: garment.file.bytes, category, seed, photoType,
      });
      if (r.done) {
        const out = await downloadResult(r.url);
        return finalize(env, request, bucket, {
          bytes: out, ms: Date.now() - tp, via, userId, credits, category, steps, seed, provider, cost,
        });
      }
      const job = `${provider}:${r.id}`;
      await saveJob(env, { job, userId, via, category, steps, seed });
      return json(
        { ok: true, pending: true, job, provider, status: r.status || "starting", poll_after_ms: 2500 },
        202,
        { "cache-control": "no-store" }
      );
    } catch (e) {
      tried.push(`${provider}:${(e && e.code) || "error"}`);
      await recordRun(env, { ms: Date.now() - tp, status: (e && e.code) || "provider_error", garments: 1, error: String(e && e.message), model: provider, cost: 0 });
    }
  }


    if (code === "quota_exhausted") {
      return json(
        {
          ok: false,
          error: "tryon_quota_exhausted",
          code: "quota_exhausted",
          detail:
            "The try-on model is at its free-tier capacity right now. Nothing was charged " +
            "and no credit was used. Try again shortly — this route never falls back to a " +
            "lower-quality render.",
          providers_tried: tried,
        },
        503
      );
    }
    if (code === "timeout" || code === "stream_ended_without_result") {
      return json(
        { ok: false, error: "tryon_timeout", detail: "The try-on model did not finish in time." },
        504
      );
    }
    if (code === "call_failed" || code === "download_failed" || code === "no_image" || code === "upload_failed") {
      return json(
        { ok: false, error: "tryon_failed", detail: String((err && err.message) || err).slice(0, 300) },
        502
      );
    }
    // Catch-all: any code not enumerated above. Deliberate last resort, not
    // the normal path — every expected failure now has its own branch above.
    return json(
      { ok: false, error: "tryon_failed", detail: String((err && err.message) || err).slice(0, 300) },
      502
    );
  }

  const ms = Date.now() - t0;
  return finalize(env, request, bucket, { bytes, ms, via, userId, credits, category, steps, seed });
}

async function finalize(env, request, bucket, o) {
  const { bytes, ms, via, userId, credits, category, steps, seed } = o;
  const model = o.provider || null;
  const cost = o.cost || 0;
  const MODEL_LABEL = model ? PAID[model].model : MODEL_VERSION;
  // --- 6. validate + store the image -----------------------------------
  if (!bytes || !bytes.length) {
    await recordRun(env, { ms, status: "empty_output", garments: 1, error: "empty image body" });
    return json({ ok: false, error: "tryon_output_empty", detail: "Try-on returned an empty image." }, 502);
  }
  const type = sniffImageType(bytes);
  if (!type) {
    await recordRun(env, { ms, status: "not_image", garments: 1, error: "unrecognizable result" });
    return json(
      { ok: false, error: "tryon_output_not_image", detail: "Try-on result was not a recognizable image." },
      502
    );
  }

  const key = resultKey(type);
  await putImage(bucket, request, key, bytes, type);

  const uuidWithExt = key.slice(key.indexOf("/") + 1);
  const uuid = uuidWithExt.replace(/\.[^.]+$/, "");
  const url = extForType(type) === "png" ? `/api/tryon/image/${uuid}` : `/api/tryon/image/${uuidWithExt}`;

  await recordRun(env, { ms, status: "ok", garments: 1, error: null, model, cost });
  if (via === "launch") {
    try { await bumpLaunch(env, userId); } catch { /* a missed tally must not hide the picture */ }
  }

  if (via === "credits") {
    const d1 = findD1(env);
    if (d1) {
      try {
        await d1
          .prepare(
            `UPDATE tryon_credits
                SET balance = balance - 1, updated_at = CURRENT_TIMESTAMP
              WHERE user_id = ? AND balance > 0`
          )
          .bind(userId)
          .run();
      } catch {
        /* credit raced away elsewhere — the delivered image is still valid */
      }
    }
  }

  return json(
    {
      ok: true,
      url,
      type,
      size: bytes.length,
      model: MODEL_LABEL,
      provider: model || "hf",
      category: FASHN_CATEGORY[category],
      steps,
      seed,
      ms,
      entitled_via: via,
      credits_left: via === "credits" ? Math.max(0, credits - 1) : credits,
      cost_usd: cost,
      charged: 0,
    },
    200,
    { "cache-control": "no-store" }
  );
}

const CREATE_JOBS = `CREATE TABLE IF NOT EXISTS tryon_jobs (
  job TEXT PRIMARY KEY, user_id INTEGER NOT NULL, via TEXT, category TEXT,
  steps INTEGER, seed INTEGER, status TEXT NOT NULL DEFAULT 'pending',
  result TEXT, created_at INTEGER NOT NULL)`;

async function saveJob(env, j) {
  const d1 = findD1(env);
  if (!d1) return;
  await d1.prepare(CREATE_JOBS).run();
  await d1.prepare(`INSERT OR REPLACE INTO tryon_jobs (job,user_id,via,category,steps,seed,status,created_at) VALUES (?,?,?,?,?,?, 'pending', ?)`)
    .bind(j.job, j.userId, j.via, j.category, j.steps, j.seed, Date.now()).run();
}

/** GET /api/tryon/hd?job=<provider:id> — the browser polls this until done. */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const jobId = new URL(request.url).searchParams.get("job") || "";
  const d1 = findD1(env);
  if (!jobId || !d1) return json({ ok: false, error: "missing_job" }, 400);
  await d1.prepare(CREATE_JOBS).run();
  const row = await d1.prepare(`SELECT * FROM tryon_jobs WHERE job = ? AND user_id = ? LIMIT 1`).bind(jobId, auth.user.id).first();
  if (!row) return json({ ok: false, error: "job_not_found" }, 404);
  if (row.status === "done" && row.result) return json(JSON.parse(row.result), 200, { "cache-control": "no-store" });
  if (row.status === "failed") return json({ ok: false, error: "tryon_failed", detail: row.result || "failed" }, 502);
  const [provider, ...rest] = jobId.split(":");
  const id = rest.join(":");
  if (!PAID[provider]) return json({ ok: false, error: "bad_job" }, 400);
  let r;
  try { r = await paidPoll(provider, env, id); }
  catch (e) {
    await d1.prepare(`UPDATE tryon_jobs SET status='failed', result=? WHERE job=?`).bind(String(e && e.message).slice(0, 300), jobId).run();
    await recordRun(env, { ms: Date.now() - row.created_at, status: (e && e.code) || "provider_error", garments: 1, error: String(e && e.message), model: provider, cost: 0 });
    return json({ ok: false, error: "tryon_failed", detail: "The photoreal render failed. No credit was used — try again." }, 502);
  }
  if (!r.done) {
    const age = Date.now() - row.created_at;
    if (age > 5 * 60 * 1000) return json({ ok: false, error: "tryon_timeout", detail: "The render took too long." }, 504);
    return json({ ok: true, pending: true, job: jobId, provider, status: r.status, poll_after_ms: 2500, elapsed_ms: age }, 202, { "cache-control": "no-store" });
  }
  // Claim the job first so two parallel polls can never charge twice.
  const claim = await d1.prepare(`UPDATE tryon_jobs SET status='finalizing' WHERE job=? AND status='pending'`).bind(jobId).run();
  if (!claim || !claim.meta || claim.meta.changes !== 1) {
    return json({ ok: true, pending: true, job: jobId, provider, status: "finalizing", poll_after_ms: 1500 }, 202);
  }
  const bytes = await downloadResult(r.url);
  const credits = row.via === "credits" ? await creditBalance(env, auth.user.id) : 0;
  const res = await finalize(env, request, requireBucket(env), {
    bytes, ms: Date.now() - row.created_at, via: row.via, userId: auth.user.id, credits,
    category: row.category, steps: row.steps, seed: row.seed, provider, cost: PAID[provider].costUsd,
  });
  const text = await res.clone().text();
  await d1.prepare(`UPDATE tryon_jobs SET status=?, result=? WHERE job=?`).bind(res.ok ? "done" : "failed", text.slice(0, 4000), jobId).run();
  return res;
}

export async function onRequest(context) {
  const m = methodOf(context.request);
  if (m === "OPTIONS") return onRequestOptions();
  if (m === "GET") return onRequestGet(context);
  if (m !== "POST") {
    return json({ ok: false, error: "method_not_allowed", detail: "Use POST, or GET ?job= to poll." }, 405);
  }
  return onRequestPost(context);
}
