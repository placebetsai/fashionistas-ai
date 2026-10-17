// install-id.test.mjs — the pairing identity and the job-payload contract.
//
//   run:  node --test apps/extension/__tests__/install-id.test.mjs
//
// WHY THIS MATTERS:
//   Cross-posting is "connect once, then feed". The thing being connected is a
//   BROWSER, and the only honest way to name a browser to the Worker is an id
//   that (a) is minted once, (b) survives restarts, (c) rides on every single
//   request as X-Install-Id, and (d) is never rotated behind the seller's back.
//   Get that wrong and pairing silently pairs the wrong machine, or pairs none.
//
//   chrome.* is stubbed here on purpose: config/api.js is the only module that
//   touches it for these paths, so the whole identity story is reachable in a
//   plain node process.

import test from "node:test";
import assert from "node:assert/strict";

/* ------------------------------------------------------------ chrome stub */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function makeStore(initial) {
  const data = { ...(initial || {}) };
  return {
    data,
    reads: 0,
    writes: 0,
    async get(key) {
      this.reads++;
      return typeof key === "string" ? { [key]: data[key] } : { ...data };
    },
    async set(obj) {
      this.writes++;
      Object.assign(data, obj);
    }
  };
}

function stubChrome(store, opts = {}) {
  globalThis.chrome = {
    storage: {
      local: {
        async get(k) {
          if (opts.throwOnGet) throw new Error("storage unavailable");
          return store.get(k);
        },
        async set(o) {
          if (opts.throwOnSet) throw new Error("quota");
          return store.set(o);
        }
      }
    }
  };
}

const api = await import("../config/api.js");
const { resetInstallIdCache } = api;

function fresh() {
  resetInstallIdCache();
}

/* ------------------------------------------------------------- install id */

test("newInstallId produces a real v4 uuid", () => {
  const id = api.newInstallId();
  assert.match(id, UUID_RE);
  assert.equal(id[14], "4", "version nibble");
  assert.ok("89ab".includes(id[19]), "variant nibble: " + id[19]);
});

test("newInstallId honours an injected uuid source (testable without a browser)", () => {
  const id = api.newInstallId(() => "11111111-2222-4333-8444-555555555555");
  assert.equal(id, "11111111-2222-4333-8444-555555555555");
});

test("a fresh install mints one id and stores it under fash-install-id", async () => {
  fresh();
  const store = makeStore();
  stubChrome(store);
  const id = await api.installId();
  assert.match(id, UUID_RE);
  assert.equal(store.data[api.INSTALL_ID_KEY], id, "stored under fash-install-id");
  assert.equal(api.INSTALL_ID_KEY, "fash-install-id", "the key is part of the contract");
});

test("the id is minted ONCE and never rotated across reads", async () => {
  fresh();
  const store = makeStore();
  stubChrome(store);
  const a = await api.installId();
  const b = await api.installId();
  const c = await api.installId();
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(store.writes, 1, "one write, not one per call");
});

test("an existing id is reused verbatim across a restart", async () => {
  fresh();
  const store = makeStore({ "fash-install-id": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  stubChrome(store);
  assert.equal(await api.installId(), "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  assert.equal(store.writes, 0, "an existing id is never rewritten");
});

test("unusable storage still yields a valid id — pairing degrades, fetching never blocks", async () => {
  fresh();
  stubChrome(makeStore(), { throwOnGet: true, throwOnSet: true });
  const id = await api.installId();
  assert.match(id, UUID_RE);
});

test("installHeaders carries X-Install-Id on top of the caller's headers", async () => {
  fresh();
  stubChrome(makeStore());
  const h = await api.installHeaders({ Accept: "application/json" });
  assert.match(h["X-Install-Id"], UUID_RE);
  assert.equal(h.Accept, "application/json");
});

test("X-Install-Id is on the wire, not just in a helper", async () => {
  fresh();
  stubChrome(makeStore());
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, headers: init.headers });
    return { ok: true, status: 200, json: async () => ({ ok: true, paired: true, jobs: [] }) };
  };
  await api.apiGet(api.JOB_POLL_PATH);
  await api.apiPost("/api/sessions", { sessions: {}, source: "extension" });
  assert.equal(seen.length, 2);
  for (const s of seen) {
    assert.ok(s.headers["X-Install-Id"], "header present on " + s.url);
    assert.match(s.headers["X-Install-Id"], UUID_RE);
  }
  assert.equal(seen[0].url, "https://fashionistas-api.fashionistas1979.workers.dev/api/jobs?status=queued");
});

