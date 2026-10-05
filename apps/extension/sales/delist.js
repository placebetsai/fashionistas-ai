// sales/delist.js — the ONE-TAP DELETE half: enqueue the EXISTING delist path
// and audit every attempt.
//
// WHAT THIS FILE IS NOT
//   It does not delete anything itself and it contains no marketplace logic.
//   Deletion already exists and is reused verbatim:
//     * extension shops -> queue.js enqueue({type:"delist", shop, payload})
//       (the same path background.js runs for a queued delist job)
//     * any other path  -> POST /api/delist (functions/api/delist.js), which
//       queues D1 extension tasks for poshmark/mercari/depop/vinted/grailed/
//       facebook and calls the eBay/Etsy APIs directly
//   This module only decides WHICH shops to ask for, calls the injected
//   enqueuer, and writes one audit line per attempt with its outcome:
//   ok | failed | skipped. Nothing here ever posts, follows, shares or offers.
//
// `ok` MEANS ENQUEUED, NOT DELETED. The actual removal happens later in the
// seller's own session (or through the eBay/Etsy API) and is audited through
// GET /api/delist. Do not read "ok" as "the live listing is gone".

/** The audit vocabulary. Exactly three values, no exceptions. */
export const OUTCOMES = Object.freeze({ OK: "ok", FAILED: "failed", SKIPPED: "skipped" });

/**
 * Shops the existing delist path knows how to handle — byte-for-byte the
 * ALL_SHOPS list of functions/api/delist.js. Anything else is `skipped`, so a
 * future shop can never be reported as deleted when no path exists for it.
 */
export const DELISTABLE_SHOPS = Object.freeze([
  "ebay",
  "etsy",
  "poshmark",
  "mercari",
  "depop",
  "vinted",
  "grailed",
  "facebook"
]);

function nowIso(now) {
  const t = typeof now === "function" ? now() : now;
  return new Date(Number.isFinite(t) ? t : Date.now()).toISOString();
}

function errText(e) {
  return String((e && e.message) || e || "unknown_error").slice(0, 200);
}

/**
 * Run the confirmation the seller just tapped.
 *
 * @param {object}   deps
 * @param {object}   deps.sale    the sale event ({key, shop, listingRef, …})
 * @param {string[]} deps.shops   shops to delete FROM (the sold shop is
 *                                always skipped defensively)
 * @param {Function} [deps.enqueue] async (job) => result. job is
 *                                {type:"delist", shop, payload:{itemRef,
 *                                listingUrl, listingRef, title, price}}
 * @param {Function} [deps.log]   async (entry) => entry  audit sink
 * @param {number|Function} [deps.now]
 * @returns {Promise<{ok:boolean, results:object, entries:object[]}>}
 *          NEVER throws: an enqueuer that blows up becomes
 *          {outcome:"failed"} for that shop and the rest still run.
 */
export async function runDelist({ sale, shops = [], enqueue = null, log = null, now } = {}) {
  const results = {};
  const entries = [];
  const soldShop = sale && sale.shop ? String(sale.shop) : "";

  for (const rawShop of shops || []) {
    const shop = String(rawShop || "").trim();
    if (!shop) continue;

    let entry;
    if (!sale || !sale.key) {
      entry = { shop, outcome: OUTCOMES.SKIPPED, detail: "missing_sale" };
    } else if (shop === soldShop) {
      // The prompt never offers it; this is the belt-and-braces check.
      entry = { shop, outcome: OUTCOMES.SKIPPED, detail: "already_sold_here" };
    } else if (!DELISTABLE_SHOPS.includes(shop)) {
      entry = { shop, outcome: OUTCOMES.SKIPPED, detail: "unsupported_shop" };
    } else if (typeof enqueue !== "function") {
      entry = { shop, outcome: OUTCOMES.SKIPPED, detail: "no_delist_path" };
    } else {
      try {
        const res = await enqueue({
          type: "delist",
          shop,
          payload: {
            itemRef: sale.key,
            listingRef: sale.listingRef || "",
            listingUrl: sale.listingUrl || "",
            title: sale.title || "",
            price: sale.price != null ? sale.price : null
          }
        });
        if (res && res.ok === false) {
          entry = res.error === "no_delist_path"
            ? { shop, outcome: OUTCOMES.SKIPPED, detail: "no_delist_path" }
            : { shop, outcome: OUTCOMES.FAILED, detail: errText(res.error) };
        } else {
          entry = {
            shop,
            outcome: OUTCOMES.OK,
            detail: (res && (res.via || res.note)) || "enqueued"
          };
        }
      } catch (e) {
        entry = { shop, outcome: OUTCOMES.FAILED, detail: errText(e) };
      }
    }

    entry.saleKey = sale && sale.key ? sale.key : null;
    entry.fromShop = soldShop || null;
    entry.at = nowIso(now);
    entries.push(entry);
    results[shop] = entry;
    try {
      if (typeof log === "function") await log(entry);
    } catch (e) {
      // the audit sink must never be able to fail a delist attempt
      entry.logError = errText(e);
    }
  }

  const ok = entries.length > 0 && entries.every((e) => e.outcome !== OUTCOMES.FAILED);
  return { ok, results, entries };
}

