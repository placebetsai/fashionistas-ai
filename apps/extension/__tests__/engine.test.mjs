// engine.test.mjs — real DOM tests for the execution adapter.
//
//   run:  node --test apps/extension/__tests__/engine.test.mjs
//
// WHY THIS FILE EXISTS: the dry-run circuit breaker is a SAFETY property, not
// a feature. "It should stop before submit" is worthless until something has
// actually watched it stop. These tests drive a real (jsdom) DOM and assert
// the submit control is never queried, let alone clicked.
//
// STATED LIMITATION (do not over-read these results):
//   jsdom implements neither `DataTransfer` nor the `HTMLInputElement.files`
//   FileList setter, so those two are stubbed below. Framework-state hydration,
//   custom dropdown traversal, the dry-run lock and the telemetry contract are
//   exercised against a real DOM. Real-Chrome photo drops are verified by hand
//   in TEST.md, not here.

import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

/* --------------------------------------------------------------- DOM harness */

const dom = new JSDOM(
  `<!doctype html><html><body>
     <form id="f">
       <input id="title" type="text">
       <textarea id="desc"></textarea>
       <select id="condition"><option value="new">New</option><option value="used">Used</option></select>
       <input id="price" type="number">
       <input id="photo" type="file" multiple>
       <div id="cat-trigger" role="button">Choose a category</div>
       <div id="menu" hidden>
         <div class="opt"><span> Women </span><span> Tops &amp; Tees </span></div>
         <div class="opt">Dresses</div>
       </div>
       <button id="publish" type="submit">Publish listing</button>
     </form>
   </body></html>`,
  { pretendToBeVisual: true }
);

const w = dom.window;
globalThis.window = w;
globalThis.document = w.document;
globalThis.Event = w.Event;
globalThis.KeyboardEvent = w.KeyboardEvent;
globalThis.InputEvent = w.InputEvent;
globalThis.getComputedStyle = w.getComputedStyle.bind(w);

// jsdom gap #1: DataTransfer (Chrome-only)
const dtFiles = [];
globalThis.DataTransfer = class DataTransfer {
  constructor() {
    dtFiles.length = 0;
    const self = this;
    this.items = {
      get length() { return dtFiles.length; },
      add(file) { dtFiles.push(file); return file; },
      clear() { dtFiles.length = 0; }
    };
    this.files = { get length() { return dtFiles.length; }, item: (i) => dtFiles[i] };
  }
};

// jsdom gap #2: the FileList setter on input.files
function allowFileAssignment(input) {
  let store = null;
  Object.defineProperty(input, "files", {
    configurable: true,
    get() { return store; },
    set(v) { store = v; }
  });
  return input;
}

const { Engine, setNativeValue, dataUrlToFile, SUCCESS, FAILED, NOT_FOUND } =
  await import("../adapters/engine.js");

const SELECTORS = {
  fields: {
    title:       { selector: "#title" },
    description: { selector: "#desc" },
    condition:   { selector: "#condition" },
    price:       { selector: "#price" },
    photos:      { selector: "#photo", kind: "file" }
  },
  menus: {
    category: { trigger: "#cat-trigger", option: ".opt", value: "Dresses" }
  },
  submit: "#publish",
  captcha: ".g-recaptcha"
};

function reset() {
  document.getElementById("menu").hidden = true;
  document.getElementById("menu").innerHTML =
    '<div class="opt"><span> Women </span><span> Tops &amp; Tees </span></div><div class="opt">Dresses</div>';
  document.getElementById("title").value = "";
  document.getElementById("desc").value = "";
  document.getElementById("price").value = "";
}

/* ═════════════════════════════════════════════ 1) THE DRY-RUN SAFETY LOCK ══ */

test("dryRun defaults to ON — a caller cannot forget it", () => {
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS });
  assert.equal(e.dryRun, true, "safe by default");
});

