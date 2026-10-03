/**
 * /api/wear — wear logging, wear history, cost-per-wear and clear-it flags.
 *
 * POST /api/wear
 *   body: { item_id }  -> log a wear against an existing closet item
 *         { name, category?, brand?, condition?, cost_usd?, acquired_on?,
 *           est_price_low?, est_price_high?, context?, note?, worn_on? }
 *                             -> create the item (the user supplied every
 *                                field) and log its first wear
 *   200 { ok:true, item:{ item_id, times_worn, cost_usd, cost_per_wear_usd,
 *                         first_worn_on, last_worn_on, clear_it }, wear:{...} }
 *   401 { ok:false, error:"not_authenticated" }
 *   404 { ok:false, error:"item_not_found" }
 *   503 { ok:false, error:"storage_unavailable" | "write_failed" }
 *
 * GET /api/wear
 *   200 { wears:[{ item_id, worn_on, context, note, name, category }],
 *         items:[{ item_id, name, status, times_worn, first_worn_on,
 *                  last_worn_on, cost_usd, cost_per_wear_usd,
 *                  est_low_usd, est_high_usd, clear_it }],
 *         stats:{ listed, sold, total_earned_usd, sold_unpriced,
 *                 active_count, item_count, clear_it_count, total_wears } }
 *   Unknown / signed-out callers get the same shape with empty arrays and
 *   zeroed stats — never another user's closet, never a 500.
 *
 * cost_per_wear_usd = cost_usd / times_worn (null when never worn or free).
 * clear_it = true when the item has had no wear for 183+ days (last_worn_on,
 * or first_worn_on, or — never worn — acquired_on older than 6 months).
 */
import {
  json,
  dbOf,
  ensureSchema,
  pickUserColumn,
  resolveIdentity,
  describeItem,
  userMatchSql,
  loadItems,
  isTerminalStatus,
  utcDay,
  round2,
} from "./closet/clear.js";