/**
 * The audit sink: every attempt is kept locally (chrome.storage.local or any
 * {get,set}) and best-effort POSTed to /api/sales/delist-log so it survives a
 * lost device. A failed upload never drops the local copy.
 *
 * @param {object} [deps] {storage, apiPost, key, cap}
 */
export function createDelistLog({ storage = null, apiPost = null, key = "sales:delistLog", cap = 300 } = {}) {
  async function record(entry) {
    const e = Object.assign({}, entry);
    if (!e.at) e.at = nowIso();
    if (storage) {
      try {
        const cur = (await storage.get(key)) || [];
        await storage.set(key, [e].concat(Array.isArray(cur) ? cur : []).slice(0, cap));
      } catch (err) {
        e.storageError = errText(err);
      }
    }
    if (typeof apiPost === "function") {
      try {
        await apiPost("/api/sales/delist-log", e);
        e.uploaded = true;
      } catch (err) {
        e.uploaded = false; // kept locally; flushed again by the next attempt
      }
    }
    return e;
  }

  async function list() {
    if (!storage) return [];
    try {
      const cur = await storage.get(key);
      return Array.isArray(cur) ? cur : [];
    } catch (e) {
      return [];
    }
  }

  return { record, list, key };
}

/**
 * The enqueuer the product actually uses, built from whatever is available:
 *   1. the seller's own extension (the externally_connectable bridge that
 *      index.html already uses: {type:"delist", shop, payload}) — it runs the
 *      job in THEIR logged-in session,
 *   2. otherwise POST /api/delist, which queues the D1 extension task (or
 *      deletes through eBay/Etsy's API for those two shops).
 * Returns {ok:false, error:"no_delist_path"} when neither exists — reported as
 * `skipped`, never as a fake success.
 */
export function createDelistEnqueuer({ extSend = null, apiPost = null } = {}) {
  return async function enqueue(job) {
    if (typeof extSend === "function") {
      try {
        const r = await extSend({ type: "delist", shop: job.shop, payload: job.payload || {} });
        if (r && r.ok !== false) return Object.assign({ via: "extension" }, r);
        if (r && r.ok === false && r.error && r.error !== "extension_not_live") {
          return { ok: false, error: String(r.error).slice(0, 200) };
        }
      } catch (e) {
        // bridge unavailable -> fall through to the server queue
      }
    }
    if (typeof apiPost === "function") {
      const body = {
        sold: true,
        itemRef: (job.payload && job.payload.itemRef) || "",
        shops: [job.shop],
        listingRefs: { [job.shop]: (job.payload && job.payload.listingUrl) || "" }
      };
      const r = await apiPost("/api/delist", body);
      return Object.assign({ via: "api" }, r || {});
    }
    return { ok: false, error: "no_delist_path" };
  };
}

export default { OUTCOMES, DELISTABLE_SHOPS, runDelist, createDelistLog, createDelistEnqueuer };
