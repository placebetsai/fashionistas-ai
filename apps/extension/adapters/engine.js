// adapters/engine.js — the one execution adapter every marketplace shares.
//
// WHY THIS FILE HAS ZERO chrome.* REFERENCES
//   The extension injects it, and so can anything else: a mobile WebView,
//   a test harness, a bookmarklet. It is a plain ES module that operates on
//   `document` only. Sharing it is what keeps 9 (and later 11) marketplace
//   integrations from becoming 9 divergent copies.
//
// WHAT IT SOLVES
//   Modern listing forms are React/Vue/Svelte apps. Three things fail with
//   naive automation:
//     1. `el.value = "x"` updates the DOM but not framework state, so the
//        form stays "empty" and validation blocks the next step.
//     2. File inputs are hidden; the UI only updates from a real drag/drop
//        or a synthetic DataTransfer onto the input.
//     3. Category/Size/Brand menus are not <select> — they are divs, so
//        setAttribute/value do nothing; you must click real nodes.
//
// SAFETY (the point of this file)
//   `dryRun: true` runs 1,2,3 in full and then HARD STOPS before any
//   submit/publish control. It cannot be bypassed by a caller forgetting a
//   flag: submit controls are only reachable through #assertCanSubmit(),
//   which re-reads this.dryRun at call time and throws.

const DEFAULT_SETTLE_MS = 320;   // let the framework commit state + re-render
const DEFAULT_MENU_MS = 260;     // custom menus mount after this
const DEFAULT_MENU_SCAN = 40;    // max nodes inspected per menu open
const HYDRATION_PASSES = 3;      // re-read to confirm the value really stuck

export const NOT_FOUND = "NOT_FOUND";
export const SUCCESS = "SUCCESS";
export const FAILED = "FAILED";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ helpers */

function log(...args) {
  try {
    // never let telemetry kill a run
    console.debug("[fash:engine]", ...args);
  } catch (e) {}
}

function textOf(el) {
  if (!el) return "";
  const raw = (el.innerText != null ? el.innerText : el.textContent) || "";
  return String(raw).replace(/\s+/g, " ").trim();
}

/**
 * Native value setter + the event burst that makes framework state accept it.
 *
 * We deliberately take the setter off the PROTOTYPE rather than the instance:
 * React defines an own `value` descriptor on the node, and using the instance
 * setter would just write back through React's own trap. The prototype setter
 * is the one the framework itself uses to update the underlying DOM.
 */
export function setNativeValue(el, value) {
  if (!el) return false;
  const tag = String(el.tagName || "").toLowerCase();
  const proto =
    tag === "textarea"
      ? window.HTMLTextAreaElement.prototype
      : tag === "select"
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;

  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  const next = value == null ? "" : String(value);

  if (desc && typeof desc.set === "function") {
    desc.set.call(el, next);
  } else {
    el.value = next;
  }

  // Cascade: input drives controlled components, change commits, blur settles
  // validators that only evaluate on leave-focus. Exactly one of each, in that
  // order — dispatching `input` twice makes some frameworks count it as two
  // keystrokes and re-run their own diffing for no reason.
  const InputEventCtor = window.InputEvent || Event;
  el.dispatchEvent(new InputEventCtor("input", {
    bubbles: true, composed: true, data: next, inputType: "insertText"
  }));
  el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  el.dispatchEvent(new Event("blur", { bubbles: false, composed: true }));
  return true;
}

/** base64 / data: URL -> File. Pure browser, no network, no node Buffer. */
export function dataUrlToFile(dataUrl, filename) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(dataUrl));
  if (!m) throw new Error("not_a_data_url");
  const mime = m[1] || "application/octet-stream";
  const isB64 = !!m[2];
  const payload = m[3];
  let bytes;
  if (isB64) {
    const bin = atob(payload);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new TextEncoder().decode(decodeURIComponent(payload));
  }
  return new File([bytes], filename, { type: mime });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error || new Error("file_read_failed"));
    fr.readAsDataURL(blob);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Engine
   ═════════════════════════════════════════════════════════════════════════ */