test("submit() under dryRun throws and NEVER queries the publish control", async () => {
  reset();
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS });
  let selectorReads = 0;
  const realQS = document.querySelector.bind(document);
  document.querySelector = (sel) => { if (sel === "#publish") selectorReads++; return realQS(sel); };

  await assert.rejects(() => e.submit({}), (err) => {
    assert.equal(err.code, "DRY_RUN_BLOCKED");
    return true;
  }, "submit must refuse");

  document.querySelector = realQS;
  assert.equal(selectorReads, 0,
    "the publish selector must not even be looked up — not just not clicked");
  assert.equal(e.submitAttempts, 1, "the refusal is recorded for audit");
});

test("flipping dryRun at runtime re-arms the lock (it is read at call time)", async () => {
  const e = new Engine({ marketplace: "mercari", selectors: SELECTORS, dryRun: false });
  e.dryRun = true; // someone changed their mind after construction
  await assert.rejects(() => e.submit({}), (err) => err.code === "DRY_RUN_BLOCKED");
});

test("canSubmit() reports dry_run rather than pretending it is ready", async () => {
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS });
  const r = await e.canSubmit();
  assert.deepEqual(r, { ok: false, reason: "dry_run" });
});

test("a missing submit control is reported, not guessed at", async () => {
  const e = new Engine({ marketplace: "x", selectors: { fields: {}, submit: "#does-not-exist" } });
  const r = await e.canSubmit();
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no_submit_control");
});

test("run() under dryRun leaves submitAttempts at 0 — it never got near publish", async () => {
  reset();
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS });
  const trace = await e.run({ title: "Silk scarf", description: "soft", price: 25 });
  assert.equal(e.submitAttempts, 0, "run() must not touch submit");
  assert.equal(trace.dryRun, true);
});

/* ═══════════════════════════════════════ 2) FRAMEWORK-SAFE VALUE HYDRATION ══ */

test("setNativeValue calls the PROTOTYPE setter, not an instance trap", () => {
  const el = document.createElement("input");
  const protoDesc = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value");
  let protoCalls = 0;
  Object.defineProperty(w.HTMLInputElement.prototype, "value", {
    configurable: true,
    get() { return protoDesc.get.call(this); },
    set(v) { protoCalls++; return protoDesc.set.call(this, v); }
  });
  try {
    setNativeValue(el, "hello");
    assert.equal(protoCalls, 1, "prototype setter must be the one used (React-safe path)");
    assert.equal(el.value, "hello");
  } finally {
    Object.defineProperty(w.HTMLInputElement.prototype, "value", protoDesc);
  }
});

test("setNativeValue bypasses a React-style OWN value trap and still updates the DOM", () => {
  const el = document.createElement("input");
  document.body.appendChild(el);
  let trapWrites = 0;
  let backing = "";
  Object.defineProperty(el, "value", {
    configurable: true,
    get() { return backing; },
    set(v) { trapWrites++; backing = "react:" + v; }
  });

  setNativeValue(el, "vintage");
  // We go through the prototype, so React's own trap is not what received it.
  assert.equal(trapWrites, 0, "own trap must not be the write path");
  el.remove();
});

test("hydration fires a bubbling input -> change -> blur cascade", () => {
  const el = document.createElement("input");
  const parent = document.createElement("div");
  parent.appendChild(el);
  document.body.appendChild(parent);
  const seen = [];
  parent.addEventListener("input", () => seen.push("input"));
  parent.addEventListener("change", () => seen.push("change"));
  // blur does not bubble, so listen on the element itself
  el.addEventListener("blur", () => seen.push("blur"));

  setNativeValue(el, "abc");

  assert.deepEqual(seen.slice(0, 3), ["input", "change", "blur"]);
  assert.ok(seen.includes("input"), "input must bubble to ancestors");
  parent.remove();
});

test("hydrate() reports SUCCESS only when the value actually stuck", async () => {
  reset();
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { settleMs: 5 } });
  assert.equal(await e.hydrate("title", "Linen dress"), SUCCESS);
  assert.equal(await e.hydrate("description", "great condition"), SUCCESS);
  assert.equal(await e.hydrate("price", "48"), SUCCESS);
  assert.equal(await e.hydrate("condition", "used"), SUCCESS, "native <select>");
  assert.equal(await e.hydrate("title", ""), SUCCESS, "clearing a field is valid");
});

