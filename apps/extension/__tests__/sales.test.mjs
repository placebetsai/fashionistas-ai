// apps/extension/__tests__/sales.test.mjs — offline tests for Phase 2 (sale detection).
//
// Run:  node --test apps/extension/__tests__/sales.test.mjs
//
// WHAT IS PROVEN HERE (offline, deterministic):
//   * registry idempotency — one event per listing, ever (re-scans don't re-fire)
//   * the 3-consecutive-failures rule — an unreadable item is parked as
//     needs_input with exactly one report line, then never blocks the scan
//   * the DOM reader (saleskit) against REAL jsdom pages: sold / clean /
//     login wall / CAPTCHA / empty closet / changed marketplace DOM
//   * the driver never throws — every wall becomes a skipped/needs_input result
//   * every delist attempt is audited with an outcome in {ok, failed, skipped}
//   * the prompt model shape index.html will render: {title, options[], confirm}
//   * ZERO inline selectors — marketplace literals live only in the selector
//     source (sold-selectors.js); logic files are data-driven
//
// WHAT IS NOT PROVEN HERE (labeled honestly in the phase report):
//   * a real marketplace page scanned (no logged-in session exists in CI)
//   * a real D1 insert (covered against local SQLite by
//     functions/api/sales/__tests__/sales-api.test.mjs, not remote D1)
//   * a delist completing on a live site

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SALES_DIR = path.join(HERE, "..", "sales");

import {
  saleKey,
  makeSaleEvent,
  acceptNew,
  pushEvent,
  emptyState,
} from "../sales/registry.js";
import {
  STRIKE_LIMIT,
  isParked,
  noteFailure,
  noteSuccess,
  reportLine,
} from "../sales/failures.js";
import {
  SALES_SHOPS,
  SOLD_SELECTORS,
  soldSelFor,
  withSoldSel,
} from "../sales/sold-selectors.js";
import { buildPrompt } from "../sales/prompt.js";
import {
  OUTCOMES,
  DELISTABLE_SHOPS,
  runDelist,
  createDelistLog,
  createDelistEnqueuer,
} from "../sales/delist.js";
import {
  scanAndRecord,
  resolveDetectLogin,
  loadState,
  saveState,
} from "../sales/driver.js";
import { selectorsFor } from "../config/selectors.js";

/* --------------------------------------------------------------- DOM harness
   saleskit.js is a classic script (no imports): it installs one global,
   globalThis.__fashSales, exactly like content/formkit.js installs
   globalThis.__fashForm. Load it once, then point the DOM globals at a fresh
   jsdom page per fixture. */

function useDom(html, url = "https://www.poshmark.com/mycloset") {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  const w = dom.window;
  globalThis.window = w;
  globalThis.document = w.document;
  globalThis.location = w.location;
  globalThis.getComputedStyle = w.getComputedStyle.bind(w);
  globalThis.Event = w.Event;
  return dom;
}

await import("../sales/saleskit.js");
const K = globalThis.__fashSales;
assert.ok(K && typeof K.scanSold === "function", "saleskit must install __fashSales");

/** SEL exactly as the driver builds it: config listingPattern + sold block. */
function selFor(shop) {
  return withSoldSel(selectorsFor(shop) || {}, shop);
}

const freshKitState = () => ({ failures: {}, gaveUp: [] });

function fakeStorage() {
  const map = new Map();
  return {
    map,
    async get(k) { return map.has(k) ? map.get(k) : null; },
    async set(k, v) { map.set(k, v); },
  };
}

/* ============================================================ 1) registry */

test("saleKey is derived from shop + listingRef, never generated", () => {
  assert.equal(saleKey("poshmark", "/listing/A-1"), "poshmark:/listing/A-1");
  assert.equal(saleKey("", "/listing/A-1"), null);
  assert.equal(saleKey("poshmark", ""), null);
  assert.equal(saleKey("poshmark", "  "), null);
});