export class Engine {
  /**
   * @param {object}   opts
   * @param {string}   opts.marketplace   e.g. "poshmark"
   * @param {object}   opts.selectors     selector dictionary (fields/menus/submit).
   *                                       Kept as DATA so Cloudflare KV can
   *                                       override it when a platform ships a
   *                                       redesign — no extension release.
   * @param {boolean}  [opts.dryRun=true] hard circuit breaker
   * @param {object}   [opts.config]      {settleMs, menuMs, menuScan, passes}
   */
  constructor({ marketplace, selectors, dryRun = true, config = {} } = {}) {
    if (!marketplace) throw new Error("marketplace is required");
    if (!selectors || typeof selectors !== "object") {
      throw new Error("selectors dictionary is required");
    }
    this.marketplace = String(marketplace);
    this.selectors = selectors;
    this.dryRun = dryRun !== false; // default SAFE
    this.config = {
      settleMs: config.settleMs ?? DEFAULT_SETTLE_MS,
      menuMs: config.menuMs ?? DEFAULT_MENU_MS,
      menuScan: config.menuScan ?? DEFAULT_MENU_SCAN,
      passes: config.passes ?? HYDRATION_PASSES
    };
    this.trace = {};
    this.error = null;
    this.submitAttempts = 0; // audit: must stay 0 during dryRun
  }

  /* ------------------------------------------------------------- resolving */

  /** Try each candidate selector in order; first visible hit wins. */
  query(candidates, root = document) {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    for (const sel of list) {
      if (!sel) continue;
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch (e) {
        log("bad selector", sel, e.message);
      }
    }
    return null;
  }

  queryAll(candidates, root = document) {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    for (const sel of list) {
      if (!sel) continue;
      try {
        const hits = root.querySelectorAll(sel);
        if (hits && hits.length) return Array.from(hits);
      } catch (e) {
        log("bad selector", sel, e.message);
      }
    }
    return [];
  }