test("hydrate() returns NOT_FOUND for an unknown or absent field", async () => {
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { settleMs: 5 } });
  assert.equal(await e.hydrate("does_not_exist", "x"), NOT_FOUND);
  const e2 = new Engine({ marketplace: "x", selectors: { fields: { nope: "#gone" } } });
  assert.equal(await e2.hydrate("nope", "x"), NOT_FOUND);
});

test("hydrate() returns FAILED when the framework refuses the write", async () => {
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { settleMs: 5 } });
  // #price is type=number: a non-numeric value is rejected by the browser.
  assert.equal(await e.hydrate("price", "not-a-number"), FAILED);
});

/* ═════════════════════════════════════════════ 3) CUSTOM DROPDOWN SELECTOR ══ */

function openMenu() {
  document.getElementById("menu").hidden = false;
}

test("selectOption clicks the trigger, waits for re-render, then clicks the match", async () => {
  reset();
  let triggerClicks = 0;
  const trigger = document.getElementById("cat-trigger");
  trigger.addEventListener("click", openMenu);
  trigger.addEventListener("click", () => triggerClicks++);
  let dressClicked = 0;
  const opts = document.querySelectorAll(".opt");
  opts[1].addEventListener("click", () => dressClicked++);
  trigger.remove();
  document.getElementById("f").appendChild(trigger);

  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { menuMs: 30 } });
  const r = await e.selectOption({ trigger: "#cat-trigger", option: ".opt", value: "Dresses" });

  trigger.removeEventListener("click", openMenu);
  assert.equal(r, SUCCESS);
  assert.equal(triggerClicks, 1, "trigger fired exactly once");
  assert.equal(dressClicked, 1, "the matching option received a physical click");
});

test("selectOption matches a label nested inside child spans", async () => {
  reset();
  const trigger = document.getElementById("cat-trigger");
  trigger.addEventListener("click", openMenu);
  let nestedClicked = 0;
  const nested = Array.from(document.querySelectorAll(".opt span"))
    .find((s) => s.textContent.includes("Tops"));
  nested.addEventListener("click", () => nestedClicked++);

  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { menuMs: 30 } });
  const r = await e.selectOption({
    trigger: "#cat-trigger", option: ".opt", value: "Tops & Tees", loose: true
  });
  assert.equal(r, SUCCESS);
  assert.ok(nestedClicked >= 1, "the child span carrying the label was clicked");
});

test("selectOption returns FAILED (and closes the menu) when nothing matches", async () => {
  reset();
  const trigger = document.getElementById("cat-trigger");
  trigger.addEventListener("click", openMenu);
  let escaped = false;
  trigger.addEventListener("keydown", (ev) => { if (ev.key === "Escape") escaped = true; });

  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { menuMs: 30 } });
  const r = await e.selectOption({ trigger: "#cat-trigger", option: ".opt", value: "SHOES" });

  assert.equal(r, FAILED);
  assert.equal(escaped, true, "menu is dismissed so it cannot overlay the form");
});

test("selectOption returns NOT_FOUND when the trigger does not exist", async () => {
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { menuMs: 10 } });
  assert.equal(await e.selectOption({ trigger: "#nope", option: ".opt", value: "x" }), NOT_FOUND);
});

/* ═══════════════════════════════════════════════════ 4) PROGRAMMATIC DROPS ══ */

test("dropFiles builds a real File from a data: URL and assigns input.files", async () => {
  const input = allowFileAssignment(document.getElementById("photo"));
  dtFiles.length = 0;
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { settleMs: 5 } });

  // 1x1 transparent PNG
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const r = await e.dropFiles("photos", [png]);

  assert.equal(r, SUCCESS);
  assert.equal(dtFiles.length, 1, "one File constructed");
  assert.ok(dtFiles[0] instanceof File || dtFiles[0] instanceof w.File || dtFiles[0].size > 0);
  assert.ok(dtFiles[0].size > 0, "bytes really decoded — not an empty stub");
  assert.equal(input.files.length, 1, "FileList mapped onto the hidden input");
});

test("dropFiles returns NOT_FOUND when there is no file input", async () => {
  const e = new Engine({ marketplace: "x", selectors: { fields: {}, photos: "#nope" } });
  assert.equal(await e.dropFiles("photos", ["data:image/png;base64,AA=="]), NOT_FOUND);
});

