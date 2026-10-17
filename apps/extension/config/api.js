// fashionistas.ai API endpoints used by the extension.
// Nothing sensitive is ever uploaded from here: no passwords, no shop cookies,
// no shop tokens. We only send job results (posted/failed + listing URL) and a
// one-way session heartbeat that is a BOOLEAN per shop.

export const DEFAULT_API_BASE = "https://fashionistas-api.fashionistas1979.workers.dev";

export const JOB_POLL_PATH = "/api/jobs?status=queued";
export const SESSIONS_PATH = "/api/sessions";

// The pairing identity. Stored ONCE, on first fetch, and never rotated: the
// Worker pairs a DEVICE, and a device is this browser + this profile.
export const INSTALL_ID_KEY = "fash-install-id";

/* Pure UUIDv4 source. crypto.randomUUID is not in every service-worker
   runtime, so the shape is generated here and unit-tested in
   __tests__/install-id.test.mjs without a browser. */
export function newInstallId(uuidFn) {
  const c = uuidFn || (typeof crypto !== "undefined" && crypto.randomUUID
    ? () => crypto.randomUUID()
    : null);
  if (c) return String(c());
  const b = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [].concat(...Array.from(b, (x) => [x.toString(16).padStart(2, "0")]));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h
    .slice(8, 10)
    .join("")}-${h.slice(10, 16).join("")}`;
}

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

/* Memoized for the lifetime of the service worker: one storage read per worker
   wake-up, not one per request. A storage failure (private mode, quota) must
   never block a fetch — the id then lives in memory only for this session, and
   the honest consequence is that the Worker sees a new, unpaired device. */
let installIdPromise = null;
export function resetInstallIdCache() {
  installIdPromise = null;
}
export async function installId() {
  if (installIdPromise) return installIdPromise;
  installIdPromise = (async () => {
    try {
      const store = await chrome.storage.local.get(INSTALL_ID_KEY);
      const found = store && store[INSTALL_ID_KEY];
      if (found) return String(found);
      const fresh = newInstallId();
      await chrome.storage.local.set({ [INSTALL_ID_KEY]: fresh });
      return fresh;
    } catch (e) {
      return newInstallId();
    }
  })();
  return installIdPromise;
}

/** Header bag every call carries: which browser profile this is. */
export async function installHeaders(extra) {
  const out = { "X-Install-Id": await installId(), ...(extra || {}) };
  return out;
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
    headers: await installHeaders({ Accept: "application/json" })
  });
  if (!res.ok) throw new ApiError(res.status, "GET", path);
  return res.json().catch(() => ({}));
}

/** POST {API_BASE}{path} -> parsed JSON (throws ApiError on non-2xx). */
export async function apiPost(path, body) {
  const res = await fetch((await apiBase()) + path, {
    method: "POST",
    credentials: "include",
    headers: await installHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new ApiError(res.status, "POST", path);
  return res.json().catch(() => ({}));
}

/* ------------------------------------------------------------- job shapes */
/* GET /api/jobs?status=queued answers {ok, jobs, paired}.
   Everything below is TOLERANT on purpose: an unpaired install is answered
   with {jobs: []}, an older build answered with a bare array, and a shape we
   cannot read must read as "nothing to do" — never as a crash that also takes
   the local queue down with it. */
export function isUnpaired(data) {
  return !!(data && typeof data === "object" && data.paired === false);
}
export function parseJobList(data) {
  const raw = Array.isArray(data)
    ? data
    : (data && Array.isArray(data.jobs))
    ? data.jobs
    : (data && data.data && Array.isArray(data.data.jobs))
    ? data.data.jobs
    : [];
  return raw.filter((j) => j && j.id != null);
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

/** An UNPAIRED install is a gate event, not a transport failure: the route
 *  answered 200 and said {paired:false, jobs:[]}. Re-asking every minute cannot
 *  change that — only the seller pairing this device can — so it walks the same
 *  ladder a dead route does. The moment POST /api/devices/pair succeeds, the
 *  ladder is back at zero and polling resumes at full speed. */
export function gateAfterUnpaired(state, now) {
  return gateAfterFailure(state, now);
}

/** Retry policy shared by queue.js: max 3 attempts, exponential backoff. */
export const MAX_ATTEMPTS = 3;
export const RETRY_BASE_MS = 15000;
