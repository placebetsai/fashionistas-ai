/**
 * The published legal pages, pinned to the state the owner asked for on
 * 2026-10-12: real, dated terms and privacy pages at /terms/ and /privacy/,
 * the unsigned /legal/* drafts still blocked, and no placeholder marker left
 * anywhere a browser can fetch.
 *
 * Why this file exists. The site once served legal/terms.html and
 * legal/privacy.html at 200 from stable URLs while their own text said "Do
 * not publish this page" and carried [COUNSEL: GOVERNING LAW PLACEHOLDER]
 * clauses. A blocked draft is not a policy: the site then had NO terms at
 * all, which is its own launch blocker. Both halves of the fix are asserted
 * here so neither can drift back:
 *   1. /terms/ and /privacy/ exist, are dated, link each other, and contain
 *      none of the markers that made the drafts unpublishable.
 *   2. Every /legal/* path still 404s, and robots.txt still disallows it.
 *
 * The pages are read from disk because Cloudflare Pages serves the repo root
 * as the output dir — the file on disk IS the URL.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

// Markers that made the old drafts unpublishable. "placeholder=" (an HTML
// attribute) is deliberately NOT matched; see connect/index.html:87.
const FORBIDDEN = [/\[PLACEHOLDER\]/i, /\[COUNSEL/i, /do not publish/i];

async function page(path) {
  return readFile(new URL(path, root), "utf8");
}

test("/terms/ is published, dated and free of draft markers", async () => {
  const html = await page("terms/index.html");
  assert.match(html, /Effective October 12, 2026/, "terms must carry an Effective date");
  assert.match(html, /<h1>Terms of Use<\/h1>/, "terms must be a real page, not a stub");
  assert.doesNotMatch(html, /<meta name="robots" content="noindex/i, "published terms must be indexable");
  for (const re of FORBIDDEN) {
    assert.doesNotMatch(html, re, `terms must not contain ${re}`);
  }
});

test("/privacy/ is published, dated and free of draft markers", async () => {
  const html = await page("privacy/index.html");
  assert.match(html, /Effective October 12, 2026/, "privacy must carry an Effective date");
  assert.doesNotMatch(html, /<meta name="robots" content="noindex/i, "the privacy page is indexed");
  for (const re of FORBIDDEN) {
    assert.doesNotMatch(html, re, `privacy must not contain ${re}`);
  }
});

test("the privacy policy discloses the AdSense third-party vendor, cookies and opt-outs", async () => {
  // Google requires a published privacy policy for AdSense sites that names
  // the third-party vendor, the cookies (incl. DART) and how to opt out.
  const html = await page("privacy/index.html");
  assert.match(html, /ca-pub-7215975042937417|AdSense/i, "AdSense must be disclosed");
  assert.match(html, /DART cookie/i, "the DART cookie must be named");
  assert.match(html, /https:\/\/www\.google\.com\/settings\/ads/, "Google Ads Settings opt-out link");
  assert.match(html, /https:\/\/www\.doubleclick\.com\/dev_resources/, "DoubleClick opt-out link");
});

test("terms and privacy link each other, and the footer links both", async () => {
  const terms = await page("terms/index.html");
  const privacy = await page("privacy/index.html");
  assert.match(terms, /href="\/privacy\/"/, "terms must link the privacy policy");
  assert.match(privacy, /href="\/terms\/"/, "privacy must link the terms");
  const home = await page("index.html");
  assert.match(home, /href="\/terms\/"/, "the home footer must link the terms");
});

test("no page outside /legal/ carries a draft marker", async () => {
  const { readdir } = await import("node:fs/promises");
  const dirs = [".", "about", "contact", "pricing", "guide", "try-on", "see-in-space", "terms", "privacy"];
  for (const dir of dirs) {
    let files = [];
    try {
      files = await readdir(new URL(dir + "/", root));
    } catch {
      continue;
    }
    for (const f of files.filter((n) => n.endsWith(".html"))) {
      const html = await page((dir === "." ? "" : dir + "/") + f);
      for (const re of FORBIDDEN) {
        assert.doesNotMatch(html, re, `${dir}/${f} must not contain ${re}`);
      }
    }
  }
});

test("the extension's reviewer doc cites the published pages, not the dead drafts", async () => {
  const md = await page("chrome-store/PRIVACY.md");
  assert.doesNotMatch(md, /fashionistas\.ai\/legal\//, "PRIVACY.md must not point reviewers at 404 URLs");
  assert.match(md, /https:\/\/fashionistas\.ai\/terms\//, "PRIVACY.md must cite the published terms");
  assert.match(md, /https:\/\/fashionistas\.ai\/privacy\//, "PRIVACY.md must cite the published privacy policy");
});

test("robots.txt still disallows /legal/ — the old draft URLs stay unindexed", async () => {
  const robots = await page("robots.txt");
  assert.match(robots, /Disallow: \/legal\//);
});

test("every /legal/* path still 404s", async () => {
  // Same import trick as tests/security-gates.test.mjs: the filename contains
  // literal brackets, which are legal on disk but not in a static specifier.
  const { onRequest } = await import(
    new URL("../functions/legal/" + "[[path]].js", import.meta.url).href
  );
  for (const path of ["/legal/terms", "/legal/privacy", "/legal/risk"]) {
    const res = await onRequest({
      request: new Request("https://fashionistas.ai" + path),
      env: {},
      params: {},
    });
    assert.equal(res.status, 404, `${path} must stay blocked`);
  }
});
