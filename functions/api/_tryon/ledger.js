/**
 * Per-call cost/time ledger for /api/tryon (lane-3).
 *
 * Cloudflare Pages has no D1 binding by default. If the project later adds one
 * (any binding object exposing .prepare/.batch — e.g. DB, COST_D1,
 * FASHIONISTAS_D1), every call is INSERTed into cost_ledger; otherwise the same
 * record is written to the function log (stdout in the Pages dashboard).
 */

import { COST_PER_RUN_USD, MODEL_ID, MODEL_VERSION } from "./replicate.js";

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

/**
 * @param {object} env  Pages function env (bindings)
 * @param {object} rec  {route, runs, previews, garments, runMs, durationMs, status, error}
 * @returns {Promise<{mode: "d1"|"console", reason?: string}>}
 */
export async function logCost(env, rec) {
  const record = {
    route: rec.route || "/api/tryon",
    model: MODEL_ID,
    version: MODEL_VERSION,
    runs: Number(rec.runs) || 0,
    previews: Number(rec.previews) || 0,
    garments: Number(rec.garments) || 0,
    estimated_cost_usd: Number(((Number(rec.runs) || 0) * COST_PER_RUN_USD).toFixed(4)),
    run_ms: Number(rec.runMs) || 0,
    duration_ms: Number(rec.durationMs) || 0,
    status: rec.status || "ok",
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
