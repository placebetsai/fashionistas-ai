/**
 * tests/api-auth-matrix.test.mjs — rule (a): every endpoint under
 * functions/api/ either refuses an anonymous caller with 401, or is on an
 * explicit, justified public allowlist.
 *
 * WHY THIS FILE IS A MATRIX AND NOT A FEW SPOT CHECKS
 *   The rule is "no auth -> 401 on EVERY endpoint". Spot checks pass while the
 *   next route someone adds forgets the gate. This test walks the real
 *   functions/api/ tree, imports every handler, calls it with NO credentials
 *   and demands one of exactly two outcomes:
 *
 *     1. 401/403 for a route that declares a session gate, or
 *     2. membership in PUBLIC below, with a reason.
 *
 *   Adding a new ungated route therefore fails this file at the next npm test,
 *   which is the point: the allowlist cannot silently grow.
 *
 * REAL CODE, REAL SQL. Every gated route runs against node:sqlite through the
 * D1 wrapper in ./helpers/d1.mjs, so the 401 comes out of the actual
 * requireAuth()/requireActiveSubscriber() code path, not a stub.
 *
 * Also pinned here: an authenticated-but-unsubscribed caller gets 402 (never a
 * silent pass, never a 500) on the routes that require a paid plan.
 *
 * Offline. No network. No new dependencies.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { freshD1, seedUser, subscribe, authed, jsonPost } from "./helpers/d1.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const API = join(ROOT, "functions", "api");

/* ------------------------------------------------------------------ tree */

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      // Directories starting with _ are Pages-ignored libraries, not routes.
      if (name.startsWith("_")) continue;
      out.push(...walk(p));
    } else if (name.endsWith(".js") && !name.endsWith(".test.js")) {
      out.push(p);
    }
  }
  return out;
}

const ROUTE_FILES = walk(API);

/**
 * Routes that are PUBLIC on purpose. Each entry names the reason it may be
 * reached without a fashionistas session; "it has not been wired yet" is not
 * an acceptable reason and must not be added here.
 *
 * `expect` is the anonymous status asserted for a body-less GET.
 */
const PUBLIC = {
  "auth/login.js": "signing in is how a session is created; it must be reachable logged out",
  "auth/register.js": "account creation, same reason as login",
  "auth/google.js": "OAuth entry point for Google sign-in",
  "auth/logout.js": "clearing a cookie is safe and must work when already signed out",
  "billing/webhook.js": "Stripe server-to-server; authenticated by HMAC signature, never by a session",
  "fees/estimate.js": "static fee arithmetic, no user data",
  "fees/compare.js": "static fee arithmetic, no user data",
  "marketplaces.js": "static shop catalogue; the handler docstring states it reads no secret",
  "ebay/status.js": "reports boolean token PRESENCE only, so the Connect screen can render",
  "ebay/config.js": "reports which env vars are set (booleans), never their values",
  "ebay/oauth/start.js": "OAuth consent redirect; there is no session yet at that point",
  "ebay/oauth/callback.js": "OAuth redirect target; verified by the `code` + state, not a session",
  "etsy/oauth/start.js": "OAuth consent redirect; there is no session yet at that point",
  "etsy/oauth/callback.js": "OAuth redirect target; verified by `code` + state cookie",
  "ai/analyze.js":
    "the identify/convert funnel (sample jacket + first photo) runs before a Pages session exists, so " +
    "it must work logged out; it stores no user data — no D1/R2 write, no image kept, the only " +
    "KV write is a per-IP rate-limit counter — and exposes no key; the sole side effect is a server-side " +
    "Groq call, capped at 20 requests/minute/IP, proven live: request 21+ answers 429. If that cap " +
    "ever stops holding, gate it instead.",
  "tryon/image/[uuid].js":
    "the stored image URL is handed to Replicate and to <img> tags, so it cannot require a session; " +
    "it is constrained by a strict id regex instead (asserted below)",
};