test("makeSaleEvent rejects items with no identity — an event we cannot de-duplicate is worse than none", () => {
  assert.equal(makeSaleEvent(null), null);
  assert.equal(makeSaleEvent({ shop: "poshmark" }), null);
  const e = makeSaleEvent(
    { shop: "poshmark", listingRef: "/listing/A-1", title: "Scarf", price: "25", currency: "USD" },
    1728000000000
  );
  assert.equal(e.key, "poshmark:/listing/A-1");
  assert.equal(e.price, 25);
  assert.equal(e.detectedAt, new Date(1728000000000).toISOString());
});

test("acceptNew is idempotent: the same closet scanned twice fires once", () => {
  const state = emptyState();
  const events = [
    { key: "poshmark:/listing/A-1" },
    { key: "poshmark:/listing/A-2" },
  ];
  const first = acceptNew(events, state);
  assert.equal(first.fresh.length, 2);
  const second = acceptNew(events, state);
  assert.equal(second.fresh.length, 0);
  // a different shop's same path never collides
  const third = acceptNew([{ key: "mercari:/listing/A-1" }], state);
  assert.equal(third.fresh.length, 1);
});

test("pushEvent retains newest-first, capped, without duplicates", () => {
  const state = emptyState();
  pushEvent(state, { key: "a" });
  pushEvent(state, { key: "a" });
  pushEvent(state, { key: "b" });
  assert.deepEqual(state.events.map((e) => e.key), ["b", "a"]);
});

/* ============================================================ 2) failures */

test("three consecutive failures park the item with exactly one report line", () => {
  assert.equal(STRIKE_LIMIT, 3);
  const state = { failures: {}, gaveUp: [] };
  let r = noteFailure(state, "poshmark:/listing/X");
  assert.deepEqual([r.count, r.reached, r.parked, r.line], [1, false, false, null]);
  r = noteFailure(state, "poshmark:/listing/X");
  assert.equal(r.reached, false);
  r = noteFailure(state, "poshmark:/listing/X");
  assert.equal(r.reached, true);
  assert.match(r.line, /^NEEDS_INPUT poshmark:\/listing\/X/);
  assert.ok(isParked(state, "poshmark:/listing/X"));
  // parked items never re-report, and other items are unaffected
  r = noteFailure(state, "poshmark:/listing/X");
  assert.deepEqual([r.reached, r.line], [false, null]);
  assert.equal(isParked(state, "poshmark:/listing/Y"), false);
});

test("a read that worked resets the streak — only CONSECUTIVE failures count", () => {
  const state = { failures: {}, gaveUp: [] };
  noteFailure(state, "k");
  noteFailure(state, "k");
  noteSuccess(state, "k");
  const r = noteFailure(state, "k");
  assert.equal(r.count, 1);
  assert.equal(r.reached, false);
});

test("reportLine follows the one-line NEEDS convention", () => {
  assert.match(reportLine("k", 3), /NEEDS_INPUT k/);
});

/* ==================================================== 3) selector source */