const LISTED_STATUS = ["listed", "on_sale", "listing", "consignment", "pending"];
const SOLD_STATUS = ["sold", "sold_out"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function emptyFeed() {
  return {
    wears: [],
    items: [],
    stats: {
      listed: 0,
      sold: 0,
      total_earned_usd: 0,
      sold_unpriced: 0,
      active_count: 0,
      item_count: 0,
      clear_it_count: 0,
      total_wears: 0,
    },
  };
}

function str(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function num(v, fallback) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dayOr(v, fallback) {
  const s = str(v);
  return s && DAY_RE.test(s) ? s : fallback;
}

async function readBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

function publicItem(it) {
  return {
    item_id: it.item_id,
    name: it.name,
    status: it.status,
    times_worn: it.times_worn,
    first_worn_on: it.first_worn_on,
    last_worn_on: it.last_worn_on,
    cost_usd: it.cost_usd,
    cost_per_wear_usd: it.cost_per_wear_usd,
    est_low_usd: round2(it.est_low),
    est_high_usd: round2(it.est_high),
    clear_it: it.clear_it,
  };
}

function soldPrice(row) {
  const n =
    row.sold_price ??
    row.sale_price ??
    row.price_sold ??
    row.sold_for ??
    row.sold_amount ??
    row.revenue;
  return n === null || n === undefined || n === "" ? null : Number(n);
}

function computeStats(rows, totalWears, now) {
  const stats = {
    listed: 0,
    sold: 0,
    total_earned_usd: 0,
    sold_unpriced: 0,
    active_count: 0,
    item_count: rows.length,
    clear_it_count: 0,
    total_wears: totalWears,
  };
  let earned = 0;
  for (const row of rows) {
    const status = String(row.status || "").trim().toLowerCase();
    if (SOLD_STATUS.includes(status)) {
      stats.sold += 1;
      const price = soldPrice(row);
      if (price === null || !Number.isFinite(price)) stats.sold_unpriced += 1;
      else earned += price;
    } else if (!isTerminalStatus(status)) {
      stats.active_count += 1;
      if (LISTED_STATUS.includes(status)) stats.listed += 1;
      const it = describeItem(row, now);
      if (it.clear_it) stats.clear_it_count += 1;
    }
  }
  stats.total_earned_usd = round2(earned);
  return stats;
}

/* ------------------------------------------------------------------ GET --- */
async function handleGet(request, env) {
  try {
    const db = dbOf(env);
    const identity = await resolveIdentity(request, env);
    if (!db || !identity) return json(emptyFeed());

    const schema = await ensureSchema(db);
    const now = Date.now();
    const rows = await loadItems(db, identity, schema.closet, { activeOnly: false });

    const items = rows
      .map((row) => describeItem(row, now))
      .sort(
        (a, b) =>
          Number(b.clear_it) - Number(a.clear_it) ||
          (b.cost_per_wear_usd || 0) - (a.cost_per_wear_usd || 0) ||
          b.item_id - a.item_id
      )
      .map(publicItem);

    const wearCol = pickUserColumn(schema.wear);
    const match = userMatchSql(wearCol, identity);
    const wearSql =
      "SELECT w.id, w.item_id, w.worn_on, w.context, w.note, i.name, i.category " +
      "FROM wear_logs w LEFT JOIN closet_items i ON i.id = w.item_id WHERE (" +
      match.sql +
      ") ORDER BY w.worn_on DESC, w.id DESC LIMIT 50";
    const wearRes = await db.prepare(wearSql).bind(...match.bind).all();
    const wears = ((wearRes && wearRes.results) || []).map((w) => ({
      item_id: w.item_id,
      worn_on: w.worn_on,
      context: w.context || null,
      note: w.note || null,
      name: w.name || null,
      category: w.category || null,
    }));

    const countSql =
      "SELECT COUNT(*) AS n FROM wear_logs WHERE (" + match.sql + ")";
    const countRes = await db.prepare(countSql).bind(...match.bind).first();
    const totalWears = num(countRes && countRes.n, wears.length);

    return json({ wears, items, stats: computeStats(rows, totalWears, now) });
  } catch (e) {
    console.error("api/wear GET failed:", e && e.message);
    return json(emptyFeed());
  }
}

/* ----------------------------------------------------------------- POST --- */
async function findItem(db, schema, identity, itemId) {
  const col = pickUserColumn(schema.closet);
  const match = userMatchSql(col, identity);
  const res = await db
    .prepare("SELECT * FROM closet_items WHERE id = ? AND (" + match.sql + ")")
    .bind(itemId, ...match.bind)
    .all();
  const rows = (res && res.results) || [];
  return rows.length ? rows[0] : null;
}

async function createItem(db, schema, identity, body, today) {
  const col = pickUserColumn(schema.closet);
  const fields = [
    col,
    "name",
    "category",
    "brand",
    "condition",
    "cost_usd",
    "acquired_on",
    "status",
    "times_worn",
    "est_price_low",
    "est_price_high",
    "price_low",
    "price_high",
  ];
  const values = [
    identity.key,
    str(body.name),
    str(body.category),
    str(body.brand),
    str(body.condition),
    num(body.cost_usd, 0),
    dayOr(body.acquired_on, today),
    "active",
    0,
    num(body.est_price_low, null),
    num(body.est_price_high, null),
    num(body.price_low, num(body.est_price_low, null)),
    num(body.price_high, num(body.est_price_high, null)),
  ];
  const sql =
    "INSERT INTO closet_items (" +
    fields.join(",") +
    ") VALUES (" +
    fields.map(() => "?").join(",") +
    ")";
  const res = await db.prepare(sql).bind(...values).run();
  const id = res && res.meta ? res.meta.last_row_id : null;
  return id ? Number(id) : null;
}

async function handlePost(request, env) {
  let identity = null;
  try {
    identity = await resolveIdentity(request, env);
  } catch {
    identity = null;
  }
  if (!identity) return json({ ok: false, error: "not_authenticated" }, 401);

  const db = dbOf(env);
  if (!db) return json({ ok: false, error: "storage_unavailable" }, 503);

  try {
    const body = await readBody(request);
    const today = utcDay(Date.now());
    const wornOn = dayOr(body.worn_on, today);
    const schema = await ensureSchema(db);

    let itemId = body.item_id !== undefined && body.item_id !== null ? Number(body.item_id) : NaN;
    if (!Number.isFinite(itemId)) itemId = NaN;

    if (!Number.isFinite(itemId) && str(body.name)) {
      itemId = await createItem(db, schema, identity, body, today);
      if (!itemId) return json({ ok: false, error: "write_failed" }, 503);
    }
    if (!Number.isFinite(itemId)) {
      return json({ ok: false, error: "item_id_or_name_required" }, 400);
    }

    const before = await findItem(db, schema, identity, itemId);
    if (!before) return json({ ok: false, error: "item_not_found" }, 404);

    const wearUserCol = pickUserColumn(schema.wear);
    await db
      .prepare(
        "INSERT INTO wear_logs (" +
          wearUserCol +
          ", item_id, worn_on, context, note) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(identity.key, itemId, wornOn, str(body.context), str(body.note))
      .run();

    await db
      .prepare(
        "UPDATE closet_items SET " +
          "times_worn = COALESCE(times_worn, 0) + 1, " +
          "first_worn_on = CASE WHEN first_worn_on IS NULL OR first_worn_on = '' OR first_worn_on > ? " +
          "THEN ? ELSE first_worn_on END, " +
          "last_worn_on = CASE WHEN last_worn_on IS NULL OR last_worn_on < ? THEN ? ELSE last_worn_on END " +
          "WHERE id = ?"
      )
      .bind(wornOn, wornOn, wornOn, wornOn, itemId)
      .run();

    const after = await findItem(db, schema, identity, itemId);
    const it = describeItem(after || before, Date.now());

    return json({
      ok: true,
      item: {
        item_id: it.item_id,
        name: it.name,
        times_worn: it.times_worn,
        first_worn_on: it.first_worn_on,
        last_worn_on: it.last_worn_on,
        cost_usd: it.cost_usd,
        cost_per_wear_usd: it.cost_per_wear_usd,
        clear_it: it.clear_it,
      },
      wear: { item_id: itemId, worn_on: wornOn, context: str(body.context), note: str(body.note) },
    });
  } catch (e) {
    console.error("api/wear POST failed:", e && e.message);
    return json({ ok: false, error: "write_failed" }, 503);
  }
}

export async function onRequestGet(context) {
  return handleGet(context.request, context.env);
}

export async function onRequestPost(context) {
  return handlePost(context.request, context.env);
}
