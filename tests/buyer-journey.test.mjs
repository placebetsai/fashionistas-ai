/**
 * Walking the marketplace as a real buyer and a real seller surfaced four
 * breaks that all landed on the same promise — "sign in once, then it just
 * works" — and quietly broke it:
 *
 *   1. Buyer taps Message on an item → the client sent `/api/dm/demo`, but the
 *      Worker's route was `/api/dm/(\d+)`. A handle never matched, fell
 *      through the router and answered 404 "Not found", which the thread then
 *      printed as a raw error. The seller never received anything, and no
 *      message was ever sent. (This was broken on production too, not just on
 *      preview — the shipped bundle passed the username.)
 *   2. Buyer taps Reserve while signed out → correct gate, correct toast, but
 *      after creating the account `afterAuth()` ran `go("home")`. The intent
 *      died, and the address bar kept claiming /shop/<id> while Home was on
 *      screen.
 *   3. The floating seller checklist sat on top of the controls it describes:
 *      it covered "Take photo" far enough to swallow a real drag-and-drop
 *      (the drop event never fired), and it covered the message composer.
 *   4. document.title froze on whichever item was last opened — Sell and
 *      Messages kept showing the previous item's title to the user and to
 *      anyone reading the tab.
 *
 * These lock the fixes: id-addressed messaging with intent kept across
 * sign-in, a resume path that lands where the user was, a checklist that gets
 * out of the way, and a tab title that follows the screen.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { indexSource } from "./helpers/index-source.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = indexSource(ROOT);
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const wizard = readFileSync(join(ROOT, "listing-wizard.js"), "utf8");
const coach = readFileSync(join(ROOT, "seller-coach.js"), "utf8");
const coachLib = readFileSync(join(ROOT, "libs", "seller-coach.js"), "utf8");

// The API lives in a sibling workspace on this laptop. When it isn't there
// (fresh clone), the Worker assertions skip instead of failing the suite.
const WORKER_SRC = join(
  ROOT, "..", "Documents", "Default Project", "nexus-ai-suite", "workers", "fashionistas-api", "src", "index.js"
);
const hasWorker = existsSync(WORKER_SRC);
const worker = hasWorker ? readFileSync(WORKER_SRC, "utf8") : "";
const noWorker = !hasWorker && "fashionistas-api source not present in this workspace";

/* ── 1. messaging is addressed by user id ─────────────────────────────── */


