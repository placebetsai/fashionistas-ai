// api-gate.test.mjs — the ladder that stops the extension polling a dead API.
//
//   run:  node --test apps/extension/__tests__/api-gate.test.mjs
//
// WHY THIS MATTERS (measured 2026-10-05, Cloudflare GraphQL):
//   The poll is a 1-minute alarm against {API_BASE}/api/jobs — a route that
//   does not exist on that Worker. Curl proves it answers 401 {"error":
//   "Unauthorized"} every time, i.e. the catch-all, not a handler. Unguarded
//   that is 1,440 guaranteed-failure Worker requests per day per browser.
//
// Nothing here touches chrome.* — the maths lives in config/api.js as pure
// functions precisely so every rung, the ceiling, and a whole simulated day
// are reachable without a browser.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ApiError,
  API_GATE_LADDER_MS,
  gateOpen,
  gateAfterFailure,
  gateAfterSuccess
} from "../config/api.js";

const MIN = 60 * 1000;

test("no state counts as open — a fresh install polls immediately", () => {
  assert.equal(gateOpen(null, 1_000_000), true);
  assert.equal(gateOpen(undefined, 1_000_000), true);
  assert.equal(gateOpen({ fails: 0, nextAt: 0 }, 1_000_000), true);
});

test("first failure steps to the first rung, not to zero", () => {
  const s = gateAfterFailure(null, 0);
  assert.equal(s.fails, 1);
  assert.equal(s.nextAt, API_GATE_LADDER_MS[0]);
  assert.equal(gateOpen(s, API_GATE_LADDER_MS[0] - 1), false, "still holding");
  assert.equal(gateOpen(s, API_GATE_LADDER_MS[0]), true, "released at nextAt");
});

test("the ladder climbs 5m -> 15m -> 60m", () => {
  let s = null;
  const waits = [];
  for (let i = 0; i < 4; i++) {
    const before = s;
    const now = gateOpen(before, 0) ? 0 : before.nextAt;
    s = gateAfterFailure(s, now);
    waits.push(s.nextAt - now);
  }
  assert.deepEqual(waits.slice(0, 3), [5 * MIN, 15 * MIN, 60 * MIN]);
});

test("failures never run past the ceiling", () => {
  let s = null;
  let now = 0;
  let lastWait = null;
  for (let i = 0; i < 50; i++) {
    s = gateAfterFailure(s, now);
    lastWait = s.nextAt - now;   // measure BEFORE now advances
    now = s.nextAt;
  }
  assert.equal(s.fails, API_GATE_LADDER_MS.length, "fails is clamped to the ladder");
  assert.equal(lastWait, 60 * MIN, "still one hour at the top rung");
});

test("one success reopens the gate completely", () => {
  let s = null;
  for (let i = 0; i < 3; i++) s = gateAfterFailure(s, 0);
  assert.equal(gateOpen(s, 0), false);
  const ok = gateAfterSuccess();
  assert.equal(ok.fails, 0);
  assert.equal(ok.nextAt, 0);
  assert.equal(gateOpen(ok, 0), true);
  // and the next failure starts back at the bottom rung
  assert.equal(gateAfterFailure(ok, 0).nextAt, 5 * MIN);
});

test("ApiError carries the real status so callers branch on the number", () => {
  const e = new ApiError(401, "GET", "/api/jobs?status=queued");
  assert.equal(e.name, "ApiError");
  assert.equal(e.status, 401);
  assert.equal(e.method, "GET");
  assert.equal(e.path, "/api/jobs?status=queued");
  assert.match(e.message, /401/);
  assert.ok(e instanceof Error, "still catchable as an Error");
});

test("simulated day against a dead endpoint: requests collapse", () => {
  const DAY = 24 * 60;
  let gate = null;
  let requests = 0;

  // One tick per minute for a full day. Every attempt that gets through the
  // gate fails, exactly as curl shows the real 401 does.
  for (let minute = 0; minute < DAY; minute++) {
    const now = minute * MIN;
    if (!gateOpen(gate, now)) continue;
    requests++;
    gate = gateAfterFailure(gate, now);
  }

  const unguarded = DAY; // 1,440 — what the code did before this gate
  // Ladder: t=0, 5m, 20m, then every 60m for the rest of the day.
  assert.equal(requests, 26, "one ladder, one simulated day");
  assert.equal(Math.round(unguarded / requests), 55, "1,440 -> 26 is a 55x cut");
});

test("a recovered endpoint is picked up within one ladder step", () => {
  let gate = null;
  // three failures -> parked at the hour rung
  let now = 0;
  for (let i = 0; i < 3; i++) {
    if (gateOpen(gate, now)) gate = gateAfterFailure(gate, now);
    now = gate.nextAt;
  }
  assert.equal(gate.fails, 3);

  // the endpoint comes back: the very next tick that passes the gate succeeds
  const later = gate.nextAt;
  assert.equal(gateOpen(gate, later), true, "gate is due to retry");
  const afterOk = gateAfterSuccess();
  assert.equal(gateOpen(afterOk, later), true, "and a success keeps it open");
  assert.equal(afterOk.fails, 0, "back to full polling speed");
});
