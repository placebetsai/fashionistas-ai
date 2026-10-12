/**
 * Security gates that used to be claims rather than behaviour.
 *
 * Two things were asserted in comments and nowhere in tests:
 *
 *  1. /legal/* "is not published" — it was, at 200, from stable URLs, and the
 *     pages carry their own instruction not to publish them. robots.txt was
 *     doing the work of a control.
 *
 *  2. /api/ai/analyze "is rate limited to 20/min" — true while KV was healthy,
 *     and silently unlimited the moment it was not, because the limiter
 *     returned `true` on both the unbound-binding and the throwing-KV path. On
 *     a public, unauthenticated, CORS `*` route that spends paid AI compute
 *     per accepted request, that is an invoice waiting to happen, and it
 *     reports itself as success.
 *
 * Both are pinned here so neither can drift back.
 */
import test from "node:test";
import assert from "node:assert/strict";

// The filename contains literal brackets, which are legal on disk but not in a
// static module specifier, so it is assembled at runtime.
const legalBlocker = await import(
  new URL("../functions/legal/" + "[[path]].js", import.meta.url).href
);
const analyze = await import("../functions/api/ai/analyze.js");

function req(body, headers = {}) {
  return new Request("https://fashionistas.ai/api/ai/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("every /legal/ path answers 404, not the draft counsel document", async () => {
  for (const path of ["/legal/terms", "/legal/privacy", "/legal/risk", "/legal/terms.html"]) {
    const res = await legalBlocker.onRequest({
      request: new Request("https://fashionistas.ai" + path),
      env: {}, // no ASSETS -> the plain-text fallback; status is what matters
      params: {},
    });
    assert.equal(res.status, 404, `${path} must not be served while it says "do not publish"`);
  }
});

test("the legal blocker never turns a blocked URL into a 500", async () => {
  // env.ASSETS exists but its fetch throws — the worst case for block().
  const res = await legalBlocker.onRequest({
    request: new Request("https://fashionistas.ai/legal/terms"),
    env: { ASSETS: { fetch: () => Promise.reject(new Error("boom")) } },
    params: {},
  });
  assert.equal(res.status, 404);
});

test("an unbound KV binding fails CLOSED on the public AI route", async () => {
  // env has no CACHE/FASHIONISTAS_KV. Pre-fix this fell through to the model
  // with no cap at all; it must now refuse before spending anything.
  const res = await analyze.onRequest({ request: req({}), env: {} });
  assert.equal(res.status, 503, "no limiter means no spend, not no limit");
  const body = await res.json();
  assert.equal(body.error, "unavailable");
  assert.notEqual(body.error, "rate_limited", "a dead limiter must not masquerade as traffic shaping");
});

test("a throwing KV binding also fails CLOSED", async () => {
  const env = {
    CACHE: {
      get: () => Promise.reject(new Error("kv down")),
      put: () => Promise.reject(new Error("kv down")),
    },
  };
  const res = await analyze.onRequest({ request: req({}), env });
  assert.equal(res.status, 503, "a KV error must not open the spending tap");
});

test("a healthy limiter still admits traffic — the happy path is unchanged", async () => {
  let stored = 0;
  const env = {
    CACHE: {
      get: async () => String(stored),
      put: async (_k, v) => {
        stored = Number(v);
      },
    },
  };
  // content-type text/plain is rejected at 415, after the limiter has run, so
  // this exercises the gate without ever reaching the vision model.
  const res = await analyze.onRequest({
    request: new Request("https://fashionistas.ai/api/ai/analyze", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "x",
    }),
    env,
  });
  assert.equal(res.status, 415, "an available limiter must not block the request");
  assert.equal(stored, 1, "the request was counted");
});

test("the healthy limiter still refuses once the budget is spent", async () => {
  const env = { CACHE: { get: async () => "20", put: async () => {} } };
  const res = await analyze.onRequest({
    request: new Request("https://fashionistas.ai/api/ai/analyze", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "x",
    }),
    env,
  });
  assert.equal(res.status, 429, "20/min must still hold");
});

/* ------------------------------------------------- header + disclosure gates */

