/**
 * AdSense wiring: the publisher id, the loader, the slots, and ads.txt must
 * agree with each other, and the parts that Google actually needs must be
 * present in the bytes the server sends.
 *
 * These are regression pins on the failure mode this site already shipped once:
 * a page that renders `<ins class="adsbygoogle">` with no adsbygoogle.js in the
 * document reports ZERO impressions forever, because nothing drains the
 * window.adsbygoogle queue. So the loader is a literal, `async`, non-deferred
 * <script src> in the head, exactly once per page — and these tests fail if it
 * is ever module-loaded, gains `defer`, is duplicated, or if an id drifts.
 *
 * Single source of truth is ../site-adsense.js. This file imports the real
 * module and re-renders its markup, then compares that against what the pages
 * and ads.txt actually ship, so hand-editing an id in HTML fails the suite.
 *
 * Nothing here is a secret: a ca-pub id is a public publisher identifier.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADSENSE_CLIENT,
  ADSENSE_LOADER_HOST,
  ADSENSE_LOADER_SRC,
  ADSENSE_PUBLISHER_ID,
  ADSENSE_ADS_TXT_LINE,
  AD_SLOTS,
  AD_RESERVED_HEIGHT,
  AD_DEFAULT_RESERVED_HEIGHT,
  slotFor,
  reservedHeightFor,
  loaderTagHTML,
  adSlotHTML,
} from "../site-adsense.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
/** Read a repo-relative path. */
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
/** Read an already-absolute path (the walked page list). */
const readAbs = (abs) => readFileSync(abs, "utf8");