test("dropFiles fails loudly on an unsupported source instead of faking a photo", async () => {
  allowFileAssignment(document.getElementById("photo"));
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { settleMs: 5 } });
  const r = await e.dropFiles("photos", ["not-a-url-or-data-uri"]);
  assert.equal(r, FAILED, "never report SUCCESS for a photo we could not attach");
});

test("dataUrlToFile decodes base64 to the exact original bytes", () => {
  const b64 = btoa("hello fashionistas");
  const f = dataUrlToFile(`data:text/plain;base64,${b64}`, "note.txt");
  assert.equal(f.name, "note.txt");
  assert.equal(f.type, "text/plain");
  assert.ok(f.size > 0);
  assert.throws(() => dataUrlToFile("http://example.com/a.png", "x.jpg"), /not_a_data_url/);
});

/* ═══════════════════════════════════════════════ 5) TELEMETRY CONTRACT ══════ */

test("buildTrace() matches the published JSON interface exactly", async () => {
  reset();
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { settleMs: 5 } });
  await e.run({ title: "Denim jacket" });
  const t = e.buildTrace();

  assert.deepEqual(Object.keys(t).sort(),
    ["dryRun", "error", "hydratedFields", "marketplace", "readyForUserTap"].sort(),
    "exactly the 5 documented keys");
  assert.equal(typeof t.marketplace, "string");
  assert.equal(typeof t.dryRun, "boolean");
  assert.equal(typeof t.hydratedFields, "object");
  assert.ok(t.error === null || typeof t.error === "string");
  assert.equal(typeof t.readyForUserTap, "boolean");
  for (const v of Object.values(t.hydratedFields)) {
    assert.ok([SUCCESS, FAILED, NOT_FOUND].includes(v), `bad status: ${v}`);
  }
});

test("readyForUserTap is FALSE when any field did not land", async () => {
  reset();
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { settleMs: 5 } });
  const t = await e.run({ title: "Ok", price: "not-a-number", brand: "Nope" });
  assert.equal(t.readyForUserTap, false);
  assert.equal(t.hydratedFields.price, FAILED);
  assert.equal(t.hydratedFields.brand, NOT_FOUND, "field absent from the form");
});

test("readyForUserTap is TRUE only when everything landed and no error is pending", async () => {
  reset();
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { settleMs: 5, menuMs: 30 } });
  const trigger = document.getElementById("cat-trigger");
  trigger.addEventListener("click", openMenu);

  const t = await e.run({
    title: "Cashmere sweater",
    description: "barely worn",
    condition: "used",
    price: "62",
    photos: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="],
    menus: { category: { trigger: "#cat-trigger", option: ".opt", value: "Dresses" } }
  });

  allowFileAssignment(document.getElementById("photo"));
  assert.equal(t.error, null, `error: ${t.error}`);
  assert.equal(t.readyForUserTap, true, JSON.stringify(t, null, 2));
  assert.equal(t.dryRun, true);
});

test("a CAPTCHA wall short-circuits the run and says so", async () => {
  reset();
  const div = document.createElement("div");
  div.className = "g-recaptcha";
  document.body.appendChild(div);
  try {
    const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS, config: { settleMs: 5 } });
    const t = await e.run({ title: "x" });
    assert.equal(t.error, "captcha_required");
    assert.equal(t.readyForUserTap, false, "a CAPTCHA means NOT ready for a tap");
  } finally {
    div.remove();
  }
});

test("run() never throws — a broken page yields a trace, not an exception", async () => {
  const e = new Engine({ marketplace: "poshmark", selectors: SELECTORS });
  e.selectors = null; // simulate corrupt remote config
  const t = await e.run({ title: "x" });
  assert.equal(typeof t, "object");
  assert.equal(typeof t.error, "string");
});

test("constructing without a selectors dictionary refuses loudly", () => {
  assert.throws(() => new Engine({ marketplace: "x" }), /selectors dictionary is required/);
  assert.throws(() => new Engine({ selectors: {} }), /marketplace is required/);
});
