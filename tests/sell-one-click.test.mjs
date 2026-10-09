/**
 * "One and done forever" — the seller's side of the UX contract:
 *
 *   1. Photos arrive by real drag & drop (and paste), not only by tapping a
 *      button into a hidden <input type=file>, and every path funnels into the
 *      same ingest -> downscale -> AI pipeline.
 *   2. The everywhere screen carries ONE primary button ("Post everywhere")
 *      that either hands every pending shop to the extension at once or walks
 *      them one tap at a time — and never claims a shop was posted.
 *   3. The session slides: the boot probe stores the renewed token, so an
 *      active seller is never asked to sign in again.
 *   4. The word cuts hold — the walls of instructions are gone.
 *
 * Source-level (offline, no browser): these read the shipped files themselves.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const wizard = readFileSync(join(ROOT, "listing-wizard.js"), "utf8");
const css = readFileSync(join(ROOT, "listing-wizard.css"), "utf8");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const bundlePath = html.match(/<script src="\/(assets\/app\.[0-9a-f]+\.js)" defer><\/script>/)[1];
const bundle = readFileSync(join(ROOT, bundlePath), "utf8");

test("drag & drop: the mount wires dragover/drop on the screen container", () => {
  assert.match(wizard, /function wireDrop\(el\)/);
  assert.match(wizard, /el\.addEventListener\("dragover"/);
  assert.match(wizard, /el\.addEventListener\("drop"/);
  assert.match(wizard, /wireDrop\(el\);\s*\n\s*wirePaste\(\);/, "both wirers run on mount");
  // The drop must be swallowed (otherwise the browser opens the file) and must
  // only fire while the wizard is the screen that's up.
  assert.match(wizard, /e\.preventDefault\(\); el\.classList\.remove\("lw-drag"\);\s*\n\s*ingest\(/);
  assert.match(wizard, /if \(!\$id\("lw"\) \|\| !W \|\| W\.mode !== "new" \|\| !hasFiles\(e\)\) return;/);
});

test("drag & drop: a visual drop target state exists in the stylesheet", () => {
  assert.match(css, /#screen\.lw-drag \.lw-drop\{[^}]*border-color:var\(--accent\)/);
  assert.match(css, /#screen\.lw-drag \.lw-grid\{/);
});

test("paste is wired too, and only for image payloads", () => {
  assert.match(wizard, /function wirePaste\(\)/);
  assert.match(wizard, /items\[i\]\.type\.indexOf\("image\/"\) === 0/);
  assert.match(wizard, /if \(got\.length\) \{ e\.preventDefault\(\); ingest\(got\); \}/);
});

test("every photo path funnels into one ingest() that filters to images", () => {
  assert.match(wizard, /function files\(inp\) \{ ingest\(inp\.files\); \}/, "file input -> ingest");
  assert.match(wizard, /function ingest\(fileList\)/);
  assert.ok(wizard.includes('return f && /^image\\//.test(f.type);'), "non-images are dropped before downscale");
  assert.match(wizard, /if \(first && PHOTOS\.length && W\.mode === "new"\) identify\(false\);/, "first photo still triggers the AI");
});

test("the everywhere screen has one primary button wired to LW.sellAll", () => {
  assert.match(wizard, /class="lw-next lw-go lw-all" onclick="LW\.sellAll\(\)"/);
  assert.match(wizard, /"Post everywhere · "/, "label counts the pending shops");
  assert.match(wizard, /sellAll: sellAll/, "exported on window.LW");
  // The button only renders while something is actually left to post.
  assert.match(wizard, /var pend = pendingShops\(\);\s*\n\s*if \(pend\.length\) \{/);
});

test("sellAll: extension installed = hand every pending shop over at once", () => {
  const body = wizard.slice(wizard.indexOf("function sellAll()"), wizard.indexOf("function walkNext()"));
  assert.match(body, /extAvailable\(\)/);
  assert.match(body, /handoffSellAll\(P\.l\.id, pend\)/, "passes the wizard's own list, not the sheet's checkboxes");
  assert.match(body, /P\.walk = pend; P\.walkAt = 0;/, "no extension -> sequential walk");
});

test("sellAll without the extension walks the list, one tap per shop", () => {
  const walk = wizard.slice(wizard.indexOf("function walkNext()"), wizard.indexOf("/* Open synchronously"));
  assert.match(walk, /stateOf\(P\.walk\[P\.walkAt\]\) === "posted"\) P\.walkAt\+\+/, "never reopens an already-posted shop");
  assert.match(walk, /P\.walk = null; renderPost\(false\);/, "walk ends by re-rendering the screen");
  assert.match(walk, /openWithKit\(id\)/);
});

test("each walk step opens the shop synchronously, then copies its own kit", () => {
  const kit = wizard.slice(wizard.indexOf("function openWithKit(id)"), wizard.indexOf("function renderPost("));
  const openAt = kit.indexOf("window.open(s.sell");
  const copyAt = kit.indexOf("navigator.clipboard.writeText(text)");
  assert.ok(openAt > -1 && copyAt > openAt, "window.open happens inside the gesture (async opens get popup-blocked)");
  assert.match(kit, /shopTitle\(id, l\)/, "shop-specific title");
  assert.match(kit, /condFor\(id, l\)/, "shop-specific condition wording");
  assert.match(kit, /shopDesc\(id, l\)/, "shop-specific description");
});

test("the bundle's handoffSellAll accepts an explicit pick list", () => {
  const fn = bundle.slice(bundle.indexOf("async function handoffSellAll("), bundle.indexOf("/** Re-render the sheet's handoff rows"));
  assert.match(fn, /async function handoffSellAll\(lid, picksArg\)/);
  assert.match(fn, /Array\.isArray\(picksArg\) && picksArg\.length/);
  assert.match(fn, /xlChecks\(\)\.filter\(c=>c\.checked\)\.map\(c=>c\.value\)/, "sheet behaviour unchanged when no list is passed");
  assert.match(fn, /for \(const shop of picks\)/, "extension branch still iterates every pick");
  assert.doesNotMatch(fn, /nothing was marked Posted[\s\S]*window\.close/, "honest toasts untouched");
});

test("the boot probe slides the session instead of only reading it", () => {
  const fn = bundle.slice(bundle.indexOf("async function restoreSession()"), bundle.indexOf("/* 402 guidance"));
  assert.match(fn, /const d = await r\.json\(\)/);
  assert.match(fn, /if \(d && d\.token && d\.token !== TOKEN\)\{ TOKEN = d\.token; localStorage\.setItem\("fash_token", TOKEN\); \}/);
  assert.match(fn, /return;/, "a 401 returns early — a dead token never stores anything");
});

test("the word cuts hold: the instruction walls are gone", () => {
  assert.doesNotMatch(wizard, /Depop, Poshmark, Mercari, Vinted, Grailed, eBay and Etsy do not let us press Post for you/);
  assert.doesNotMatch(wizard, /Photo, title, price\. Then it/);
  assert.doesNotMatch(wizard, /AI reads the first photo and fills in the details/);
  assert.match(wizard, /Front, label, back, flaws — up to ' \+ MAXP \+ '\. AI fills in the rest\./);
});
