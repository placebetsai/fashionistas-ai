// apps/extension/scripts/build-login-detect.mjs
//
// Generates apps/extension/content/login-detect.js from the canonical
// libs/login-detect.js, because content scripts are CLASSIC scripts (no
// `export`), while the source is an ES module.
//
//     node apps/extension/scripts/build-login-detect.mjs          # write
//     node apps/extension/scripts/build-login-detect.mjs --check  # verify only
//
// The extension must never grow a second hand-written copy of this logic: two
// implementations of "am I logged in?" would drift, and the drift would only
// ever show up as a badge that disagrees with reality. --check exits non-zero
// when the shipped copy no longer matches the source, and the test suite runs
// it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// HERE = <repo>/apps/extension/scripts
const EXT_ROOT = path.join(HERE, ".."); // <repo>/apps/extension
const REPO_ROOT = path.join(HERE, "..", "..", ".."); // <repo>
const SRC = path.join(REPO_ROOT, "libs", "login-detect.js");
const OUT = path.join(EXT_ROOT, "content", "login-detect.js");

const HEADER = `// !!! GENERATED FILE - DO NOT EDIT !!!
// Source of truth: libs/login-detect.js
// Regenerate: node apps/extension/scripts/build-login-detect.mjs
//
// Generated because content scripts are classic scripts and cannot use
// \`export\`. Editing this file directly will fail the login-detect test.

`;

/** ES module source -> classic script body. */
function toClassic(source) {
  if (!/export function detectLogin/.test(source)) {
    throw new Error("libs/login-detect.js does not export detectLogin — refusing to generate");
  }
  let body = source
    // `export function x(` -> `function x(`
    .replace(/^export\s+(?=function|const|let|class)/gm, "")
    // `export default {...};` -> nothing; we expose the API explicitly below
    .replace(/^export\s+default\s+[^;]+;\s*$/gm, "");

  if (/\bexport\b/.test(body)) {
    const leftover = body.match(/^.*\bexport\b.*$/m);
    throw new Error(`unhandled export left in output: ${leftover ? leftover[0].trim() : "?"}`);
  }

  body += `
globalThis.__fashLoginDetect = Object.freeze({
  REASONS,
  normalizePath,
  isSignInPath,
  hasNotFoundText,
  detectLogin
});
`;
  return body;
}

const source = fs.readFileSync(SRC, "utf8");
const generated = HEADER + toClassic(source);

const check = process.argv.includes("--check");

if (check) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== generated) {
    console.error("STALE: apps/extension/content/login-detect.js does not match libs/login-detect.js");
    console.error("       run: node apps/extension/scripts/build-login-detect.mjs");
    process.exit(1);
  }
  console.log("login-detect: shipped copy matches libs/login-detect.js");
} else {
  fs.writeFileSync(OUT, generated);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${generated.length} bytes)`);
}