test("the item page messages the seller by id, not by handle", () => {
  assert.match(src, /function dmPeerRef\(m, fallback\)\{/, "one place builds the peer");
  assert.match(src, /const id = m && m\.seller && Number\(m\.seller\.id\)/, "prefers seller.id");
  assert.match(
    src,
    /onclick="dmOrSignIn\(\$\{dmPeerRef\(m, sellerU\|\|seller\)\}/,
    "buy bar passes the resolved peer"
  );
  assert.match(
    src,
    /onclick="closeSheet\(\);dmOrSignIn\(\$\{dmPeerRef\(m, seller\)\}/,
    "buy sheet passes the resolved peer"
  );
  // the two raw handle call sites are gone
  assert.doesNotMatch(src, /threadScreen\('\$\{escapeAttr\(sellerU\|\|seller\)\}'\)/);
  assert.doesNotMatch(src, /threadScreen\('\$\{escapeAttr\(\(m\.seller&&m\.seller\.username\)\|\|seller\)\}'\)/);
});

test("the Worker accepts a handle and resolves it to an account", { skip: noWorker }, () => {
  assert.match(worker, /async function dmPeerId\(env, raw\)/, "shared resolver");
  assert.match(worker, /if \(\/\^\\d\+\$\/\.test\(raw\)\) return \+raw;/, "numeric ids stay untouched");
  assert.match(worker, /SELECT id FROM users WHERE username=\? LIMIT 1/, "handle lookup");
  assert.ok(
    worker.includes('const dmOne = path.match(/^\\/api\\/dm\\/([0-9]{1,12}|[A-Za-z0-9_.@-]{1,64})$/);'),
    "route matches a handle as well as an id"
  );
  assert.ok(!worker.includes('const dmOne = path.match(/^\\/api\\/dm\\/(\\d+)$/);'), "old handle-blind matcher is gone");
  assert.ok(
    worker.includes('const other = await dmPeerId(env, dmOne[1]);\n        if (!other) return json({ messages: [], latest: 0 });'),
    "an unknown handle reads as an empty thread, not an error page"
  );
  assert.ok(
    worker.includes('const other = await dmPeerId(env, dmOne[1]);\n        if (!other) return err("No such person", 404);'),
    "posting to a handle nobody owns is a real 404"
  );
});

/* ── 2. sign-in finishes what the guest started ───────────────────────── */

test("a gated tap remembers the intent instead of losing it", () => {
  assert.match(src, /function setPendingIntent\(data\)\{/, "writer");
  assert.match(src, /function takePendingIntent\(\)\{/, "reader, and it removes the key");
  assert.match(src, /sessionStorage\.removeItem\("fash_pending"\)/, "one-shot");
  assert.match(src, /\(Date\.now\(\) - \(p\.at \|\| 0\)\) > 15 \* 60000/, "stale intents expire");
  assert.match(
    src,
    /if \(!TOKEN\)\{ closeSheet\(\); setPendingIntent\(\{ action:"reserve", id: Number\(id\) \}\);/,
    "guest Reserve saves the item"
  );
  assert.match(
    src,
    /if \(r\.status === 401\)\{ closeSheet\(\); setPendingIntent\(\{ action:"reserve", id: Number\(id\) \}\);/,
    "an expired token mid-reserve saves it too"
  );
  assert.match(
    src,
    /if \(!TOKEN\)\{ setPendingIntent\(\{ action:"message", peer: peer, label: label \|\| "" \}\);/,
    "guest Message saves the thread"
  );
});

test("afterAuth resumes the intent instead of forcing Home", () => {
  const auth = src.slice(src.indexOf("function afterAuth(d){"), src.indexOf("function logout(){"));
  assert.match(auth, /resumeAfterAuth\(\)/, "resume runs on every sign-in");
  assert.doesNotMatch(auth, /go\("home"\)/, "the hard-coded Home hop is gone");
  // the chrome flip the earlier test locks must survive
  assert.match(auth, /syncSessionChrome\(\)/);

  assert.match(src, /function resumeAfterAuth\(\)\{/, "the resumer exists");
  assert.match(src, /p\.action === "reserve" && p\.id/, "re-opens the item and reserves");
  assert.match(src, /await openMarketItem\(Number\(p\.id\)\); buySheet\(Number\(p\.id\)\);/, "back on the item first");
  assert.match(src, /p\.action === "message" && p\.peer !== undefined/, "re-opens the thread");
  // and a plain deep link lands on the page the address bar claims
  assert.ok(src.includes("const item = path.match(/^\\/shop\\/(\\d+)$/);"), "/shop/<id> is recognized");
  assert.match(src, /if \(item\)\{ openMarketItem\(Number\(item\[1\]\)\); return true; \}/, "item route wins");
  assert.match(src, /if \(path === "\/shop"\)\{ go\("shop"\); return true; \}/, "grid route too");
  // the "next: Connect your shop" nudge must not fire when it just finished a task
  assert.match(src, /if \(!resumed\) toast\("Signed in as " \+ who/, "no generic nudge after a resume");
});

/* ── 3. the checklist stops covering the controls ─────────────────────── */

test("the seller checklist collapses before anything it would cover", () => {
  assert.match(coach, /function collapse\(\) \{/, "collapse exists");
  assert.match(coach, /window\.SCCollapse = collapse;/, "plain global: it loads after the app bundle");
  assert.match(coach, /collapse: collapse/, "also on the SellerCoach object");
  assert.equal(coach, coachLib, "public copy stays byte-identical to libs/");

  // it collapses exactly where it caused damage: drop zone, composer, sheets
  assert.match(wizard, /if \(typeof SCCollapse === "function"\) \{ try \{ SCCollapse\(\); \} catch \(e\) \{\} \}/,
    "sell wizard mounts with it out of the way");
  assert.match(src, /function openSheet\(html\)\{\n if \(typeof SCCollapse === "function"\)/, "sheets open over it");
  assert.match(src, /async function threadScreen\(id, label\)\{[\s\S]{0,400}SCCollapse\(\)/, "messages too");
  assert.match(src, /async function messagesScreen\(\)\{[\s\S]{0,300}SCCollapse\(\)/, "the inbox too");
  assert.match(src, /navDrawer\(false\);\n  \/\* Move on and the floating checklist[\s\S]{0,220}SCCollapse\(\)/,
    "and every screen swap");

  // it must not re-expand itself behind the fix, or every collapse is cosmetic
  assert.match(coach, /function collapse\(\) \{[\s\S]{0,620}st\.panelOpened = true; saveState\(st\);/,
    "collapse() also retires the first-open expansion");
  assert.ok(!coach.includes("isPhone"), "the phone-only gate is gone");
  assert.match(coach,
    /if \(!st\.panelOpened\) \{ panel\.classList\.add\("collapsed"\); st\.panelOpened = true; saveState\(st\); \}/,
    "first open starts collapsed on every screen size");
  assert.doesNotMatch(coach, /panel\.classList\.remove\("collapsed"\);[\s\S]{0,80}tg\.textContent/,
    "it no longer force-expands itself on first render");
});

/* ── 4. the tab title follows the screen ──────────────────────────────── */

test("document.title tracks the screen the user is on", () => {
  assert.match(src, /const \[t, sub\] = TITLES\[v\] \|\| \["",""\]; if \(t\) document\.title = t \+ " — fashionistas\.ai";/,
    "go() sets the tab title");
  assert.match(src, /async function threadScreen\(id, label\)\{[\s\S]{0,400}document\.title = name \+ " — fashionistas\.ai";/,
    "Messages is Messages");
  assert.match(wizard, /if \(t\) document\.title = t \+ " — fashionistas\.ai";/, "Sell is Sell");
  assert.match(src, /async function messagesScreen\(\)\{[\s\S]{0,260}document\.title = "Messages — fashionistas\.ai";/,
    "the inbox names itself, not the screen behind it");
  assert.match(html, /src="\/assets\/app\.[0-9a-f]{12}\.js"/, "bundle is content-addressed");
  assert.match(html, /src="\/listing-wizard\.js\?v=\d+"/, "wizard cache-busted");
  assert.match(html, /src="\/seller-coach\.js\?v=\d+"/, "coach cache-busted");
});

/* ── 5. your own conversations are never dropped ──────────────────────── */

test("Messages keeps real threads ahead of the directory sample", { skip: noWorker }, () => {
  assert.ok(worker.includes("const threads = await env.DB.prepare("), "conversations get their own query");
  assert.match(
    worker,
    /SELECT 1 FROM dm_messages m WHERE \(m\.from_id=u\.id AND m\.to_id=\?\) OR \(m\.to_id=u\.id AND m\.from_id=\?\)/,
    "finds the peer you actually talked to"
  );
  assert.ok(
    worker.includes("const people = [...(threads.results || []), ...(directory.results || [])]"),
    "threads first, never-messaged accounts after"
  );
  assert.ok(worker.includes("const visible = (people || []).filter"), "the merged list is what renders");
  // the old shape: conversations were derived from the first 100 accounts
  // alphabetically, so a real thread disappeared once the site passed 100 users
  assert.ok(!worker.includes("const visible = (people.results || []).filter"), "no longer sliced by the directory LIMIT");
  assert.ok(!/SELECT id, username, display_name FROM users WHERE id<>\? ORDER BY COALESCE\(display_name,username\) ASC LIMIT 100"\s*\)\.bind\(user\.sub\)\.all\(\);\s*const visible/.test(worker),
    "the single capped query is no longer the source of truth");
});