/** Routes whose gate is 402-before-401 for an authenticated free user. */
const PAID = {
  "list/all.js": "onRequestPost",
  "list/ebay.js": "onRequestPost",
  "list/etsy.js": "onRequestPost",
  "sales/index.js": "onRequestPost",
  "sales/ack.js": "onRequestPost",
  "sales/delist-log.js": "onRequestPost",
};

test("the route tree is discovered, not hardcoded (a new file is covered automatically)", () => {
  assert.ok(ROUTE_FILES.length >= 30, `only found ${ROUTE_FILES.length} route files`);
  const rels = ROUTE_FILES.map((p) => relative(API, p).split("\\").join("/"));
  // Sanity: the tree we walk really is the shipped one.
  assert.ok(rels.includes("listing/index.js"));
  assert.ok(rels.includes("tryon/hd.js"));
  assert.ok(rels.includes("tryon/image/[uuid].js"));
  // Libraries under _/ are never routed and must not be in the matrix.
  assert.ok(!rels.some((r) => r.startsWith("_")));
  assert.ok(!rels.some((r) => r.includes("/_lib/")));
});

test("the public allowlist has no dangling entries", () => {
  const rels = new Set(ROUTE_FILES.map((p) => relative(API, p).split("\\").join("/")));
  for (const key of Object.keys(PUBLIC)) {
    assert.ok(rels.has(key), `allowlist names a route that does not exist: ${key}`);
    assert.ok(
      String(PUBLIC[key]).length > 20,
      `${key} is allowlisted without a real justification`
    );
  }
});

test("no route file leaks a hardcoded secret", () => {
  // Cheap tripwire: a real key in a committed file is the failure mode the
  // $0/no-paid-account rule cannot tolerate.
  const SUSPICIOUS = [
    /sk_live_[0-9a-z]{10,}/i,
    /rk_live_[0-9a-z]{10,}/i,
    /whsec_[0-9a-z]{10,}/i,
    /r8_[0-9a-z]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  ];
  for (const file of ROUTE_FILES) {
    const src = readFileSync(file, "utf8");
    for (const re of SUSPICIOUS) {
      assert.ok(!re.test(src), `${relative(ROOT, file)} looks like it contains a live secret (${re})`);
    }
  }
});

/* ------------------------------------------------- (a) anonymous -> 401 */

/**
 * Anonymous probe. GET is the cheapest method and is what a stranger or a
 * crawler would try first.
 *
 * Three outcomes are accepted, and each one means "no data left the building":
 *   401 / 403  the session gate refused the caller
 *   405        the route does not offer GET at all (POST-only route, correct)
 *   204        a CORS preflight, which carries no body
 * Anything else — above all 200/201/500 — is a failure. Separately, every
 * gated route must produce at least one hard 401/403 across its handlers, so
 * "it only ever answered 405" cannot stand in for a gate.
 */
const REFUSALS = new Set([401, 403, 405, 204]);

/**
 * A deliberately OVER-CONFIGURED env for the matrix.
 *
 * Why: several routes check configuration BEFORE the session (billing/portal
 * answers 503 for a missing STRIPE_SECRET_KEY without ever looking at the
 * caller). Probing with an empty env would then measure "is this deployment
 * configured" instead of "is this route gated" — and a route whose gate sits
 * behind an env check would look untested. Every placeholder below is a dummy
 * string that is never sent anywhere: no test in this file performs a network
 * call, and each route refuses before it could use one.
 */
function matrixEnv(d1) {
  return {
    DB: d1,
    STRIPE_SECRET_KEY: "sk_test_PLACEHOLDER_NOT_A_REAL_KEY",
    STRIPE_WEBHOOK_SECRET: "whsec_test_PLACEHOLDER",
    GOOGLE_CLIENT_ID: "placeholder.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "PLACEHOLDER",
    EBAY_CLIENT_ID: "PLACEHOLDER",
    EBAY_CLIENT_SECRET: "PLACEHOLDER",
    ETSY_API_KEY: "PLACEHOLDER",
    ETSY_API_SECRET: "PLACEHOLDER",
    ETSY_SHARED_SECRET: "PLACEHOLDER",
    REPLICATE_API_TOKEN: "r8_PLACEHOLDER",
    GPU_PROVIDER: "runpod",
    MODEL_PROVIDER: "disabled",
  };
}

