/**
 * Per-call cost/time ledger for the /api/tryon routes (lane-3).
 *
 * ONE ledger for every try-on lane. The economics used to be hardcoded here
 * (Replicate's MODEL_ID and a flat runs * $0.023) because there was exactly one
 * lane. Now that the GPU provider is behind _tryon/provider.js and each
 * provider prices itself, the caller states its own model/version/cost and this
 * module only owns the table, the write, and the month-spend read that the
 * MAX_MONTHLY_TRYON_SPEND kill switch is built on.
 *
 * Cloudflare Pages has no D1 binding by default. If the project has one (any
 * binding object exposing .prepare/.batch — e.g. DB, COST_D1, FASHIONISTAS_D1),
 * every call is INSERTed into cost_ledger; otherwise the same record is written
 * to the function log (stdout in the Pages dashboard).
 */

import { TryonError } from "./http.js";

/**
 * Default economics, kept only so a caller that omits them still records
 * something honest. The retired Replicate lane is the historical default.
 */
export const DEFAULT_LEDGER_MODEL = "unknown";
export const DEFAULT_LEDGER_VERSION = "unknown";
export const DEFAULT_COST_PER_RUN_USD = 0;

const CREATE_TABLE = `
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
)
`;

const INSERT = `
INSERT INTO cost_ledger
  (route, model, version, runs, previews, garments, estimated_cost_usd, run_ms, duration_ms, status, error, created_at)
VALUES
  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/** Find a D1 binding without depending on its name. */
export function findD1(env) {
  if (!env || typeof env !== "object") return null;
  for (const value of Object.values(env)) {
    if (
      value &&
      typeof value === "object" &&
      typeof value.prepare === "function" &&
      typeof value.batch === "function"
    ) {
      return value;
    }
  }
  return null;
}

/** Trim a caller-supplied label to something safe for a NOT NULL text column. */
function label(value, fallback) {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, 64) : fallback;
}

/**
 * Append one run to cost_ledger. This is the ONLY writer for that table across
 * every try-on route, so monthSpendUsd() below sums a complete history.
 *
 * @param {object} env  Pages function env (bindings)
 * @param {object} rec  {route, model, version, runs, previews, garments,
 *                       costUsd, runMs, durationMs, status, error}
 *   costUsd is the PER-RUN price in USD, supplied by the caller (the provider
 *   prices itself). estimated_cost_usd = runs * costUsd. It is an ESTIMATE: the
 *   real invoice is RunPod's, and this number exists to keep the
 *   MAX_MONTHLY_TRYON_SPEND ceiling from being decorative.
 * @returns {Promise<{mode: "d1"|"console", reason?: string}>}
 */
export async function logCost(env, rec) {
  const runs = Math.max(0, Number(rec.runs) || 0);
  const perRun = Number(rec.costUsd);
  const costUsd = Number.isFinite(perRun) && perRun >= 0 ? perRun : DEFAULT_COST_PER_RUN_USD;
  const record = {
    route: label(rec.route, "/api/tryon"),
    model: label(rec.model, DEFAULT_LEDGER_MODEL),
    version: label(rec.version, DEFAULT_LEDGER_VERSION),
    runs,
    previews: Math.max(0, Number(rec.previews) || 0),
    garments: Math.max(0, Number(rec.garments) || 0),
    estimated_cost_usd: Number((runs * costUsd).toFixed(4)),
    run_ms: Math.max(0, Number(rec.runMs) || 0),
    duration_ms: Math.max(0, Number(rec.durationMs) || 0),
    status: label(rec.status, "ok"),
    error: rec.error ? String(rec.error).slice(0, 300) : null,
    created_at: Date.now(),
  };

  // Always log — this is the durable fallback when no D1 binding exists.
  console.log(`[tryon-cost] ${JSON.stringify(record)}`);

  const d1 = findD1(env);
  if (!d1) {
    return { mode: "console", reason: "no_d1_binding_in_pages_env" };
  }

  try {
    await d1.prepare(CREATE_TABLE).run();
    await d1
      .prepare(INSERT)
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
    console.log(
      `[tryon-cost] d1_write_failed ${((err && err.message) || "unknown").slice(0, 200)}`
    );
    return { mode: "console", reason: "d1_write_failed" };
  }
}

/**
 * Create cost_ledger if absent. Split out so monthSpendUsd() can read without
 * writing, and so a read on a fresh project answers 0 instead of throwing.
 */
export async function ensureLedger(env) {
  const d1 = findD1(env);
  if (!d1) return null;
  try {
    await d1.prepare(CREATE_TABLE).run();
    return d1;
  } catch (err) {
    if (!/already exists/i.test(String((err && err.message) || err))) {
      console.log(
        `[tryon-cost] d1_create_failed ${((err && err.message) || "unknown").slice(0, 200)}`
      );
      return null;
    }
    return d1;
  }
}

/** First instant of the current UTC month, in ms. */
export function monthStartMs(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/**
 * USD already spent on ONE route since the start of the current UTC month.
 *
 * This is what the MAX_MONTHLY_TRYON_SPEND kill switch reads. Fail-closed is
 * the caller's decision, not this function's: a missing D1 binding, a missing
 * table or a failed query all report 0 here, and the route decides whether 0
 * means "no spend yet" or "cannot prove there was no spend".
 */
export async function monthSpendUsd(env, route) {
  const d1 = findD1(env);
  if (!d1) return 0;
  try {
    const row = await d1
      .prepare(
        `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS spent
           FROM cost_ledger
          WHERE route = ? AND created_at >= ?`
      )
      .bind(route, monthStartMs())
      .first();
    const n = Number(row && row.spent);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * The MAX_MONTHLY_TRYON_SPEND ceiling, in USD.
 *
 * Fail-closed: absent, non-numeric, negative or NaN all read as 0, which
 * forbids every METERED run. Setting the var is therefore required to spend
 * money, and a typo can only ever make the route stricter, never looser.
 */
export function spendCapUsd(env) {
  const n = Number(env && env.MAX_MONTHLY_TRYON_SPEND);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * The kill switch itself. Returns null when the run may proceed, or a TryonError
 * the route should answer verbatim when it may not.
 *
 * Two conditions block:
 *   1. the provider is metered and the cap is 0/unset  -> nobody may spend
 *   2. month spend + this run's estimate would exceed the cap
 *
 * A non-metered provider ($0 per run) is never blocked: the cap exists to bound
 * MONEY, and a free render costs none.
 */
export function checkSpendCap({ metered, capUsd, spentUsd, costUsd }) {
  if (!metered) return null;
  const run = Number.isFinite(Number(costUsd)) && Number(costUsd) > 0 ? Number(costUsd) : 0;
  if (capUsd <= 0) {
    throw new TryonError(
      503,
      "tryon_spend_disabled",
      "Photoreal try-on spend is disabled on this deployment (MAX_MONTHLY_TRYON_SPEND is unset). " +
        "Nothing was charged and no credit was used."
    );
  }
  const projected = (Number(spentUsd) || 0) + run;
  if (projected > capUsd) {
    throw new TryonError(
      503,
      "tryon_spend_cap_reached",
      `This month's photoreal try-on budget is used up ($${(Number(spentUsd) || 0).toFixed(2)} of ` +
        `$${capUsd.toFixed(2)}). Nothing was charged and no credit was used.`
    );
  }
  return null;
}
