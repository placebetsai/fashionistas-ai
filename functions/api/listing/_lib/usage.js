/**
 * Entitlement + monthly counters for the AI routes, and the listings store
 * that /api/chat grounds on.
 *
 * WHY A SEPARATE TABLE (and not a SELECT COUNT(*))
 * The cap is a product promise ("10 listings/month on free") that has to be
 * answerable before we spend a model call, and it has to survive the listing
 * rows being deleted or edited. One row per user per UTC month with three
 * integer columns answers "how many this month" in one indexed read, and the
 * same table is where the AI-photo counter lives so the photo route shares one
 * meter instead of inventing a second one.
 *
 * ENTITLEMENT COMES FROM ONE PLACE: subscriptionState() in _lib/auth.js, i.e.
 * subscriptions.status — the same thing the paid routes gate on. `users.plan`
 * is deliberately NOT consulted (billing/webhook.js documents why: writing
 * users.plan alone used to leave a genuine buyer with 402 forever).
 *
 * CAPS (per calendar month, UTC):
 *            free      pro
 *   listings 10        unlimited
 *   ai_photos 3        100
 *   chat_messages 10   100      <- the spec names no cap for chat; this keeps
 *                                  chat on the same 10/100 ladder instead of
 *                                  inventing a new one.
 * `null` means unlimited — never Infinity, which JSON.stringify turns into
 * null anyway and a client reads as "0".
 *
 * The DDL below is checked in as
 * functions/api/listing/migrations/0001_ai_usage.sql as well; the lazy CREATE
 * TABLE IF NOT EXISTS here is how the rest of this repo (auth.js, closet,
 * tryon) makes a route work before anyone has run a migration, so the endpoint
 * is not blocked on `wrangler d1 execute --remote`.
 */

import { getDB, json, subscriptionState } from "../../_lib/auth.js";

export const USAGE_KINDS = ["listings", "ai_photos", "chat_messages"];

export const CAPS = {
  free: { listings: 10, ai_photos: 3, chat_messages: 10 },
  pro: { listings: null, ai_photos: 100, chat_messages: 100 },
};

const KIND_TEXT = {
  listings:
    "Free tier: 10 listings per month. Pro: unlimited listings. Upgrade from /pricing.",
  ai_photos: "Free tier: 3 AI photos per month. Pro: 100 AI photos per month. Upgrade from /pricing.",
  chat_messages:
    "Free tier: 10 stylist messages per month. Pro: 100 per month. Upgrade from /pricing.",
};

const USAGE_DDL = `CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  listings INTEGER NOT NULL DEFAULT 0,
  ai_photos INTEGER NOT NULL DEFAULT 0,
  chat_messages INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, month)
)`;

const LISTINGS_DDL = `CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  condition TEXT,
  brand TEXT,
  colour TEXT,
  size TEXT,
  price REAL,
  tags TEXT,
  hashtags TEXT,
  breakdown TEXT,
  model_provider TEXT,
  model_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`;

const LISTINGS_INDEX = "CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id, created_at)";

/* ------------------------------------------------------------ D1 shims */
/* D1 returns { results: [...] } / { meta: { changes } }; node:sqlite returns
 * bare arrays / { changes }. Normalise both so the tests exercise the real
 * handler without a second code path. */

export function rowsOf(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.results)) return res.results;
  return [];
}

export function changesOf(res) {
  if (!res) return null;
  if (res.meta && Number.isFinite(res.meta.changes)) return res.meta.changes;
  if (Number.isFinite(res.changes)) return res.changes;
  return null;
}

async function run(db, sql, binds = []) {
  if (binds.length) return db.prepare(sql).bind(...binds).run();
  return db.prepare(sql).run();
}

async function first(db, sql, binds = []) {
  if (binds.length) return db.prepare(sql).bind(...binds).first();
  return db.prepare(sql).first();
}

async function all(db, sql, binds = []) {
  const res = binds.length ? await db.prepare(sql).bind(...binds).all() : await db.prepare(sql).all();
  return rowsOf(res);
}

/** Lazy schema, safe on every request. Returns false only if DDL truly failed. */
export async function ensureUsageSchema(db) {
  const stmts = [USAGE_DDL, LISTINGS_DDL, LISTINGS_INDEX];
  for (const sql of stmts) {
    try {
      await run(db, sql);
    } catch (err) {
      const msg = String((err && err.message) || err);
      if (!/already exists|duplicate/i.test(msg)) throw err;
    }
  }
  return true;
}

/* ------------------------------------------------------------ time */

/** UTC month bucket: "2026-10". Counters reset on the 1st, not on signup. */
export function monthKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** ISO instant the counter resets — first millisecond of the next UTC month. */
export function resetsAt(month = monthKey()) {
  const [y, m] = month.split("-").map((n) => Number(n));
  return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString();
}

/* ------------------------------------------------------------ plan */