test("every sales shop has a complete sold block with an https listUrl", () => {
  assert.ok(SALES_SHOPS.length >= 6);
  for (const shop of SALES_SHOPS) {
    const s = soldSelFor(shop);
    assert.ok(s, `${shop} has a sold block`);
    assert.match(s.listUrl, /^https:\/\//, `${shop} listUrl`);
    for (const k of ["login", "item", "link", "title", "price", "status", "sold", "active", "date"]) {
      assert.ok(Array.isArray(s[k]) && s[k].length > 0, `${shop}.sold.${k} is a non-empty candidate list`);
    }
  }
  assert.equal(soldSelFor("bogus-shop"), null);
});

test("withSoldSel prefers SEL.sold when config already carries it", () => {
  const custom = { sold: { listUrl: "https://example.com/mine", item: ["x"] } };
  assert.equal(withSoldSel(custom, "poshmark").sold, custom.sold);
  const merged = withSoldSel({ listingPattern: "^x" }, "poshmark");
  assert.equal(merged.sold, SOLD_SELECTORS.poshmark);
  assert.equal(merged.listingPattern, "^x");
});

test("driver SEL carries a listingPattern for every sales shop", () => {
  for (const shop of SALES_SHOPS) {
    const SEL = selFor(shop);
    assert.ok(SEL.listingPattern, `${shop} needs a listingPattern (from config/selectors.js)`);
    assert.ok(SEL.sold, `${shop} needs a sold block`);
  }
});

test("ZERO inline selectors: logic files contain no marketplace literals", () => {
  const logicFiles = [
    "saleskit.js",
    "driver.js",
    "registry.js",
    "failures.js",
    "delist.js",
    "prompt.js",
    ...["poshmark", "mercari", "depop", "grailed", "ebay", "etsy"].map((s) => `adapters/${s}.js`),
    "adapters/index.js",
  ];
  const banned = [
    "poshmark.com",
    "mercari.com",
    "depop.com",
    "grailed.com",
    "ebay.com",
    "etsy.com",
    "data-testid",
    "data-cy",
    "tile__",
    "pfeed",
  ];
  for (const f of logicFiles) {
    const src = fs.readFileSync(path.join(SALES_DIR, f), "utf8");
    for (const b of banned) {
      assert.ok(!src.includes(b), `${f} must not contain ${JSON.stringify(b)} — selectors live in sold-selectors.js`);
    }
  }
  // adapters additionally never touch the DOM themselves
  for (const s of ["poshmark", "mercari", "depop", "grailed", "ebay", "etsy"]) {
    const src = fs.readFileSync(path.join(SALES_DIR, `adapters/${s}.js`), "utf8");
    assert.ok(!src.includes("querySelector"), `adapters/${s}.js never queries the DOM`);
  }
});

/* ======================================================== 4) saleskit DOM */

const SOLD_CARD = `
  <div data-testid="product-card">
    <a href="/listing/Vintage-Silk-Scarf-123">scarf</a>
    <span data-testid="product-title">Vintage silk scarf</span>
    <span data-testid="product-price">$25.00</span>
    <span class="sold-badge">Sold</span>
    <time datetime="2026-09-20T10:00:00.000Z">Sep 20</time>
  </div>`;

const ACTIVE_CARD = `
  <div data-testid="product-card">
    <a href="/listing/Linen-Shirt-9">shirt</a>
    <span data-testid="product-title">Linen shirt</span>
    <span data-testid="product-price">$18.00</span>
    <span data-testid="active">Active</span>
  </div>`;

test("a sold closet reads as sold with a full observation", () => {
  useDom(`<body>${SOLD_CARD}${ACTIVE_CARD}</body>`);
  const out = K.scanSold("poshmark", selFor("poshmark"), { state: freshKitState() });
  assert.equal(out.status, "sold");
  assert.equal(out.counts.sold, 1);
  assert.equal(out.counts.readable, 2);
  const sold = out.items.find((i) => i.status === "sold");
  assert.equal(sold.listingRef, "/listing/Vintage-Silk-Scarf-123");
  assert.equal(sold.listingUrl, "https://www.poshmark.com/listing/Vintage-Silk-Scarf-123");
  assert.equal(sold.title, "Vintage silk scarf");
  assert.equal(sold.price, 25);
  assert.equal(sold.soldAt, "2026-09-20T10:00:00.000Z");
});

test("a closet with nothing sold reads as clean, not skipped", () => {
  useDom(`<body>${ACTIVE_CARD}</body>`);
  const out = K.scanSold("poshmark", selFor("poshmark"), { state: freshKitState() });
  assert.equal(out.status, "clean");
  assert.equal(out.reason, null);
});

test("a sign-in page reads as skipped/login_wall — never as an empty closet", () => {
  useDom(`<body><form action="/login"><input type="password" name="pw"></form></body>`);
  const out = K.scanSold("poshmark", selFor("poshmark"), { state: freshKitState() });
  assert.equal(out.status, "skipped");
  assert.equal(out.reason, "login_wall");
});

test("a CAPTCHA reads as skipped/captcha — we never solve, never bypass", () => {
  useDom(`<body><div class="g-recaptcha">prove you are human</div>${ACTIVE_CARD}</body>`);
  const out = K.scanSold("poshmark", selFor("poshmark"), { state: freshKitState() });
  assert.equal(out.status, "skipped");
  assert.equal(out.reason, "captcha");
});

test("an empty page reads as skipped/no_listings with signals for the login detector", () => {
  useDom(`<body><p>hello</p></body>`);
  const out = K.scanSold("poshmark", selFor("poshmark"), { state: freshKitState() });
  assert.equal(out.status, "skipped");
  assert.equal(out.reason, "no_listings");
  assert.ok(out.signals && typeof out.signals.controlCount === "number");
});

test("a changed marketplace DOM strikes, parks after 3, then never blocks again", () => {
  const html = `<body>
    <div data-testid="product-card">
      <a href="/listing/Mystery-1">m</a>
      <span data-testid="product-title">Mystery</span>
      <span data-testid="product-price">$9.00</span>
      <span data-testid="status">Archived</span>
    </div></body>`;
  let state = freshKitState();
  let out;
  for (let i = 0; i < 3; i++) {
    useDom(html);
    out = K.scanSold("poshmark", selFor("poshmark"), { state });
    state = out.state; // ALWAYS read back — executeScript serializes it
  }
  assert.equal(out.status, "skipped");
  assert.equal(out.needsInput.length, 1);
  assert.equal(out.report.length, 1);
  assert.match(out.report[0], /^NEEDS_INPUT poshmark:/);
  // fourth scan: parked, no new noise
  useDom(html);
  const fourth = K.scanSold("poshmark", selFor("poshmark"), { state });
  assert.equal(fourth.report.length, 0);
  assert.equal(fourth.status, "skipped");
});

test("scanSold never throws — even on a missing document or missing config", () => {
  // no_document: no global document AND no injected doc
  const savedDoc = globalThis.document;
  delete globalThis.document;
  try {
    const noDoc = K.scanSold("poshmark", selFor("poshmark"), { state: freshKitState(), doc: null });
    assert.equal(noDoc.status, "skipped");
    assert.equal(noDoc.reason, "no_document");
  } finally {
    globalThis.document = savedDoc;
  }
  useDom(`<body></body>`);
  const noCfg = K.scanSold("poshmark", { sold: null }, { state: freshKitState() });
  assert.equal(noCfg.status, "skipped");
  assert.equal(noCfg.reason, "no_sold_config");
});

/* ============================================================== 5) driver */

const KIT_SOLD = {
  status: "sold",
  reason: null,
  items: [
    {
      status: "sold",
      listingRef: "/listing/A-1",
      listingUrl: "https://www.poshmark.com/listing/A-1",
      title: "A",
      price: 10,
      currency: "USD",
      soldAt: null,
      soldAtText: null,
    },
  ],
  needsInput: [],
  report: [],
  counts: { found: 1, readable: 1, unreadable: 0, sold: 1 },
  state: freshKitState(),
  signals: null,
  href: "https://www.poshmark.com/mycloset",
};

test("an unsupported shop is skipped, not thrown", async () => {
  const r = await scanAndRecord({ shop: "bogus", runInTab: async () => null });
  assert.equal(r.status, "skipped");
  assert.equal(r.reason, "unsupported_shop");
});

test("a missing tab runner is skipped, not thrown", async () => {
  const r = await scanAndRecord({ shop: "poshmark" });
  assert.equal(r.status, "skipped");
  assert.equal(r.reason, "no_run_in_tab");
});

test("a tab that throws is skipped/scan_error and the state is still stored", async () => {
  const storage = fakeStorage();
  const r = await scanAndRecord({
    shop: "poshmark",
    runInTab: async () => { throw new Error("tab crashed"); },
    storage,
  });
  assert.equal(r.status, "skipped");
  assert.equal(r.reason, "scan_error");
  assert.equal(r.stored, true);
});

test("a sold scan records exactly one event and POSTs it; a re-scan records nothing", async () => {
  const storage = fakeStorage();
  const posted = [];
  const deps = {
    shop: "poshmark",
    runInTab: async () => JSON.parse(JSON.stringify(KIT_SOLD)),
    storage,
    apiPost: async (p, e) => { posted.push([p, e]); return { ok: true }; },
    now: () => 1728000000000,
  };
  const first = await scanAndRecord(deps);
  assert.equal(first.status, "sold");
  assert.equal(first.recorded.length, 1);
  assert.equal(first.recorded[0].key, "poshmark:/listing/A-1");
  assert.deepEqual(posted, [["/api/sales", first.recorded[0]]]);
  assert.equal(first.stored, true);

  const second = await scanAndRecord({ ...deps, runInTab: async () => JSON.parse(JSON.stringify(KIT_SOLD)) });
  assert.equal(second.recorded.length, 0);
  assert.equal(posted.length, 1, "no second POST for an already-seen sale");
});

test("an unreadable page that bounced to sign-in is refined to login_wall", async () => {
  const r = await scanAndRecord({
    shop: "poshmark",
    requestedPath: "https://www.poshmark.com/mycloset",
    runInTab: async () => ({
      status: "skipped",
      reason: "no_listings",
      items: [],
      needsInput: [],
      report: [],
      counts: { found: 0, readable: 0, unreadable: 0, sold: 0 },
      state: freshKitState(),
      signals: { hasPasswordField: true, controlCount: 3, bodyText: "log in" },
      href: "https://www.poshmark.com/login?ru=%2Fmycloset",
    }),
  });
  assert.equal(r.status, "skipped");
  assert.equal(r.reason, "login_wall");
});

test("the login detector resolves in node and fails soft everywhere else", async () => {
  const fn = await resolveDetectLogin();
  assert.equal(typeof fn, "function");
  const v = fn({ requestedPath: "/mycloset", finalPath: "/login", signals: {} });
  assert.equal(v.connected, false);
});

test("loadState/saveState survive a corrupt store", async () => {
  const empty = await loadState(null);
  assert.deepEqual(empty, emptyState());
  const angry = { get: async () => { throw new Error("x"); }, set: async () => { throw new Error("x"); } };
  assert.deepEqual(await loadState(angry), emptyState());
  assert.equal(await saveState(null, {}), false);
  assert.equal(await saveState(angry, {}), false);
});

/* ============================================================== 6) delist */

test("runDelist audits every attempt with an outcome in {ok, failed, skipped}", async () => {
  const sale = { key: "poshmark:/listing/A-1", shop: "poshmark", listingRef: "/listing/A-1" };
  const logged = [];
  const r = await runDelist({
    sale,
    shops: ["mercari", "poshmark", "bogus-shop", "depop"],
    enqueue: async (job) => {
      assert.equal(job.type, "delist");
      if (job.shop === "depop") throw new Error("bridge down");
      return { ok: true };
    },
    log: async (e) => { logged.push(e); },
    now: () => 1728000000000,
  });
  assert.equal(r.ok, false, "one failure means ok:false");
  assert.equal(r.results.mercari.outcome, OUTCOMES.OK);
  assert.equal(r.results.poshmark.outcome, OUTCOMES.SKIPPED, "never delete the sale itself");
  assert.equal(r.results["bogus-shop"].outcome, OUTCOMES.SKIPPED);
  assert.equal(r.results.depop.outcome, OUTCOMES.FAILED);
  assert.equal(logged.length, 4, "every attempt logged, including skips");
  for (const e of logged) {
    assert.ok(["ok", "failed", "skipped"].includes(e.outcome));
    assert.ok(e.at);
    assert.equal(e.saleKey, sale.key);
  }
});

test("runDelist with no sale or no path skips honestly — never a fake success", async () => {
  const noSale = await runDelist({ sale: null, shops: ["mercari"], enqueue: async () => ({ ok: true }) });
  assert.equal(noSale.results.mercari.outcome, "skipped");
  const noPath = await runDelist({
    sale: { key: "k", shop: "poshmark" },
    shops: ["mercari"],
    enqueue: null,
  });
  assert.equal(noPath.results.mercari.outcome, "skipped");
  assert.equal(noPath.ok, true, "skips are not failures");
});

test("DELISTABLE_SHOPS matches the server's ALL_SHOPS so no shop is reported deleted with no path", async () => {
  const src = fs.readFileSync(
    path.join(HERE, "..", "..", "..", "functions", "api", "delist.js"),
    "utf8"
  );
  for (const shop of DELISTABLE_SHOPS) {
    assert.ok(src.includes(`"${shop}"`), `server delist.js knows ${shop}`);
  }
});

test("createDelistLog keeps a local copy and uploads best-effort", async () => {
  const storage = fakeStorage();
  const { record, list } = createDelistLog({
    storage,
    apiPost: async () => { throw new Error("offline"); },
  });
  const entry = await record({ shop: "mercari", outcome: "ok", detail: "enqueued" });
  assert.equal(entry.uploaded, false);
  assert.equal((await list()).length, 1);
});

test("createDelistEnqueuer prefers the extension bridge, falls back to POST /api/delist", async () => {
  const viaExt = createDelistEnqueuer({ extSend: async () => ({ ok: true }), apiPost: null });
  const r1 = await viaExt({ shop: "mercari", payload: {} });
  assert.equal(r1.via, "extension");

  const calls = [];
  const viaApi = createDelistEnqueuer({
    extSend: async () => { throw new Error("no bridge"); },
    apiPost: async (p, b) => { calls.push([p, b]); return { ok: true }; },
  });
  const r2 = await viaApi({ shop: "mercari", payload: { itemRef: "k" } });
  assert.equal(r2.via, "api");
  assert.equal(calls[0][0], "/api/delist");
  assert.equal(calls[0][1].sold, true);

  const noPath = createDelistEnqueuer({});
  const r3 = await noPath({ shop: "mercari", payload: {} });
  assert.deepEqual(r3, { ok: false, error: "no_delist_path" });
});

/* ============================================================== 7) prompt
   Contract for index.html (owned by another workstream — do NOT edit it):
     const prompt = buildPrompt(sale, { shops, enqueue, log });
     // render prompt.title + prompt.options ([{id, label, checked}])
     // seller taps confirm -> await prompt.confirm()      (every option)
     //                  or -> await prompt.confirm(id)    (just that one) */

test("buildPrompt excludes the sold shop and confirms every option by default", async () => {
  const sale = { key: "poshmark:/listing/A-1", shop: "poshmark", title: "Scarf", price: 25, currency: "USD" };
  const seen = [];
  const p = buildPrompt(sale, {
    shops: ["poshmark", "mercari", "depop", "poshmark"],
    enqueue: async (job) => { seen.push(job.shop); return { ok: true }; },
  });
  assert.match(p.title, /Poshmark/);
  assert.ok(!p.options.some((o) => o.id === "poshmark"), "never delete the sale itself");
  assert.deepEqual(p.options.map((o) => o.id), ["mercari", "depop"]);
  assert.ok(p.options.every((o) => o.checked === true));
  assert.equal(p.kind, "delist-after-sale");
  const r = await p.confirm();
  assert.equal(r.ok, true);
  assert.deepEqual(seen.sort(), ["depop", "mercari"]);
});

test("confirm(id) targets one shop; unknown ids and empty shops fail cleanly", async () => {
  const sale = { key: "poshmark:/listing/A-1", shop: "poshmark" };
  const p = buildPrompt(sale, { shops: ["mercari"], enqueue: async () => ({ ok: true }) });
  const one = await p.confirm("mercari");
  assert.ok(one.results.mercari);
  const bad = await p.confirm("bogus");
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "unknown_option");
  const lonely = buildPrompt(sale, { shops: ["poshmark"], enqueue: async () => ({ ok: true }) });
  assert.match(lonely.title, /no other shops/);
  assert.equal((await lonely.confirm()).error, "no_other_shops");
});

