/* fashionistas.ai /guide/ — one-tap copy + checklist memory.
   Plain ES5-compatible script, no dependencies, no network calls.
   1. [data-copy="#id"] buttons copy a field with the async Clipboard API,
      falling back to a hidden textarea + execCommand on http/locked contexts.
   2. [data-count-for="#id"] labels show a live "used / max" character count
      so you never blow a platform's title or tag limit before you paste.
   3. input[type=checkbox][data-store] onboarding ticks are remembered in
      localStorage on this device. */
(function () {
  "use strict";

  var FEEDBACK_MS = 1600;
  var STORE_PREFIX = "fa:guide:";

  function fieldText(el) {
    if (!el) return "";
    var t = typeof el.value === "string" ? el.value : (el.innerText || el.textContent || "");
    return String(t).replace(/\u00a0/g, " ").replace(/\s+$/, "");
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return legacyCopy(text)
      ? Promise.resolve()
      : Promise.reject(new Error("clipboard blocked"));
  }

  function feedback(btn, label) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = label;
    btn.classList.add("is-done");
    window.setTimeout(function () {
      btn.textContent = btn.dataset.label;
      btn.classList.remove("is-done");
    }, FEEDBACK_MS);
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("[data-copy]") : null;
    if (!btn) return;
    ev.preventDefault();
    var src = document.querySelector(btn.getAttribute("data-copy"));
    var text = fieldText(src);
    if (!text) { feedback(btn, "Empty field"); return; }
    copyText(text).then(function () {
      feedback(btn, "Copied \u2713");
    }, function () {
      feedback(btn, "Press Ctrl/\u2318+C");
    });
  });

  function runCounters() {
    var nodes = document.querySelectorAll("[data-count-for]");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var src = document.querySelector(n.getAttribute("data-count-for"));
      if (!src) continue;
      var max = parseInt(n.getAttribute("data-max"), 10);
      var len = fieldText(src).length;
      var over = !isNaN(max) && len > max;
      n.textContent = isNaN(max) ? len + " chars" : len + " / " + max + " chars";
      n.classList.toggle("over", over);
    }
  }

  document.addEventListener("input", function (ev) {
    if (ev.target && ev.target.classList && ev.target.classList.contains("copy-val")) runCounters();
  });

  function runChecklist() {
    var boxes = document.querySelectorAll("input[type=checkbox][data-store]");
    if (!boxes.length) return;
    var out = document.getElementById("ck-progress");

    function save() {
      var n = 0;
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) n++;
        try { window.localStorage.setItem(STORE_PREFIX + boxes[i].getAttribute("data-store"), boxes[i].checked ? "1" : "0"); }
        catch (e) { /* private mode: ticks just won't persist */ }
      }
      if (out) out.textContent = n + " of " + boxes.length + " done";
    }

    for (var j = 0; j < boxes.length; j++) {
      var v = null;
      try { v = window.localStorage.getItem(STORE_PREFIX + boxes[j].getAttribute("data-store")); }
      catch (e) { v = null; }
      boxes[j].checked = v === "1";
      boxes[j].addEventListener("change", save);
    }
    save();
  }

  runCounters();
  runChecklist();
})();