/**
 * 'pro' | 'free' from subscriptions.status, exactly like every paid route.
 * Returns { ok:false, error } when the lookup itself failed, so the caller
 * fails 500 instead of quietly treating a paying user as free.
 */
export async function planFor(env, userId) {
  const db = getDB(env);
  if (!db) return { ok: false, error: "server_not_configured" };
  const sub = await subscriptionState(env, userId);
  if (!sub.ok) return { ok: false, error: sub.error || "subscription_lookup_failed" };
  return { ok: true, plan: sub.status === "active" ? "pro" : "free", status: sub.status };
}

export function capFor(plan, kind) {
  const table = CAPS[plan] || CAPS.free;
  const cap = table[kind];
  return cap === undefined ? null : cap;
}

/* ------------------------------------------------------------ counters */

async function counterRow(db, userId, month) {
  const row = await first(db, "SELECT * FROM ai_usage WHERE user_id = ? AND month = ? LIMIT 1", [
    userId,
    month,
  ]);
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    listings: row ? num(row.listings) : 0,
    ai_photos: row ? num(row.ai_photos) : 0,
    chat_messages: row ? num(row.chat_messages) : 0,
  };
}

/**
 * Pre-flight quota check. `{ ok:true, plan, month, used, cap, remaining }`
 * where cap === null means unlimited, or `{ ok:false, response }` — return
 * `response` verbatim: a 402 that says exactly how many are left and when the
 * counter resets, never a vague "upgrade".
 */
export async function checkQuota(env, userId, kind) {
  if (!USAGE_KINDS.includes(kind)) {
    throw new Error(`checkQuota: unknown usage kind "${kind}"`);
  }
  const db = getDB(env);
  if (!db) {
    return {
      ok: false,
      response: json({ ok: false, error: "server_not_configured", detail: "No D1 binding." }, 500),
    };
  }

  const plan = await planFor(env, userId);
  if (!plan.ok) {
    return {
      ok: false,
      response: json({ ok: false, error: plan.error || "subscription_lookup_failed" }, 500),
    };
  }

  try {
    await ensureUsageSchema(db);
    const month = monthKey();
    const used = (await counterRow(db, userId, month))[kind];
    const cap = capFor(plan.plan, kind);
    const unlimited = cap === null;

    if (!unlimited && used >= cap) {
      return {
        ok: false,
        response: json(
          {
            ok: false,
            error: "quota_exceeded",
            code: `${kind}_quota_reached`,
            plan: plan.plan,
            kind,
            used,
            cap,
            remaining: 0,
            month,
            resetsAt: resetsAt(month),
            detail: KIND_TEXT[kind],
          },
          402
        ),
      };
    }
    return {
      ok: true,
      plan: plan.plan,
      month,
      used,
      cap,
      unlimited,
      remaining: unlimited ? null : cap - used,
      resetsAt: resetsAt(month),
    };
  } catch (err) {
    return {
      ok: false,
      response: json(
        { ok: false, error: "usage_lookup_failed", detail: String((err && err.message) || err) },
        500
      ),
    };
  }
}

/**
 * Burn one unit of `kind`. Called only AFTER the work succeeded, so a failed
 * model call never costs the user their free listing.
 *
 * Known limitation (stated, not hidden): check-then-increment is not
 * transactional, so two simultaneous requests near the cap could both pass the
 * pre-flight. Closing it needs a conditional UPDATE whose `changes` both D1 and
 * node:sqlite report identically; the product cost of the race is one extra
 * listing on a free tier, so it is accepted for now and not silently ignored.
 */
