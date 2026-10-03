/**
 * GET/POST /api/closet/clear — what to sell, donate or keep, and what it is worth.
 *
 * Always returns EXACTLY these top-level keys, even when signed out, when the
 * auth lane is not deployed yet, or when no D1 binding exists:
 *   {
 *     "sell":    [{ "item_id": n, "reason": "...", "est_usd": n }, ...],
 *     "donate":  [{ "item_id": n, "reason": "...", "est_usd": n }, ...],
 *     "keep":    [{ "item_id": n, "reason": "...", "est_usd": n }, ...],
 *     "total_usd": <number>,
 *     "bundles": [{ "item_ids": [n, ...], "est_usd": n }, ...]
 *   }
 *
 * total_usd is the sum of the per-item estimates of the SELL rows — it is
 * computed from real est_price_low / est_price_high (or price_low / price_high)
 * rows in D1. No items in the closet => empty arrays and total_usd 0. Nothing
 * is invented to make the number look good.
 *
 * Storage: D1 binding `env.DB` (fallbacks: env.D1, env.FASHIONISTAS_DB,
 * env.D1_DATABASE, env.DATABASE). Tables `closet_items` and `wear_logs` are
 * created lazily with CREATE TABLE IF NOT EXISTS inside the handler.
 */

import { requireAuth } from "../_lib/auth.js";
/* ---------------------------------------------------------------------------
 * Decision thresholds — every reason string below is built from these.
 * ------------------------------------------------------------------------ */
export const T = {
  UNWORN_DAYS: 183, // 6 months with no wear (or never worn + bought 6mo ago)
  RECENT_DAYS: 30, // worn in the last 30 days = still in rotation
  LOW_VALUE_MID: 15, // est midpoint under $15 = low resale value
  GOOD_VALUE_MID: 25, // est midpoint $25+ = good resale value
  CPW_KEEP: 5, // $5+/wear or more = worth keeping in the closet
  BUNDLE_ITEM_MAX: 15, // single items under $15 mid sell better bundled
  BUNDLE_MAX_SIZE: 4, // never more than 4 items per suggested bundle
  BUNDLE_MAX: 24, // hard cap so the payload stays small
};

const TERMINAL_STATUS = [
  "sold",
  "donated",
  "discard",
  "discarded",
  "archived",
  "trashed",
  "given",
  "recycled",
  "disposed",
];

const USER_COLUMNS = ["user_id", "userId", "owner_id", "account_id", "user", "email"];

const SESSION_COOKIE_NAMES = [
  "session",
  "session_id",
  "sid",
  "fash_session",
  "fashionistas_session",
  "auth_session",
  "auth_token",
  "access_token",
  "token",
];

const JWT_RE = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}$/;