/** Every .html the static build serves. Skips node_modules/.git/dotfiles. */
function findHtml(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findHtml(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const ALL_HTML = findHtml(ROOT);
const rel = (abs) => abs.slice(ROOT.length + 1);

/** A page counts as instrumented if it references the library or a mount. */
const isInstrumented = (html) => /adsbygoogle|data-ad-slot/.test(html);

const PAGES = ALL_HTML.filter((f) => isInstrumented(readAbs(f))).map((f) => ({ name: rel(f), html: readAbs(f) }));

/** Real mount points only — not the prose mentions of the attribute in comments. */
const MOUNT_RE = /<div data-ad-slot="([A-Za-z0-9_-]+)"\s*><\/div>/g;

function mountsOf(html) {
  return [...html.matchAll(MOUNT_RE)].map((m) => m[1]);
}

/** Count non-overlapping occurrences of a literal string. */
const countOf = (haystack, needle) => haystack.split(needle).length - 1;

test("the adsense surface is not empty", () => {
  assert.ok(ALL_HTML.length > 0, "found no .html pages to check");
  assert.ok(PAGES.length > 0, "no page ships an AdSense loader or slot — the site earns nothing");
});

test("the publisher id is the approved one and is defined once", () => {
  assert.equal(ADSENSE_CLIENT, "ca-pub-7215975042937417");
  assert.equal(ADSENSE_PUBLISHER_ID, "pub-7215975042937417");
  assert.ok(ADSENSE_LOADER_SRC.includes(ADSENSE_CLIENT), "loader src must carry the client id");
  assert.equal(
    ADSENSE_LOADER_SRC,
    `https://${ADSENSE_LOADER_HOST}/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`,
  );
});

test("no second or invented publisher id exists on the served surface", () => {
  // One publisher only. A drifted copy is how a site ends up filling slots
  // against an account that was never approved for it.
  const sources = [
    ...PAGES.map((p) => [p.name, p.html]),
    ["ads.txt", read("ads.txt")],
    ["site-adsense.js", read("site-adsense.js")],
  ];
  for (const [name, body] of sources) {
    const ids = new Set(body.match(/ca-pub-\d+/g) || []);
    for (const id of ids) {
      assert.equal(id, ADSENSE_CLIENT, `${name} ships a foreign publisher id: ${id}`);
    }
  }
});

test("ads.txt authorizes exactly this publisher", () => {
  const ads = read("ads.txt");
  const directives = ads
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  assert.deepEqual(directives, [ADSENSE_ADS_TXT_LINE], "ads.txt must carry the one approved directive line");
  assert.ok(ads.includes(ADSENSE_PUBLISHER_ID), "ads.txt must name the publisher from site-adsense.js");
  assert.doesNotMatch(ads, /pub-X{4,}/, "ads.txt still has a placeholder id — no ad would ever be authorized");
});

test("every instrumented page emits the loader exactly once, in the head", () => {
  for (const page of PAGES) {
    const srcCount = countOf(page.html, ADSENSE_LOADER_SRC);
    assert.equal(srcCount, 1, `${page.name} loads adsbygoogle.js ${srcCount} times, expected once`);

    assert.ok(
      page.html.includes(loaderTagHTML()),
      `${page.name} does not ship loaderTagHTML() byte-for-byte; regenerate it from site-adsense.js`,
    );

    const loaderAt = page.html.indexOf(ADSENSE_LOADER_SRC);
    const headEnd = page.html.indexOf("</head>");
    assert.ok(headEnd !== -1, `${page.name} has no </head>`);
    assert.ok(loaderAt < headEnd, `${page.name} loads adsbygoogle.js after </head>, so no ad ever fills`);
  }
});

test("the loader is async and never deferred or module-loaded", () => {
  const tag = loaderTagHTML();
  assert.match(tag, /<script\b/);
  assert.match(tag, /\basync\b/);
  assert.doesNotMatch(tag, /\bdefer\b/, "defer injects late: the <ins> ships with nothing to fill it");
  assert.doesNotMatch(tag, /type=["']?module/, "a module script loads late the same way");
  assert.match(tag, /crossorigin="anonymous"/);

  // Guard the whole surface, not just the helper: a page could hardcode a
  // second, wrongly-ordered loader that the helper above never sees.
  for (const page of PAGES) {
    for (const m of page.html.matchAll(/<script[^>]*pagead2\.googlesyndication\.com[^>]*>/g)) {
      assert.match(m[0], /\basync\b/, `${page.name}: loader must stay async`);
      assert.doesNotMatch(m[0], /\bdefer\b/, `${page.name}: loader must never be deferred`);
      assert.doesNotMatch(m[0], /type=["']?module/, `${page.name}: loader must never be a module`);
    }
  }
});

test("every page carries at least one mount, and every mount is a known placement", () => {
  for (const page of PAGES) {
    const mounts = mountsOf(page.html);
    assert.ok(mounts.length > 0, `${page.name} is instrumented but declares no ad mount`);

    for (const name of mounts) {
      assert.ok(name in AD_SLOTS, `${page.name} mounts unknown placement "${name}" — never invent a slot id`);
    }

    // Every data-ad-slot value in the page must be a placement name this module
    // knows, so no page can smuggle in a raw slot id behind the module's back.
    for (const m of page.html.matchAll(/data-ad-slot="([^"]+)"/g)) {
      const value = m[1];
      if (mounts.includes(value)) continue;
      assert.ok(
        Object.values(AD_SLOTS).includes(value),
        `${page.name} declares data-ad-slot="${value}" that does not resolve through site-adsense.js`,
      );
    }
  }
});

test("adSlotHTML is self-consistent and escapes caller-supplied attributes", () => {
  assert.equal(slotFor("hero"), AD_SLOTS.hero);
  assert.equal(slotFor(null), AD_SLOTS.default);
  assert.equal(slotFor(undefined), AD_SLOTS.default);
  assert.equal(reservedHeightFor("sidebar"), AD_RESERVED_HEIGHT.sidebar);
  assert.equal(reservedHeightFor(null), AD_DEFAULT_RESERVED_HEIGHT);

  for (const name of Object.keys(AD_SLOTS)) {
    assert.ok(name in AD_RESERVED_HEIGHT, `placement "${name}" reserves no height — an ad filling in would shift layout`);
  }

  const html = adSlotHTML("inContent");
  assert.ok(html.includes(`data-ad-client="${ADSENSE_CLIENT}"`));
  assert.ok(html.includes(`data-ad-slot="${AD_SLOTS.inContent}"`));
  assert.ok(html.includes(`min-height:${AD_RESERVED_HEIGHT.inContent}px`), "slot must reserve its height");
  assert.ok(html.includes('class="adsbygoogle"'));

  // adSlotHTML is assigned to innerHTML, so a quote in a caller-supplied label
  // must not be able to close the attribute and append an event handler.
  const injected = adSlotHTML("inContent", { label: `x" onload="alert(1)` });
  assert.doesNotMatch(injected, /onload="alert\(1\)/, "label escaped into markup as a live attribute");
  assert.ok(injected.includes("&quot;"), "quotes in a label must be entity-encoded");
});

test("site-adsense.js is reachable by a browser, not shadowed by a blocked rule", () => {
  // /libs/* is answered by functions/libs/[[path]].js and deliberately 404s,
  // which is why this module must live at the repo root and be loaded as
  // /site-adsense.js. Pin both halves so the path cannot be quietly broken.
  const redirects = read("_redirects");
  assert.match(
    redirects,
    /^\/libs\/\*\s+\/__blocked__/m,
    "the /libs/* block is gone; re-check whether site-adsense.js could live in libs/ now",
  );
  assert.match(
    read("libs/login-detect.js"),
    /NOTE ON \/libs/,
    "the /libs note that documents this decision is missing",
  );

  for (const line of redirects.split("\n")) {
    const rule = line.trim();
    if (!rule.startsWith("/")) continue;
    assert.doesNotMatch(rule, /site-adsense/, `_redirects would shadow the module from browsers: ${rule}`);
  }
});
