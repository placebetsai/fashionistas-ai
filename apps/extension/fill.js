/* fashionistas.ai crosslister — content script that fills the draft.
 *
 * Runs on poshmark.com, mercari.com, depop.com, vinted.com, grailed.com and
 * facebook.com/marketplace. Reads every selector from config.js (loaded just
 * before this file). Fills title / description / price / category / brand /
 * size / condition / hashtags, uploads photos onto the shop's file input via
 * DataTransfer + dt.items (MV3 has no chrome.fileSystem), then STOPS.
 *
 * HARD CONTRACT: this file never clicks the shop's publish/submit control.
 * safeClick() refuses it, submitClickAttempts must stay 0, and fillListing()
 * throws if that assertion ever breaks.
 */
(function () {
  "use strict";

  const CONFIG = globalThis.FASHIONISTAS_CONFIG;
  if (!CONFIG) return;

  const MSG = {
    fill: "fashionistas:fill",
    needPayload: "fashionistas:need-payload",
    fetchPhoto: "fashionistas:fetch-photo",
    retryUrl: "fashionistas:retry-url",
    filled: "fashionistas:filled"
  };

  const BANNER_ID = "fashionistas-ai-banner";
  const SUBMITTED = false; // must stay false — nothing is ever published
  let submitClickAttempts = 0;

  /* ------------------------------------------------------------ helpers */

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function normText(s) {
    return String(s == null ? "" : s)
      .replace(/\s+/g, " ")
      .replace(/\s*:\s*$/, "")
      .trim()
      .toLowerCase();
  }

  function queryAllSafe(selectors) {
    const out = [];
    (selectors || []).forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (out.indexOf(el) === -1) out.push(el);
        });
      } catch (e) {
        /* selector this browser rejects — ignore */
      }
    });
    return out;
  }

  function isControl(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return el.isContentEditable === true || el.getAttribute("contenteditable") === "true";
  }

  /** Resolve a field's control: config selectors first, then label text. */
  function resolveControl(field) {
    if (!field) return null;
    const hits = queryAllSafe(field.selectors);
    for (const el of hits) {
      if (isControl(el)) return el;
      const inner = el.querySelector
        ? el.querySelector('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="textbox"]')
        : null;
      if (inner) return inner;
    }
    const labels = [field.label].concat(field.labelAliases || []).filter(Boolean);
    if (labels.length) {
      const wanted = labels.map(normText);
      const candidates = document.querySelectorAll('label, legend, [aria-label], [placeholder], [title]');
      for (const el of candidates) {
        const texts = [];
        ["aria-label", "placeholder", "title"].forEach((a) => {
          const v = el.getAttribute && el.getAttribute(a);
          if (v) texts.push(v);
        });
        if (el.tagName === "LABEL" || el.tagName === "LEGEND") texts.push(el.textContent);
        if (!texts.some((t) => wanted.indexOf(normText(t)) !== -1)) continue;
        if (isControl(el)) return el;
        if (el.htmlFor) {
          const byId = document.getElementById(el.htmlFor);
          if (byId) return byId;
        }
        const inner2 = el.querySelector
          ? el.querySelector('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="button"], button')
          : null;
        if (inner2) return inner2;
        const box = el.closest ? el.closest("div, li, fieldset, section, form") : null;
        if (box) {
          const inner3 = box.querySelector('input, textarea, select, [contenteditable="true"], [role="combobox"]');
          if (inner3) return inner3;
        }
      }
    }
    return null;
  }

  async function waitForControl(field, timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 8000);
    let el = resolveControl(field);
    while (!el && Date.now() < deadline) {
      await sleep(250);
      el = resolveControl(field);
    }
    return el;
  }

  function readValue(el) {
    if (!el) return "";
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return el.value || "";
    return el.textContent || "";
  }

  /** Native setter + events so React/Vue bindings pick the value up. */
  function setTextValue(el, value) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      const proto = tag === "INPUT" ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      try {
        el.focus();
      } catch (e) {
        /* ignore */
      }
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return el.value === value;
    }
    if (el.isContentEditable || el.getAttribute("contenteditable") === "true") {
      try {
        el.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, value);
      } catch (e) {
        el.textContent = value;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    return false;
  }

  function setSelectValue(el, value) {
    const opts = Array.prototype.slice.call(el.options || []);
    const want = normText(value);
    const opt =
      opts.find((o) => normText(o.text) === want) ||
      opts.find((o) => normText(o.text).indexOf(want) !== -1) ||
      opts.find((o) => want.indexOf(normText(o.text)) !== -1 && normText(o.text).length > 2) ||
      opts.find((o) => normText(o.text).indexOf(want.split(" ")[0]) !== -1 && want.split(" ")[0].length > 3);
    if (!opt) return false;
    el.value = opt.value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  /* --------------------------------------------------- never-submit guard */

  function matchesSubmit(shop, el) {
    if (!el) return false;
    const sels = (shop.submit && shop.submit.selectors) || [];
    for (const sel of sels) {
      try {
        if (el.matches && el.matches(sel)) return true;
        if (el.closest && el.closest(sel)) return true;
      } catch (e) {
        /* ignore */
      }
    }
    const raw = (el.textContent || el.value || (el.getAttribute && el.getAttribute("aria-label")) || "").trim();
    const text = normText(raw);
    if (!text) return false;
    return ((shop.submit && shop.submit.textMatchers) || []).some((m) => {
      const mm = normText(m);
      return mm && (text === mm || (mm.length > 4 && text.indexOf(mm) === 0));
    });
  }

  /** The only click path in this file — refuses anything that publishes. */
  function safeClick(shop, el) {
    if (matchesSubmit(shop, el)) {
      submitClickAttempts += 1;
      throw new Error(
        "fashionistas.ai blocked a click on a submit control of " + shop.label
      );
    }
    el.click();
    return true;
  }

  function assertNeverSubmitted(report) {
    if (submitClickAttempts > 0) {
      report.submitted = true;
      throw new Error("auto-submit attempt detected (" + submitClickAttempts + ")");
    }
    report.submitted = SUBMITTED;
    console.assert(
      SUBMITTED === false && submitClickAttempts === 0,
      "[fashionistas.ai] never auto-submit — assertion failed"
    );
    if (SUBMITTED !== false) throw new Error("[fashionistas.ai] auto-submit attempted");
  }

  /* ------------------------------------------------------------ fields */

  function truncate(value, max) {
    if (!max || max <= 0 || value.length <= max) return value;
    return value.slice(0, max).replace(/\s+$/, "");
  }

  function formatPrice(raw, cfg) {
    const cleaned = String(raw == null ? "" : raw).replace(/[^0-9.,-]/g, "").trim();
    if (!cleaned) return "";
    const num = Number(cleaned.replace(",", "."));
    if (!isFinite(num)) return cleaned;
    const decimals = cfg && cfg.decimals != null ? cfg.decimals : 2;
    const out = decimals === 0 ? String(Math.round(num)) : num.toFixed(decimals);
    return cfg && cfg.prefix ? cfg.prefix + out : out;
  }

  async function fillField(shop, name, field, value, report) {
    if (value == null || value === "") {
      if (!field.optional) report.skipped.push(name + " (empty in payload)");
      return false;
    }
    const el = await waitForControl(field, 8000);
    if (!el) {
      if (!field.optional) report.skipped.push(name + " (control not found)");
      return false;
    }

    if (field.kind === "combo") {
      const ok = await fillCombo(shop, el, field, value, report);
      if (ok) report.filled.push(name);
      return ok;
    }

    if (el.tagName === "SELECT") {
      const ok = setSelectValue(el, value);
      if (ok) report.filled.push(name);
      else report.notes.push('No "' + value + '" option in ' + field.label + " — set it manually.");
      return ok;
    }

    if (!isControl(el)) {
      report.skipped.push(name + " (not an editable control)");
      return false;
    }

    let text = String(value);
    if (name === "title") {
      const before = text.length;
      text = truncate(text, shop.limits.title);
      if (text.length < before) {
        report.notes.push("Title trimmed to the " + shop.limits.title + "-character " + shop.label + " limit.");
      }
    }
    if (name === "description") {
      const before = text.length;
      text = truncate(text, shop.limits.description);
      if (text.length < before) {
        report.notes.push("Description trimmed to the " + shop.limits.description + "-character " + shop.label + " limit.");
      }
    }

    const ok = setTextValue(el, text);
    if (ok) report.filled.push(name);
    else report.notes.push("Could not verify " + field.label + " — check it by hand.");
    return ok;
  }

  async function fillCombo(shop, control, field, value, report) {
    const want = normText(value);

    if (control.tagName === "SELECT") {
      const ok = setSelectValue(control, value);
      if (!ok) report.notes.push('No "' + value + '" option in ' + field.label + " — set it manually.");
      return ok;
    }

    /* A chip/pill that already shows the wanted value: just click it. */
    const candidates = [control].concat(queryAllSafe(field.selectors));
    for (const el of candidates) {
      if (el.tagName === "SELECT") {
        if (setSelectValue(el, value)) return true;
      }
      if (normText(el.textContent) === want || normText(el.value) === want) {
        safeClick(shop, el);
        return true;
      }
    }

    safeClick(shop, control);
    try {
      control.focus();
    } catch (e) {
      /* ignore */
    }
    if (control.tagName === "INPUT") setTextValue(control, value);
    await sleep(350);

    const optionSels = (field.optionSelectors || []).concat(CONFIG.optionSelectors || []);
    const opts = queryAllSafe(optionSels).filter((el) => !matchesSubmit(shop, el));
    const match =
      opts.find((el) => normText(el.textContent) === want) ||
      opts.find((el) => normText(el.textContent).indexOf(want) !== -1) ||
      opts.find((el) => want.indexOf(normText(el.textContent)) !== -1 && normText(el.textContent).length > 2);

    if (match) {
      safeClick(shop, match);
      await sleep(200);
      return true;
    }

    if (control.tagName === "INPUT" && normText(control.value) === want) {
      control.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await sleep(200);
      if (normText(control.value) === want && document.activeElement === control) {
        report.notes.push('Accepted "' + value + '" in ' + field.label + ".");
        return true;
      }
    }

    report.notes.push('Could not pick "' + value + '" from ' + field.label + " — choose it manually.");
    return false;
  }

  function applyHashtags(shop, listing, report) {
    const field = shop.fields.tags;
    const tags = (listing.tags || [])
      .map((t) => String(t).replace(/^#+/, "").trim().replace(/\s+/g, ""))
      .filter(Boolean)
      .slice(0, (field && field.max) || 5);
    if (!field || field.mode !== "append-description" || !tags.length) return false;
    const el = resolveControl(shop.fields.description);
    if (!el) {
      report.notes.push("Description control missing — hashtags not appended.");
      return false;
    }
    const tagStr = tags.map((t) => "#" + t).join(" ");
    const current = readValue(el).replace(/\s+$/, "");
    let next = current ? current + "\n\n" + tagStr : tagStr;
    next = truncate(next, shop.limits.description);
    if (setTextValue(el, next)) {
      report.filled.push("tags");
      return true;
    }
    report.notes.push("Could not append hashtags — add them to the description manually.");
    return false;
  }

  /* -------------------------------------------------------------- photos */

  async function findFileInput(shop, report) {
    const pick = () => {
      const hits = queryAllSafe(shop.photos.selectors);
      for (const el of hits) {
        if (el.tagName === "INPUT" && el.type === "file") return el;
        const inner = el.querySelector ? el.querySelector('input[type="file"]') : null;
        if (inner) return inner;
      }
      return null;
    };
    let input = pick();
    if (input) return input;

    const reveal = shop.photos.reveal || {};
    const revealHits = queryAllSafe(reveal.selectors || []);
    const textWanted = (reveal.textMatchers || []).map(normText);
    for (const el of revealHits) {
      const t = normText(el.textContent || el.getAttribute("aria-label") || "");
      if (textWanted.some((m) => t === m || (m.length > 4 && t.indexOf(m) === 0))) {
        try {
          safeClick(shop, el);
          await sleep(350);
        } catch (e) {
          report.notes.push(String(e.message));
          break;
        }
        input = pick();
        if (input) return input;
      }
    }
    return null;
  }

  async function photoToFile(photo, index) {
    let blob = null;
    let filename = null;
    if (typeof photo === "string") photo = { url: photo };
    if (photo && photo.data) {
      const res = await fetch(photo.data);
      blob = await res.blob();
    } else if (photo && photo.url) {
      try {
        const res = await fetch(photo.url, { mode: "cors" });
        if (res.ok) blob = await res.blob();
      } catch (e) {
        blob = null;
      }
      if (!blob) {
        const resp = await chrome.runtime.sendMessage({ type: MSG.fetchPhoto, url: photo.url });
        if (resp && resp.ok && resp.data) {
          const res2 = await fetch(resp.data);
          blob = await res2.blob();
        }
      }
    }
    if (!blob || !blob.size) throw new Error("could not load photo " + (index + 1));
    filename = (photo && photo.filename) || "fashionistas-" + (index + 1) + ".jpg";
    if (!/\.[a-z0-9]{2,5}$/i.test(filename)) {
      filename += "." + ((blob.type && blob.type.split("/")[1]) || "jpg");
    }
    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  }

  async function uploadPhotos(shop, photos, report) {
    if (!Array.isArray(photos) || !photos.length) {
      report.notes.push("No photos in the payload.");
      return false;
    }
    const input = await findFileInput(shop, report);
    if (!input) {
      report.skipped.push("photos (file input not found)");
      return false;
    }
    const files = [];
    for (let i = 0; i < photos.length; i++) {
      try {
        const f = await photoToFile(photos[i], i);
        if (f) files.push(f);
      } catch (e) {
        report.notes.push("Photo " + (i + 1) + " skipped: " + (e && e.message));
      }
    }
    if (!files.length) {
      report.skipped.push("photos (no usable file data)");
      return false;
    }
    const use = input.multiple ? files : files.slice(0, 1);
    if (!input.multiple && files.length > 1) {
      report.notes.push("This shop's input takes one photo — sent the first only.");
    }
    /* MV3 has no chrome.fileSystem: build the FileList with DataTransfer. */
    const dt = new DataTransfer();
    use.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    report.photos = use.length;
    report.filled.push("photos");
    return true;
  }

  /* -------------------------------------------------------------- banner */

  function showBanner(shop, report, error) {
    const old = document.getElementById(BANNER_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const el = document.createElement("div");
    el.id = BANNER_ID;
    el.setAttribute("role", "status");
    el.style.cssText = [
      "position:fixed",
      "top:16px",
      "right:16px",
      "z-index:2147483647",
      "max-width:340px",
      "padding:14px 16px 12px",
      "background:#0f1720",
      "color:#f5f7fa",
      "font:13px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
      "border:1px solid #2ecc71",
      "border-radius:12px",
      "box-shadow:0 12px 32px rgba(0,0,0,.35)"
    ].join(";");

    const head = document.createElement("div");
    head.style.cssText = "font-weight:600;color:#2ecc71;margin-bottom:4px";
    head.textContent = CONFIG.banner.title;
    el.appendChild(head);

    const meta = document.createElement("div");
    meta.style.cssText = "color:#cbd5e1;margin-bottom:6px";
    meta.textContent =
      shop.label +
      " · " +
      (error ? "fill failed" : "filled " + report.filled.length + " field(s)") +
      " · " +
      report.photos +
      " photo(s)";
    el.appendChild(meta);

    const stop = document.createElement("div");
    stop.style.cssText = "color:#e2e8f0;margin-bottom:6px";
    stop.textContent = error ? String(error) : CONFIG.banner.stoppedNote;
    el.appendChild(stop);

    const notes = report.notes.concat(
      report.skipped.map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase()) + " — do it manually")
    );
    if (notes.length) {
      const ul = document.createElement("ul");
      ul.style.cssText = "margin:0 0 6px 16px;padding:0;color:#f6c343";
      notes.slice(0, 6).forEach((n) => {
        const li = document.createElement("li");
        li.style.marginBottom = "2px";
        li.textContent = String(n).slice(0, 160);
        ul.appendChild(li);
      });
      el.appendChild(ul);
    }

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Got it";
    close.style.cssText =
      "margin-top:4px;padding:5px 12px;border:0;border-radius:8px;background:#2ecc71;color:#0f1720;font-weight:600;cursor:pointer";
    close.addEventListener("click", () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    el.appendChild(close);

    document.documentElement.appendChild(el);
  }

  /* --------------------------------------------------------- main fill */

  async function fillListing(shopKey, listing, token) {
    const busyFlag = "__fashionistasBusy";
    let guard = 0;
    while (globalThis[busyFlag] && guard < 60) {
      await sleep(250);
      guard++;
    }
    const doneMap = globalThis.__fashionistasDone || (globalThis.__fashionistasDone = {});
    if (token) {
      if (doneMap[token]) return { ok: true, skipped: true, report: { submitted: false } };
      doneMap[token] = true;
    }
    globalThis[busyFlag] = true;

    const shop = CONFIG.shops[shopKey];
    const report = {
      shop: shopKey,
      label: shop ? shop.label : shopKey,
      filled: [],
      skipped: [],
      notes: [],
      photos: 0,
      submitted: SUBMITTED
    };

    if (!shop) {
      globalThis[busyFlag] = false;
      return { ok: false, error: "unknown shop: " + shopKey, report: report };
    }

    try {
      await sleep(shop.readyDelayMs || 600);

      const titleField = shop.fields.title;
      const titleEl = await waitForControl(titleField, 8000);
      if (!titleEl) {
        const pwd = document.querySelector('input[type="password"]');
        if (pwd) {
          const err = "Not logged in to " + shop.label + " — sign in, then retry.";
          showBanner(shop, report, err);
          return { ok: false, error: err, report: report };
        }
        const retry = await chrome.runtime.sendMessage({
          type: MSG.retryUrl,
          shop: shopKey,
          listing: listing
        });
        if (retry && retry.ok) return { ok: true, retried: true, report: report };
        const err = shop.label + " create-listing form not found on this page.";
        showBanner(shop, report, err);
        return { ok: false, error: err, report: report };
      }

      await uploadPhotos(shop, listing.photos, report);

      const order = ["title", "description", "price", "category", "brand", "size", "condition"];
      const values = {
        title: listing.title,
        description: listing.description,
        price: formatPrice(listing.price, shop.price),
        category: listing.category,
        brand: listing.brand,
        size: listing.size,
        condition: listing.condition
      };

      for (const name of order) {
        const field = shop.fields[name];
        if (!field) continue;
        if (name === "title") {
          await fillField(shop, name, field, values.title, report);
          continue;
        }
        await fillField(shop, name, field, values[name], report);
        await sleep(120);
      }

      applyHashtags(shop, listing, report);

      document.documentElement.setAttribute("data-fashionistas-filled", shopKey);
      assertNeverSubmitted(report);
      showBanner(shop, report, null);

      try {
        const sent = chrome.runtime.sendMessage({ type: MSG.filled, shop: shopKey, report: report });
        if (sent && typeof sent.catch === "function") sent.catch(function () {});
      } catch (e) {
        /* ignore */
      }
      return { ok: true, report: report };
    } catch (e) {
      report.notes.push(String(e && e.message ? e.message : e));
      showBanner(shop, report, e && e.message ? e.message : String(e));
      return { ok: false, error: String(e && e.message ? e.message : e), report: report };
    } finally {
      globalThis[busyFlag] = false;
    }
  }

  /* ------------------------------------------------------ wiring, once */

  if (!globalThis.__fashionistasListener) {
    globalThis.__fashionistasListener = true;
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || typeof msg.type !== "string" || msg.type.indexOf("fashionistas:") !== 0) return;
      if (msg.type === MSG.fill) {
        fillListing(msg.shop, msg.listing, msg.token)
          .then((res) => sendResponse(res))
          .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
        return true;
      }
      if (msg.type === MSG.needPayload) {
        sendResponse({ ok: true });
        return false;
      }
    });

    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({ type: MSG.needPayload }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.pending) return;
          const p = resp.pending;
          if (p && p.shop && p.listing) fillListing(p.shop, p.listing, p.token);
        });
      } catch (e) {
        /* ignore */
      }
    }, 400);
  }
})();
