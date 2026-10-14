// Injected into a marketplace tab (or the mock page). Pure DOM; no network, no passwords.
// window.__faFill(spec, item, opts) → report {filled:[], missed:[], photos:n, submitted:bool}
(function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const human = (o) => sleep(o.fast ? 30 : 350 + Math.random() * 700);
  const vis = (e) => e && e.getClientRects().length > 0 && !e.disabled;
  function byLabel(word) {
    const w = word.toLowerCase(), C = 'input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable="true"],[role="combobox"]';
    for (const el of document.querySelectorAll(C)) {
      const t = [el.getAttribute("aria-label"), el.placeholder, el.name, el.id, el.getAttribute("data-testid")].filter(Boolean).join(" ").toLowerCase();
      if (t.includes(w) && vis(el)) return el;
    }
    for (const lb of document.querySelectorAll("label,[id$='-label'],legend,span,div")) {
      if (lb.children.length > 3) continue;
      const tx = (lb.textContent || "").trim().toLowerCase(); if (!tx || tx.length > 40 || !tx.startsWith(w)) continue;
      const f = (lb.htmlFor && document.getElementById(lb.htmlFor)) || lb.querySelector(C) || (lb.parentElement && lb.parentElement.querySelector(C));
      if (vis(f)) return f;
    }
    return null;
  }
  function find(hint) { const [sel, ...words] = hint || []; let e = sel && document.querySelector(sel); if (vis(e)) return e; for (const w of words) { e = byLabel(w); if (e) return e; } return null; }
  function setVal(el, v) {
    el.focus();
    if (el.isContentEditable) { el.textContent = v; el.dispatchEvent(new InputEvent("input", { bubbles: true })); return; }
    if (el.tagName === "SELECT") { const o = [...el.options].find((o) => o.text.toLowerCase().includes(String(v).toLowerCase())); if (!o) return false; el.value = o.value; el.dispatchEvent(new Event("change", { bubbles: true })); return true; }
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); // works with React-controlled inputs
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); el.blur();
    return true;
  }
  async function pickOption(el, v, o) { // comboboxes: type then choose the first matching option
    setVal(el, v); await human(o);
    const opt = [...document.querySelectorAll('[role="option"],li[data-value],.dropdown li')].find((x) => vis(x) && x.textContent.toLowerCase().includes(String(v).toLowerCase()));
    if (opt) { opt.click(); return true; } return !!el.value;
  }
  function clickText(words) {
    for (const w of [].concat(words)) {
      const b = [...document.querySelectorAll('button,[role="button"],a,input[type=submit]')].find((x) => vis(x) && (x.textContent || x.value || x.getAttribute("aria-label") || "").trim().toLowerCase() === w);
      if (b) { b.click(); return true; }
    } return false;
  }
  window.__faFill = async function (spec, item, opts = {}) {
    const rep = { filled: [], missed: [], photos: 0, submitted: false };
    const vals = { title: item.title, description: item.description, price: item.price != null ? String(item.price) : "", brand: item.brand, size: item.size, condition: item.condition, category: item.category };
    if (item.photos && item.photos.length) {
      const inp = document.querySelector(spec.photo || 'input[type="file"]');
      if (inp) {
        const dt = new DataTransfer();
        for (const [i, p] of item.photos.entries()) { const b = await (await fetch(p.dataUrl)).blob(); dt.items.add(new File([b], "photo-" + (i + 1) + ".jpg", { type: b.type || "image/jpeg" })); }
        inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); inp.dispatchEvent(new Event("input", { bubbles: true }));
        rep.photos = dt.files.length; await human(opts);
      } else rep.missed.push("photos");
    }
    for (const k of ["title", "description", "price", "brand", "size", "condition", "category"]) {
      if (!vals[k]) continue; const el = find(spec.f[k]);
      if (!el) { rep.missed.push(k); continue; }
      const ok = (el.getAttribute("role") === "combobox" || /brand|size|condition|category|designer/i.test(k) && el.tagName === "INPUT") ? await pickOption(el, vals[k], opts) : setVal(el, vals[k]);
      (ok === false ? rep.missed : rep.filled).push(k); await human(opts);
    }
    if (opts.autoSubmit) { await sleep(opts.fast ? 50 : 1500 + Math.random() * 2000); const [sel, ...w] = spec.submit || []; const b = sel && document.querySelector(sel); if (vis(b)) { b.click(); rep.submitted = true; } else rep.submitted = clickText(w); }
    return rep;
  };
  window.__faDelist = async function (spec, opts = {}) { const done = []; for (const w of spec.delist || []) { await sleep(opts.fast ? 50 : 900 + Math.random() * 900); if (clickText(w)) done.push(w); } return { steps: done }; };
})();
