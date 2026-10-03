// selector-source.test.mjs — proves the remote-config path and, more
// importantly, that it cannot make things worse than bundled.
//
//   run:  node --test apps/extension/__tests__/selector-source.test.mjs
//
// Uses a REAL local HTTP server for the happy path (actual fetch, actual JSON)
// and then breaks it deliberately: connection refused, 500, malformed JSON,
// wrong schema, a doc that drops a shop, a doc that blanks a selector.

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SELECTORS_URL,
  SCHEMA,
  CACHE_KEY,
  CACHE_TTL_MS,
  validateSelectors,
  mergeWithBundled,
  loadSelectors
} from "../config/selector-source.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_PATH = path.join(HERE, "..", "config", "selectors.bundled.json");
const bundledDoc = JSON.parse(fs.readFileSync(BUNDLED_PATH, "utf8"));

/* ------------------------------------------------------------- test doubles */

function fakeStorage() {
  const map = new Map();
  return {
    map,
    calls: 0,
    async get(k) { this.calls++; return map.has(k) ? map.get(k) : null; },
    async set(obj) { this.calls++; for (const [k, v] of Object.entries(obj)) map.set(k, v); }
  };
}

function validRemoteDoc() {
  return {
    schema: SCHEMA,
    version: 7,
    shops: {
      poshmark: {
        ...bundledDoc.shops.poshmark,
        title: ["#title", "[data-testid='title-input'] NEW"]
      }
    }
  };
}

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/selectors.json`;
  try {
    return await fn(url);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const jsonServer = (makeBody) => (req, res) => {
  const body = makeBody(req);
  if (body === null) { res.statusCode = 500; res.end("boom"); return; }
  res.setHeader("content-type", "application/json");
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

/* ------------------------------------------------------------------ validate */

test("validateSelectors accepts the shipped doc and real remote docs", () => {
  assert.equal(validateSelectors(bundledDoc).ok, true, "bundled copy must be valid");
  assert.equal(validateSelectors(validRemoteDoc()).ok, true);
});

test("validateSelectors rejects every class of garbage", () => {
  const bad = [
    [null, "not_an_object"],
    ["nope", "not_an_object"],
    [{ schema: 99, version: 1, shops: bundledDoc.shops }, "schema:99!=1"],
    [{ schema: SCHEMA, version: 0, shops: bundledDoc.shops }, "version:0"],
    [{ schema: SCHEMA, version: 1, shops: {} }, "shops_empty"],
    [{ schema: SCHEMA, version: 1, shops: [] }, "shops_missing"],
    [{ schema: SCHEMA, version: 1, shops: { x: { createUrl: "javascript:alert(1)" } } }, "bad_createUrl:x"],
    [{ schema: SCHEMA, version: 1, shops: { x: { createUrl: "ftp://a/b" } } }, "bad_createUrl:x"],
    // non-JSON values must never survive a round trip into chrome.storage
    [{ schema: SCHEMA, version: 1, shops: { x: { createUrl: "https://a.b/c", title: () => 1 } } },
      "bad_value:x.title"],
    [{ schema: SCHEMA, version: 1, shops: { x: { createUrl: "https://a.b/c", title: Symbol("s") } } },
      "bad_value:x.title"],
    [{ schema: SCHEMA, version: 1, shops: { x: { createUrl: "https://a.b/c", title: NaN } } },
      "bad_value:x.title"],
    // pathologically deep config is rejected rather than walked forever
    [{ schema: SCHEMA, version: 1,
       shops: { x: { createUrl: "https://a.b/c",
                     title: [[[[[[[[["deep"]]]]]]]]] } } }, "depth:x.title[0][0][0][0][0][0]"]
  ];
  for (const [doc, expected] of bad) {
    const r = validateSelectors(doc);
    assert.equal(r.ok, false, `should reject: ${expected}`);
    assert.equal(r.error, expected, `wrong reason for: ${expected}`);
  }
});

/* -------------------------------------------------------------- happy path */

test("fetches the remote doc, validates it, and caches it", async () => {
  let hits = 0;
  await withServer(jsonServer(() => { hits++; return validRemoteDoc(); }), async (url) => {
    const storage = fakeStorage();
    const r = await loadSelectors({ bundled: bundledDoc, url, storage });
    assert.equal(r.source, "remote", "server answered, so remote wins");
    assert.equal(r.version, 7);
    assert.equal(r.error, null);
    assert.equal(hits, 1);
    assert.equal(storage.map.has(CACHE_KEY), true, "written to cache");
    assert.equal(storage.map.get(CACHE_KEY).version, 7);
    // the remote edit is visible, and it merged over the bundled copy
    assert.ok(r.shops.poshmark.title.includes("[data-testid='title-input'] NEW"));
    assert.equal(r.shops.poshmark.createUrl, bundledDoc.shops.poshmark.createUrl,
      "fields the remote doc did not mention keep their bundled value");
    // every bundled shop is still present
    for (const shop of Object.keys(bundledDoc.shops)) {
      assert.ok(r.shops[shop], `remote load must not lose ${shop}`);
    }
  });
});

test("second call inside the TTL is served from cache — no network", async () => {
  let hits = 0;
  await withServer(jsonServer(() => { hits++; return validRemoteDoc(); }), async (url) => {
    const storage = fakeStorage();
    const now0 = Date.now();
    const first = await loadSelectors({ bundled: bundledDoc, url, storage, now: now0 });
    assert.equal(first.source, "remote");

    const second = await loadSelectors({
      bundled: bundledDoc, url, storage, now: now0 + 60000, ttl: CACHE_TTL_MS
    });
    assert.equal(second.source, "cache", "fresh cache is trusted");
    assert.equal(hits, 1, "server contacted exactly once");
    assert.equal(second.version, 7);
    assert.equal(second.error, null);
  });
});

test("once the TTL expires the config is revalidated against the server", async () => {
  let hits = 0;
  await withServer(jsonServer(() => { hits++; return validRemoteDoc(); }), async (url) => {
    const storage = fakeStorage();
    const now0 = Date.now();
    await loadSelectors({ bundled: bundledDoc, url, storage, now: now0 });
    await loadSelectors({
      bundled: bundledDoc, url, storage,
      now: now0 + CACHE_TTL_MS + 1, ttl: CACHE_TTL_MS
    });
    assert.equal(hits, 2, "expired cache triggers a refetch");
  });
});

/* -------------------------------------------------------------- failure paths */

test("connection refused -> cached copy, no cache -> bundled, and it says why", async () => {
  // dead server (port with nothing on it)
  const deadUrl = "http://127.0.0.1:9/selectors.json";

  // A *fresh* cache short-circuits before any network call (tested above).
  // To exercise the outage path the cache must be due for revalidation, so the
  // loader really tries the server, really fails, and then keeps the stale copy.
  const withCache = fakeStorage();
  withCache.map.set(CACHE_KEY, {
    doc: validRemoteDoc(), version: 7, fetchedAt: Date.now() - 2 * CACHE_TTL_MS
  });
  const a = await loadSelectors({ bundled: bundledDoc, url: deadUrl, storage: withCache });
  assert.equal(a.source, "cache", "network is down but we have a good cached copy");
  assert.equal(a.version, 7);
  assert.match(a.error, /^fetch:/, "the outage is reported, not swallowed");

  const noCache = fakeStorage();
  const b = await loadSelectors({ bundled: bundledDoc, url: deadUrl, storage: noCache });
  assert.equal(b.source, "bundled", "no cache -> bundled floor");
  assert.match(b.error, /^fetch:/);
  for (const shop of Object.keys(bundledDoc.shops)) assert.ok(b.shops[shop]);
});

test("HTTP 500 -> bundled", async () => {
  await withServer(jsonServer(() => null), async (url) => {
    const r = await loadSelectors({ bundled: bundledDoc, url, storage: fakeStorage() });
    assert.equal(r.source, "bundled");
    assert.equal(r.error, "http_500");
  });
});

test("malformed JSON body -> bundled", async () => {
  await withServer(jsonServer(() => "<!doctype html><h1>maintenance</h1>"), async (url) => {
    const r = await loadSelectors({ bundled: bundledDoc, url, storage: fakeStorage() });
    assert.equal(r.source, "bundled");
    assert.match(r.error, /^invalid_remote:|^fetch:/);
    for (const shop of Object.keys(bundledDoc.shops)) assert.ok(r.shops[shop], shop);
  });
});

test("a payload that does not validate -> bundled, never applied", async () => {
  await withServer(jsonServer(() => ({ schema: SCHEMA, version: 7, shops: { broken: { title: 42 } } })),
    async (url) => {
      const r = await loadSelectors({ bundled: bundledDoc, url, storage: fakeStorage() });
      assert.equal(r.source, "bundled", "garbage must not be applied");
      assert.match(r.error, /^invalid_remote:/);
      assert.equal(r.shops.poshmark, bundledDoc.shops.poshmark, "bundled objects untouched");
    });
});

test("storage throwing must not take down config loading", async () => {
  const angry = {
    async get() { throw new Error("storage quota"); },
    async set() { throw new Error("storage quota"); }
  };
  await withServer(jsonServer(() => validRemoteDoc()), async (url) => {
    const r = await loadSelectors({ bundled: bundledDoc, url, storage: angry });
    assert.equal(r.source, "remote", "read failed, write failed, fetch still applied");
    assert.equal(r.version, 7);
  });
});

/* ------------------------------------------------------ safety of the merge */

test("a remote doc that DROPS a shop cannot remove it", () => {
  const remote = { shops: { poshmark: bundledDoc.shops.poshmark } }; // 8 shops missing
  const merged = mergeWithBundled(bundledDoc.shops, remote.shops);
  for (const shop of Object.keys(bundledDoc.shops)) {
    assert.ok(merged[shop], `${shop} was dropped by remote but must survive`);
  }
  assert.equal(Object.keys(merged).length, 9);
});

test("a remote doc that BLANKS a selector cannot blank it", () => {
  const before = bundledDoc.shops.mercari.title;
  const merged = mergeWithBundled(bundledDoc.shops, {
    mercari: { title: "", condition: null }
  });
  assert.deepEqual(merged.mercari.title, before, "empty string must not erase a selector");
  assert.deepEqual(merged.mercari.condition, bundledDoc.shops.mercari.condition, "null must not erase");
});

test("a remote doc may ADD a brand-new shop", () => {
  const merged = mergeWithBundled(bundledDoc.shops, {
    bonanza: { createUrl: "https://www.bonanza.com/items/new", title: ["#listing_title"] }
  });
  assert.ok(merged.bonanza, "new shops are allowed in");
  assert.equal(Object.keys(merged).length, 10);
});

/* ------------------------------------------------------------ bundled truth */

test("the shipped selectors.bundled.json really matches selectors.js", async () => {
  const mod = await import("../config/selectors.js");
  assert.deepEqual(
    Object.keys(bundledDoc.shops).sort(),
    Object.keys(mod.SHOPS).sort(),
    "bundled JSON has drifted from selectors.js — regenerate it"
  );
  assert.equal(bundledDoc.schema, SCHEMA);
  assert.equal(bundledDoc.version, 1);
});

test("no fetch available -> bundled, still usable", async () => {
  // pass null (NOT undefined: undefined would fall back to globalThis.fetch)
  const r = await loadSelectors({ bundled: bundledDoc, fetchImpl: null, storage: fakeStorage() });
  assert.equal(r.source, "bundled");
  assert.equal(Object.keys(r.shops).length, 9);
  void SELECTORS_URL;
});
