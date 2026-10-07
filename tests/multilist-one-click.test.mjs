/**
 * Multilist one-click wiring: extension path must cover all shops (incl. eBay/
 * Etsy) without requiring Stripe, and queue ADAPTERS must include every shop
 * SHOPS knows about.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const queue = readFileSync(join(ROOT, "apps/extension/queue.js"), "utf8");
const selectors = readFileSync(join(ROOT, "apps/extension/config/selectors.js"), "utf8");
const manifest = JSON.parse(readFileSync(join(ROOT, "apps/extension/manifest.json"), "utf8"));
const doc = readFileSync(join(ROOT, "docs/MULTILIST-ONE-CLICK.md"), "utf8");

function grab(name) {
  let i = html.indexOf("function " + name + "(");
  assert.notEqual(i, -1, `function not found: ${name}`);
  if (html.slice(i - 6, i) === "async ") i -= 6;
  let depth = 0, started = false;
  for (let k = html.indexOf("{", i); k < html.length; k++) {
    const c = html[k];
    if (c === "{") { depth++; started = true; }
    else if (c === "}") {
      depth--;
      if (started && depth === 0) return html.slice(i, k + 1);
    }
  }
  throw new Error("unbalanced braces: " + name);
}

test("queue ADAPTERS includes ebay and etsy (session post, no API keys)", () => {
  assert.match(queue, /import \* as ebay from "\.\/adapters\/ebay\.js"/);
  assert.match(queue, /import \* as etsy from "\.\/adapters\/etsy\.js"/);
  const m = queue.match(/export const ADAPTERS = \{([\s\S]*?)\};/);
  assert.ok(m, "ADAPTERS block");
  for (const shop of ["poshmark", "mercari", "depop", "vinted", "grailed", "facebook", "kidizen", "vestiaire", "whatnot", "ebay", "etsy"]) {
    assert.match(m[1], new RegExp("\\b" + shop + "\\b"), "ADAPTERS missing " + shop);
  }
});

test("selectors SHOPS lists ebay and etsy for heartbeat + createUrl", () => {
  assert.match(selectors, /\bebay:\s*\{/);
  assert.match(selectors, /\betsy:\s*\{/);
  assert.match(selectors, /createUrl:\s*"https:\/\/www\.ebay\.com\/lstng"/);
  assert.match(selectors, /createUrl:\s*"https:\/\/www\.etsy\.com\/your\/shops\/me\/tools\/listings\/create"/);
});

test("handoffSellAll prefers extension for every pick, not only non-API shops", () => {
  const fn = grab("handoffSellAll");
  assert.match(fn, /extAvailable/);
  assert.match(fn, /for \(const shop of picks\)/);
  assert.match(fn, /extPublish/);
  // Must not call handoffApi inside the extension-live branch.
  const extBranch = fn.slice(fn.indexOf("extAvailable"), fn.indexOf("No extension"));
  assert.doesNotMatch(extBranch, /handoffApi/);
  assert.match(fn, /no Stripe|queued to the extension/i);
});

test("site bridge exposes install sheet + durable extSetId path", () => {
  assert.match(html, /function extInstallSheet\(/);
  assert.match(html, /function extSaveIdFromInput\(/);
  assert.match(html, /function extSetId\(/);
  assert.match(html, /FASH_EXT_IDS = \[\]/);
  assert.match(html, /fashionistas-extension-v1\.0\.1\.zip/);
  assert.match(html, /fash-ext-ready/);
});

test("status chips cover queued / posting / posted / failed / capped", () => {
  const fn = grab("handoffLabel");
  for (const s of ["posted", "queued", "posting", "failed", "capped", "awaiting_publish"]) {
    assert.match(fn, new RegExp(s));
  }
  assert.match(grab("extPollStart"), /listing_url/);
  assert.match(grab("handoffChip"), /handoff-url/);
});

test("manifest announces on fashionistas.ai and is externally_connectable", () => {
  assert.deepEqual(manifest.externally_connectable.matches, [
    "https://fashionistas.ai/*",
    "https://www.fashionistas.ai/*",
  ]);
  const announce = manifest.content_scripts.find((c) =>
    (c.js || []).includes("content/announce.js")
  );
  assert.ok(announce, "announce.js content script");
  assert.ok(announce.matches.includes("https://fashionistas.ai/*"));
});

test("MULTILIST-ONE-CLICK doc covers zero → one click and gaps", () => {
  assert.match(doc, /Load unpacked/);
  assert.match(doc, /FASH_EXT_IDS/);
  assert.match(doc, /Stripe/);
  assert.match(doc, /Human Chrome/i);
  assert.match(doc, /Sell everywhere/);
});