/* ---------------------------------------------------------------------------
 * Small helpers (reused by functions/api/wear.js)
 * ------------------------------------------------------------------------ */
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function emptyPlan() {
  return { sell: [], donate: [], keep: [], total_usd: 0, bundles: [] };
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function money(n) {
  return "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

function firstNum(...vals) {
  for (const v of vals) {
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj ? obj[k] : undefined;
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

/** "2026-01-05" / "2026-01-05 12:00:00" -> epoch ms, or null. */
export function dayMs(value) {
  if (!value) return null;
  const day = String(value).slice(0, 10);
  const ms = Date.parse(day + "T00:00:00Z");
  return Number.isFinite(ms) ? ms : null;
}

function daysSince(ms, now) {
  if (ms === null) return null;
  return Math.floor((now - ms) / 86400000);
}

function dateStr(ms) {
  return ms === null ? "unknown date" : new Date(ms).toISOString().slice(0, 10);
}

export function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------------
 * Identity — session-authenticated, degrades to null (anonymous) not 500.
 * ------------------------------------------------------------------------ */
function readCookies(request) {
  const jar = new Map();
  const raw = (request && request.headers && request.headers.get("Cookie")) || "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p) continue;
    const i = p.indexOf("=");
    if (i < 1) continue;
    const name = p.slice(0, i).trim();
    let value = p.slice(i + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep raw */
    }
    jar.set(name, value);
  }
  return jar;
}

function b64urlToJson(part) {
  try {
    let s = String(part).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return JSON.parse(atob(s));
  } catch {
    return null;
  }
}

function b64urlFromBytes(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSignB64Url(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64urlFromBytes(sig);
}

function identityFromRecord(me) {
  if (!me || typeof me !== "object") return null;
  if (me.authenticated === false || me.ok === false) return null;
  const u = me.user && typeof me.user === "object" ? me.user : null;
  const id = pick(me, ["user_id", "id", "sub", "uid"]) || pick(u, ["user_id", "id", "sub", "uid"]);
  const email = pick(me, ["email"]) || pick(u, ["email"]);
  if (id !== null) return { key: String(id), email: email ? String(email).toLowerCase() : null };
  if (email !== null) return { key: String(email).toLowerCase(), email: String(email).toLowerCase() };
  return null;
}

function pickSessionCookie(jar) {
  for (const name of SESSION_COOKIE_NAMES) {
    const v = jar.get(name);
    if (v && v.length > 8) return v;
  }
  for (const value of jar.values()) {
    if (JWT_RE.test(value)) return value;
  }
  return null;
}

async function identityFromJwt(raw, env) {
  const parts = String(raw).split(".");
  if (parts.length !== 3) return null;
  const payload = b64urlToJson(parts[1]);
  if (!payload || typeof payload !== "object") return null;

  // Verify the signature when a shared secret is bound; without one there is
  // nothing to check against, so the signed-auth route above stays canonical.
  const secret = pick(env, [
    "AUTH_SECRET",
    "SESSION_SECRET",
    "JWT_SECRET",
    "FASHIONISTAS_SECRET",
    "TOKEN_SECRET",
  ]);
  if (secret) {
    try {
      const expect = await hmacSignB64Url(secret, parts[0] + "." + parts[1]);
      if (expect !== parts[2]) return null;
    } catch {
      return null;
    }
  }
  const id = pick(payload, ["sub", "uid", "user_id", "id"]);
  const email = pick(payload, ["email"]);
  if (id !== null) return { key: String(id), email: email ? String(email).toLowerCase() : null };
  if (email !== null) return { key: String(email).toLowerCase(), email: String(email).toLowerCase() };
  return null;
}

/**
 * Resolves the signed-in user, or null when we cannot vouch for who is asking.
 * null means "show nothing" — never someone else's closet.
 */

/** Resolve a raw session token (Bearer) to the shared identity shape. */
async function identityFromSessionToken(token, env) {
  const db = dbOf(env);
  if (!db || typeof db.prepare !== "function") return null;
  try {
    const row = await db
      .prepare(
        `SELECT u.id AS id, u.email AS email
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token = ? AND s.expires_at > ?
          LIMIT 1`
      )
      .bind(token, Math.floor(Date.now() / 1000))
      .first();
    if (!row) return null;
    return { key: String(row.id), email: row.email ? String(row.email).toLowerCase() : null };
  } catch {
    return null;
  }
}

export async function resolveIdentity(request, env) {
  // 0) API clients: `Authorization: Bearer <session token>`. Resolved straight
  //    against D1 — the same credential the auth gate accepts, so a Bearer
  //    caller is not authenticated at the gate and then dropped downstream.
  const authz = request.headers.get("Authorization") || "";
  const bm = /^\s*Bearer\s+(\S+)\s*$/i.exec(authz);
  if (bm) {
    const ident = await identityFromSessionToken(bm[1], env);
    if (ident) return ident;
  }

  let jar;
  try {
    jar = readCookies(request);
  } catch {
    return null;
  }
  if (!jar.size) return null;

  // 1) Canonical: let the auth route itself vouch for this cookie. Works as
  //    soon as the auth lane is deployed; a 404 / non-JSON reply just falls
  //    through instead of failing.
  try {
    const res = await fetch(new URL("/api/auth/me", request.url).href, {
      headers: { cookie: request.headers.get("Cookie") || "" },
      signal: AbortSignal.timeout(2500),
      redirect: "manual",
    });
    if (res && res.ok && String(res.headers.get("content-type") || "").includes("json")) {
      const me = await res.json();
      const ident = identityFromRecord(me);
      if (ident) return ident;
    }
  } catch {
    /* auth route not deployed yet — fall through */
  }

  // 2) Fallback: decode the session cookie locally.
  const raw = pickSessionCookie(jar);
  if (!raw) return null;
  try {
    return await identityFromJwt(raw, env);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * D1 — binding lookup, lazy schema, defensive column discovery.
 * ------------------------------------------------------------------------ */
export function dbOf(env) {
  if (!env) return null;
  return env.DB || env.D1 || env.FASHIONISTAS_DB || env.D1_DATABASE || env.DATABASE || null;
}

const CLOSET_COLUMNS = [
  ["id", "INTEGER PRIMARY KEY AUTOINCREMENT"],
  ["user_id", "TEXT"],
  ["name", "TEXT"],
  ["category", "TEXT"],
  ["brand", "TEXT"],
  ["condition", "TEXT"],
  ["cost_usd", "REAL DEFAULT 0"],
  ["acquired_on", "TEXT"],
  ["status", "TEXT DEFAULT 'active'"],
  ["times_worn", "INTEGER DEFAULT 0"],
  ["first_worn_on", "TEXT"],
  ["last_worn_on", "TEXT"],
  ["est_price_low", "REAL"],
  ["est_price_high", "REAL"],
  ["price_low", "REAL"],
  ["price_high", "REAL"],
  ["sold_price", "REAL"],
  ["sold_on", "TEXT"],
  ["created_at", "TEXT DEFAULT (datetime('now'))"],
];

const WEAR_COLUMNS = [
  ["id", "INTEGER PRIMARY KEY AUTOINCREMENT"],
  ["user_id", "TEXT"],
  ["item_id", "INTEGER"],
  ["worn_on", "TEXT"],
  ["context", "TEXT"],
  ["note", "TEXT"],
  ["created_at", "TEXT DEFAULT (datetime('now'))"],
];

const CLOSET_DDL = `CREATE TABLE IF NOT EXISTS closet_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT,
  category TEXT,
  brand TEXT,
  condition TEXT,
  cost_usd REAL DEFAULT 0,
  acquired_on TEXT,
  status TEXT DEFAULT 'active',
  times_worn INTEGER DEFAULT 0,
  first_worn_on TEXT,
  last_worn_on TEXT,
  est_price_low REAL,
  est_price_high REAL,
  price_low REAL,
  price_high REAL,
  sold_price REAL,
  sold_on TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`;

const WEAR_DDL = `CREATE TABLE IF NOT EXISTS wear_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  item_id INTEGER,
  worn_on TEXT,
  context TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`;

const INDEX_DDL = [
  "CREATE INDEX IF NOT EXISTS idx_closet_items_user ON closet_items(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_closet_items_user_status ON closet_items(user_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_wear_logs_user_worn ON wear_logs(user_id, worn_on)",
  "CREATE INDEX IF NOT EXISTS idx_wear_logs_item ON wear_logs(item_id)",
];

async function tableColumns(db, table) {
  const rows = await db.prepare("PRAGMA table_info(" + table + ")").all();
  const list = (rows && rows.results) || [];
  return new Set(list.map((c) => c.name));
}

async function addMissingColumns(db, table, cols, defs) {
  for (const [name, type] of defs) {
    if (cols.has(name)) continue;
    try {
      await db.exec("ALTER TABLE " + table + " ADD COLUMN " + name + " " + type);
      cols.add(name);
    } catch (e) {
      /* another lane added it concurrently, or the type is not alterable */
    }
  }
}

/** Creates closet_items / wear_logs lazily; safe to call on every request. */
export async function ensureSchema(db) {
  await db.exec(CLOSET_DDL);
  await db.exec(WEAR_DDL);

  const closetCols = await tableColumns(db, "closet_items");
  await addMissingColumns(db, "closet_items", closetCols, CLOSET_COLUMNS);

  const wearCols = await tableColumns(db, "wear_logs");
  await addMissingColumns(db, "wear_logs", wearCols, WEAR_COLUMNS);

  for (const sql of INDEX_DDL) {
    try {
      await db.exec(sql);
    } catch {
      /* index already exists / table shape differs */
    }
  }
  return { closet: closetCols, wear: wearCols };
}

export function pickUserColumn(cols) {
  for (const c of USER_COLUMNS) if (cols.has(c)) return c;
  return "user_id";
}

/* ---------------------------------------------------------------------------
 * Item description: estimates, wear age, cost-per-wear, clear-it flag.
 * ------------------------------------------------------------------------ */
export function describeItem(row, now) {
  const id = firstNum(row.id, row.item_id);
  const low = firstNum(row.est_price_low, row.price_low, row.price_min, row.est_low);
  const high = firstNum(row.est_price_high, row.price_high, row.price_max, row.est_high);
  const mid = low || high ? (low && high ? (low + high) / 2 : low || high) : 0;

  const cost = Math.max(0, firstNum(row.cost_usd, row.cost, row.price_paid));
  const timesWorn = Math.max(0, Math.round(firstNum(row.times_worn, row.wear_count)));

  const lastMs = dayMs(row.last_worn_on) ?? dayMs(row.first_worn_on);
  const acquiredMs = dayMs(row.acquired_on);
  const lastKnownMs = lastMs ?? acquiredMs;
  const neverWorn = lastMs === null;

  const sinceWornDays = lastMs === null ? null : daysSince(lastMs, now);
  const ageDays = acquiredMs === null ? null : daysSince(acquiredMs, now);

  // Clear-it: no wear for 6+ months — either the last wear or, for something
  // never worn at all, the day it was bought.
  const dormantDays = lastMs !== null ? sinceWornDays : ageDays;
  const clearIt = dormantDays !== null && dormantDays >= T.UNWORN_DAYS;

  const cpw = timesWorn > 0 && cost > 0 ? round2(cost / timesWorn) : null;

  return {
    item_id: id,
    name: row.name || "",
    category: row.category || "",
    status: row.status || "",
    cost_usd: round2(cost),
    times_worn: timesWorn,
    cost_per_wear_usd: cpw,
    first_worn_on: row.first_worn_on || null,
    last_worn_on: row.last_worn_on || null,
    acquired_on: row.acquired_on || null,
    est_low: low,
    est_high: high,
    est_mid: mid,
    est_usd: round2(mid),
    sold_price: row.sold_price === undefined ? null : row.sold_price,
    since_worn_days: sinceWornDays,
    age_days: ageDays,
    last_known_ms: lastKnownMs,
    last_worn_ms: lastMs,
    never_worn: neverWorn,
    clear_it: clearIt,
  };
}

/**
 * The whole decision tree. Every branch ends in a bucket plus a sentence a
 * human can read back and disagree with.
 *
 *  1. worn in the last 30 days            -> keep  (loved / in rotation)
 *  2. dormant 6+ months
 *       est midpoint < $15                -> donate (low resale value)
 *       otherwise                          -> sell   (unworn but has demand)
 *  3. est midpoint >= $25                  -> sell   (good resale value)
 *  4. never worn, bought < 6 months ago    -> keep  (give it a season)
 *  5. cost-per-wear >= $5                  -> keep  (paid up, cheap per use)
 *  6. no estimate on file                  -> keep  (cannot price it yet)
 *  7. est midpoint < $15                   -> sell   (bundled, not solo)
 *  8. everything else                      -> sell   (mid $15-$25, not dormant)
 */
export function decide(it) {
  const mid = it.est_mid;

  if (it.since_worn_days !== null && it.since_worn_days <= T.RECENT_DAYS) {
    return {
      bucket: "keep",
      reason:
        "Worn " +
        dateStr(it.last_worn_ms) +
        " (" +
        it.since_worn_days +
        "d ago) — still in rotation, keep it.",
    };
  }

  if (it.clear_it) {
    const since = dateStr(it.last_known_ms);
    const gap = it.since_worn_days ?? it.age_days;
    if (mid < T.LOW_VALUE_MID) {
      return {
        bucket: "donate",
        reason:
          "No wear since " +
          since +
          " (" +
          gap +
          "d) and only about " +
          money(mid) +
          " resale value — donate it.",
      };
    }
    return {
      bucket: "sell",
      reason:
        "Unworn since " +
        since +
        " but still worth an estimated " +
        money(it.est_low) +
        "–" +
        money(it.est_high) +
        " — list it.",
    };
  }

  if (mid >= T.GOOD_VALUE_MID) {
    return {
      bucket: "sell",
      reason: "Estimated resale " + money(it.est_low) + "–" + money(it.est_high) + " — worth listing now.",
    };
  }

  if (it.never_worn && it.times_worn === 0 && it.age_days !== null) {
    return {
      bucket: "keep",
      reason: "Bought " + dateStr(dayMs(it.acquired_on)) + " and never worn — give it a season first.",
    };
  }

  if (it.times_worn > 0 && it.cost_per_wear_usd !== null && it.cost_per_wear_usd >= T.CPW_KEEP) {
    return {
      bucket: "keep",
      reason:
        money(it.cost_usd) +
        " ÷ " +
        it.times_worn +
        " wears = " +
        money(it.cost_per_wear_usd) +
        " a wear — worth more in your closet than after seller fees.",
    };
  }

  if (mid <= 0) {
    return { bucket: "keep", reason: "No price estimate on file yet — kept until it is priced." };
  }

  if (mid < T.LOW_VALUE_MID) {
    return {
      bucket: "sell",
      reason:
        "Only about " +
        money(mid) +
        " on its own — bundle it with similar pieces so it is worth posting.",
    };
  }

  const when =
    it.since_worn_days === null
      ? "No wear logged yet"
      : "Last worn " + it.since_worn_days + "d ago";
  return {
    bucket: "sell",
    reason: when + ", estimated " + money(it.est_low) + "–" + money(it.est_high) + " — list it.",
  };
}

/** Builds the /api/closet/clear payload from real closet_items rows. */
export function buildPlan(rows, now) {
  const nowMs = now || Date.now();
  const buckets = { sell: [], donate: [], keep: [] };
  const meta = [];

  for (const row of rows || []) {
    const it = describeItem(row, nowMs);
    const d = decide(it);
    buckets[d.bucket].push({ item_id: it.item_id, reason: d.reason, est_usd: it.est_usd });
    meta.push({ bucket: d.bucket, mid: it.est_mid, category: it.category, item_id: it.item_id });
  }

  const byValue = (a, b) => b.est_usd - a.est_usd || a.item_id - b.item_id;
  buckets.sell.sort(byValue);
  buckets.donate.sort(byValue);
  buckets.keep.sort(byValue);

  const total = round2(buckets.sell.reduce((sum, r) => sum + r.est_usd, 0));

  return {
    sell: buckets.sell,
    donate: buckets.donate,
    keep: buckets.keep,
    total_usd: total,
    bundles: buildBundles(meta),
  };
}

/**
 * Low-value sell rows travel together: same category first, max BUNDLE_MAX_SIZE
 * per bundle, never a bundle of one.
 */
function buildBundles(meta) {
  const low = meta.filter(
    (m) => m.bucket === "sell" && m.mid > 0 && m.mid < T.BUNDLE_ITEM_MAX
  );
  if (low.length < 2) return [];

  const groups = new Map();
  for (const m of low) {
    const key = String(m.category || "").trim().toLowerCase() || "misc";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  const bundles = [];
  for (const items of groups.values()) {
    items.sort((a, b) => a.mid - b.mid || a.item_id - b.item_id);
    let size = T.BUNDLE_MAX_SIZE;
    if (items.length % size === 1 && items.length > 1) size -= 1; // never a bundle of one
    const chunks = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    const tail = chunks[chunks.length - 1];
    if (chunks.length > 1 && tail && tail.length === 1) {
      // a dangling single joins the previous bundle instead of being dropped
      chunks.pop();
      chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(tail);
    }
    for (const chunk of chunks) {
      if (chunk.length < 2) continue;
      bundles.push({
        item_ids: chunk.map((m) => m.item_id),
        est_usd: round2(chunk.reduce((sum, m) => sum + m.mid, 0)),
      });
      if (bundles.length >= T.BUNDLE_MAX) break;
    }
    if (bundles.length >= T.BUNDLE_MAX) break;
  }
  bundles.sort((a, b) => b.est_usd - a.est_usd);
  return bundles;
}

/* ---------------------------------------------------------------------------
 * Reading the closet.
 * ------------------------------------------------------------------------ */
export function isTerminalStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return TERMINAL_STATUS.includes(s);
}

/** "user_id = ? [ OR user_id = ? ]" plus its binds, never string-interpolated input. */
export function userMatchSql(col, identity) {
  let sql = col + " = ?";
  const bind = [identity.key];
  if (identity.email && identity.email !== identity.key) {
    sql += " OR " + col + " = ?";
    bind.push(identity.email);
  }
  return { sql, bind };
}

export async function loadItems(db, identity, cols, opts) {
  const col = pickUserColumn(cols);
  const match = userMatchSql(col, identity);
  let sql = "SELECT * FROM closet_items WHERE (" + match.sql + ")";
  const bind = match.bind.slice();
  if (!opts || opts.activeOnly) {
    sql +=
      " AND (status IS NULL OR lower(status) NOT IN (" +
      TERMINAL_STATUS.map((s) => "'" + s + "'").join(",") +
      "))";
  }
  if (opts && opts.orderBy) sql += " ORDER BY " + opts.orderBy;
  if (opts && opts.limit) sql += " LIMIT " + Math.max(1, Math.min(2000, opts.limit | 0));
  const res = await db.prepare(sql).bind(...bind).all();
  return (res && res.results) || [];
}

/* ---------------------------------------------------------------------------
 * Handler.
 * ------------------------------------------------------------------------ */
async function handleClear(request, env) {
  try {
    const db = dbOf(env);
    if (!db) return json(emptyPlan());
    const identity = await resolveIdentity(request, env);
    if (!identity) return json(emptyPlan());
    const cols = await ensureSchema(db);
    const rows = await loadItems(db, identity, cols.closet, { activeOnly: true });
    return json(buildPlan(rows));
  } catch (e) {
    console.error("closet/clear failed:", e && e.message);
    return json(emptyPlan());
  }
}

export async function onRequestGet(context) {
  // Auth gate: no valid session token → 401, on every non-OPTIONS method.
  if (context.request.method !== "OPTIONS") {
    const __gate = await requireAuth(context.request, context.env);
    if (__gate.response) return __gate.response;
    context.__user = __gate.user;
  }
  return handleClear(context.request, context.env);
}

export async function onRequestPost(context) {
  // Auth gate: no valid session token → 401, on every non-OPTIONS method.
  if (context.request.method !== "OPTIONS") {
    const __gate = await requireAuth(context.request, context.env);
    if (__gate.response) return __gate.response;
    context.__user = __gate.user;
  }
  return handleClear(context.request, context.env);
}
