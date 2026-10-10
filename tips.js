/* fashionistas.ai — plain-English hover tips for STATIC pages.
   This is the same engine the app bundle ships (assets/app.*.js, "PLAIN-ENGLISH
   HOVER TIPS"), extracted verbatim so /guide/ and the other hand-written pages
   behave identically instead of inventing a second tooltip system.

   Hover (or keyboard-focus) anything carrying [data-tip] and one short plain
   sentence appears in a fixed bubble appended to <body>, so it can never be
   clipped by a scrolling container. Touch devices have no hover: there the
   same sentence is handed to the native title attribute.

   The #tip-bubble stylesheet lives in /guide/guide.css (and any page that
   includes this file must link it), because the bubble is styled to match each
   page's own design tokens.

   Usage:  <span data-tip="One sentence, no jargon.">term</span>            */
(function () {
  var CAN_HOVER = !!(window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches);
  function nodes(root) {
    var out = [];
    if (!root) return out;
    if (root.nodeType === 1 && root.hasAttribute("data-tip")) out.push(root);
    if (root.querySelectorAll) out = out.concat([].slice.call(root.querySelectorAll("[data-tip]")));
    return out;
  }
  function syncTips(root) {
    nodes(root).forEach(function (el) {
      var tip = el.getAttribute("data-tip");
      if (!tip) return;
      if (!CAN_HOVER) { if (el.getAttribute("title") !== tip) el.setAttribute("title", tip); return; }
      // hover devices get the bubble instead of a second, delayed native one
      if (el.hasAttribute("title")) el.removeAttribute("title");
      if (!el.getAttribute("aria-label") && !(el.textContent || "").trim()) el.setAttribute("aria-label", tip);
    });
  }
  try { window.syncTips = syncTips; } catch (e) {}
  function watch(root) {
    if (!window.MutationObserver) return;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        [].slice.call(m.addedNodes).forEach(function (n) { if (n.nodeType === 1) syncTips(n); });
      });
    }).observe(root, { childList: true, subtree: true });
  }
  syncTips(document);
  watch(document.body || document.documentElement);
  if (!CAN_HOVER) return; // touch: title attributes only, no bubble

  var bubble = null, current = null;
  function ensure() {
    if (!bubble) {
      bubble = document.createElement("div");
      bubble.id = "tip-bubble";
      bubble.setAttribute("role", "tooltip");
      bubble.setAttribute("aria-hidden", "true");
      document.body.appendChild(bubble);
    }
    return bubble;
  }
  function show(el) {
    var text = el.getAttribute("data-tip");
    if (!text) return;
    var b = ensure();
    b.textContent = text;
    b.classList.add("on");
    var r = el.getBoundingClientRect();
    var w = b.offsetWidth, h = b.offsetHeight;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var top = r.top - h - 9;                 // sit above the label, never on it
    if (top < 8) top = r.bottom + 9;         // ...unless there is no room
    var left = r.left + (r.width / 2) - (w / 2);
    left = Math.max(8, Math.min(left, Math.max(8, vw - w - 8)));
    b.style.left = Math.round(left) + "px";
    b.style.top = Math.round(Math.max(8, Math.min(top, Math.max(8, vh - h - 8)))) + "px";
    current = el;
  }
  function hide() { current = null; if (bubble) bubble.classList.remove("on"); }
  // A screen change removes the hovered element without any mouseout, which
  // left the bubble stuck on screen; drop it as soon as its anchor is gone.
  new MutationObserver(function () { if (current && !document.body.contains(current)) hide(); })
    .observe(document.body, { childList: true, subtree: true });
  function target(e) {
    var n = e.target;
    return (n && n.nodeType === 1 && n.closest) ? n.closest("[data-tip]") : null;
  }
  document.addEventListener("mouseover", function (e) {
    var el = target(e);
    if (el) { if (el !== current) show(el); return; }
    if (current && !current.contains(e.target)) hide();
  });
  document.addEventListener("mouseout", function (e) {
    if (current && !current.contains(e.relatedTarget)) hide();
  });
  document.addEventListener("focusin", function (e) { var el = target(e); if (el) show(el); });
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerdown", hide);
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
})();
