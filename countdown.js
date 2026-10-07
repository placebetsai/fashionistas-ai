/* Launch countdown bar — sits directly under the header (inside the sticky landing header,
   or in normal flow under the sub-page header). Never overlays content. */
(function () {
  var DEADLINE = Date.parse("2026-10-14T09:45:00-04:00");
  if (document.getElementById("lc-bar")) return;
  var land = document.getElementById("land-nav"), sub = document.querySelector("header.topnav");
  if (!land && !sub) return;
  var css = document.createElement("style");
  css.textContent =
    ".lc-bar{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:10px;min-height:38px;padding:6px 14px;box-sizing:border-box;" +
    "font:600 13.5px/1.2 Inter,system-ui,sans-serif;color:#fff;text-align:center;" +
    "background:linear-gradient(95deg,#1a1226,#3a1630 45%,#4a1a1a);border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}" +
    ".lc-dot{width:8px;height:8px;border-radius:50%;background:#48e08b;box-shadow:0 0 10px #48e08b;flex:none;animation:lcPulse 1.8s ease-in-out infinite}" +
    ".lc-bar b{font-variant-numeric:tabular-nums;background:linear-gradient(95deg,#ffb37a,#ff6a4d 45%,#d990ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:800}" +
    ".lc-bar .lc-s{opacity:.75}" +
    "@keyframes lcPulse{50%{opacity:.35}}" +
    "@media (max-width:480px){.lc-bar{font-size:12.5px;min-height:36px;gap:7px}.lc-long{display:none}}" +
    "@media (prefers-reduced-motion:reduce){.lc-dot{animation:none}}" +
    "header.topnav + .lc-bar{margin:0 0 12px;border-radius:12px}";
  document.head.appendChild(css);
  var bar = document.createElement("div");
  bar.id = "lc-bar"; bar.className = "lc-bar"; bar.setAttribute("role", "status"); bar.setAttribute("aria-live", "off");
  bar.innerHTML = '<span class="lc-dot" aria-hidden="true"></span><span class="lc-txt"></span>';
  if (land) land.appendChild(bar); else sub.parentNode.insertBefore(bar, sub.nextSibling);
  var txt = bar.querySelector(".lc-txt"), timer;
  function p(n){ return n < 10 ? "0" + n : "" + n; }
  function tick() {
    var ms = DEADLINE - Date.now();
    if (ms <= 0) { txt.innerHTML = "<b>We're live</b> <span class=\"lc-long\">— fashionistas.ai is open to everyone</span>"; clearInterval(timer); return; }
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    txt.innerHTML = '<span class="lc-long">Public launch in </span><span class="lc-short-l">Launch in </span><b>' + d + "d " + p(h) + "h " + p(m) + "m <span class=\"lc-s\">" + p(sec) + "s</span></b>";
  }
  css.textContent += ".lc-short-l{display:none}@media (max-width:480px){.lc-short-l{display:inline}}";
  tick(); timer = setInterval(tick, 1000);
})();