  /**
   * Visibility by CSS state, deliberately NOT by layout geometry.
   *
   * getBoundingClientRect() reports 0x0 for anything not yet laid out (and for
   * every element under jsdom), which would make us reject a control that is
   * plainly on screen. CSS state is the reliable, layout-independent signal
   * for "is this menu/control actually presented".
   */
  isVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    if (el.disabled) return false;
    if (el.type === "hidden") return false;
    const st = window.getComputedStyle(el);
    if (st.display === "none") return false;
    if (st.visibility === "hidden" || st.visibility === "collapse") return false;
    if (st.opacity === "0") return false;
    return true;
  }

  /* --------------------------------------------------- 1) text hydration */

  /**
   * Hydrate one field and CONFIRM it stuck by re-reading it.
   * Frameworks silently reject writes, so an unverified set is a lie.
   *
   * @returns {"SUCCESS"|"FAILED"|"NOT_FOUND"}
   */
  async hydrate(field, value) {
    const spec = (this.selectors.fields || {})[field];
    if (!spec) return NOT_FOUND;

    const el = this.query(spec.selector || spec);
    if (!el) return NOT_FOUND;

    const tag = String(el.tagName || "").toLowerCase();
    try {
      if (tag === "select") {
        const ok = this.#setSelect(el, value);
        if (!ok) return FAILED;
      } else if (el.isContentEditable) {
        el.textContent = String(value);
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: String(value) }));
      } else {
        // autocomplete/combobox fields need the suggestion clicked, not just typed
        if (spec.suggestions && value) {
          const picked = await this.#pickSuggestion(spec, value);
          if (picked) return this.#verify(el, value);
        }
        setNativeValue(el, value);
      }

      await sleep(this.config.settleMs);
      return this.#verify(el, value);
    } catch (e) {
      log("hydrate failed", field, e.message);
      return FAILED;
    }
  }

  #verify(el, expected) {
    const want = String(expected == null ? "" : expected).trim();
    const got = String(el.value != null ? el.value : textOf(el)).trim();
    if (!want) return SUCCESS; // clearing a field: nothing to compare
    // combo boxes often keep a label in .value and the id in a data-attr
    if (got === want) return SUCCESS;
    if (got.length && want.toLowerCase().includes(got.toLowerCase())) return SUCCESS;
    const aria = (el.getAttribute("aria-valuetext") || el.dataset.value || "").trim();
    if (aria && (aria === want || want.toLowerCase().includes(aria.toLowerCase()))) return SUCCESS;
    return FAILED;
  }

  #setSelect(el, value) {
    const want = String(value).toLowerCase();
    const opt = Array.from(el.options || []).find(
      (o) => (o.textContent || "").trim().toLowerCase() === want ||
             (o.value || "").toLowerCase() === want
    );
    if (!opt) return false;
    setNativeValue(el, opt.value);
    opt.selected = true;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async #pickSuggestion(spec, value) {
    const el = this.query(spec.selector || spec);
    if (!el) return false;
    setNativeValue(el, value);
    await sleep(this.config.menuMs);
    const items = this.queryAll(spec.suggestions, el.parentElement || document);
    const want = String(value).toLowerCase();
    for (const item of items) {
      if (textOf(item).toLowerCase() === want) { item.click(); return true; }
    }
    for (const item of items) {
      if (textOf(item).toLowerCase().includes(want)) { item.click(); return true; }
    }
    return false;
  }

  /* -------------------------------------------- 2) programmatic photo drop */

  /**
   * Build real File objects and push them onto a hidden input through
   * DataTransfer — the same object the browser produces for a human drop,
   * which is the only thing these UIs listen for.
   *
   * Accepts: File | Blob | "data:image/jpeg;base64,..." | "https://..." URL.
   * @returns {"SUCCESS"|"FAILED"|"NOT_FOUND"}
   */
  async dropFiles(field, sources) {
    const spec = (this.selectors.fields || {})[field] || this.selectors.photos;
    const input = this.query(spec && (spec.selector || spec));
    if (!input) return NOT_FOUND;
    if (input.type !== "file") return FAILED;

    try {
      const files = await this.#toFiles(sources);
      if (!files.length) return FAILED;

      const dt = new DataTransfer();
      for (const f of files) dt.items.add(f);
      input.files = dt.files;

      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      input.dispatchEvent(new Event("drop", { bubbles: true, composed: true, dataTransfer: dt }));
      input.dispatchEvent(new Event("dragenter", { bubbles: true, dataTransfer: dt }));
      input.dispatchEvent(new Event("dragover", { bubbles: true, dataTransfer: dt }));
      await sleep(this.config.settleMs);

      // confirm: some UIs clear input.files on rejection
      const ok = input.files && input.files.length >= files.length;
      return ok ? SUCCESS : FAILED;
    } catch (e) {
      log("dropFiles failed", e.message);
      return FAILED;
    }
  }

  async #toFiles(sources) {
    const list = Array.isArray(sources) ? sources : [sources];
    const out = [];
    let seq = 0;
    for (const src of list) {
      if (!src) continue;
      if (src instanceof File) { out.push(src); continue; }
      if (src instanceof Blob) {
        seq++;
        out.push(new File([src], `fashionistas-${Date.now()}-${seq}.jpg`, { type: src.type || "image/jpeg" }));
        continue;
      }
      const str = String(src);
      if (str.startsWith("data:")) {
        seq++;
        out.push(dataUrlToFile(str, `fashionistas-${Date.now()}-${seq}.jpg`));
        continue;
      }
      if (/^https?:\/\//i.test(str)) {
        // Cross-origin: needs the host to allow it. A failure here is reported
        // as a failure — we never pretend a photo was attached.
        const res = await fetch(str, { mode: "cors" });
        if (!res.ok) throw new Error(`image_fetch_${res.status}`);
        const blob = await res.blob();
        seq++;
        out.push(new File([blob], `fashionistas-${Date.now()}-${seq}.jpg`, { type: blob.type || "image/jpeg" }));
        continue;
      }
      throw new Error("unsupported_photo_source");
    }
    return out;
  }

  /** Reverse helper: used to hand a preview back to the UI. */
  async fileToDataUrl(file) {
    return blobToDataUrl(file);
  }

  /* ------------------------------------- 3) custom (non-<select>) dropdowns */

  /**
   * Click-trigger -> wait for the re-render -> scan every node the menu just
   * appended -> click the one whose text matches EXACTLY (then loosely).
   *
   * Works for div/ul/li "selects", floating-ui, Radix, Material menus.
   * @returns {"SUCCESS"|"FAILED"|"NOT_FOUND"}
   */
  async selectOption({ trigger, option, value, loose = false, menuMs, scan } = {}) {
    const triggerEl = this.query(trigger);
    if (!triggerEl) return NOT_FOUND;

    try {
      triggerEl.click();
      await sleep(menuMs ?? this.config.menuMs);

      const max = scan ?? this.config.menuScan;
      const want = String(value).toLowerCase().trim();
      let candidates = this.queryAll(option).slice(0, max);

      // Menus re-render after the click, so re-query once more before giving up.
      if (!candidates.length) {
        await sleep(this.config.menuMs);
        candidates = this.queryAll(option).slice(0, max);
      }
      if (!candidates.length) return NOT_FOUND;

      // Pass 1: strict text match (case-insensitive).
      for (const node of candidates) {
        if (textOf(node).toLowerCase() === want) { this.#click(node); return SUCCESS; }
      }
      // Pass 2: a child node carries the label (nested spans/strongs).
      for (const node of candidates) {
        const kids = node.querySelectorAll ? node.querySelectorAll("span,div,li,option,strong,label") : [];
        for (const kid of kids) {
          if (textOf(kid).toLowerCase() === want) { this.#click(kid); return SUCCESS; }
        }
      }
      // Pass 3: opt-in loose match.
      if (loose) {
        for (const node of candidates) {
          const t = textOf(node).toLowerCase();
          if (t.includes(want) || want.includes(t)) { this.#click(node); return SUCCESS; }
        }
      }
      // Nothing matched: close the menu so we don't leave it overlaying the form.
      triggerEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return FAILED;
    } catch (e) {
      log("selectOption failed", e.message);
      return FAILED;
    }
  }

  #click(node) {
    node.scrollIntoView && node.scrollIntoView({ block: "nearest" });
    node.click();
  }

  /* ------------------------------------------------------- 4) safety shield */

  /**
   * THE circuit breaker. Called immediately before touching any submit or
   * publish control. Reads this.dryRun at call time so flipping a local
   * variable in the caller cannot slip past it.
   */
  #assertCanSubmit() {
    this.submitAttempts++;
    if (this.dryRun) {
      const err = new Error("DRY_RUN_BLOCKED: submit selector was reachable but refused");
      err.code = "DRY_RUN_BLOCKED";
      throw err;
    }
  }

  /** True only if a submit control exists AND we are allowed to press it. */
  async canSubmit() {
    const el = this.query(this.selectors.submit);
    if (!el || !this.isVisible(el)) return { ok: false, reason: "no_submit_control" };
    if (this.dryRun) return { ok: false, reason: "dry_run" };
    return { ok: true, reason: null };
  }

  /**
   * Press publish. Throws under dryRun. Exists so no other code path needs to
   * know the selector or the flag.
   */
  async submit(payload) {
    this.#assertCanSubmit();
    const el = this.query(this.selectors.submit);
    if (!el) throw new Error("submit_control_not_found");
    if (this.selectors.submitWaitMs) await sleep(this.selectors.submitWaitMs);
    el.click();
    return { submitted: true, at: Date.now() };
  }

  /* ------------------------------------------------------------- telemetry */

  /**
   * The telemetry contract:
   * {
   *   "marketplace": "string",
   *   "dryRun": true,
   *   "hydratedFields": { "field_name": "SUCCESS | FAILED | NOT_FOUND" },
   *   "error": "string | null",
   *   "readyForUserTap": true
   * }
   */
  buildTrace() {
    const values = Object.values(this.trace);
    const usable = values.filter((v) => v === SUCCESS).length;
    const attempted = values.length;
    const blocked = values.some((v) => v === FAILED || v === NOT_FOUND);
    // Honest gate: everything we tried must have landed, we must have actually
    // tried something, and no error may be pending.
    const ready = attempted > 0 && usable === attempted && !this.error && this.submitAttempts === 0;
    void blocked;
    return {
      marketplace: this.marketplace,
      dryRun: this.dryRun === true,
      hydratedFields: { ...this.trace },
      error: this.error || null,
      readyForUserTap: ready
    };
  }

  /**
   * Drive one marketplace end-to-end from a payload.
   *
   * Order is fixed: captcha check -> text -> menus -> photos -> STOP.
   * Under dryRun it never reaches submit; without dryRun it fills everything
   * and then WAITS for the human, because the product rule is that the person
   * taps Post.
   *
   * @param {object} payload {title, description, price, category, brand,
   *                          size, condition, shipping, photos, menus:{...}}
   * @returns {Promise<object>} telemetry trace (never throws)
   */
  async run(payload = {}) {
    const started = Date.now();
    this.trace = {};
    this.error = null;
    this.submitAttempts = 0;

    try {
      // 0) CAPTCHA / verification wall => stop, do not poke the form
      if (this.selectors.captcha) {
        const wall = this.query(this.selectors.captcha) ||
          Array.from(document.querySelectorAll("iframe")).some((f) =>
            /recaptcha|hcaptcha|challenges\.cloudflare|funcaptcha/i.test(f.src || "")
          );
        if (wall) {
          this.error = "captcha_required";
          const t = this.buildTrace();
          t.durationMs = Date.now() - started;
          return t;
        }
      }

      // 1) plain text / number / textarea fields
      const fields = (this.selectors.fields) || {};
      for (const [name, spec] of Object.entries(fields)) {
        if (spec && spec.kind === "file") continue;      // handled below
        if (spec && spec.kind === "menu") continue;      // handled below
        const value = payload[name];
        if (value == null || value === "") {
          this.trace[name] = NOT_FOUND;
          continue;
        }
        this.trace[name] = await this.hydrate(name, value);
      }

      // A field the caller asked for but the selector dictionary has no
      // mapping for is a real gap — surface it instead of silently omitting it.
      for (const key of Object.keys(payload)) {
        if (key === "photos" || key === "menus") continue;
        if (!(key in this.trace)) this.trace[key] = NOT_FOUND;
      }

      // 2) custom dropdowns declared as {field: {trigger, option, value}}
      const menus = payload.menus || this.selectors.menus || {};
      for (const [name, cfg] of Object.entries(menus)) {
        if (!cfg || !cfg.trigger || !cfg.option) { this.trace[name] = NOT_FOUND; continue; }
        const target = cfg.value != null ? cfg.value : payload[name];
        if (target == null || target === "") { this.trace[name] = NOT_FOUND; continue; }
        this.trace[name] = await this.selectOption({
          trigger: cfg.trigger,
          option: cfg.option,
          value: target,
          loose: cfg.loose === true,
          menuMs: cfg.menuMs,
          scan: cfg.scan
        });
      }

      // 3) photos
      if (payload.photos && payload.photos.length) {
        const photoField = Object.keys(fields).find(
          (k) => fields[k] && fields[k].kind === "file"
        ) || "photos";
        this.trace[photoField] = await this.dropFiles(photoField, payload.photos);
      }

      // 4) HARD STOP if dryRun. This is the last thing that runs.
      if (this.dryRun) {
        log("dryRun: stopping before submit", this.marketplace);
      } else {
        // Even when allowed, WE do not press it: the human taps Post.
        const can = await this.canSubmit();
        if (!can.ok) this.error = can.reason;
      }
    } catch (e) {
      this.error = String((e && e.message) || e);
    }

    const trace = this.buildTrace();
    trace.durationMs = Date.now() - started;
    return trace;
  }
}

/** Convenience factory used by marketplace adapter files. */
export function createEngine(marketplace, selectors, opts = {}) {
  return new Engine({ marketplace, selectors, ...opts });
}

export default Engine;
