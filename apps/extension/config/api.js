// fashionistas.ai API endpoints used by the extension.
// Nothing sensitive is ever uploaded from here: no passwords, no shop cookies,
// no shop tokens. We only send job results (posted/failed + listing URL) and a
// one-way session heartbeat that is a BOOLEAN per shop.

export const DEFAULT_API_BASE = "https://fashionistas-api.fashionistas1979.workers.dev";

export const JOB_POLL_PATH = "/api/jobs?status=queued";
export const SESSIONS_PATH = "/api/sessions";

/** Overridable from chrome.storage.local for dev/staging. */
export async function apiBase() {
  try {
    const { apiBase: stored } = await chrome.storage.local.get("apiBase");
    if (stored) return String(stored).replace(/\/+$/, "");
  } catch (e) {
    // storage unavailable -> fall through to default
  }
  return DEFAULT_API_BASE;
}

/** A non-2xx answer. Carries the status so callers can branch on the real
 *  number instead of pattern-matching a message — the poll gate below keys
 *  off 401/404 exactly. */
export class ApiError extends Error {
  constructor(status, method, path) {
    super(`${method} ${path} -> ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.method = method;
    this.path = path;
  }
}

/** GET {API_BASE}{path} -> parsed JSON (throws ApiError on non-2xx). */
export async function apiGet(path) {
  const res = await fetch((await apiBase()) + path, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  if (!res.ok) throw new ApiError(res.status, "GET", path);
  return res.json();
}

/** POST {API_BASE}{path} -> parsed JSON (throws ApiError on non-2xx). */
export async function apiPost(path, body) {
  const res = await fetch((await apiBase()) + path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new ApiError(res.status, "POST", path);
  return res.json().catch(() => ({}));
}

/* ------------------------------------------------------------- poll gate */
/* The job poll fires on a 1-minute alarm. When {API_BASE} answers 401/404 for
   that route, re-polling every minute can never succeed: it spends one Worker
   request per attempt on a response we already know. Failures therefore move
   the poll onto a ladder, and a single success resets it to zero.

   Pure on purpose — chrome.storage is read/written by queue.js, but the maths
   is here so every step (including the ceiling) is unit-testable without a
   browser. */
export const API_GATE_LADDER_MS = [5 * 60e3, 15 * 60e3, 60 * 60e3];

/** true when the gate is not holding us back (no state counts as open). */
export function gateOpen(state, now) {
  return !state || now >= (state.nextAt || 0);
}

/** Record a failed call. Returns the next state; never exceeds the ladder. */
export function gateAfterFailure(state, now) {
  const fails = Math.min(((state && state.fails) || 0) + 1, API_GATE_LADDER_MS.length);
  return { fails, nextAt: now + API_GATE_LADDER_MS[fails - 1] };
}

/** The endpoint answered: poll at full speed again. */
export function gateAfterSuccess() {
  return { fails: 0, nextAt: 0 };
}

/** Retry policy shared by queue.js: max 3 attempts, exponential backoff. */
export const MAX_ATTEMPTS = 3;
export const RETRY_BASE_MS = 15000;
