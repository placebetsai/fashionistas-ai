/* mobile-nav.js — 2026 phone chrome for fashionistas.ai (<900px).
   - Header is position:FIXED (not sticky): sticky silently fails on Android when
     any ancestor clips/scrolls; fixed + a measured spacer always holds.
   - One 5-tab bottom bar, rebuilt for signed-in vs signed-out.
   No intervals, no subtree observers (no repaint loops). */
(function () {
  var MQ = window.matchMedia ? window.matchMedia("(max-width:899px)") : { matches: false };
  var root = document.documentElement;
  var I = {
    home: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
    shop: '<path d="M4.5 8h15l-1.1 11.1a2 2 0 0 1-2 1.9H7.6a2 2 0 0 1-2-1.9z"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    tryon: '<path d="M8.5 3.5 12 5.2l3.5-1.7L20 6.5l-2.2 3.4-1.5-.9V20.5h-8.6V9l-1.5.9L4 6.5z"/>',
    room: '<path d="M4 20V9l8-5 8 5v11"/><rect x="8.5" y="11" width="7" height="5" rx=".8"/>',
    user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>'
  };
  function ic(n) { return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>'; }
  function tab(id, label, icon, href, extra) {
    return '<a class="mt-tab' + (extra || '') + '" data-mt="' + id + '" href="' + href + '">' +
      (extra ? '<span class="mt-fab">' + ic(icon) + '</span>' : ic(icon)) + '<span class="mt-l">' + label + '</span></a>';
  }
  function signedIn() { var a = document.getElementById("view-app"); return !!(a && !a.classList.contains("hidden")); }
  var bar = null, mode = "";
  function build() {
    var want = signedIn() ? "app" : "land";
    if (!bar) {
      bar = document.createElement("nav");
      bar.id = "mtabbar"; bar.setAttribute("aria-label", "Main");
      document.body.appendChild(bar);
      bar.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest("a[data-mt]"); if (!a) return;
        var id = a.getAttribute("data-mt");
        if (id === "l-home") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
        if (id === "l-sell" || id === "l-acct") {
          e.preventDefault();
          try { if (window.authTab) authTab(id === "l-sell" ? "signup" : "login"); } catch (x) {}
          var c = document.querySelector(".land-card"); if (c) c.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }
    if (want === mode) return;
    mode = want;
    bar.innerHTML = want === "app"
      ? tab("home", "Home", "home", "javascript:go('home')") + tab("shop", "Shop", "shop", "javascript:go('shop')") +
        tab("snap", "Sell", "cam", "javascript:go('snap')", " mt-center") + tab("tryon", "Try on", "tryon", "/try-on/") +
        tab("more", "Account", "user", "javascript:go('more')")
      : tab("l-home", "Home", "home", "#") + tab("l-tryon", "Try on", "tryon", "/try-on/") +
        tab("l-sell", "Sell", "cam", "#", " mt-center") + tab("l-room", "Room", "room", "/see-in-space/") +
        tab("l-acct", "Sign in", "user", "#");
    root.classList.toggle("mt-app", want === "app");
    root.classList.toggle("mt-land", want === "land");
    sync(); measure();
  }
  /* highlight the current tab from the app's own nav state */
  function sync() {
    if (!bar || mode !== "app") return;
    var on = document.querySelector("nav.tabbar a.on");
    var v = on ? on.getAttribute("data-v") : "";
    /* current view as an attribute: CSS shows the "What's next" coach bar on Home only */
    var mv = v || "other";
    if (root.getAttribute("data-mtv") !== mv) root.setAttribute("data-mtv", mv);
    var map = { home: "home", shop: "shop", snap: "snap", more: "more" };
    [].forEach.call(bar.querySelectorAll("a[data-mt]"), function (a) {
      var hit = a.getAttribute("data-mt") === map[v];
      a.classList.toggle("on", hit);
      if (hit) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function measure() {
    if (!MQ.matches) return;
    var h = signedIn() ? document.getElementById("topbar") : document.getElementById("land-nav");
    var hh = h ? Math.ceil(h.getBoundingClientRect().height) : 0;
    var tb = bar ? Math.ceil(bar.getBoundingClientRect().height) : 0;
    if (hh) root.style.setProperty("--mh", hh + "px");
    if (tb) root.style.setProperty("--tb", tb + "px");
  }
  function init() {
    build();
    var ro = window.ResizeObserver ? new ResizeObserver(measure) : null;
    ["topbar", "land-nav"].forEach(function (id) { var el = document.getElementById(id); if (el && ro) ro.observe(el); });
    if (ro && bar) ro.observe(bar);
    window.addEventListener("resize", measure, { passive: true });
    /* auth swaps: watch only the class attribute of the two views */
    var mo = new MutationObserver(function () { build(); measure(); });
    ["view-app", "view-auth"].forEach(function (id) { var el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ["class"] }); });
    /* tab highlight follows the app's own tab bar (class changes only) */
    var tb = document.getElementById("tabbar");
    if (tb) new MutationObserver(sync).observe(tb, { attributes: true, subtree: true, attributeFilter: ["class"] });
    /* header shadow once scrolled */
    var last = false;
    window.addEventListener("scroll", function () { var s = window.scrollY > 4; if (s !== last) { last = s; root.classList.toggle("mt-scrolled", s); } }, { passive: true });
  }
  /* menu item: open the seller checklist (lives on Home on phones) */
  window.mtShowNext = function () {
    try { if (window.navDrawer) navDrawer(false); } catch (x) {}
    var open = function () {
      var p = document.getElementById("seller-coach-panel"); if (!p) return;
      p.classList.remove("collapsed");
      var b = p.querySelector(".sc-toggle"); if (b) b.textContent = "\u25BE";
    };
    try { var r = window.go && go("home"); if (r && r.then) r.then(function () { setTimeout(open, 60); }); else setTimeout(open, 60); } catch (x) { open(); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
