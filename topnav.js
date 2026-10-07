/* Shared sub-page header: one row on desktop, hamburger (all links) at <=1100px. Layout only. */
(function () {
  var h = document.querySelector("header.topnav");
  if (!h || h.dataset.tn) return;
  h.dataset.tn = "1";
  var nav = h.querySelector("nav");
  if (!nav) return;
  if (!nav.id) nav.id = "tn-links";
  var css = document.createElement("style");
  css.textContent =
    "header.topnav{position:relative;display:flex;align-items:center;flex-wrap:nowrap;gap:16px}" +
    "header.topnav .brand{white-space:nowrap;flex:none}" +
    "header.topnav nav{display:flex;flex-wrap:nowrap;gap:18px;margin-left:auto;align-items:center}" +
    "header.topnav nav a{white-space:nowrap}" +
    ".tn-burger{display:none;margin-left:auto;width:44px;height:44px;border-radius:11px;place-items:center;border:1px solid var(--line,#e5ddd3);background:var(--soft,#f1ece4);color:var(--ink,#1a1410);cursor:pointer;flex:none}" +
    "@media (max-width:1100px){" +
    ".tn-burger{display:grid}" +
    "header.topnav nav{display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);flex-direction:column;align-items:stretch;gap:2px;padding:7px;background:var(--card,#fff);border:1px solid var(--line,#e5ddd3);border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.12);z-index:80}" +
    "header.topnav nav.open{display:flex}" +
    "header.topnav nav a{display:flex;align-items:center;min-height:44px;padding:0 13px;border-radius:10px;font-size:15px}" +
    "}";
  document.head.appendChild(css);
  var b = document.createElement("button");
  b.type = "button";
  b.className = "tn-burger";
  b.setAttribute("aria-label", "Open the menu");
  b.setAttribute("aria-expanded", "false");
  b.setAttribute("aria-controls", nav.id);
  b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  h.insertBefore(b, nav);
  function set(o) { nav.classList.toggle("open", o); b.setAttribute("aria-expanded", o ? "true" : "false"); }
  b.addEventListener("click", function (e) { e.stopPropagation(); set(!nav.classList.contains("open")); });
  document.addEventListener("click", function (e) { if (!h.contains(e.target)) set(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
})();
