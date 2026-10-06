/**
 * Proves the browser half of the no-person guard on try-on/index.html by
 * executing the ACTUAL function extracted from the page.
 *
 * Why: a photo with no human in it used to be sent to the GPU anyway, which
 * returned the input resized with no garment applied - a paid, useless render
 * (reproduced with a dog photo). The page must now stop that before any
 * upload, and the server re-checks, so a page-side failure to load MediaPipe
 * must fall through to the server rather than silently allow everything.
 *
 * Offline: no network, no DOM. The MediaPipe import is never executed because
 * the pose cache is pre-filled.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "try-on", "index.html"), "utf8");

/** Pull a function declaration out of the page. */
function grab(name, source = html) {
  const i = source.indexOf("function " + name + "(");
  assert.notEqual(i, -1, `function not found in try-on/index.html: ${name}`);
  let depth = 0, started = false;
  for (let k = source.indexOf("{", i); k < source.length; k++) {
    const c = source[k];
    if (c === "{") { depth++; started = true; }
    else if (c === "}") {
      depth--;
      if (started && depth === 0) return source.slice(i, k + 1);
    }
  }
  throw new Error(`unbalanced braces for ${name}`);
}

/** Landmarks helper: 33 MediaPipe points, all confidently visible. */
function fullPose(overrides = {}) {
  const pts = Array.from({ length: 33 }, (_, i) => ({
    x: 0.5, y: 0.5, z: 0, visibility: i < 10 ? 0.9 : 0.7, ...overrides,
  }));
  pts[0].visibility = 0.95;  // nose
  pts[23].visibility = 0.9;  // left hip
  pts[24].visibility = 0.9;  // right hip
  return pts;
}

/** Build personInPhoto() with a supplied landmarker behaviour. */
function buildPersonInPhoto(landmarker, bitmapFactory) {
  const src = grab("personInPhoto") + "\n" + grab("loadPose");
  const factory = new Function(
    "posePromise", "createImageBitmap", "POSE_PKG", "POSE_MODEL",
    `${src}\nreturn personInPhoto;`,
  );
  // Pre-filled cache means loadPose() returns the stub and never runs import().
  // It has to be a Promise: in the page posePromise is always one.
  return factory(Promise.resolve({ detect: landmarker }), bitmapFactory, "", "", "");
}

const FILE = { name: "x.jpg" };
const bitmap = { close() {} };
const okBitmap = async () => bitmap;

test("a photo with no pose at all is refused", async () => {
  const personInPhoto = buildPersonInPhoto(() => ({ landmarks: [] }), okBitmap);
  assert.equal(await personInPhoto(FILE), false, "empty landmark set must be refused");
});

test("a fully visible person is allowed through", async () => {
  const personInPhoto = buildPersonInPhoto(() => ({ landmarks: [fullPose()] }), okBitmap);
  assert.equal(await personInPhoto(FILE), true, "a clear person must be allowed");
});

test("too few visible landmarks is refused (head-to-knees rule)", async () => {
  const personInPhoto = buildPersonInPhoto(
    () => ({ landmarks: [Array.from({ length: 33 }, () => ({ visibility: 0.1 }))] }),
    okBitmap,
  );
  assert.equal(await personInPhoto(FILE), false, "a blurry pose must be refused");
});

test("a pose without hips is refused - not head to knees", async () => {
  const pts = fullPose();
  pts[23].visibility = 0.1;
  pts[24].visibility = 0.1;
  const personInPhoto = buildPersonInPhoto(() => ({ landmarks: [pts] }), okBitmap);
  assert.equal(await personInPhoto(FILE), false, "legs cut off above the hips must be refused");
});

test("if the detector throws, the request falls through to the server check", async () => {
  const personInPhoto = buildPersonInPhoto(() => { throw new Error("wasm died"); }, okBitmap);
  assert.equal(
    await personInPhoto(FILE), true,
    "a page-side failure must not hard-block users; the server re-checks",
  );
});

test("if the bitmap cannot be decoded, the request falls through too", async () => {
  const personInPhoto = buildPersonInPhoto(
    () => { throw new Error("should not run"); },
    () => Promise.reject(new Error("no createImageBitmap")),
  );
  assert.equal(await personInPhoto(FILE), true, "decode failure must fall through to the server");
});

test("the guard runs before runHd() and uses the shared friendly message", () => {
  assert.match(html, /personInPhoto\(files\.person\)/, "run() must call the guard");
  assert.ok(
    html.indexOf("personInPhoto(files.person)") < html.indexOf("return runHd();"),
    "guard must be awaited before runHd()",
  );
  assert.match(html, /throw new Error\(NO_PERSON_MSG\)/, "rejection must use NO_PERSON_MSG");
  assert.match(
    html,
    /var NO_PERSON_MSG = "Upload a photo of yourself, head to knees";/,
    "message must match the server's wording",
  );
  assert.match(html, /@mediapipe\/tasks-vision@/, "MediaPipe must be pinned, not floating");
  assert.ok(!/@mediapipe\/tasks-vision@latest/.test(html), "a floating tag can break the page");
});

test("the page's module script parses", () => {
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(m, "try-on/index.html must have a module script");
  const tmp = join(ROOT, "try-on", ".guard-syntax-check.mjs");
  try {
    writeFileSync(tmp, m[1]);
    execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
  } finally {
    try { unlinkSync(tmp); } catch { /* already gone */ }
  }
});