test("confirm never throws — an enqueuer that blows up becomes failed, not an exception", async () => {
  const sale = { key: "poshmark:/listing/A-1", shop: "poshmark" };
  const p = buildPrompt(sale, {
    shops: ["mercari"],
    enqueue: async () => { throw new Error("boom"); },
  });
  const r = await p.confirm();
  assert.equal(r.ok, false);
  assert.equal(r.results.mercari.outcome, "failed");
});

/* ================================================== 8) extension wiring
   queue.runSalesScanNow is what background.js calls (6-hour alarm +
   fash:sales-scan message). With no chrome.tabs — e.g. this harness — every
   shop must report skipped/no_tab_runner. The scan runs in the seller's own
   session in production; here we prove it fails soft instead of throwing. */

test("queue.runSalesScanNow without tabs skips every shop instead of throwing", async () => {
  const { runSalesScanNow } = await import("../queue.js");
  const results = await runSalesScanNow({ shops: ["poshmark", "mercari"] });
  assert.equal(results.length, 2);
  for (const r of results) {
    assert.equal(r.status, "skipped");
    assert.equal(r.reason, "no_tab_runner");
    assert.equal(r.recorded, 0);
  }
});

/* ------------------------------------------------- 8b) the tab half, offline
   driver.runShopScan opens the shop's own-listings page in a background tab of
   the seller's browser, injects the kit, reads the page and closes the tab.
   A REAL marketplace page is NOT PROVEN in CI (no logged-in session exists),
   but the WIRING can be: a stub chrome + a jsdom closet page drive the exact
   production path — tab create -> wait -> kit inject -> adapter scan -> event
   recorded + POSTed -> tab removed. */