export async function charge(env, userId, kind) {
  if (!USAGE_KINDS.includes(kind)) throw new Error(`charge: unknown usage kind "${kind}"`);
  const db = getDB(env);
  if (!db) return { ok: false, error: "server_not_configured" };

  const month = monthKey();
  const sql =
    `INSERT INTO ai_usage (user_id, month, ${kind}) VALUES (?, ?, 1) ` +
    `ON CONFLICT(user_id, month) DO UPDATE SET ${kind} = ${kind} + 1, updated_at = datetime('now')`;
  try {
    await ensureUsageSchema(db);
    await run(db, sql, [userId, month]);
    const row = await counterRow(db, userId, month);
    return { ok: true, month, used: row[kind], row };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/** Response-shaped view of every counter for this user, this month. */
export async function usageSnapshot(env, userId) {
  const db = getDB(env);
  const month = monthKey();
  const empty = {
    plan: "free",
    month,
    listings: { used: 0, cap: 10, unlimited: false, remaining: 10 },
    ai_photos: { used: 0, cap: 3, unlimited: false, remaining: 3 },
    chat_messages: { used: 0, cap: 10, unlimited: false, remaining: 10 },
    resetsAt: resetsAt(month),
  };
  if (!db) return empty;

  const plan = await planFor(env, userId);
  if (!plan.ok) return empty;
  try {
    await ensureUsageSchema(db);
    const used = await counterRow(db, userId, month);
    const out = { plan: plan.plan, month, resetsAt: resetsAt(month) };
    for (const kind of USAGE_KINDS) {
      const cap = capFor(plan.plan, kind);
      const unlimited = cap === null;
      out[kind] = {
        used: used[kind],
        cap,
        unlimited,
        remaining: unlimited ? null : Math.max(0, cap - used[kind]),
      };
    }
    return out;
  } catch {
    return empty;
  }
}

/* ------------------------------------------------------------ listings */

function jsonParse(text, fallback) {
  if (typeof text !== "string" || !text) return fallback;
  try {
    const v = JSON.parse(text);
    return v === null || v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

/** Persist a validated listing. Returns its id, or null (never throws). */
export async function insertListing(env, userId, value, breakdown, model) {
  const db = getDB(env);
  if (!db) return null;
  try {
    await ensureUsageSchema(db);
    const res = await run(
      db,
      `INSERT INTO listings
         (user_id, title, description, category, condition, brand, colour, size,
          price, tags, hashtags, breakdown, model_provider, model_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        value.title,
        value.description,
        value.category,
        value.condition,
        value.brand,
        value.colour,
        value.size,
        value.price,
        JSON.stringify(value.tags),
        JSON.stringify(value.hashtags),
        JSON.stringify(breakdown),
        (model && model.provider) || null,
        (model && model.model) || null,
      ]
    );
    const id =
      (res && res.meta && res.meta.last_row_id) ||
      (res && res.lastInsertRowid) ||
      null;
    return id ? Number(id) : null;
  } catch (err) {
    console.error("[listing] insert failed:", (err && err.message) || err);
    return null;
  }
}

/** This user's generated listings, newest first, for chat grounding. */
export async function listListings(env, userId, limit = 20) {
  const db = getDB(env);
  if (!db) return [];
  try {
    await ensureUsageSchema(db);
    const rows = await all(
      db,
      `SELECT id, title, description, category, condition, brand, colour, size, price,
              tags, hashtags, created_at
         FROM listings
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?`,
      [userId, Math.max(1, Math.min(100, limit))]
    );
    return rows.map((r) => ({
      type: "listing",
      origin: "generated",
      id: Number(r.id),
      title: String(r.title || ""),
      description: String(r.description || ""),
      category: String(r.category || ""),
      condition: String(r.condition || ""),
      brand: String(r.brand || ""),
      colour: String(r.colour || ""),
      size: String(r.size || ""),
      price: r.price === null || r.price === undefined ? null : Number(r.price),
      tags: jsonParse(r.tags, []),
      hashtags: jsonParse(r.hashtags, []),
      created_at: r.created_at || null,
    }));
  } catch (err) {
    console.error("[listing] read failed:", (err && err.message) || err);
    return [];
  }
}

/**
 * The user's own closet rows (functions/api/closet/*), so the stylist can talk
 * about items the user already tracks even if they never ran the writer.
 * Matches the repo's identity convention: closet_items.user_id is TEXT and may
 * hold either the numeric id or the email (see userMatchSql in closet/clear.js).
 * Any shape mismatch is "no rows", never a 500 on a chat question.
 */
export async function listClosetItems(env, userId, email, limit = 20) {
  const db = getDB(env);
  if (!db) return [];
  const binds = [String(userId), userId];
  if (email) binds.push(String(email).toLowerCase());
  try {
    const rows = await all(
      db,
      `SELECT id, name, category, brand, condition, status,
              price_low, price_high, est_price_low, est_price_high
         FROM closet_items
        WHERE user_id = ? OR user_id = ? OR user_id = ?
        ORDER BY id DESC
        LIMIT ?`,
      [...binds, Math.max(1, Math.min(100, limit))]
    );
    const money = (a, b) => {
      const lo = Number(a);
      const hi = Number(b);
      if (Number.isFinite(lo) && Number.isFinite(hi) && (lo || hi)) return round2ish((lo + hi) / 2);
      if (Number.isFinite(lo) && lo) return round2ish(lo);
      if (Number.isFinite(hi) && hi) return round2ish(hi);
      return null;
    };
    const TERMINAL = ["sold", "donated", "discard", "discarded", "archived", "trashed", "recycled"];
    return rows
      .filter((r) => {
        const s = r.status === null || r.status === undefined ? "" : String(r.status).toLowerCase();
        return !TERMINAL.includes(s);
      })
      .map((r) => ({
        type: "listing",
        origin: "closet",
        id: Number(r.id),
        title: String(r.name || "").trim() || "(untitled item)",
        description: "",
        category: String(r.category || ""),
        condition: String(r.condition || ""),
        brand: String(r.brand || ""),
        colour: "",
        size: "",
        price: money(
          r.price_low !== undefined ? r.price_low : r.est_price_low,
          r.price_high !== undefined ? r.price_high : r.est_price_high
        ),
        tags: [],
        hashtags: [],
        created_at: null,
      }));
  } catch {
    return [];
  }
}

function round2ish(n) {
  return Math.round(Number(n) * 100) / 100;
}