async function anonStatus(rel, handler, fn, env) {
  const url = "https://fashionistas.ai/api/" + rel.replace(/\.js$/, "");
  const req = new Request(url, { method: "GET" });
  const res = await handler[fn]({ request: req, env, params: { uuid: "0".repeat(32) } });
  return res.status;
}

test("an anonymous caller never gets past a gated route", async () => {
  const { d1 } = freshD1();
  const env = { DB: d1 };
  let probes = 0;

  for (const file of ROUTE_FILES) {
    const rel = relative(API, file).split("\\").join("/");
    if (rel in PUBLIC) continue;

    const mod = await import(file);
    const fns = Object.keys(mod).filter((k) => /^onRequest/.test(k) && k !== "onRequestOptions");
    if (fns.length === 0) {
      // Not a route. Pages Functions ignores files and directories whose name
      // starts with `_`, so a `_`-prefixed path is a library by convention and
      // correctly absent from this matrix. Anything else that has no handler is
      // a mistake worth failing on: it either should be underscore-prefixed, or
      // it is a route that was never wired.
      const isLibrary = rel.startsWith("_") || rel.includes("/_");
      assert.ok(
        isLibrary,
        `${rel} exports no onRequest* handler, so it is not a route — ` +
          `prefix its path with _ to mark it a library, or give it a handler`
      );
      continue;
    }

    let hardGate = 0;
    for (const fn of fns) {
      const status = await anonStatus(rel, mod, fn, env);
      probes++;
      assert.ok(
        REFUSALS.has(status),
        `${rel} ${fn} answered ${status} to an anonymous GET. Expected 401/403 ` +
          `(no session), 405 (method not offered) or 204 (preflight). Anything else ` +
          `means an unauthenticated caller reached the handler body — add the gate ` +
          `or allowlist the route with a reason.`
      );
      if (status === 401 || status === 403) hardGate++;
    }
    assert.ok(
      hardGate > 0,
      `${rel} never answered 401/403 for an anonymous caller — it is effectively public. ` +
        `Move it to the PUBLIC allowlist and justify it, or add the session gate.`
    );
  }

  // 19 route files export 37 handlers once the 15 PUBLIC entries are skipped
  // (14 further files are `_`-prefixed libraries with no handler). This is the
  // exact count, not a round number: it is a shrink guard, so if a handler is
  // deleted or a file drops out of the walk, the matrix got smaller and that
  // has to be a conscious edit rather than a silent one.
  assert.ok(probes >= 37, `matrix only exercised ${probes} handlers`);
});