/* ------------------------------------------------------- job list parsing */

test("the contract shape {ok, paired, jobs} parses", () => {
  const jobs = api.parseJobList({ ok: true, paired: true, jobs: [{ id: "j1", shop: "depop" }] });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, "j1");
});

test("an UNPAIRED answer is {jobs:[]} and is recognised as unpaired", () => {
  const data = { ok: true, paired: false, jobs: [] };
  assert.equal(api.isUnpaired(data), true);
  assert.deepEqual(api.parseJobList(data), []);
});

test("paired:true is not unpaired, and a missing flag is not unpaired", () => {
  assert.equal(api.isUnpaired({ ok: true, paired: true, jobs: [] }), false);
  assert.equal(api.isUnpaired({ ok: true, jobs: [] }), false);
  assert.equal(api.isUnpaired({ ok: true, paired: false }), true);
  assert.equal(api.isUnpaired(null), false);
  assert.equal(api.isUnpaired([]), false);
});

test("older/newer shapes degrade to an empty list, never to a crash", () => {
  assert.deepEqual(api.parseJobList([{ id: 1 }]), [{ id: 1 }]);          // bare array
  assert.deepEqual(api.parseJobList({ data: { jobs: [{ id: 2 }] } }), [{ id: 2 }]);
  assert.deepEqual(api.parseJobList(null), []);
  assert.deepEqual(api.parseJobList({}), []);
  assert.deepEqual(api.parseJobList("nope"), []);
  assert.deepEqual(api.parseJobList({ jobs: "nope" }), []);
});

test("a job without an id is dropped — it could never be reported back", () => {
  assert.deepEqual(api.parseJobList({ jobs: [{ shop: "depop" }, null, { id: 0 }] }), [{ id: 0 }]);
});

/* ----------------------------------------------------- the unpaired ladder */

test("{paired:false} walks API_GATE_LADDER_MS exactly like a dead route", () => {
  assert.equal(api.gateAfterUnpaired(null, 0).fails, 1);
  assert.equal(api.gateAfterUnpaired(null, 0).nextAt, api.API_GATE_LADDER_MS[0]);
  // same maths, so an install that is unpaired for a day is not polled 1,440
  // times — it is polled on the same 5/15/60 ladder as any failure
  let s = null;
  const waits = [];
  for (let i = 0; i < 3; i++) {
    const now = api.gateOpen(s, 0) ? 0 : s.nextAt;
    s = api.gateAfterUnpaired(s, now);
    waits.push(s.nextAt - now);
  }
  assert.deepEqual(waits, [5 * 60e3, 15 * 60e3, 60 * 60e3]);
  // and pairing (a successful poll) puts it straight back to full speed
  const ok = api.gateAfterSuccess();
  assert.equal(ok.fails, 0);
  assert.equal(api.gateOpen(ok, s.nextAt), true);
});

test("a simulated day of paired:false collapses like the dead-route case", () => {
  const MIN = 60e3;
  let gate = null;
  let requests = 0;
  for (let minute = 0; minute < 24 * 60; minute++) {
    const now = minute * MIN;
    if (!api.gateOpen(gate, now)) continue;
    requests++;
    gate = api.gateAfterUnpaired(gate, now);
  }
  assert.equal(requests, 26, "1,440 -> 26 requests, same 55x cut");
});