test("runShopScan drives the full tab lifecycle against a jsdom closet page", async () => {
  const { runShopScan } = await import("../sales/driver.js");
  useDom(`<body>${SOLD_CARD}${ACTIVE_CARD}</body>`, "https://www.poshmark.com/mycloset");

  const events = [];
  const removed = [];
  const created = [];
  const kitInjected = [];
  const stubChrome = {
    tabs: {
      create: async (opts) => {
        created.push(opts);
        return { id: 4242, url: opts.url };
      },
      get: async () => ({ id: 4242, status: "complete" }),
      remove: async (id) => { removed.push(id); },
      onUpdated: { addListener: () => {}, removeListener: () => {} }
    },
    scripting: {
      executeScript: async (opts) => {
        if (opts.files) { kitInjected.push(opts.files); return [{}]; }
        const [fn, args] = [opts.func, opts.args || []];
        const result = fn(...args);
        return [{ result }];
      }
    }
  };

  const r = await runShopScan({
    chrome: stubChrome,
    shop: "poshmark",
    storage: fakeStorage(),
    apiPost: async (path, event) => { events.push([path, event]); return { ok: true }; },
    now: () => 1728000000000
  });

  assert.equal(r.status, "sold");
  assert.equal(r.recorded.length, 1);
  assert.equal(r.recorded[0].key, "poshmark:/listing/Vintage-Silk-Scarf-123");
  assert.equal(r.recorded[0].title, "Vintage silk scarf");
  assert.equal(r.recorded[0].price, 25);
  assert.deepEqual(created, [{ url: "https://www.poshmark.com/mycloset", active: false }]);
  assert.deepEqual(kitInjected, [["sales/saleskit.js"]]);
  assert.deepEqual(removed, [4242], "the background tab is always closed again");
  assert.deepEqual(events, [["/api/sales", r.recorded[0]]], "exactly one POST per fresh sale");
});

test("runShopScan fails soft when the tab cannot even be created", async () => {
  const { runShopScan } = await import("../sales/driver.js");
  const broken = {
    tabs: {
      create: async () => { throw new Error("chrome is gone"); },
      get: async () => ({ status: "complete" }),
      remove: async () => {},
      onUpdated: { addListener: () => {}, removeListener: () => {} }
    },
    scripting: { executeScript: async () => [{ result: null }] }
  };
  const r = await runShopScan({ chrome: broken, shop: "poshmark", storage: fakeStorage() });
  assert.equal(r.status, "skipped");
  assert.equal(r.reason, "scan_error");
  assert.equal(r.recorded.length, 0);
});