test("the CSP is report-only, so it cannot blank the page", async () => {
  const headers = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../_headers", import.meta.url), "utf8")
  );
  const csp = headers.match(/^\s+Content-Security-Policy(-Report-Only)?: (.+)$/m);
  assert.ok(csp, "_headers must carry a CSP");
  assert.match(
    headers,
    /^ {2}Content-Security-Policy-Report-Only:/m,
    "enforcing before the violation log is read back would be a guess — AdSense loads ~15 origins dynamically and a wrong directive kills both the page and ad revenue"
  );
  const directives = csp[2];
  for (const must of ["default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'"]) {
    assert.ok(directives.includes(must), `missing ${must}`);
  }
  assert.match(headers, /^ {2}Strict-Transport-Security: /m, "HSTS was never set");
  assert.match(headers, /^ {2}X-Frame-Options: DENY$/m, "clickjacking was never closed");
});

test("the report endpoint accepts POST and rejects everything else", async () => {
  const csp = await import("../functions/api/csp-report.js");

  const post = await csp.onRequest({
    request: new Request("https://fashionistas.ai/api/csp-report", {
      method: "POST",
      body: JSON.stringify([
        {
          effectiveDirective: "script-src-elem",
          blockedURI: "https://evil.example/x.js",
          sourceFile: "https://fashionistas.ai/",
          lineNumber: 12,
        },
      ]),
    }),
  });
  assert.equal(post.status, 204, "a report endpoint must answer nothing — no body for a browser to retry");

  const get = await csp.onRequest({
    request: new Request("https://fashionistas.ai/api/csp-report", { method: "GET" }),
  });
  assert.equal(get.status, 405, "a report sink must not be readable or replayable");
});

test("a malformed report can never 500 the route", async () => {
  const csp = await import("../functions/api/csp-report.js");
  for (const body of ["{not json", "", "null", '"just a string"']) {
    const res = await csp.onRequest({
      request: new Request("https://fashionistas.ai/api/csp-report", { method: "POST", body }),
    });
    assert.equal(res.status, 204, `body ${JSON.stringify(body)} must be swallowed`);
  }
});

test("a huge report is dropped instead of parsed", async () => {
  const csp = await import("../functions/api/csp-report.js");
  const res = await csp.onRequest({
    request: new Request("https://fashionistas.ai/api/csp-report", {
      method: "POST",
      body: "[" + "1,".repeat(200000) + "1]",
    }),
  });
  assert.equal(res.status, 204);
});

test("PRIVACY.md no longer describes endpoints that do not answer", async () => {
  const fs = await import("node:fs/promises");
  const doc = await fs.readFile(new URL("../chrome-store/PRIVACY.md", import.meta.url), "utf8");

  // The table used to have a "Why it is needed" column, which asserted purpose
  // for calls that 404 — the exact shape of a disclosure that overstates what
  // the infrastructure does. Those rows now carry their real status instead.
  assert.doesNotMatch(doc, /\| Why it is needed \|/, "the overclaiming column is back");
  assert.match(doc, /endpoint not served/, "the unserved endpoints must be marked as such");
  assert.match(doc, /not yet served|not served|not published/i, "the doc must state the release status");
});

test("the deploy gate withholds the extension zip unless a human opts in", async () => {
  const fs = await import("node:fs/promises");
  const script = await fs.readFile(new URL("../scripts/deploy-local.sh", import.meta.url), "utf8");

  // The zip used to be built unconditionally, publishing an extension whose
  // entire backend (jobs, sessions) was never implemented.
  assert.match(script, /SHIP_EXTENSION/, "shipping the extension must be a deliberate act");

  // Regression pin for a gate that looked like it worked and did not. The first
  // version probed /api/jobs and accepted 401 as proof the route existed — but
  // this Worker answers 401 for EVERY unmatched /api path, so that check passed
  // for URLs that do not exist and shipped the zip on every deploy while
  // appearing to withhold it. A probe is only a gate if it can fail.
  assert.doesNotMatch(
    script,
    /200\s*\|\s*401/,
    "401 cannot mean 'the route exists' when the Worker 401s every unknown /api path"
  );
  assert.match(
    script,
    /definitely-not-a-real-route/,
    "the evidence that disproved the probe must stay in the file so nobody re-adds it"
  );

  const gate = script.slice(script.indexOf("SHIP_EXTENSION"));
  assert.match(gate, /NOT shipped/, "a missing backend must withhold the zip, not warn");
});
