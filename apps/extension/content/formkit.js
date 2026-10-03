// formkit.js — the generic form engine shared by every shop adapter.
//
// It is a classic (non-module) content script so it can be declared in
// manifest.json, and it installs ONE global: globalThis.__fashForm.
// Adapters injected by chrome.scripting.executeScript run in the same
// isolated world, so they can call it. All selectors arrive as data (the
// SEL object built from config/selectors.js) — no selector is hard-coded
// here or in any adapter.
//
// IMPORTANT SAFETY RULES baked into this file:
//   * it never solves a CAPTCHA, never touches an ID/verification check;
//   * it never creates an account (signup only pre-fills fields);
//   * it always reports a detected CAPTCHA back to the queue and stops.
(function () {
  if (globalThis.__fashForm) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  function q(cands, root) {
    const scope = root || document;
    for (const sel of cands || []) {
      if (!sel) continue;
      try {
        const el = scope.querySelector(sel);
        if (el) return el;
      } catch (e) {
        // invalid selector in config -> ignore and try the next candidate
      }
    }
    return null;
  }

  function qAll(cands) {
    const out = [];
    for (const sel of cands || []) {
      try {
        document.querySelectorAll(sel).forEach((el) => out.push(el));
      } catch (e) {
        /* bad selector in config */
      }
    }
    return out;
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  }

  /** Set a value the way React/Vue/Svelte notice (native setter + events). */
  function setValue(el, value) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "select") {
      const before = el.value;
      el.value = value;
      if (el.value !== value) {
        // value not in <option> list -> try matching option text
        const opt = Array.from(el.options || []).find(
          (o) => o.textContent.trim().toLowerCase() === String(value).trim().toLowerCase()
        );
        if (opt) el.value = opt.value;
      }
      if (el.value !== before) {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return el.value !== before || el.value !== "";
    }
    if (el.isContentEditable || tag === "div" || tag === "p") {
      el.focus();
      el.textContent = String(value);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: String(value) }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    const proto = tag === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) {
      desc.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return String(el.value) === String(value);
  }

  /** Fill an <input> that has an autocomplete dropdown, then pick a suggestion. */
  async function setWithSuggestions(el, value, SEL) {
    if (!el) return false;
    setValue(el, value);
    await sleep(rand(450, 1100));
    const sugg = q(SEL.suggestions);
    if (sugg && visible(sugg)) {
      sugg.click();
      await sleep(rand(250, 700));
      return true;
    }
    return String(el.value || "") !== "";
  }

  /** Upload photos into a file input via DataTransfer (data: URLs preferred). */
  async function uploadPhotos(input, photos) {
    if (!input || !photos || !photos.length) return { uploaded: 0 };
    const dt = new DataTransfer();
    let uploaded = 0;
    for (let i = 0; i < photos.length; i++) {
      try {
        const src = photos[i];
        const blob = src.startsWith("data:")
          ? await (await fetch(src)).blob()
          : await (await fetch(src, { credentials: "omit" })).blob();
        dt.items.add(new File([blob], `fashionistas-${i + 1}.jpg`, { type: blob.type || "image/jpeg" }));
        uploaded++;
      } catch (e) {
        // one bad photo must not abort the whole listing
      }
    }
    if (!uploaded) return { uploaded: 0 };
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(rand(800, 1800));
    return { uploaded };
  }

  /**
   * Detect a CAPTCHA / human-verification widget.
   * Returns the selector string that matched, or null.
   * The queue treats a match as a hard stop: {status:"failed", error:"captcha_required"}.
   */
  function detectCaptcha(SEL) {
    const list = (SEL && SEL.captcha) || [];
    for (const sel of list) {
      try {
        const el = document.querySelector(sel);
        if (el && visible(el)) return sel;
      } catch (e) {
        /* bad selector in config */
      }
    }
    const frames = Array.from(document.querySelectorAll("iframe"));
    for (const f of frames) {
      const src = (f.getAttribute("src") || "").toLowerCase();
      if (
        src.includes("recaptcha") ||
        src.includes("hcaptcha") ||
        src.includes("challenges.cloudflare.com") ||
        src.includes("funcaptcha") ||
        src.includes("geo.captcha-delivery.com")
      ) {
        return "iframe:" + src.slice(0, 60);
      }
    }
    if (document.querySelector(".g-recaptcha[data-size]")) return ".g-recaptcha";
    return null;
  }

  /**
   * Generic wizard-aware fill:
   *  - uploads photos,
   *  - fills every field that is present on the current step,
   *  - clicks "next" while steps remain (shops with multi-step create flows),
   *  - repeats until no progress is made.
   * Returns {ok, filled, missing, photos}.
   */
  async function fill(payload, SEL) {
    const F = SEL.fields || {};
    const want = {
      title: payload.title,
      description: payload.description,
      brand: payload.brand,
      category: payload.category,
      subcategory: payload.subcategory,
      size: payload.size,
      condition: payload.condition,
      color: payload.color,
      material: payload.material,
      price: payload.price,
      quantity: payload.quantity,
      sku: payload.sku
    };
    const filled = [];
    const missing = [];

    // 1) photos first — most shops unlock the rest of the form afterwards
    let photoResult = { uploaded: 0 };
    const photoInput = q(F.photos);
    if (payload.photos && payload.photos.length) {
      photoResult = await uploadPhotos(photoInput, payload.photos);
      if (photoResult.uploaded) filled.push("photos");
      else missing.push("photos");
    } else {
      photoResult = { uploaded: 0, skipped: true };
    }

    // 2) walk the steps of the create flow
    let steps = 0;
    while (steps < 6) {
      steps++;
      let progress = false;

      for (const key of Object.keys(want)) {
        const value = want[key];
        if (value === undefined || value === null || value === "") continue;
        if (filled.includes(key)) continue;
        const cands = F[key];
        if (!cands || !cands.length) continue;
        const el = q(cands);
        if (!el || !visible(el)) continue;
        const ok = SEL.autocomplete && SEL.autocomplete.includes(key)
          ? await setWithSuggestions(el, String(value), SEL)
          : setValue(el, String(value));
        if (ok) {
          filled.push(key);
          progress = true;
          await sleep(rand(150, 500));
        }
      }

      const allDone = Object.keys(want)
        .filter((k) => want[k] !== undefined && want[k] !== null && want[k] !== "")
        .every((k) => filled.includes(k));
      if (allDone) break;

      const nextBtn = q(SEL.buttons && SEL.buttons.next);
      if (nextBtn && visible(nextBtn) && !nextBtn.disabled) {
        nextBtn.click();
        await sleep(rand(900, 2000));
        progress = true;
      } else if (!progress) {
        break;
      }
    }

    for (const k of Object.keys(want)) {
      const v = want[k];
      if (v !== undefined && v !== null && v !== "" && !filled.includes(k)) missing.push(k);
    }

    return { ok: missing.length === 0, filled, missing, photos: photoResult.uploaded };
  }

  /**
   * Click the shop's real "List / Publish / Sell now" button.
   * This IS the submission — the listing goes live from here.
   * Returns {ok, captcha, error}.
   */
  function submit(SEL) {
    const captchaSel = detectCaptcha(SEL);
    if (captchaSel) return { ok: false, captcha: true, matched: captchaSel };
    const btn = q(SEL.buttons && SEL.buttons.submit);
    if (!btn) return { ok: false, captcha: false, error: "submit_button_not_found" };
    if (!visible(btn)) return { ok: false, captcha: false, error: "submit_button_hidden" };
    if (btn.disabled || btn.getAttribute("aria-disabled") === "true") {
      return { ok: false, captcha: false, error: "submit_button_disabled" };
    }
    btn.click();
    return { ok: true, captcha: false };
  }

  /**
   * Capture the LIVE listing URL after the post-submit redirect.
   * Tries, in order: current URL, canonical link, og:url, any anchor that
   * matches the shop's listing pattern. Returns a string or null.
   */
  function extractUrl(SEL) {
    let re = null;
    try {
      re = new RegExp(SEL.listingPattern || "$^");
    } catch (e) {
      re = null;
    }
    const clean = (u) => (u ? u.split("#")[0] : null);
    const candidates = [location.href, location.origin + location.pathname];
    try {
      const canon = document.querySelector("link[rel='canonical']");
      if (canon) candidates.push(canon.href);
    } catch (e) {}
    try {
      const og = document.querySelector("meta[property='og:url']");
      if (og) candidates.push(og.content);
    } catch (e) {}
    for (const c of candidates) {
      const u = clean(c);
      if (u && re && re.test(u)) return u;
    }
    if (re) {
      const links = qAll(SEL.successLinks).slice(0, 300);
      for (const a of links) {
        const u = clean(a.href);
        if (u && re.test(u)) return u;
      }
    }
    return null;
  }

  /**
   * SIGNUP ASSIST — pre-fills only.
   * HARD RULE (enforced here and in every adapter): this never clicks the
   * create-account button, never bypasses a CAPTCHA or an ID check.
   * Returns {ok, filled, captcha}. The queue turns a captcha hit into
   * {status:"failed", error:"captcha_required"} and stops the job.
   */
  async function prefillSignup(user, SEL) {
    const captchaSel = detectCaptcha(SEL);
    if (captchaSel) return { ok: false, captcha: true, matched: captchaSel, filled: [] };
    const S = SEL.signup || {};
    const want = {
      firstName: user.firstName || user.name || "",
      lastName: user.lastName || "",
      email: user.email || "",
      username: user.username || ""
    };
    const filled = [];
    for (const key of Object.keys(want)) {
      if (!want[key]) continue;
      const el = q(S[key]);
      if (!el || !visible(el)) continue;
      if (setValue(el, String(want[key]))) filled.push(key);
      await sleep(rand(150, 450));
    }
    // NOTE: we stop here on purpose. Account creation is always a human action.
    return { ok: filled.length > 0, captcha: false, filled, stopped_before_submit: true };
  }

  /** Click a shop's own delete/delist flow (menu -> delete -> confirm). */
  function delist(SEL) {
    const captchaSel = detectCaptcha(SEL);
    if (captchaSel) return { ok: false, captcha: true, matched: captchaSel };
    const menu = q(SEL.buttons && SEL.buttons.menu);
    if (menu && visible(menu)) {
      menu.click();
      // the menu opens synchronously on most shops; give React a beat
      const t = Date.now();
      while (Date.now() - t < 300) {
        /* busy wait for the menu to paint */
      }
    }
    const del = q(SEL.buttons && SEL.buttons.delete);
    if (del && visible(del)) {
      del.click();
      const t2 = Date.now();
      while (Date.now() - t2 < 300) {
        /* busy wait for the confirm dialog */
      }
    } else {
      return { ok: false, captcha: false, error: "delete_button_not_found" };
    }
    const confirm = q(SEL.buttons && SEL.buttons.deleteConfirm);
    if (confirm && visible(confirm)) {
      confirm.click();
      return { ok: true, captcha: false };
    }
    return { ok: false, captcha: false, error: "delete_confirm_not_found" };
  }

  globalThis.__fashForm = {
    q,
    qAll,
    visible,
    setValue,
    sleep,
    rand,
    fill,
    submit,
    extractUrl,
    detectCaptcha,
    prefillSignup,
    delist,
    uploadPhotos
  };
})();
