// scripts/build-selectors-bundle.mjs — regenerate config/selectors.bundled.json
//
// WHY THIS EXISTS
// selectors.bundled.json is the extension's always-available fallback copy of
// the selector dictionary. It must never drift from config/selectors.js, and it
// used to be maintained by hand — which meant adding a shop broke the test and
// nobody knew how to fix it. This script is the one way to produce it, so
// regeneration is a single command:
//
//     node apps/extension/scripts/build-selectors-bundle.mjs
//
// Run it after ANY change to SHOPS / ALIASES / SESSION_ONLY_SHOPS, then:
//     node --test apps/extension/__tests__/*.mjs
//
// It is a pure derivation: it reads selectors.js and writes JSON. It never
// invents a selector, never drops a field, and it fails loudly if the source
// module cannot be imported.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(HERE, "..", "config");
const SRC = path.join(CONFIG_DIR, "selectors.js");
const OUT = path.join(CONFIG_DIR, "selectors.bundled.json");

const src = await import(pathToFileURL(SRC).href);
const { SHOPS, ALIASES, SESSION_ONLY_SHOPS } = src;

// Same schema constant the validator enforces — one source of truth.
const selectorSource = await import(pathToFileURL(path.join(CONFIG_DIR, "selector-source.js")).href);
const SCHEMA = selectorSource.SCHEMA;

if (!SHOPS || typeof SHOPS !== "object") {
  console.error("FATAL: selectors.js did not export SHOPS");
  process.exit(1);
}
if (!SESSION_ONLY_SHOPS || typeof SESSION_ONLY_SHOPS !== "object") {
  console.error("FATAL: selectors.js did not export SESSION_ONLY_SHOPS");
  process.exit(1);
}

// Every shop that can be POSTED must ship an adapter, or the queue would fill a
// form and have no code to hand it to. This is the real safety check.
const ADAPTER_DIR = path.join(HERE, "..", "adapters");
for (const key of Object.keys(SHOPS)) {
  const adapter = path.join(ADAPTER_DIR, `${key}.js`);
  if (!fs.existsSync(adapter)) {
    console.error(`FATAL: SHOPS.${key} has no adapters/${key}.js — add the adapter or drop the shop`);
    process.exit(1);
  }
}

// Every shop must be reachable: a createUrl to open and a submit control to
// find. A shop missing either would stall the queue with no way forward.
for (const [key, shop] of Object.entries(SHOPS)) {
  if (!shop.createUrl) {
    console.error(`FATAL: SHOPS.${key} is missing createUrl`);
    process.exit(1);
  }
  if (!shop.buttons || !Array.isArray(shop.buttons.submit) || shop.buttons.submit.length === 0) {
    console.error(`FATAL: SHOPS.${key} is missing buttons.submit selectors`);
    process.exit(1);
  }
  if (!shop.fields || !Array.isArray(shop.fields.photos)) {
    console.error(`FATAL: SHOPS.${key} is missing fields.photos selectors`);
    process.exit(1);
  }
}

const bundle = {
  schema: SCHEMA,
  version: 1,
  generatedAt: new Date().toISOString(),
  shops: SHOPS,
  aliases: ALIASES || {},
  // Empty is CORRECT once every shop has an adapter (eBay/Etsy moved into
  // SHOPS). Kept as a key so the document shape stays stable for old clients.
  sessionOnly: SESSION_ONLY_SHOPS
};

fs.writeFileSync(OUT, JSON.stringify(bundle, null, 2) + "\n");

const shops = Object.keys(bundle.shops);
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
console.log(`  schema=${bundle.schema} version=${bundle.version}`);
console.log(`  shops (${shops.length}): ${shops.join(", ")}`);
console.log(`  aliases: ${Object.keys(bundle.aliases).length}`);
console.log(`  sessionOnly: ${Object.keys(bundle.sessionOnly).length}`);
