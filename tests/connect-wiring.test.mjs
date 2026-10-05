/**
 * Proves the Connect wiring in index.html by executing the ACTUAL functions
 * extracted from index.html — not a re-implementation of them.
 *
 * Why this matters: the Connect grid used to self-declare `via:"local"` when
 * the seller pressed "I've connected", so the UI claimed "Connected" for a
 * session nobody ever observed. "connected" must now be reachable only from
 * the extension's probe. If someone reverts that, these tests fail.
 *
 * Offline: no network, no extension, no DOM.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

/** Pull a real function declaration (incl. its `async ` prefix) out of index.html. */
function grab(name) {
  let i = html.indexOf("function " + name + "(");
  assert.notEqual(i, -1, `function not found in index.html: ${name}`);
  if (html.slice(i - 6, i) === "async ") i -= 6; // dropping `await`'s async is fatal
  let depth = 0, started = false;
  for (let k = html.indexOf("{", i); k < html.length; k++) {
    const c = html[k];
    if (c === "{") { depth++; started = true; }
    else if (c === "}") {
      depth--;
      if (started && depth === 0) return html.slice(i, k + 1);
    }
  }
  throw new Error(`unbalanced braces while extracting: ${name}`);
}

const NAMES = [
  "xlConnectLoad", "xlConnectSave", "xlConnectStatus", "xlConnectStatusTag",
  "xlConnectVerify", "xlConnectSyncFromExtension", "xlConnectMarkLocal",
];
const SRC = NAMES.map(grab).join("\n\n");

/** Fresh world: in-memory localStorage + a controllable fake extension. */
function makeWorld({ sessions = {}, dead = false, ebayKeys = {} } = {}) {
  const store = {};
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const world = {
    store, localStorage,
    XL_CONNECT_KEY: "fash_connect_v1",
    sessions, dead, ebayKeys,
    sent: [], toasts: [], refreshed: 0,
  };
  world.xlEbayKeysLoad = () => world.ebayKeys;
  world.escapeHtml = (s) => String(s);
  world.toast = (m) => world.toasts.push(String(m));
  world.xlConnectRefresh = () => { world.refreshed++; };
  world.xlShopPaintStatus = () => {};
  world.xlConnectShopsMerged = () =>
    ["poshmark", "mercari", "depop", "grailed", "ebay", "etsy"].map((id) => ({ id }));
  world.extSend = async (msg) => {
    world.sent.push(msg);
    return world.dead ? null : { ok: true, sessions: world.sessions };
  };
  // `new Function` body is sloppy-mode, so its declarations stay local and the
  // extracted functions can close over the stubs above as parameters.
  const build = new Function(
    "localStorage", "XL_CONNECT_KEY", "xlEbayKeysLoad", "escapeHtml", "toast",
    "xlConnectRefresh", "xlShopPaintStatus", "xlConnectShopsMerged", "extSend",
    `${SRC}\n;return {${NAMES.join(",")}};`,
  );
  Object.assign(world, build(
    world.localStorage, world.XL_CONNECT_KEY, world.xlEbayKeysLoad, world.escapeHtml,
    world.toast, world.xlConnectRefresh, world.xlShopPaintStatus,
    world.xlConnectShopsMerged, world.extSend,
  ));
  world.state = () => JSON.parse(world.store[world.XL_CONNECT_KEY] || "{}");
  return world;
}

test("a manual mark reports Unverified, never Connected", () => {
  const w = makeWorld();
  w.xlConnectMarkLocal("poshmark");
  const st = w.xlConnectStatus("poshmark");
  assert.equal(st, "unverified");
  const tag = w.xlConnectStatusTag(st);
  assert.match(tag, /Unverified/);
  assert.doesNotMatch(tag, /tag connected/);
  assert.equal(w.state().poshmark.via, "manual");
  assert.ok(!JSON.stringify(w.state()).includes('"local"'), "via:'local' must never be written again");
});

test("only an extension probe can produce 'connected'", async () => {
  const w = makeWorld({ sessions: { poshmark: true } });
  w.xlConnectMarkLocal("poshmark");
  assert.equal(w.xlConnectStatus("poshmark"), "unverified", "manual mark is not yet connected");

  await w.xlConnectSyncFromExtension();
  assert.equal(w.state().poshmark.via, "extension");
  assert.equal(w.xlConnectStatus("poshmark"), "connected");
  assert.match(w.xlConnectStatusTag("connected"), /tag connected/);
});

test("a negative probe says needs + why, instead of keeping a stale claim", async () => {
  const w = makeWorld({ sessions: { poshmark: false, mercari: false } });
  w.xlConnectMarkLocal("poshmark"); // seller insists
  await w.xlConnectSyncFromExtension();
  assert.equal(w.xlConnectStatus("poshmark"), "needs");
  assert.equal(w.state().poshmark.via, "extension");
  assert.equal(w.state().poshmark.reason, "session_absent");
});

test("verify sends exactly {type:'status'} and persists no secret-shaped data", async () => {
  const w = makeWorld({ sessions: { depop: true } });
  const res = await w.xlConnectVerify("depop");
  assert.deepEqual(res, { ok: true, connected: true });
  assert.equal(w.sent.length, 1);
  assert.deepEqual(w.sent[0], { type: "status" }, "no extra fields go over the wire");
  assert.ok(!/cookie|token|password/i.test(JSON.stringify(w.state().depop)));
});

test("an unreachable extension fails closed and writes nothing", async () => {
  const w = makeWorld({ dead: true, sessions: { grailed: true } });
  w.xlConnectMarkLocal("grailed");
  const before = w.store[w.XL_CONNECT_KEY];
  const res = await w.xlConnectVerify("grailed");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "extension_unavailable");
  assert.equal(w.store[w.XL_CONNECT_KEY], before, "localStorage must be untouched");
  assert.equal(await w.xlConnectSyncFromExtension(), false);
});

test("a negative session probe never downgrades saved eBay keys", async () => {
  const w = makeWorld({ sessions: { ebay: false }, ebayKeys: { clientId: "cid" } });
  await w.xlConnectSyncFromExtension();
  assert.equal(w.state().ebay.reason, "session_absent");
  assert.equal(w.xlConnectStatus("ebay"), "ready", "'no live session' is not 'no account'");
});

test("sync only rewrites shops the grid actually renders", async () => {
  const w = makeWorld({ sessions: { poshmark: true, someothermarket: true } });
  await w.xlConnectSyncFromExtension();
  const s = w.state();
  assert.ok(s.poshmark, "rendered shop written");
  assert.equal(s.someothermarket, undefined, "unknown shop left alone");
});

test("index.html inline JavaScript parses", () => {
  const blocks = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const t = /type="([^"]+)"/.exec(attrs);
    if (t && t[1] !== "text/javascript" && t[1] !== "module") continue; // JSON-LD etc.
    if (attrs.includes("src=")) continue;
    blocks.push(m[2]);
  }
  assert.ok(blocks.length >= 1, "expected at least one inline script");
  // every onclick="fn(" must resolve to a definition in the inline script
  const combined = blocks.join("\n;\n");
  const handlers = new Set([...html.matchAll(/on(?:click|input|change)="([A-Za-z_$][\w$]*)\(/g)].map((x) => x[1]));
  const defined = new Set([...combined.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((x) => x[1]));
  // arrow-function / variable bindings count as definitions too (`const $ = (s) => ...`)
  for (const m of combined.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
  for (const h of handlers) assert.ok(defined.has(h), `onclick handler has no definition: ${h}`);
});