test("a POST-only route still refuses an anonymous POST with 401", async () => {
  // The GET sweep above can only see 405 for these, so the gate is proven here
  // on the method they actually serve.
  const { db, d1 } = freshD1();
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, stripe_customer_id TEXT,
    stripe_subscription_id TEXT)`);
  const env = { DB: d1, STRIPE_SECRET_KEY: "sk_test_never_used" };

  const checkout = await import(join(API, "billing", "checkout.js"));
  const c = await checkout.onRequestPost({
    request: new Request("https://fashionistas.ai/api/billing/checkout", { method: "POST" }),
    env,
  });
  assert.equal(c.status, 401, `billing/checkout POST anon -> ${c.status}`);

  const portal = await import(join(API, "billing", "portal.js"));
  const p = await portal.onRequestPost({
    request: new Request("https://fashionistas.ai/api/billing/portal", { method: "POST" }),
    env,
  });
  assert.equal(p.status, 401, `billing/portal POST anon -> ${p.status}`);
});

test("the Stripe webhook is public but signature-gated (401 is never its answer)", async () => {
  const { d1 } = freshD1();
  const env = { DB: d1, STRIPE_WEBHOOK_SECRET: "whsec_test_only" };
  const mod = await import(join(API, "billing", "webhook.js"));
  const res = await mod.onRequestPost({
    request: new Request("https://fashionistas.ai/api/billing/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bad" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    }),
    env,
  });
  assert.equal(res.status, 400, "an unsigned/forged Stripe event must be rejected, never trusted");
  assert.notEqual(res.status, 401, "the webhook has no session to check");
});

test("a valid-shaped but expired/forged token is still 401, never a 500", async () => {
  const { d1 } = freshD1();
  const env = { DB: d1 };
  const mod = await import(join(API, "wear.js"));
  for (const headers of [
    { authorization: "Bearer totally-made-up" },
    { cookie: "fash_session=totally-made-up" },
    { authorization: "Basic dXNlcjpwYXNz" },
    { authorization: "" },
  ]) {
    const req = new Request("https://fashionistas.ai/api/wear", { headers });
    const res = await mod.onRequestGet({ request: req, env });
    assert.equal(res.status, 401, `headers ${JSON.stringify(headers)} -> ${res.status}`);
  }
});

test("a valid session passes the gate: the 401 above is the gate, not a broken route", async () => {
  const { db, d1 } = freshD1();
  const user = seedUser(db);
  const env = { DB: d1 };

  const mod = await import(join(API, "closet", "clear.js"));
  const anon = await mod.onRequestGet({ request: new Request("https://fashionistas.ai/api/closet/clear"), env });
  assert.equal(anon.status, 401);

  const ok = await mod.onRequestGet({ request: authed("https://fashionistas.ai/api/closet/clear", user.token), env });
  assert.equal(ok.status, 200, `signed-in caller got ${ok.status}: ${await ok.text()}`);
});

/* ------------------------------------------- (a) authenticated-free -> 402 */

test("an authenticated free-tier user gets 402 on every paid route", async () => {
  for (const [rel, fn] of Object.entries(PAID)) {
    const { db, d1 } = freshD1();
    const user = seedUser(db); // note: NO subscribe() -> free tier
    const env = { DB: d1 };
    const mod = await import(join(API, rel));
    const req = authed("https://fashionistas.ai/api/" + rel.replace(/\.js$/, ""), user.token, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await mod[fn]({ request: req, env });
    assert.equal(res.status, 402, `${rel} ${fn} -> ${res.status} for a free user`);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.ok(body.error, "the 402 must name a machine-readable error");
    assert.ok(
      !/upgrade to pro|contact support/i.test(String(body.detail || "")) || /pricing/i.test(String(body.detail || "")),
      `${rel} 402 must point somewhere real`
    );
  }
});

test("the same paid route answers 200 once the subscription is active", async () => {
  const { db, d1 } = freshD1();
  const user = seedUser(db);
  subscribe(db, user.id);
  const env = { DB: d1 };
  const mod = await import(join(API, "list", "ebay.js"));
  const req = authed("https://fashionistas.ai/api/list/ebay", user.token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const res = await mod.onRequestPost({ request: req, env });
  // Past the 402. With no sandbox credentials configured it must now fail on
  // the CREDENTIAL layer (503), never on the paywall again.
  assert.notEqual(res.status, 401, "an active subscriber is authenticated");
  assert.notEqual(res.status, 402, "an active subscriber is not on the free tier");
  assert.equal(res.status, 503, `expected the missing-credentials 503, got ${res.status}`);
});

test("a lapsed subscription drops back to 402 (a stale 'active' row is not a pass)", async () => {
  const { db, d1 } = freshD1();
  const user = seedUser(db);
  const env = { DB: d1 };
  // Past period end: the row still says 'active', which is exactly the case
  // the gate has to catch on its own.
  db.exec(`CREATE TABLE subscriptions (user_id INTEGER PRIMARY KEY, status TEXT, current_period_end INTEGER)`);
  db.prepare(`INSERT INTO subscriptions VALUES (?, 'active', ?)`).run(
    user.id,
    Math.floor(Date.now() / 1000) - 60
  );
  const mod = await import(join(API, "list", "etsy.js"));
  const req = authed("https://fashionistas.ai/api/list/etsy", user.token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const res = await mod.onRequestPost({ request: req, env });
  assert.equal(res.status, 402);
});

/* ------------------------------------- routes that gate AFTER body parse */

test("routes that validate the body before the gate still refuse a stranger", async () => {
  const { d1 } = freshD1();
  const env = { DB: d1 };

  const listing = await import(join(API, "listing", "index.js"));
  const good = jsonPost("https://fashionistas.ai/api/listing", {
    item: { description: "a blue denim jacket, worn twice" },
  });
  const res = await listing.onRequest({ request: good, env });
  assert.equal(res.status, 401, `listing -> ${res.status}`);

  const chat = await import(join(API, "chat", "index.js"));
  const chatRes = await chat.onRequest({
    request: jsonPost("https://fashionistas.ai/api/chat", { message: "what should I price this at?" }),
    env,
  });
  assert.equal(chatRes.status, 401, `chat -> ${chatRes.status}`);
});

/* --------------------------------------------- public routes stay read-only */

test("the public presence endpoints never emit a token or a secret", async () => {
  const { d1 } = freshD1();
  // Put a REAL-looking token in the store so a leak would actually show.
  db_seedToken(d1);
  const env = { DB: d1 };

  for (const rel of ["ebay/status.js", "ebay/config.js"]) {
    const mod = await import(join(API, rel));
    const res = await mod.onRequestGet({ request: new Request("https://fashionistas.ai/api/x"), env });
    const text = await res.text();
    assert.ok(res.status === 200, `${rel} -> ${res.status}`);
    assert.ok(!/SUPER_SECRET_ACCESS_TOKEN/.test(text), `${rel} leaked an access token`);
    assert.ok(!/SUPER_SECRET_REFRESH/.test(text), `${rel} leaked a refresh token`);
    assert.ok(!/SUPER_SECRET_CLIENT_ID/.test(text), `${rel} leaked a client id`);
  }
});

function db_seedToken(d1) {
  // written through the raw binding the same way the OAuth callback does
  const db = d1.__raw;
  db.exec(`CREATE TABLE IF NOT EXISTS ebay_tokens (token_key TEXT PRIMARY KEY, access_token TEXT, refresh_token TEXT, expires_at INTEGER, token_type TEXT, env TEXT, scopes TEXT, updated_at INTEGER)`);
  db.prepare(`INSERT INTO ebay_tokens VALUES ('anon', ?, ?, ?, 'Bearer', 'production', '', 0)`).run(
    "SUPER_SECRET_ACCESS_TOKEN",
    "SUPER_SECRET_REFRESH",
    Math.floor(Date.now() / 1000) + 7200
  );
}

test("the stored image route is public but strictly path-scoped", async () => {
  const { d1 } = freshD1();
  const env = { DB: d1, TRYON_BUCKET: null };
  const mod = await import(join(API, "tryon", "image", "[uuid].js"));

  // Every traversal / injection shape a stranger could try.
  const BAD = [
    "../../etc/passwd",
    "..%2F..%2Fwrangler.toml",
    "0123456789abcdef0123456789abcdef/../../secrets",
    "tryon/0123456789abcdef0123456789abcdef.png",
    "0123456789abcdef0123456789abcde",
    "0123456789abcdef0123456789abcdeg.png",
    "src-../../.env",
    "",
    "0123456789abcdef0123456789abcdef.png%00.txt",
  ];
  for (const raw of BAD) {
    const res = await mod.onRequestGet({
      request: new Request("https://fashionistas.ai/api/tryon/image/x"),
      env,
      params: { uuid: raw },
    });
    assert.equal(res.status, 400, `id ${JSON.stringify(raw)} -> ${res.status} (must be refused)`);
  }

  // A well-formed but absent id is a 404, not a 500 and not a foreign key read.
  const missing = await mod.onRequestGet({
    request: new Request("https://fashionistas.ai/api/tryon/image/x"),
    env: { TRYON_BUCKET: { put: async () => {}, get: async () => null } },
    params: { uuid: "0123456789abcdef0123456789abcdef" },
  });
  assert.equal(missing.status, 404);
});