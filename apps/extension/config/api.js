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

/** GET {API_BASE}{path} -> parsed JSON (throws on non-2xx). */
export async function apiGet(path) {
  const res = await fetch((await apiBase()) + path, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

/** POST {API_BASE}{path} -> parsed JSON (throws on non-2xx). */
export async function apiPost(path, body) {
  const res = await fetch((await apiBase()) + path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json().catch(() => ({}));
}

/** Retry policy shared by queue.js: max 3 attempts, exponential backoff. */
export const MAX_ATTEMPTS = 3;
export const RETRY_BASE_MS = 15000;
