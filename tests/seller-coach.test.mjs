/**
 * Seller coach wiring: libs/seller-coach.js must ship the checklist path,
 * open chat with suggested questions, and be included from index.html.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const coach = readFileSync(join(ROOT, "libs/seller-coach.js"), "utf8");

test("index includes /seller-coach.js (public; libs/ blocked by Pages Functions)", () => {
  assert.match(html, /src="\/seller-coach\.js"/);
  assert.doesNotMatch(html, /src="\/libs\/seller-coach\.js"/);
  assert.match(html, /SellerCoach\.refresh/);
});

test("listing form price/size/brand carry plain-English tips", () => {
  assert.match(html, /id="f-price"[^>]*data-tip="/);
  assert.match(html, /id="f-size"[^>]*data-tip="/);
  assert.match(html, /id="f-brand"[^>]*data-tip="/);
  assert.doesNotMatch(html, /id="f-price"[^>]*data-tip="[^"]*OAuth/i);
  assert.doesNotMatch(coach, /\bOAuth\b|\bsandbox\b/i);
});

test("coach covers seller path steps in plain words", () => {
  for (const label of [
    "Take a photo",
    "Let AI name it",
    "Fill the listing",
    "Open Multilist",
    "Connect the extension",
    "Sell everywhere",
  ]) {
    assert.match(coach, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(coach, /What's next/);
  assert.match(coach, /First sale path/);
  assert.match(coach, /Photo → Identify → Fill → Sell everywhere/);
});

test("coach reuses chatbot via guideToggle / guideSend suggested questions", () => {
  assert.match(coach, /guideToggle/);
  assert.match(coach, /guideSend/);
  assert.match(coach, /How do I list something from a photo\?/);
  assert.match(coach, /How do I install the Chrome extension\?/);
  assert.match(coach, /How does Sell everywhere work\?/);
  assert.match(coach, /How does virtual try-on work\?/);
});

test("coach exposes window.SellerCoach API", () => {
  assert.match(coach, /window\.SellerCoach\s*=/);
  assert.match(coach, /mark:\s*mark/);
  assert.match(coach, /ask:\s*askChat/);
  assert.match(coach, /progress:\s*progress/);
});

test("go() marks photo/multilist without fighting try-on pages", () => {
  assert.match(html, /SellerCoach\.mark\("photo"\)/);
  assert.match(html, /SellerCoach\.mark\("multilist"\)/);
  assert.doesNotMatch(html, /try-on\/index\.html[\s\S]{0,80}SellerCoach/);
});

test("public /seller-coach.js matches libs/seller-coach.js (libs HTTP is blocked)", () => {
  const pub = readFileSync(join(ROOT, "seller-coach.js"), "utf8");
  const lib = readFileSync(join(ROOT, "libs/seller-coach.js"), "utf8");
  assert.equal(pub, lib);
  assert.match(html, /src="\/seller-coach\.js"/);
  assert.doesNotMatch(html, /src="\/libs\/seller-coach\.js"/);
});
