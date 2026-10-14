/* fashionistas.ai v2 — one app: Shop / Sell / You. No framework, no build step. */
(function () {
"use strict";
var API = "/w";
var TOKEN = "", USER = null;
try { TOKEN = localStorage.getItem("fash_token") || ""; USER = JSON.parse(localStorage.getItem("fash_user") || "null"); } catch (e) {}
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
var money = function (n) { n = Number(n) || 0; return "$" + (n % 1 ? n.toFixed(2) : n.toFixed(0)); };
var app = $("#app");

/* ---------- icons (inline, 24px stroke) ---------- */
var I = {
  shop: '<svg viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6"/></svg>',
  sell: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  you: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  sort: '<svg viewBox="0 0 24 24"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v13M7 8l5-5 5 5M5 14v6h14v-6"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  hanger: '<svg viewBox="0 0 24 24"><path d="M12 7a2 2 0 1 1 2-2c0 1.2-2 1.8-2 3.5M12 8.5L3 15.5c-.8.6-.4 1.5.5 1.5h17c.9 0 1.3-.9.5-1.5z"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="18" height="18" style="stroke:currentColor;fill:none;stroke-width:2"><path d="M9 6l6 6-6 6"/></svg>',
  out: '<svg viewBox="0 0 24 24" width="18" height="18" style="stroke:currentColor;fill:none;stroke-width:2"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  wand: '<svg viewBox="0 0 24 24"><path d="M4 20L15 9M14 4v2M18 6l-1.5 1.5M20 10h-2M12 8l4 4"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>'
};

/* ---------- marketplaces (extension-posted) ---------- */
var MK = [["ebay","eBay","#e53238"],["poshmark","Poshmark","#7f0353"],["mercari","Mercari","#5356ee"],["depop","Depop","#ff2300"],["facebook","Facebook","#0866ff"],["vinted","Vinted","#007782"],["grailed","Grailed","#111111"],["etsy","Etsy","#f1641e"],["vestiaire","Vestiaire","#1d1d1b"],["kidizen","Kidizen","#00a39a"],["whatnot","Whatnot","#e8b700"],["shopify","Shopify","#5e8e3e"]];
var MKBY = {}; MK.forEach(function (m) { MKBY[m[0]] = m; });
function logo(id, size) {
  var m = MKBY[id] || [id, id, "#111"], L = window.FA_LOGOS || {}, s = size ? ' style="width:' + size + 'px;height:' + size + 'px;border-radius:' + Math.round(size / 4) + 'px"' : "";
  if (id === "fashionistas") return '<span class="lg"' + s + ' style="background:var(--ink);color:var(--bg)">f</span>';
  return '<span class="lg"' + s + ' style="background:' + m[2] + '" aria-hidden="true">' + (L[id] ? '<svg viewBox="0 0 24 24"><path d="' + L[id] + '"/></svg>' : esc(m[1].charAt(0))) + "</span>";
}

/* ---------- brand ---------- */
var LOGO = '<svg class="fmark" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4f8b"/><stop offset=".55" stop-color="#c2410c"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#fg)"/><g fill="#fff"><rect x="20" y="15" width="9" height="34" rx="2.5"/><rect x="20" y="15" width="25" height="9" rx="2.5"/><rect x="20" y="27.5" width="18" height="9" rx="2.5"/></g></svg>';
var BRAND = '<a href="/" class="wordmark brand" data-link aria-label="fashionistas.ai home">' + LOGO + '<span>fashionistas<i>.ai</i></span></a>';
var RMOTION = function () { return !!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches); };
function countUp(root) { $$("[data-count]", root).forEach(function (el) { var to = Number(el.dataset.count) || 0, pre = el.dataset.pre || "", t0 = 0, D = 900; if (RMOTION() || !to) { el.textContent = pre + to; return; } function f(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = pre + Math.round(to * e); if (k < 1) requestAnimationFrame(f); } requestAnimationFrame(f); }); }
var IO = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("shown"); IO.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" }) : null;
function reveal(root) { $$(".rv:not(.shown)", root).forEach(function (el) { if (IO) IO.observe(el); else el.classList.add("shown"); }); }
var LIKES = (function () { try { return JSON.parse(localStorage.getItem("fa_likes") || "{}"); } catch (e) { return {}; } })();
var HEART = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.4 5c2 0 3.3 1.1 4.1 2.3h3C14.3 6.1 15.6 5 17.6 5 21 5 22.7 8.4 21.2 11.4 19 15.6 12 20 12 20z"/></svg>';

/* ---------- api ---------- */
function api(path, opts) {
  opts = opts || {};
  var h = Object.assign({}, opts.form ? {} : { "Content-Type": "application/json" }, opts.headers || {});
  if (TOKEN) h.Authorization = "Bearer " + TOKEN;
  return fetch((opts.base == null ? API : opts.base) + path, { method: opts.method || "GET", headers: h, body: opts.body, credentials: "include" }).then(function (r) {
    return r.text().then(function (t) {
      var d = null; try { d = t ? JSON.parse(t) : {}; } catch (e) { d = {}; }
      if (r.status === 401 && TOKEN && !/\/auth\//.test(path)) { signOut(true); }
      if (!r.ok) { var e = new Error((d && (d.error || d.message)) || ("Something went wrong (" + r.status + ")")); e.status = r.status; e.data = d; throw e; }
      return d;
    });
  });
}
function setSession(d) {
  TOKEN = (d && d.token) || ""; USER = (d && d.user) || null;
  try { if (TOKEN) { localStorage.setItem("fash_token", TOKEN); localStorage.setItem("fash_user", JSON.stringify(USER)); } } catch (e) {}
  extHello();
}
function signOut(expired) {
  TOKEN = ""; USER = null; try { localStorage.removeItem("fash_token"); localStorage.removeItem("fash_user"); } catch (e) {}
  if (expired) toast("Please sign in again");
}

/* ---------- ui helpers ---------- */
var toastT;
function toast(msg, ms) { var t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, ms || 2600); }
function tap() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} }
function sheet(title, body, foot, onClose) {
  closeSheet(true);
  var s = $("#sheet"), sc = $("#scrim");
  s.innerHTML = '<div class="grab"></div><div class="sheet-h"><h3>' + esc(title) + '</h3><button class="iconbtn" data-close aria-label="Close">' + I.close + '</button></div><div class="sheet-b">' + body + "</div>" + (foot ? '<div class="sheet-f">' + foot + "</div>" : "");
  s._onClose = onClose; s.setAttribute("aria-hidden", "false");
  requestAnimationFrame(function () { s.classList.add("on"); sc.classList.add("on"); });
  $("[data-close]", s).onclick = function () { closeSheet(); };
  return s;
}
function closeSheet(silent) { var s = $("#sheet"); if (!s.classList.contains("on")) return; s.classList.remove("on"); $("#scrim").classList.remove("on"); s.setAttribute("aria-hidden", "true"); if (!silent && s._onClose) s._onClose(); }
function topbar(opts) {
  return '<header class="top"><div class="top-row">' + (opts.back ? '<button class="iconbtn" data-back aria-label="Back">' + I.back + "</button>" : "") +
    (opts.wordmark ? BRAND : '<h1>' + esc(opts.title || "") + "</h1>") + (opts.right || "") + "</div>" + (opts.below || "") + "</header>";
}
function emptyState(icon, h, p, cta) { return '<div class="empty">' + icon + "<h2>" + esc(h) + "</h2><p>" + esc(p) + "</p>" + (cta || "") + "</div>"; }
function skelGrid(n) { var h = ""; for (var i = 0; i < (n || 6); i++) h += '<div><div class="sk" style="aspect-ratio:4/5"></div><div class="sk sk-line"></div><div class="sk sk-line" style="width:40%"></div></div>'; return '<div class="grid">' + h + "</div>"; }
function imgLoaded(root) { $$("img[data-fade]", root).forEach(function (im) { if (im.complete && im.naturalWidth) im.classList.add("ld"); else { im.onload = function () { im.classList.add("ld"); }; im.onerror = function () { im.classList.add("ld"); im.style.opacity = 0; }; } }); }
function mountAds() { try { window.fashMountAds && window.fashMountAds(); } catch (e) {} }
function photosOf(l) { var a = []; if (Array.isArray(l.photos)) a = l.photos.slice(); if (l.photo_url && a.indexOf(l.photo_url) < 0) a.unshift(l.photo_url); return a.filter(Boolean); }
function catLabel(p) { return String(p || "").split("/").pop(); }
function setMeta(title, desc) { document.title = title ? title + " · fashionistas.ai" : "fashionistas.ai — Shop secondhand fashion"; var m = $('meta[name="description"]'); if (m && desc) m.setAttribute("content", desc); }

/* ---------- router ---------- */
var ROUTES = [];
function route(re, fn) { ROUTES.push([re, fn]); }
function nav(path, replace) { if (path === location.pathname + location.search && !replace) { render(); return; } history[replace ? "replaceState" : "pushState"]({}, "", path); render(); window.scrollTo(0, 0); }
function render() {
  closeSheet(true); clearInterval(window.__dmT);
  var p = location.pathname.replace(/\/+$/, "") || "/";
  for (var i = 0; i < ROUTES.length; i++) { var m = p.match(ROUTES[i][0]); if (m) { ROUTES[i][1].apply(null, m.slice(1)); tabs(); return; } }
  app.innerHTML = topbar({ wordmark: true }) + emptyState(I.alert, "Page not found", "That page doesn't exist anymore.", '<a class="btn" href="/" data-link>Go to Shop</a>');
  tabs();
}
function tabs() {
  var p = location.pathname, cur = /^\/(sell)/.test(p) ? "sell" : /^\/(you|signin|u\/)/.test(p) && !/^\/u\//.test(p) ? "you" : /^\/you/.test(p) ? "you" : "shop";
  var T = $("#tabs"), idx = cur === "shop" ? 0 : cur === "sell" ? 1 : 2; T.style.setProperty("--ti", idx);
  if (T.firstChild && !T.querySelector(".ind")) T.innerHTML = "";
  T.innerHTML = '<span class="ind" aria-hidden="true"></span><div class="tabs-in">' +
    '<a href="/" data-link class="tab' + (cur === "shop" ? " on" : "") + '"' + (cur === "shop" ? ' aria-current="page"' : "") + ">" + I.shop + "Shop</a>" +
    '<a href="/sell" data-link class="tab' + (cur === "sell" ? " on" : "") + '"><span class="sellic">' + I.sell + "</span>Sell</a>" +
    '<a href="/you" data-link class="tab' + (cur === "you" ? " on" : "") + '">' + I.you + "You" + (UNREAD ? '<span class="dot" style="top:4px;right:calc(50% - 22px)">' + UNREAD + "</span>" : "") + "</a></div>";
}
document.addEventListener("click", function (e) {
  var lk = e.target.closest(".like"); if (lk) { e.preventDefault(); e.stopPropagation(); tap(); var k = lk.dataset.like; if (LIKES[k]) delete LIKES[k]; else LIKES[k] = 1; lk.classList.toggle("on", !!LIKES[k]); lk.setAttribute("aria-pressed", !!LIKES[k]); lk.classList.remove("pulse"); void lk.offsetWidth; if (LIKES[k]) lk.classList.add("pulse"); try { localStorage.setItem("fa_likes", JSON.stringify(LIKES)); } catch (x) {} return; }
  var a = e.target.closest("a[data-link]");
  if (a && !e.metaKey && !e.ctrlKey && a.origin === location.origin) { e.preventDefault(); tap(); nav(a.getAttribute("href")); return; }
  if (e.target.closest("[data-back]")) { e.preventDefault(); if (history.length > 1 && document.referrer.indexOf(location.host) >= 0 || window.__navd) history.back(); else nav("/"); }
});
window.addEventListener("popstate", render);
$("#scrim").onclick = function () { closeSheet(); };
addEventListener("scroll", function () { var t = $(".top"); if (t) t.classList.toggle("scrolled", scrollY > 4); var h = innerHeight; $$(".rv:not(.shown)").forEach(function (el) { if (el.getBoundingClientRect().top < h) el.classList.add("shown"); }); }, { passive: true });
var _ps = history.pushState; history.pushState = function () { window.__navd = true; return _ps.apply(history, arguments); };

/* ================= SHOP ================= */
var MARKET = null, MARKET_AT = 0;
function loadMarket(force) {
  if (MARKET && !force && Date.now() - MARKET_AT < 60000) return Promise.resolve(MARKET);
  if (window.__FASH_MARKET__ && !force) { var b = window.__FASH_MARKET__; window.__FASH_MARKET__ = null; MARKET = (b.market || []); MARKET_AT = Date.now(); return Promise.resolve(MARKET); }
  return api("/api/market?limit=500").then(function (d) { MARKET = (d.market || []).filter(function (x) { return x.status !== "deleted"; }); MARKET_AT = Date.now(); return MARKET; });
}
/* Feed quality: the public feed only shows real fashion listings. Nothing is deleted —
   test items, non-clothing and junk stay in the DB and on direct links, just not in the feed. */
var JUNK = /(\be2e\b|\btest listing\b|delete me|\bcoffee\b|\bkeurig\b|\bmug\b|\bcup lid\b|\blid\b|\bappliance|\bmaker\b|\btoaster\b|\bblender\b|\bcharger\b)/i;
function feedOK(x) { if (!x || x.status === "deleted" || x.status === "draft") return false; if (JUNK.test(String(x.title || "") + " " + String(x.description || ""))) return false; var d = String(x.category || "").split("/")[0]; if (!d) return false; var deps = (window.FASH_CAT && FASH_CAT.departments) || []; if (deps.length && deps.indexOf(d) < 0) return false; if (d === "Home" || d === "Art") return false; return !!x.photo_url; }
function feed(list) { return (list || []).filter(feedOK); }
var CONDS = ["New with tags", "Excellent", "Good", "Fair"];
var CONDLBL = { "New with tags": "New with tags", "Excellent": "Like new", "Good": "Good", "Fair": "Fair" };
var SORTS = [["newest", "Newest"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["az", "A–Z"], ["popular", "Most popular"]];
var COLORS = { black: "#111", white: "#fff", grey: "#9e9e9e", gray: "#9e9e9e", blue: "#2f5fd0", navy: "#1f2a44", red: "#d32f2f", pink: "#f48fb1", green: "#388e3c", yellow: "#fbc02d", orange: "#f57c00", purple: "#7b1fa2", brown: "#795548", beige: "#e8d9bf", cream: "#f3ead6", gold: "#c9a227", silver: "#c0c0c0", multi: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" };
function slug(s) { return String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function readF() {
  var q = new URLSearchParams(location.search), arr = function (k) { var v = q.get(k); return v ? v.split(",") : []; };
  return { q: q.get("q") || "", sort: q.get("sort") || "newest", brand: arr("brand"), size: arr("size"), color: arr("color"), cond: arr("cond"), dept: arr("dept"), min: q.get("min") || "", max: q.get("max") || "" };
}
function writeF(F, base) {
  var q = new URLSearchParams();
  if (F.q) q.set("q", F.q); if (F.sort && F.sort !== "newest") q.set("sort", F.sort);
  ["brand", "size", "color", "cond", "dept"].forEach(function (k) { if (F[k].length) q.set(k, F[k].join(",")); });
  if (F.min) q.set("min", F.min); if (F.max) q.set("max", F.max);
  var s = q.toString(); return (base || "/") + (s ? "?" + s : "");
}
function colorKey(c) { c = String(c || "").toLowerCase(); for (var k in COLORS) if (c.indexOf(k) >= 0) return k === "gray" ? "grey" : k; return c ? "multi" : ""; }
function brandOf(x) { return String(x.brand || "").trim(); }
function apply(list, F, cat) {
  var q = F.q.toLowerCase().trim(), words = q ? q.split(/\s+/) : [];
  var r = list.filter(function (x) {
    if (x.status && x.status !== "active" && x.status !== "reserved") return false;
    if (cat && String(x.category || "").indexOf(cat) !== 0) return false;
    if (words.length) { var hay = [x.title, x.brand, x.category, x.color, x.material, x.size, x.description].join(" ").toLowerCase(); for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i].replace(/s$/, "")) < 0) return false; }
    if (F.brand.length && F.brand.indexOf(brandOf(x)) < 0) return false;
    if (F.size.length && F.size.indexOf(String(x.size || "")) < 0) return false;
    if (F.color.length && F.color.indexOf(colorKey(x.color)) < 0) return false;
    if (F.cond.length && F.cond.indexOf(x.condition) < 0) return false;
    if (F.dept.length && F.dept.indexOf(String(x.category || "").split("/")[0]) < 0) return false;
    if (F.min && Number(x.price) < Number(F.min)) return false;
    if (F.max && Number(x.price) > Number(F.max)) return false;
    return true;
  });
  var by = { newest: function (a, b) { return String(b.listed_at || "").localeCompare(String(a.listed_at || "")) || b.id - a.id; }, price_asc: function (a, b) { return a.price - b.price; }, price_desc: function (a, b) { return b.price - a.price; }, az: function (a, b) { return String(a.title).localeCompare(String(b.title)); }, popular: function (a, b) { return (Number(b.views || b.view_count || b.likes || 0) - Number(a.views || a.view_count || a.likes || 0)) || b.id - a.id; } };
  return r.sort(by[F.sort] || by.newest);
}
function nActive(F) { return F.brand.length + F.size.length + F.color.length + F.cond.length + F.dept.length + (F.min || F.max ? 1 : 0); }
function cardHTML(x, i) {
  var b = brandOf(x);
  return '<a class="card" href="/shop/' + x.id + '" data-link style="animation-delay:' + Math.min(i || 0, 12) * 45 + 'ms"><div class="ph">' + '<button type="button" class="like' + (LIKES[x.id] ? ' on' : '') + '" data-like="' + x.id + '" aria-label="Save ' + esc(x.title) + '" aria-pressed="' + !!LIKES[x.id] + '">' + HEART + '</button>' + (x.photo_url ? '<img data-fade src="' + esc(x.photo_url) + '" alt="' + esc(x.title) + '" loading="' + (i < 4 ? "eager" : "lazy") + '" decoding="async">' : "") + (x.status === "reserved" ? '<span class="badge">Reserved</span>' : "") + '</div><div class="meta"><div class="pr">' + money(x.price) + "</div>" + (b ? '<div class="br">' + esc(b) + "</div>" : "") + '<div class="tl">' + esc(x.title) + "</div>" + (x.size ? '<div class="sz">' + esc(x.size) + (x.condition ? " · " + esc(CONDLBL[x.condition] || x.condition) : "") + "</div>" : "") + "</div></a>";
}
function shopView(catSlug) {
  var F = readF(), base = location.pathname, cat = "";
  var cm = location.pathname.match(/^\/shop\/c\/([^/]+)(?:\/([^/]+))?/), bm = location.pathname.match(/^\/shop\/b\/([^/]+)/);
  if (cm && window.FASH_CAT) { var dep = (FASH_CAT.departments || []).find(function (d) { return slug(d) === cm[1]; }); if (dep) { cat = dep; if (cm[2]) { var hit = (FASH_CAT.categories || []).find(function (c) { return c.dept === dep && slug(c.sub) === cm[2]; }); if (hit) cat = hit.path; } } }
  if (bm && !F.q) F.q = window.__FASH_Q__ || decodeURIComponent(bm[1]).replace(/-/g, " ");
  setMeta(cat ? catLabel(cat) + (cat.indexOf("/") > 0 ? " — " + cat.split("/")[0] : "") : (F.q ? F.q : ""), "Shop secondhand fashion from real sellers on fashionistas.ai.");
  var n = nActive(F), isHome = !F.q && !cat && !n && F.sort === "newest" && /^\/(shop)?$/.test(location.pathname);
  app.innerHTML = '<div class="view' + (isHome ? " home" : "") + '">' + topbar({ wordmark: !F.q && !cat, title: cat ? catLabel(cat) : "", back: !!cat, right: "",
    below: '<form class="top-row" id="sf" role="search" style="margin-top:4px"><label class="search"><span class="sr">Search</span>' + I.search + '<input id="q" type="search" enterkeyhint="search" placeholder="Search brands, items, styles" value="' + esc(F.q) + '" autocomplete="off">' + (F.q ? '<button type="button" class="clr" id="qx" aria-label="Clear search">×</button>' : "") + "</label></form>" }) +
    (isHome ? homeTop() + '<div class="sec-h" id="drops" style="padding-top:8px"><h2>Fresh drops</h2></div>' : "") + '<div class="chips" id="fchips"><button class="chip' + (n ? " on" : "") + '" id="fopen">' + I.filter + "Filter" + (n ? " · " + n : "") + '</button><button class="chip" id="sopen">' + I.sort + esc((SORTS.find(function (s) { return s[0] === F.sort; }) || SORTS[0])[1]) + "</button>" + quickChips(F) + "</div>" +
    '<div class="bar"><span id="count">&nbsp;</span>' + (n || F.q ? '<button class="linkbtn" id="clearall">Clear all</button>' : "") + "</div>" +
    '<div id="feed">' + skelGrid(6) + "</div>" + (isHome ? '<div id="homeb"></div>' : "") + footer() + "</div>";
  if (isHome) { reveal(app); var sn = $("#shopnow"); if (sn) sn.onclick = function (e) { e.preventDefault(); var d = $("#drops"); if (d) d.scrollIntoView({ behavior: RMOTION() ? "auto" : "smooth" }); }; }
  var go = function (F2) { nav(writeF(F2, base), true); };
  $("#sf").onsubmit = function (e) { e.preventDefault(); var v = $("#q").value.trim(); $("#q").blur(); F.q = v; go(F); };
  if ($("#qx")) $("#qx").onclick = function () { F.q = ""; go(F); };
  $("#fopen").onclick = function () { filterSheet(F, cat, go); };
  $("#sopen").onclick = function () { sortSheet(F, go); };
  if ($("#clearall")) $("#clearall").onclick = function () { go({ q: "", sort: F.sort, brand: [], size: [], color: [], cond: [], dept: [], min: "", max: "" }); };
  $$("[data-qc]").forEach(function (b) { b.onclick = function () { tap(); var k = b.dataset.qc, v = b.dataset.v, a = F[k], i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); go(F); }; });
  loadMarket().then(function (all) {
    var list = feed(all), r = apply(list, F, cat), feed_ = $("#feed"), feedEl = feed_; if (!feedEl) return; var feed2 = feedEl;
    $("#count").textContent = r.length + (r.length === 1 ? " item" : " items");
    if (!r.length) {
      feed2.innerHTML = list.length ? emptyState(I.search, "No matches", F.q ? "Nothing for “" + F.q + "” with these filters. Try fewer filters or another word." : "Nothing matches these filters yet.", '<button class="btn sec" id="reset">Clear filters</button>') : emptyState(I.hanger, "Nothing for sale yet", "Be the first — list something in under a minute.", '<a class="btn" href="/sell" data-link>Sell an item</a>');
      if ($("#reset")) $("#reset").onclick = function () { nav(base, true); };
      if (isHome && $("#homeb")) { $("#homeb").innerHTML = homeBottom(all); reveal($("#homeb")); }
      return;
    }
    var h = "";
    r.forEach(function (x, i) { h += cardHTML(x, i); });
    feed2.innerHTML = '<div class="grid">' + h + "</div>" + (r.length >= 6 ? '<div class="ad"><div class="ad-label">Advertisement</div><div data-ad-slot="inContent"></div></div>' : "");
    imgLoaded(feed2); reveal(feed2); mountAds();
    if (isHome && $("#homeb")) { $("#homeb").innerHTML = homeBottom(all); reveal($("#homeb")); }
  }).catch(function () {
    var fe = $("#feed"); if (fe) fe.innerHTML = emptyState(I.alert, "Couldn't load the shop", "Check your connection and try again.", '<button class="btn" id="retry">Try again</button>');
    if ($("#retry")) $("#retry").onclick = function () { MARKET = null; render(); };
  });
}

/* ================= HOME (editorial layer) ================= */
var CATS = [["Women", "/shop/c/women", "women"], ["Men", "/shop/c/men", "men"], ["Shoes", "/?q=shoes", "shoes"], ["Bags", "/shop/c/women/bags-and-handbags", "bags"], ["Vintage", "/?q=vintage", "vintage"], ["Streetwear", "/?q=streetwear", "streetwear"], ["Designer", "/?q=designer", "designer"]];
var BRANDS = ["Levi's", "Nike", "Zara", "Versace", "Adidas", "Coach", "Ralph Lauren", "Carhartt", "Free People", "Gucci"];
function pic(name, alt, cls, eager, sizes) { return '<picture class="' + (cls || "") + '"><source type="image/avif" srcset="/assets/ed/' + name + '.avif"><img src="/assets/ed/' + name + '.webp" alt="' + esc(alt || "") + '" ' + (eager ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async"></picture>'; }
function homeTop() {
  return '<section class="hero" aria-label="fashionistas.ai">' + pic("hero", "Model in an olive utility jacket", "hero-img", true) + '<div class="hero-shade"></div>' +
    '<div class="hero-copy"><p class="kick"><span class="pulse-dot"></span>Secondhand fashion · free to buy & sell</p><h1 class="kinetic"><span class="k-line">Thrift it.</span><span class="k-line">Style it.</span><span class="k-line k-rot"><span class="k-w">Sell it.</span><span class="k-w">Try it on.</span><span class="k-w">Love it.</span></span></h1>' +
    '<div class="hero-cta"><a class="btn hero-btn" href="#drops" id="shopnow">Shop drops</a><a class="btn glass" href="/sell" data-link>Sell in 30s</a></div></div></section>' +
    '<section class="hsec rv"><div class="sec-h"><h2>Shop by category</h2></div><div class="cats">' + CATS.map(function (c, i) { return '<a class="cat" href="' + c[1] + '" data-link style="--d:' + i * 60 + 'ms">' + pic(c[2], c[0]) + '<span class="cat-shade"></span><b>' + c[0] + '</b><span class="cat-go" aria-hidden="true">' + I.chev + "</span></a>"; }).join("") + "</div></section>";
}
function homeBottom(list) {
  var real = uniq(feed(list).map(brandOf)), br = uniq(real.concat(BRANDS)).slice(0, 12);
  var mks = MK.filter(function (m) { return EXT_SITES.indexOf(m[0]) >= 0; });
  return '<section class="hsec rv"><a class="feat feat-try" href="/try-on/">' + pic("tryon", "Woman posing in a black outfit") + '<span class="feat-shade"></span><span class="scan" aria-hidden="true"></span><span class="spark s1" aria-hidden="true"></span><span class="spark s2" aria-hidden="true"></span><span class="feat-copy"><small>Virtual try-on · free</small><b>See it on you<br>before you buy.</b><span class="pillbtn">Try it on ' + I.chev + "</span></span></a></section>" +
    '<section class="hsec rv"><div class="sec-h"><h2>Shop by brand</h2></div><div class="brands">' + br.map(function (b, i) { return '<a class="brandchip" href="/shop/b/' + slug(b) + '" data-link style="--d:' + i * 40 + 'ms"><span>' + esc(b.charAt(0)) + "</span>" + esc(b) + "</a>"; }).join("") + "</div></section>" +
    '<section class="hsec rv"><a class="feat feat-sell" href="/sell" data-link>' + pic("sell", "Clothes on a rack") + '<span class="feat-shade"></span><span class="feat-copy"><small>For sellers</small><b>Sell in 30 seconds.</b><span class="steps3"><i><em>1</em>Snap</i><i><em>2</em>AI drafts</i><i><em>3</em>Post everywhere</i></span><span class="pillbtn">Start selling ' + I.chev + "</span></span></a></section>" +
    '<section class="hsec rv"><div class="sec-h"><h2>One listing. Every marketplace.</h2></div><div class="marq" aria-label="Marketplaces you can crosspost to"><div class="marq-in">' + mks.concat(mks).map(function (m, i) { return '<span class="mq"' + (i >= mks.length ? ' aria-hidden="true"' : "") + ">" + logo(m[0]) + esc(m[1]) + "</span>"; }).join("") + '</div></div><p class="sub" style="padding:0 16px;margin:8px 0 0;font-size:13px">With our free Chrome extension, using the accounts you\'re already signed into.</p></section>';
}
function quickChips(F) {
  var h = "";
  ["dept", "brand", "size", "color", "cond"].forEach(function (k) { F[k].forEach(function (v) { h += '<button class="chip on" data-qc="' + k + '" data-v="' + esc(v) + '">' + esc(k === "cond" ? CONDLBL[v] || v : k === "color" ? v.charAt(0).toUpperCase() + v.slice(1) : v) + '<span class="x" aria-label="remove">×</span></button>'; }); });
  if (!h && window.FASH_CAT) (FASH_CAT.departments || []).slice(0, 4).forEach(function (d) { h += '<button class="chip" data-qc="dept" data-v="' + esc(d) + '">' + esc(d) + "</button>"; });
  return h;
}
function uniq(a) { var o = {}, r = []; a.forEach(function (v) { if (v && !o[v]) { o[v] = 1; r.push(v); } }); return r; }
function filterSheet(F0, cat, go) {
  var F = JSON.parse(JSON.stringify(F0)), list = feed(MARKET || []);
  var live = list.filter(function (x) { return !cat || String(x.category || "").indexOf(cat) === 0; });
  var brands = uniq(live.map(brandOf)).sort(), sizes = uniq(live.map(function (x) { return String(x.size || ""); })).sort(), colors = uniq(live.map(function (x) { return colorKey(x.color); })), depts = uniq(live.map(function (x) { return String(x.category || "").split("/")[0]; }));
  function grp(k, title, vals, lab) {
    if (!vals.length) return "";
    return '<div class="fsec"><h4>' + title + '</h4><div class="wrap">' + vals.map(function (v) { return '<button class="chip' + (F[k].indexOf(v) >= 0 ? " on" : "") + '" data-k="' + k + '" data-v="' + esc(v) + '">' + (lab ? lab(v) : esc(v)) + "</button>"; }).join("") + "</div></div>";
  }
  function body() {
    return grp("dept", "Category", depts) + grp("brand", "Brand", brands) + grp("size", "Size", sizes) +
      grp("color", "Color", colors, function (v) { return '<span class="sw" style="background:' + COLORS[v] + '"></span>' + esc(v.charAt(0).toUpperCase() + v.slice(1)); }) +
      grp("cond", "Condition", CONDS.filter(function (c) { return live.some(function (x) { return x.condition === c; }) || F.cond.indexOf(c) >= 0; }), function (v) { return esc(CONDLBL[v]); }) +
      '<div class="fsec"><h4>Price</h4><div class="prow"><label class="pre" style="flex:1"><b>$</b><input class="in" inputmode="numeric" id="fmin" placeholder="Min" value="' + esc(F.min) + '" aria-label="Minimum price"></label><span style="color:var(--ink3)">–</span><label class="pre" style="flex:1"><b>$</b><input class="in" inputmode="numeric" id="fmax" placeholder="Max" value="' + esc(F.max) + '" aria-label="Maximum price"></label></div></div>';
  }
  var cnt = function () { return apply(list, F, cat).length; };
  var foot = function () { return '<button class="btn ghost" id="fclr" style="flex:0 0 auto">Clear</button><button class="btn" id="fgo" style="flex:1">Show ' + cnt() + " result" + (cnt() === 1 ? "" : "s") + "</button>"; };
  var s = sheet("Filter", body(), foot());
  function wire() {
    $$("[data-k]", s).forEach(function (b) { b.onclick = function () { tap(); var a = F[b.dataset.k], i = a.indexOf(b.dataset.v); if (i >= 0) a.splice(i, 1); else a.push(b.dataset.v); b.classList.toggle("on"); upd(); }; });
    ["fmin", "fmax"].forEach(function (id) { $("#" + id, s).oninput = function (e) { F[id === "fmin" ? "min" : "max"] = e.target.value.replace(/[^0-9.]/g, ""); upd(); }; });
    $("#fclr", s).onclick = function () { F.brand = []; F.size = []; F.color = []; F.cond = []; F.dept = []; F.min = F.max = ""; $(".sheet-b", s).innerHTML = body(); upd(); wire(); };
    $("#fgo", s).onclick = function () { closeSheet(true); go(F); };
  }
  function upd() { var n = cnt(); $("#fgo", s).textContent = "Show " + n + " result" + (n === 1 ? "" : "s"); }
  wire();
}
function sortSheet(F, go) {
  var s = sheet("Sort by", '<div class="menu" style="margin:0 -16px;border-top:0">' + SORTS.map(function (o) { return '<button data-s="' + o[0] + '">' + esc(o[1]) + (F.sort === o[0] ? '<span style="color:var(--ink)">' + I.check.replace("<svg", '<svg width="20" height="20" style="stroke:currentColor;fill:none;stroke-width:2.4"') + "</span>" : "") + "</button>"; }).join("") + "</div>");
  $$("[data-s]", s).forEach(function (b) { b.onclick = function () { tap(); F.sort = b.dataset.s; closeSheet(true); go(F); }; });
}
function footer() {
  return '<footer class="foot"><nav><a href="/about/">About</a><a href="/blog/">Style guide</a><a href="/price-guide/">Price guide</a><a href="/try-on/">Virtual try-on</a><a href="/seller/get-extension/">Crosslister</a><a href="/contact/">Contact</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/credits/">Image credits</a></nav>© ' + new Date().getFullYear() + " fashionistas.ai · Free to buy and sell. Supported by ads and affiliate links.</footer>";
}
route(/^\/$/, function () { shopView(""); });
route(/^\/shop$/, function () { shopView(""); });
route(/^\/shop\/[cb]\/.+$/, function () { shopView("x"); });

/* ================= ITEM ================= */
function findItem(id) {
  return loadMarket().then(function (list) {
    var x = list.find(function (y) { return Number(y.id) === Number(id); });
    if (x) return x;
    return api("/api/market/" + id).then(function (d) { return d.listing || d.item || (d.id ? d : null); }).catch(function () { return null; });
  });
}
function itemView(id) {
  app.innerHTML = '<div class="view"><div class="gal-wrap"><div class="sk" style="aspect-ratio:4/5;border-radius:0"></div><div class="floatbar"><button class="iconbtn" data-back aria-label="Back">' + I.back + '</button></div></div><div class="item"><div class="sk sk-line" style="width:30%"></div><div class="sk" style="height:24px;margin-top:12px;width:80%"></div><div class="sk" style="height:32px;margin-top:12px;width:30%"></div></div></div>';
  findItem(id).then(function (x) {
    if (!x) { app.innerHTML = topbar({ back: true, title: "" }) + emptyState(I.hanger, "This item is gone", "It sold or the seller took it down.", '<a class="btn" href="/" data-link>Keep shopping</a>'); return; }
    var ph = photosOf(x), b = brandOf(x), s = x.seller || {}, sname = s.display_name || s.username || "Seller", mine = USER && s.id && Number(USER.id) === Number(s.id);
    setMeta(x.title + " — " + money(x.price), (b ? b + " " : "") + x.title + ", size " + (x.size || "n/a") + ". " + money(x.price) + " on fashionistas.ai.");
    var sold = x.status === "sold";
    app.innerHTML = '<div class="view"><div class="gal-wrap"><div class="gal" id="gal">' + (ph.length ? ph.map(function (u, i) { return '<img src="' + esc(u) + '" alt="' + esc(x.title) + (i ? " photo " + (i + 1) : "") + '"' + (i ? ' loading="lazy"' : "") + ">"; }).join("") : '<div style="aspect-ratio:4/5;width:100%"></div>') + "</div>" +
      (ph.length > 1 ? '<div class="gal-dots">' + ph.map(function (_, i) { return "<i" + (i ? "" : ' class="on"') + "></i>"; }).join("") + '</div><span class="gal-n">1/' + ph.length + "</span>" : "") +
      '<div class="floatbar"><button class="iconbtn" data-back aria-label="Back">' + I.back + '</button><button class="iconbtn" id="share" aria-label="Share">' + I.share + "</button></div></div>" +
      '<div class="item">' + (b ? '<div class="br">' + esc(b) + "</div>" : "") + "<h1>" + esc(x.title) + '</h1><div class="price">' + money(x.price) + "</div>" +
      (x.status === "reserved" ? '<p class="pill" style="margin-top:8px">Reserved</p>' : sold ? '<p class="pill sold" style="margin-top:8px">Sold</p>' : "") +
      '<dl class="specs">' + [["Size", x.size], ["Condition", CONDLBL[x.condition] || x.condition], ["Color", x.color], ["Material", x.material], ["Category", x.category ? String(x.category).replace(/\//g, " › ") : ""], ["Ships from", [x.ship_city, x.ship_country].filter(Boolean).join(", ") || (x.local_pickup ? "Local pickup" : "")]].filter(function (r) { return r[1]; }).map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("") + "</dl>" +
      (x.description ? '<p class="desc">' + esc(x.description) + "</p>" : "") +
      '<a class="seller" href="/u/' + encodeURIComponent(s.username || s.id || "") + '" data-link><span class="av">' + esc(sname.charAt(0)) + "</span><span><b>" + esc(sname) + "</b><small>See all their items</small></span><span class=\"chev\">" + I.chev + "</span></a>" +
      '<div class="outlinks" id="out"></div>' +
      (!mine && !sold ? '<a class="outlink" id="tryon" href="/try-on/?id=' + x.id + "&item=" + encodeURIComponent(x.photo_url || "") + "&title=" + encodeURIComponent(x.title || "") + '">' + '<span class="lg" style="background:var(--bg2);color:var(--ink)">' + I.wand.replace("<svg", '<svg style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8"') + "</span><span>Try it on<small>See it on your own photo · free</small></span><span class=\"chev\">" + I.chev + "</span></a>" : "") +
      '<div class="ad"><div class="ad-label">Advertisement</div><div data-ad-slot="bottom"></div></div><div id="more"></div><div style="height:72px"></div></div>' +
      '<div class="buybar"><div class="buybar-in">' + (mine ? '<a class="btn sec" href="/you/item/' + x.id + '" data-link>Manage listing</a>' : sold ? '<a class="btn sec" href="/" data-link>Shop similar</a>' : '<button class="btn sec" id="msg">' + I.chat + 'Message</button><button class="btn" id="buy"' + (x.status === "reserved" ? " disabled" : "") + ">" + (x.status === "reserved" ? "Reserved" : "Buy now") + "</button>") + "</div></div></div>";
    if (ph.length < 2) fetch("/api/listing-photos/" + x.id).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var more = ((d && d.photos) || []).filter(function (u) { return ph.indexOf(u) < 0; }); if (!more.length || !$("#gal")) return; ph = ph.concat(more).slice(0, 10);
      $("#gal").innerHTML = ph.map(function (u, i) { return '<img src="' + esc(u) + '" alt="' + esc(x.title) + (i ? " photo " + (i + 1) : "") + '"' + (i ? ' loading="lazy"' : "") + ">"; }).join("");
      $(".gal-wrap").insertAdjacentHTML("beforeend", '<div class="gal-dots">' + ph.map(function (_, i) { return "<i" + (i ? "" : ' class="on"') + "></i>"; }).join("") + '</div><span class="gal-n">1/' + ph.length + "</span>"); wireGal();
    }).catch(function () {});
    function wireGal() { var g = $("#gal"); if (!g || ph.length < 2) return; g.addEventListener("scroll", function () { var i = Math.round(g.scrollLeft / g.clientWidth); $$(".gal-dots i").forEach(function (d, j) { d.classList.toggle("on", i === j); }); var n = $(".gal-n"); if (n) n.textContent = (i + 1) + "/" + ph.length; }, { passive: true }); }
    var g = $("#gal"); if (false && g && ph.length > 1) g.addEventListener("scroll", function () { var i = Math.round(g.scrollLeft / g.clientWidth); $$(".gal-dots i").forEach(function (d, j) { d.classList.toggle("on", i === j); }); }, { passive: true });
    wireGal();
    $("#share").onclick = function () { var u = location.origin + "/shop/" + x.id; if (navigator.share) navigator.share({ title: x.title, url: u }).catch(function () {}); else { Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(u)).then(function () { toast("Link copied"); }, function () { toast(u, 4000); }); } };
    if ($("#msg")) $("#msg").onclick = function () { tap(); needAuth("message " + sname, function () { nav("/you/messages/" + s.id + "?item=" + x.id); }); };
    if ($("#buy")) $("#buy").onclick = function () { tap(); buySheet(x); };
    fetch("/api/crosslist/links?id=" + x.id).then(function (r) { return r.json(); }).then(function (d) {
      var L = (d && d.links) || [], o = $("#out"); if (!o || !L.length || mine) return;
      o.innerHTML = L.map(function (l) { var m = MKBY[l.platform] || [l.platform, l.platform]; return '<a class="outlink" href="' + esc(l.url) + '" target="_blank" rel="noopener sponsored nofollow">' + logo(l.platform) + "<span>Also on " + esc(m[1]) + "<small>Buy it there instead</small></span><span class=\"chev\">" + I.out + "</span></a>"; }).join("");
    }).catch(function () {});
    var more = feed(MARKET || []).filter(function (y) { return y.id !== x.id && (y.status === "active") && ((y.seller || {}).id === s.id || String(y.category).split("/")[0] === String(x.category).split("/")[0]); }).slice(0, 4);
    if (more.length) $("#more").innerHTML = '<h3 style="font-size:16px;margin:24px 0 12px">You might also like</h3><div class="grid" style="padding:0;margin:0 -8px;padding:0 8px">' + more.map(cardHTML).join("") + "</div>";
    imgLoaded(app); mountAds();
  });
}
function buySheet(x) {
  var sname = (x.seller && (x.seller.display_name || x.seller.username)) || "the seller";
  var s = sheet("Buy now", '<div class="card-row" style="margin:0 0 16px"><img src="' + esc(x.photo_url || "") + '" alt=""><div><b>' + esc(x.title) + "</b><small>" + money(x.price) + " · from " + esc(sname) + '</small></div></div><p style="margin:0 0 8px;font-size:14px">Reserve it now — no payment yet. ' + esc(sname) + ' gets a message and you agree payment and shipping together.</p><p class="hint" style="margin:0">Never pay outside a method you trust.</p>',
    '<button class="btn full" id="rsv">Reserve for ' + money(x.price) + "</button>");
  $("#rsv", s).onclick = function () {
    var b = this; needAuth("reserve this", function () {
      b.disabled = true; b.innerHTML = '<span class="spin"></span>';
      api("/api/market/" + x.id + "/buy", { method: "POST", body: "{}" }).then(function () {
        x.status = "reserved"; closeSheet(true); toast("Reserved ✓ Now message the seller");
        api("/api/dm/" + x.seller.id, { method: "POST", body: JSON.stringify({ body: "Hi! I just reserved “" + x.title + "” (" + money(x.price) + "). How would you like to handle payment and shipping?" }) }).catch(function () {}).then(function () { nav("/you/messages/" + x.seller.id); });
      }).catch(function (e) { b.disabled = false; b.textContent = "Reserve for " + money(x.price); toast(/own|yourself/i.test(e.message) ? "That's your own listing" : e.message); });
    });
  };
}
route(/^\/shop\/(\d+)(?:-[^/]*)?$/, function (id) { itemView(id); });

/* ================= SELLER PROFILE ================= */
route(/^\/u\/([^/]+)$/, function (name) {
  name = decodeURIComponent(name);
  app.innerHTML = topbar({ back: true, title: name }) + skelGrid(4);
  loadMarket().then(function (list) {
    var mine = feed(list).filter(function (x) { var s = x.seller || {}; return s.username === name || String(s.id) === name; });
    var s = (mine[0] && mine[0].seller) || { username: name }, sname = s.display_name || s.username;
    setMeta(sname + "'s shop", "Shop " + sname + " on fashionistas.ai.");
    app.innerHTML = '<div class="view">' + topbar({ back: true, title: sname }) + '<div class="prof"><span class="av">' + esc(String(sname).charAt(0)) + "</span><div><h2>" + esc(sname) + "</h2><small>" + mine.length + " item" + (mine.length === 1 ? "" : "s") + " for sale</small></div></div>" +
      (s.id && !(USER && Number(USER.id) === Number(s.id)) ? '<div class="sect" style="margin-bottom:16px"><button class="btn sec full" id="pmsg">' + I.chat + "Message " + esc(sname) + "</button></div>" : "") +
      (mine.length ? '<div class="grid">' + mine.map(cardHTML).join("") + "</div>" : emptyState(I.hanger, "Nothing for sale", "This seller has no items listed right now.", '<a class="btn" href="/" data-link>Keep shopping</a>')) + footer() + "</div>";
    if ($("#pmsg")) $("#pmsg").onclick = function () { needAuth("message " + sname, function () { nav("/you/messages/" + s.id); }); };
    imgLoaded(app);
  }).catch(function () { app.innerHTML = topbar({ back: true, title: name }) + emptyState(I.alert, "Couldn't load this shop", "Check your connection and try again.", '<button class="btn" onclick="location.reload()">Try again</button>'); });
});

/* ================= AUTH ================= */
function needAuth(reason, cb) { if (TOKEN) return cb(); authSheet(reason, cb); }
function authForm(mode) {
  return '<div class="seg2" role="tablist"><button data-m="up" class="' + (mode === "up" ? "on" : "") + '">Create account</button><button data-m="in" class="' + (mode === "in" ? "on" : "") + '">Sign in</button></div><form id="af"><p class="err" id="aerr" hidden></p>' +
    '<label class="field"><span>' + (mode === "up" ? "Username" : "Username or email") + '</span><input class="in" name="u" autocomplete="username" autocapitalize="off" required></label>' +
    (mode === "up" ? '<label class="field"><span>Email</span><input class="in" name="e" type="email" autocomplete="email" required></label>' : "") +
    '<label class="field"><span>Password' + (mode === "up" ? " <em>6+ characters</em>" : "") + '</span><input class="in" name="p" type="password" autocomplete="' + (mode === "up" ? "new-password" : "current-password") + '" required minlength="6"></label>' +
    '<button class="btn full" type="submit">' + (mode === "up" ? "Create account" : "Sign in") + '</button><p class="hint" style="text-align:center">Free forever. By continuing you agree to the <a href="/terms/" style="text-decoration:underline">Terms</a>.</p></form>';
}
function wireAuth(root, mode, done) {
  $$("[data-m]", root).forEach(function (b) { b.onclick = function () { mode = b.dataset.m; root.innerHTML = authForm(mode); wireAuth(root, mode, done); }; });
  $("#af", root).onsubmit = function (e) {
    e.preventDefault(); var f = e.target, btn = $("button[type=submit]", f), er = $("#aerr", root);
    var body = mode === "up" ? { username: f.u.value.trim(), email: f.e.value.trim(), password: f.p.value } : { username: f.u.value.trim(), password: f.p.value };
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; er.hidden = true;
    api(mode === "up" ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: JSON.stringify(body) }).then(function (d) { setSession(d); toast("Welcome, " + ((USER && (USER.display_name || USER.username)) || "you")); done(); })
      .catch(function (x) { btn.disabled = false; btn.textContent = mode === "up" ? "Create account" : "Sign in"; er.textContent = x.status === 401 ? "That username and password don't match." : x.message; er.hidden = false; });
  };
}
function authSheet(reason, cb) {
  var s = sheet("Sign in to " + reason, '<div id="aroot">' + authForm("up") + "</div>");
  wireAuth($("#aroot", s), "up", function () { closeSheet(true); cb && cb(); render(); });
}
route(/^\/signin$/, function () {
  app.innerHTML = '<div class="view">' + topbar({ wordmark: true }) + '<div class="auth"><h2 class="lead">Buy and sell fashion, free.</h2><p class="sub">One account to shop, message sellers and list your closet everywhere.</p><div id="aroot">' + authForm("up") + "</div></div></div>";
  wireAuth($("#aroot"), "up", function () { var n = new URLSearchParams(location.search).get("next"); nav(n && /^\/[a-z]/.test(n) ? n : "/you", true); });
});

/* ================= SELL ================= */
var SK = "fa2_sell", SELL;
function freshSell() { return { photos: [], f: { title: "", price: "", cat: "", size: "", brand: "", cond: "", color: "", desc: "", material: "" }, touched: {}, ai: null, aiState: "", at: Date.now() }; }
function loadSell() { if (SELL) return SELL; try { SELL = JSON.parse(localStorage.getItem(SK) || "null"); } catch (e) {} if (!SELL || !SELL.f) SELL = freshSell(); if (SELL.aiState === "busy") SELL.aiState = ""; return SELL; }
function saveSell() { try { localStorage.setItem(SK, JSON.stringify(SELL)); } catch (e) { try { var c = Object.assign({}, SELL, { photos: SELL.photos.slice(0, 2) }); localStorage.setItem(SK, JSON.stringify(c)); } catch (e2) {} } }
function clearSell() { SELL = freshSell(); try { localStorage.removeItem(SK); } catch (e) {} }
function shrink(file) {
  return new Promise(function (res) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () { var M = 1400, k = Math.min(1, M / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", .85)); };
    im.onerror = function () { URL.revokeObjectURL(url); res(null); };
    im.src = url;
  });
}
function addFiles(files) {
  var S = loadSell(), room = 10 - S.photos.length, arr = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name); }).slice(0, Math.max(0, room));
  if (!arr.length) { if (room <= 0) toast("10 photos max"); return Promise.resolve(); }
  return Promise.all(arr.map(shrink)).then(function (srcs) {
    var had = S.photos.length;
    srcs.filter(Boolean).forEach(function (s) { S.photos.push({ src: s }); });
    if (srcs.some(function (x) { return !x; })) toast("One photo couldn't be read");
    saveSell(); if (!had && S.photos.length) identify();
  });
}
function identify() {
  var S = loadSell(), p = S.photos[0]; if (!p) return;
  S.aiState = "busy"; var at = S.at = Date.now(); refreshSell();
  fetch("/api/ai/analyze", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, TOKEN ? { Authorization: "Bearer " + TOKEN } : {}), body: JSON.stringify({ image: p.src.split(",")[1] }) })
    .then(function (r) { return r.json(); }).then(function (d) {
      if (S.at !== at) return; if (!d || d.source === "error" || d.ok === false) throw new Error("x");
      var conf = Number(d.confidence) || 0, path = canon(d.categoryPath || d.category), kind = String(d.type || "").trim(), f = S.f, t = S.touched;
      var put = function (k, v) { if (v && !t[k]) f[k] = v; };
      var col = String(d.color || "").trim(), tc = function (s) { return String(s || "").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); };
      S.ai = { conf: conf, lo: Number(d.priceMin) || 0, hi: Number(d.priceMax) || 0, kind: kind, path: path, unsure: !kind || conf < 85 || !path };
      if (kind) put("title", [d.brand, col && kind.toLowerCase().indexOf(col.toLowerCase()) < 0 ? tc(col) : "", tc(kind)].filter(Boolean).join(" ").slice(0, 80));
      if (!S.ai.unsure) put("cat", path);
      put("brand", d.brand); put("size", d.sizeHint); put("color", tc(col)); put("material", d.material);
      var c = String(d.condition || "").toLowerCase(); put("cond", /new/.test(c) ? "New with tags" : /excellent|like/.test(c) ? "Excellent" : /fair|worn/.test(c) ? "Fair" : c ? "Good" : "");
      if (S.ai.lo && S.ai.hi && !t.price) f.price = String(Math.round((S.ai.lo + S.ai.hi) / 2));
      S.aiState = "done"; saveSell(); refreshSell();
    }).catch(function () { if (S.at !== at) return; S.aiState = "error"; saveSell(); refreshSell(); });
}
function canon(p) { p = String(p || ""); if (!window.FASH_CAT) return p; var c = (FASH_CAT.categories || []).find(function (x) { return x.path.toLowerCase() === p.toLowerCase(); }); return c ? c.path : ""; }
function refreshSell() { var p = location.pathname; if (p === "/sell") sellPhotos(); else if (p === "/sell/review") refreshAiBox(); }
function stepsBar(n) { return '<div class="steps" aria-label="Step ' + n + ' of 3"><i class="on"></i><i' + (n > 1 ? ' class="on"' : "") + "></i><i" + (n > 2 ? ' class="on"' : "") + "></i></div>"; }
function sellPhotos() {
  var S = loadSell(), n = S.photos.length;
  setMeta("Sell", "List an item in seconds.");
  var drop = '<div class="drop sell-intro"><div class="cam-art" aria-hidden="true"><span class="ring r1"></span><span class="ring r2"></span><div class="big">' + I.cam + '</div><span class="flash"></span></div><h2>Sell it in 30 seconds</h2><p>Snap the front first — it becomes your cover. Add the label, back and any flaws.</p><ol class="isteps"><li style="--d:0ms"><em>1</em><span><b>Snap</b>Up to 10 photos</span></li><li style="--d:140ms"><em>2</em><span><b>AI drafts it</b>Title, category, price</span></li><li style="--d:280ms"><em>3</em><span><b>Post everywhere</b>Live here instantly</span></li></ol><div class="row"><button class="btn" data-pick="cam">' + I.cam + 'Camera</button><button class="btn ghost" data-pick="gal">' + I.img + "Gallery</button></div></div>";
  var grid = '<div class="shots" id="shots">' + S.photos.map(function (p, i) { return '<div class="shot" draggable="true" data-i="' + i + '"><img src="' + p.src + '" alt="Photo ' + (i + 1) + '">' + (i ? "" : '<span class="cov">COVER</span>') + '<button class="rm" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">×</button><span class="mv">' + (i ? '<button data-mv="' + i + '" data-d="-1" aria-label="Move earlier">‹</button>' : "") + (i < n - 1 ? '<button data-mv="' + i + '" data-d="1" aria-label="Move later">›</button>' : "") + "</span></div>"; }).join("") +
    (n < 10 ? '<button class="addtile" data-pick="cam">' + I.cam + 'Camera</button><button class="addtile" data-pick="gal">' + I.img + "Gallery</button>" : "") + "</div>";
  app.innerHTML = '<div class="view">' + topbar({ title: "Sell an item", right: n ? '<button class="linkbtn" id="startover" style="padding:0 8px">Start over</button>' : "" }) + stepsBar(1) + '<div class="pad">' + (n ? '<p class="sub" style="margin-bottom:16px">' + n + " of 10 photos · drag or use ‹ › to reorder</p>" + grid + aiLine(S) : drop) + "</div>" +
    '<input type="file" id="pcam" accept="image/*" capture="environment" hidden><input type="file" id="pgal" accept="image/*" multiple hidden>' +
    (n ? '<div class="footcta"><div class="footcta-in"><a class="btn" href="/sell/review" data-link>Next</a></div></div>' : "") + "</div>";
  $$("[data-pick]").forEach(function (b) { b.onclick = function () { tap(); $(b.dataset.pick === "cam" ? "#pcam" : "#pgal").click(); }; });
  ["#pcam", "#pgal"].forEach(function (id) { $(id).onchange = function (e) { addFiles(e.target.files).then(sellPhotos); }; });
  $$("[data-rm]").forEach(function (b) { b.onclick = function () { var i = +b.dataset.rm; S.photos.splice(i, 1); if (i === 0) { S.ai = null; S.aiState = ""; if (S.photos.length) identify(); } saveSell(); sellPhotos(); }; });
  $$("[data-mv]").forEach(function (b) { b.onclick = function () { var i = +b.dataset.mv, j = i + (+b.dataset.d); move(i, j); }; });
  if ($("#startover")) $("#startover").onclick = function () { clearSell(); sellPhotos(); };
  function move(i, j) { var p = S.photos.splice(i, 1)[0]; S.photos.splice(j, 0, p); saveSell(); tap(); sellPhotos(); }
  var from = -1; $$(".shot").forEach(function (el) {
    el.ondragstart = function () { from = +el.dataset.i; el.classList.add("drag"); };
    el.ondragend = function () { el.classList.remove("drag"); };
    el.ondragover = function (e) { e.preventDefault(); el.classList.add("over"); };
    el.ondragleave = function () { el.classList.remove("over"); };
    el.ondrop = function (e) { e.preventDefault(); var to = +el.dataset.i; if (from >= 0 && from !== to) move(from, to); };
  });
  var dz = app; dz.ondragover = function (e) { if (e.dataTransfer && e.dataTransfer.types.indexOf("Files") >= 0) e.preventDefault(); };
  dz.ondrop = function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files).then(sellPhotos); } };
}
function aiLine(S) {
  if (S.aiState === "busy") return '<div class="aibox" style="margin-top:16px"><span class="spin"></span><div><b>Reading your photo…</b><span>We\'ll draft the title, category and price.</span></div></div>';
  if (S.aiState === "done") return '<div class="aibox" style="margin-top:16px">' + I.spark + "<div><b>Draft ready</b><span>Tap Next to check it.</span></div></div>";
  if (S.aiState === "error") return '<div class="aibox ask" style="margin-top:16px">' + I.alert + "<div><b>Couldn't read that photo</b><span>No problem — you'll fill in the details on the next step.</span></div></div>";
  return "";
}
var SIZES = { alpha: ["XXS", "XS", "S", "M", "L", "XL", "XXL"], shoe: ["5", "6", "7", "8", "9", "10", "11", "12"], one: ["One size"] };
function sizeSet(path) { var c = window.FASH_CAT && (FASH_CAT.categories || []).find(function (x) { return x.path === path; }); var t = c ? String(c.size || "") : ""; return /one/.test(t) ? SIZES.one : /shoe/.test(t) ? SIZES.shoe : /alpha|kids|men|women/.test(t) ? SIZES.alpha : []; }
function catOptions(sel) {
  if (!window.FASH_CAT) return "";
  var h = '<option value="">Choose a category</option>';
  (FASH_CAT.departments || []).forEach(function (d) { h += '<optgroup label="' + esc(d) + '">' + FASH_CAT.categories.filter(function (c) { return c.dept === d; }).map(function (c) { return '<option value="' + esc(c.path) + '"' + (c.path === sel ? " selected" : "") + ">" + esc(c.sub) + "</option>"; }).join("") + "</optgroup>"; });
  return h;
}
function aiBoxHTML(S) {
  if (S.aiState === "busy") return '<div class="aibox"><span class="spin"></span><div><b>Reading your photo…</b><span>Fields fill in as soon as it\'s done. You can type meanwhile.</span></div></div>';
  if (S.aiState === "error") return '<div class="aibox ask">' + I.alert + '<div><b>We couldn\'t read the photo</b><span>Fill in the details below. <button class="linkbtn" style="min-height:0;padding:0" id="aire">Try again</button></span></div></div>';
  if (S.ai && S.ai.unsure) return '<div class="aibox ask">' + I.alert + "<div><b>We drafted it — please check</b><span>" + (S.ai.kind ? "We think it's a " + esc(S.ai.kind.toLowerCase()) + ", but we're not sure. " : "") + "Confirm the category below.</span></div></div>";
  if (S.ai) return '<div class="aibox">' + I.spark + "<div><b>Drafted from your photo</b><span>Check everything — you know your item best.</span></div></div>";
  return "";
}
function refreshAiBox() {
  var S = loadSell(), b = $("#aibox"); if (!b) return;
  b.innerHTML = aiBoxHTML(S);
  ["title", "brand", "size", "color", "price"].forEach(function (k) { var el = $("#f-" + k); if (el && !S.touched[k] && S.f[k] && el.value !== S.f[k]) el.value = S.f[k]; });
  var cs = $("#f-cat"); if (cs && S.f.cat && !cs.value) { cs.value = S.f.cat; }
  renderSug(); condChips(); sizeChips(); priceHint(); validate();
  if ($("#aire")) $("#aire").onclick = identify;
}
function renderSug() { var S = loadSell(), el = $("#catsug"); if (!el) return; var p = S.ai && S.ai.unsure && S.ai.path && !S.f.cat ? S.ai.path : ""; el.innerHTML = p ? '<span class="hint" style="margin:0">Suggested:</span><button type="button" class="chip" id="usesug">' + esc(p.replace("/", " › ")) + "</button>" : ""; if (p) $("#usesug").onclick = function () { S.f.cat = p; S.touched.cat = 1; $("#f-cat").value = p; $("#f-cat").classList.remove("ask"); saveSell(); renderSug(); sizeChips(); validate(); }; $("#f-cat") && $("#f-cat").classList.toggle("ask", !S.f.cat && !!(S.ai && S.ai.unsure)); }
function condChips() { var S = loadSell(), el = $("#condc"); if (!el) return; el.innerHTML = CONDS.map(function (c) { return '<button type="button" class="chip' + (S.f.cond === c ? " on" : "") + '" data-c="' + esc(c) + '">' + esc(CONDLBL[c]) + "</button>"; }).join(""); $$("[data-c]", el).forEach(function (b) { b.onclick = function () { tap(); S.f.cond = b.dataset.c; S.touched.cond = 1; saveSell(); condChips(); validate(); }; }); }
function sizeChips() { var S = loadSell(), el = $("#sizec"); if (!el) return; var set = sizeSet(S.f.cat); el.innerHTML = set.map(function (s) { return '<button type="button" class="chip' + (S.f.size === s ? " on" : "") + '" data-sz="' + esc(s) + '">' + esc(s) + "</button>"; }).join(""); el.hidden = !set.length; $$("[data-sz]", el).forEach(function (b) { b.onclick = function () { tap(); S.f.size = b.dataset.sz; S.touched.size = 1; $("#f-size").value = S.f.size; saveSell(); sizeChips(); }; }); }
function priceHint() { var S = loadSell(), el = $("#phint"); if (el) el.textContent = S.ai && S.ai.lo && S.ai.hi ? "Similar items usually sell for " + money(S.ai.lo) + "–" + money(S.ai.hi) + " (AI estimate)." : ""; }
function validate() { var S = loadSell(), f = S.f, ok = S.photos.length && f.title.trim().length >= 3 && Number(f.price) > 0 && f.cat && f.cond; var b = $("#post"); if (b) { b.disabled = !ok; b.textContent = ok ? "Post" : !f.cat ? "Choose a category" : !f.cond ? "Choose condition" : !(Number(f.price) > 0) ? "Add a price" : "Add a title"; } return ok; }
function sellReview() {
  var S = loadSell(); if (!S.photos.length) return nav("/sell", true);
  setMeta("Review listing");
  var f = S.f;
  app.innerHTML = '<div class="view">' + topbar({ back: true, title: "Review" }) + stepsBar(2) + '<div class="pad"><div class="revhead">' + S.photos.map(function (p) { return '<img src="' + p.src + '" alt="">'; }).join("") + '</div><div id="aibox">' + aiBoxHTML(S) + "</div>" +
    '<label class="field"><span>Title</span><input class="in" id="f-title" maxlength="80" value="' + esc(f.title) + '" placeholder="e.g. Levi\'s 501 straight jeans"></label>' +
    '<label class="field"><span>Category</span><select class="in select" id="f-cat">' + catOptions(f.cat) + '</select><div class="suggest" id="catsug"></div></label>' +
    '<div class="field"><span>Condition</span><div class="wrap" id="condc"></div></div>' +
    '<label class="field"><span>Size</span><input class="in" id="f-size" value="' + esc(f.size) + '" placeholder="e.g. M, 32, 9"><div class="wrap" id="sizec" style="margin-top:8px"></div></label>' +
    '<label class="field"><span>Brand <em>optional</em></span><input class="in" id="f-brand" value="' + esc(f.brand) + '" placeholder="e.g. Zara" autocapitalize="words"></label>' +
    '<label class="field"><span>Price</span><span class="pre" style="display:block"><b>$</b><input class="in" id="f-price" inputmode="decimal" value="' + esc(f.price) + '" placeholder="0"></span><small class="hint" id="phint" style="display:block"></small></label>' +
    '<label class="field"><span>Color <em>optional</em></span><input class="in" id="f-color" value="' + esc(f.color) + '" placeholder="e.g. Black"></label>' +
    '<label class="field"><span>Description <em>optional</em></span><textarea class="in" id="f-desc" maxlength="2000" placeholder="Fit, measurements, any flaws. We\'ll write a short one if you skip this.">' + esc(f.desc) + "</textarea></label>" +
    '<div style="height:80px"></div></div><div class="footcta"><div class="footcta-in"><button class="btn" id="post" disabled>Post</button></div></div></div>';
  ["title", "size", "brand", "price", "color", "desc"].forEach(function (k) { $("#f-" + k).oninput = function (e) { S.f[k] = k === "price" ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value; if (k === "price") e.target.value = S.f.price; S.touched[k] = 1; saveSell(); if (k === "size") sizeChips(); validate(); }; });
  $("#f-cat").onchange = function (e) { S.f.cat = e.target.value; S.touched.cat = 1; saveSell(); renderSug(); sizeChips(); validate(); };
  $("#post").onclick = function () { if (validate()) needAuth("post your listing", postListing); };
  refreshAiBox();
}
function upload(src, name) {
  var bin = atob(src.split(",")[1]), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  var fd = new FormData(); fd.append("file", new Blob([u], { type: "image/jpeg" }), (name || "item").slice(0, 40).replace(/[^a-z0-9]+/gi, "-") + ".jpg");
  return api("/api/images/upload", { method: "POST", body: fd, form: true }).then(function (d) { if (!d.url) throw new Error("Photo upload failed"); return d.url; });
}
var POSTING = false;
function postListing() {
  if (POSTING) return; var S = loadSell(), f = S.f, b = $("#post"); POSTING = true;
  var done = 0, total = S.photos.length;
  var lbl = function () { if (b) b.innerHTML = '<span class="spin"></span> Uploading photos ' + done + "/" + total; };
  if (b) b.disabled = true; lbl();
  Promise.all(S.photos.map(function (p) { return (p.url ? Promise.resolve(p.url) : upload(p.src, f.title).then(function (u) { p.url = u; return u; })).then(function (u) { done++; lbl(); return u; }); })).then(function (urls) {
    if (b) b.innerHTML = '<span class="spin"></span> Posting…';
    var c = (f.cond === "New with tags" ? "new with tags" : (CONDLBL[f.cond] || "good").toLowerCase());
    var body = { title: f.title.trim().slice(0, 80), description: (f.desc.trim() || f.title.trim() + ". Size " + (f.size || "see photos") + ", " + c + " condition." + (f.material ? " " + f.material + "." : "")), price: Number(f.price), size: f.size.trim(), condition: f.cond, category: f.cat, photo_url: urls[0], photos: urls, ai_confidence: S.ai ? S.ai.conf : null, brand: f.brand.trim(), color: f.color.trim(), material: f.material || "", status: "active", platforms: ["fashionistas"] };
    return api("/api/listings", { method: "POST", body: JSON.stringify(body) });
  }).then(function (d) {
    var id = d && ((d.listing && d.listing.id) || d.id); POSTING = false; if (!id) throw new Error("The listing wasn't created — try again.");
    clearSell(); MARKET = null; MINE = null; nav("/sell/done/" + id, true);
  }).catch(function (e) { POSTING = false; saveSell(); if (b) { b.disabled = false; b.textContent = "Try again"; } toast(e.message || "Couldn't post — your draft is saved", 4000); });
}
route(/^\/sell$/, sellPhotos);
route(/^\/sell\/review$/, sellReview);

/* ================= EXTENSION BRIDGE ================= */
var EXT_SITES = ["ebay", "poshmark", "mercari", "depop", "facebook", "vinted", "grailed", "etsy", "vestiaire", "kidizen", "whatnot", "shopify"];
var SESS = {}, CHECKED = false, PROG = {}, PREF = null;
function hasExt() { return !!document.documentElement.dataset.faExt; }
function extHello() { if (hasExt() && TOKEN) window.postMessage({ type: "FA_TOKEN", token: TOKEN }, location.origin); }
function extCheck() { if (!hasExt()) return; CHECKED = false; window.postMessage({ type: "FA_CHECK", sites: EXT_SITES }, location.origin); }
window.addEventListener("message", function (e) {
  if (e.source !== window || !e.data || typeof e.data.type !== "string") return;
  var d = e.data;
  if (d.type === "FA_SESSIONS") { for (var k in (d.sessions || {})) SESS[k] = d.sessions[k]; if (!d.partial) CHECKED = true; if (PREF && !PREF.length && CHECKED) { PREF = connected(); savePref(); } drawShops(); }
  if (d.type === "FA_PROGRESS") { PROG[d.site] = d.step; drawShops(); if (d.step === "listed") { MINE = null; toast("Live on " + (MKBY[d.site] || [0, d.site])[1] + " ✓"); } }
  if (d.type === "FA_ACK" && !d.ok) { if (d.error === "needs_consent") consentSheet(); else { Object.keys(PROG).forEach(function (k) { if (PROG[k] === "queued") PROG[k] = "error"; }); drawShops(); toast("The extension couldn't start: " + (d.error || "unknown error")); } }
});
function connected() { return EXT_SITES.filter(function (s) { return SESS[s] && SESS[s].state === "connected"; }); }
function loadPref() { if (PREF || !TOKEN) return Promise.resolve(PREF || []); return fetch("/api/seller/prefs", { headers: { Authorization: "Bearer " + TOKEN }, credentials: "include" }).then(function (r) { return r.json(); }).then(function (d) { PREF = (d && d.marketplaces) || []; return PREF; }).catch(function () { PREF = []; return PREF; }); }
function savePref() { if (!TOKEN) return; fetch("/api/seller/prefs", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Authorization: "Bearer " + TOKEN }, body: JSON.stringify({ marketplaces: PREF || [] }) }).catch(function () {}); }
function consentSheet() {
  var s = sheet("Allow crossposting", '<p style="margin:0 0 12px">The extension opens each marketplace\'s sell page in a new tab, fills in your listing and uploads the photos. You check it and press publish there.</p><p class="hint" style="margin:0">It uses the accounts you\'re already signed into. It never sees or stores your passwords.</p>', '<button class="btn full" id="allow">Allow and post</button>');
  $("#allow", s).onclick = function () { window.postMessage({ type: "FA_ACCEPT" }, location.origin); closeSheet(true); setTimeout(function () { if (CUR) runPost(CUR); }, 400); };
}
var CUR = null;
function stLabel(id, l) {
  var p = PROG[id], st = l && l.shops && l.shops[id] && l.shops[id].status;
  if (st === "sold") return ['Sold', "st-ok"];
  if (st === "listed" || st === "active" || p === "listed") return ["Live", "st-ok"];
  if (p === "queued" || p === "opening") return ["Opening…", "st-warn"];
  if (p === "filled") return ["Filled in — publish in its tab", "st-warn"];
  if (p === "no-url") return ["Not published yet", "st-warn"];
  if (p === "error") return ["Couldn't start", "st-err"];
  var s = SESS[id];
  if (!hasExt()) return ["", ""];
  if (!CHECKED && !s) return ["Checking…", ""];
  return s && s.state === "connected" ? ["Signed in", "st-ok"] : ["Not signed in", ""];
}
function shopsHTML(l) {
  if (!hasExt()) {
    return '<div class="aibox">' + I.spark + '<div><b>Post everywhere from your computer</b><span>Install our free Chrome extension once. It finds the shops you\'re signed into — eBay, Poshmark, Depop, Mercari and more — and fills each sell form for you.</span></div></div><a class="btn sec full" href="/seller/get-extension/">Get the free extension</a>' +
      '<p class="hint" style="text-align:center">On your phone? Your item is already live here. Crosspost later from a computer — it\'ll be waiting in You.</p>';
  }
  var con = connected(), pref = PREF || [];
  var rows = MK.filter(function (m) { return EXT_SITES.indexOf(m[0]) >= 0; }).map(function (m) {
    var id = m[0], s = stLabel(id, l), on = pref.indexOf(id) >= 0, c = con.indexOf(id) >= 0, live = s[0] === "Live" || s[0] === "Sold";
    return '<div class="mk">' + logo(id) + '<div class="nm"><b>' + esc(m[1]) + '</b><small class="' + s[1] + '">' + esc(s[0]) + "</small></div>" +
      (live ? "" : c ? '<button class="tog' + (on ? " on" : "") + '" role="switch" aria-checked="' + on + '" aria-label="Post to ' + esc(m[1]) + '" data-tg="' + id + '"></button>' : '<button class="btn sm ghost" data-login="' + id + '">Sign in</button>') + "</div>";
  }).join("");
  var n = pref.filter(function (x) { return con.indexOf(x) >= 0 && !(l && l.shops && l.shops[x] && /listed|active|sold/.test(l.shops[x].status)); }).length;
  return '<div id="mklist">' + rows + '</div><div style="height:16px"></div>' + (l ? '<button class="btn full" id="goall"' + (n ? "" : " disabled") + ">" + (n ? "Post to " + n + " shop" + (n > 1 ? "s" : "") : CHECKED ? "Pick shops to post to" : "Checking your shops…") + "</button>" : "") + '<p class="hint" style="text-align:center">Each sell form opens in its own tab, filled in. You press publish.</p>';
}
function drawShops() { var el = $("#shops"); if (!el) return; el.innerHTML = shopsHTML(CUR); wireShops(el); }
function wireShops(el) {
  $$("[data-tg]", el).forEach(function (b) { b.onclick = function () { tap(); var id = b.dataset.tg; PREF = PREF || []; var i = PREF.indexOf(id); if (i >= 0) PREF.splice(i, 1); else PREF.push(id); savePref(); drawShops(); }; });
  $$("[data-login]", el).forEach(function (b) { b.onclick = function () { window.postMessage({ type: "FA_OPEN_LOGIN", site: b.dataset.login }, location.origin); toast("Sign in in the new tab, then come back"); }; });
  var g = $("#goall", el); if (g) g.onclick = function () { tap(); runPost(CUR); };
}
function runPost(l) {
  if (!l) return; var con = connected(), sites = (PREF || []).filter(function (x) { return con.indexOf(x) >= 0 && !(l.shops && l.shops[x] && /listed|active|sold/.test(l.shops[x].status)); });
  if (!sites.length) return;
  sites.forEach(function (s) { PROG[s] = "queued"; }); drawShops();
  window.postMessage({ type: "FA_POST", job: { item: { id: l.id, title: l.title, description: l.description || "", price: l.price, brand: l.brand || "", size: l.size || "", condition: l.condition || "", category: l.category || "", photos: photosOf(l).map(function (u) { return new URL(u, location.href).href; }) }, sites: sites } }, location.origin);
}
addEventListener("focus", function () { if ($("#shops")) extCheck(); });

/* ================= SELLER: posted + dashboard ================= */
var MINE = null;
function loadMine(force) {
  if (MINE && !force) return Promise.resolve(MINE);
  return fetch("/api/crosslist/board", { headers: { Authorization: "Bearer " + TOKEN }, credentials: "include" }).then(function (r) { if (r.status === 401) { signOut(true); throw new Error("auth"); } return r.json(); }).then(function (d) {
    MINE = (d.listings || []); return MINE;
  });
}
function postedView(id) {
  if (!TOKEN) return nav("/signin?next=/you", true);
  setMeta("Posted");
  app.innerHTML = '<div class="view">' + topbar({ title: "" }) + stepsBar(3) + '<div class="success"><div class="confetti" aria-hidden="true">' + new Array(18).join("<i></i>") + '<i></i></div><div class="chk"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div><h2 class="lead" style="margin:0 0 4px">You\'re live</h2><p class="sub" style="margin:0">Buyers on fashionistas.ai can see it now.</p></div><div id="pc"></div><div class="sect"><h3>Post to your other shops</h3><div id="shops"><div class="sk" style="height:200px"></div></div></div><div class="sect" style="margin-top:24px"><div class="prow"><a class="btn sec" style="flex:1" href="/sell" data-link>Sell another</a><a class="btn ghost" style="flex:1" href="/you" data-link>Done</a></div></div></div>';
  Promise.all([loadMine(true), loadPref()]).then(function (r) {
    var l = r[0].find(function (x) { return Number(x.id) === Number(id); }); CUR = l || null;
    if (l) $("#pc").innerHTML = '<a class="card-row" href="/shop/' + l.id + '" data-link><img src="' + esc(l.photo_url) + '" alt=""><div style="flex:1;min-width:0"><b>' + esc(l.title) + "</b><small>" + money(l.price) + " · View listing</small></div>" + I.chev + "</a>";
    drawShops(); extCheck();
  }).catch(function () { $("#shops").innerHTML = '<p class="sub">Couldn\'t load your shops. <a href="/you" data-link style="text-decoration:underline">Open your listings</a></p>'; });
}
route(/^\/sell\/done\/(\d+)$/, postedView);
function statusPills(l) {
  var h = "", sh = l.shops || {};
  if (l.status === "sold") return '<span class="pill sold">Sold</span>';
  Object.keys(sh).forEach(function (k) { var s = sh[k].status; if (/listed|active/.test(s)) h += '<span class="pill ok">' + (k === "fashionistas" ? "fashionistas" : (MKBY[k] || [0, k])[1]) + "</span>"; });
  return h || '<span class="pill">Draft</span>';
}
function youView() {
  if (!TOKEN) {
    setMeta("You");
    app.innerHTML = '<div class="view">' + topbar({ title: "You" }) + '<div class="auth"><h2 class="lead">Your closet, everywhere.</h2><p class="sub">Sign in to see your listings, messages and sales.</p><div id="aroot">' + authForm("in") + "</div></div>" + footer() + "</div>";
    wireAuth($("#aroot"), "in", function () { render(); }); return;
  }
  var name = (USER && (USER.display_name || USER.username)) || "You", tab = new URLSearchParams(location.search).get("t") || "active";
  setMeta("Your listings");
  app.innerHTML = '<div class="view">' + topbar({ title: name, right: '<a class="iconbtn" href="/you/messages" data-link aria-label="Messages">' + I.chat + (UNREAD ? '<span class="dot">' + UNREAD + "</span>" : "") + "</a>" }) + '<div id="stats" class="stats"><div class="stat sk" style="height:64px"></div><div class="stat sk" style="height:64px"></div><div class="stat sk" style="height:64px"></div></div>' +
    '<div class="seg">' + [["active", "For sale"], ["sold", "Sold"], ["all", "All"]].map(function (t) { return '<a class="chip' + (tab === t[0] ? " on" : "") + '" href="/you?t=' + t[0] + '" data-link>' + t[1] + "</a>"; }).join("") + '</div><div id="ml"><div class="sk" style="height:88px;margin:0 16px 8px"></div><div class="sk" style="height:88px;margin:0 16px"></div></div>' +
    '<nav class="menu"><a href="/you/messages" data-link>Messages' + I.chev + '</a><a href="/you/shops" data-link>Connected shops' + I.chev + '</a><a href="/try-on/">Virtual try-on' + I.chev + '</a><a href="/contact/">Help & contact' + I.chev + '</a><button id="so">Sign out</button></nav>' + footer() + "</div>";
  $("#so").onclick = function () { signOut(); MINE = null; toast("Signed out"); nav("/"); };
  loadMine(true).then(function (L) {
    var act = L.filter(function (l) { return l.status === "active" || l.status === "reserved"; }), sold = L.filter(function (l) { return l.status === "sold"; });
    var earned = sold.reduce(function (a, l) { return a + (Number(l.price) || 0); }, 0);
    $("#stats").innerHTML = '<div class="stat g1"><b data-count="' + act.length + '">' + act.length + '</b><small>For sale</small></div><div class="stat g2"><b data-count="' + sold.length + '">' + sold.length + '</b><small>Sold</small></div><div class="stat g3"><b' + (earned % 1 ? "" : ' data-pre="$" data-count="' + earned + '"') + ">" + money(earned) + "</b><small>Sold value</small></div>"; countUp($("#stats"));
    var rows = tab === "sold" ? sold : tab === "all" ? L : act;
    $("#ml").innerHTML = rows.length ? rows.map(function (l) { return '<a class="lrow" href="/you/item/' + l.id + '" data-link>' + (l.photo_url ? '<img src="' + esc(l.photo_url) + '" alt="" loading="lazy">' : '<span class="noimg"></span>') + '<div class="nm"><b>' + esc(l.title) + '</b><span class="p">' + money(l.price) + '</span><div class="pills">' + statusPills(l) + "</div></div>" + I.chev + "</a>"; }).join("")
      : emptyState(I.hanger, tab === "sold" ? "No sales yet" : "Nothing listed yet", tab === "sold" ? "When something sells, mark it sold and it shows up here." : "Snap a photo — it takes under a minute.", tab === "sold" ? "" : '<a class="btn" href="/sell" data-link>Sell an item</a>');
  }).catch(function (e) { if (e.message === "auth") return render(); $("#ml").innerHTML = emptyState(I.alert, "Couldn't load your listings", "Check your connection and try again.", '<button class="btn" onclick="location.reload()">Try again</button>'); $("#stats").innerHTML = ""; });
}
route(/^\/you$/, youView);
function manageView(id) {
  if (!TOKEN) return nav("/signin?next=" + encodeURIComponent(location.pathname), true);
  app.innerHTML = topbar({ back: true, title: "Listing" }) + '<div class="sk" style="height:120px;margin:16px"></div>';
  Promise.all([loadMine(true), loadPref()]).then(function (r) {
    var l = r[0].find(function (x) { return Number(x.id) === Number(id); }); CUR = l || null;
    if (!l) { app.innerHTML = topbar({ back: true, title: "Listing" }) + emptyState(I.hanger, "Listing not found", "It may have been deleted.", '<a class="btn" href="/you" data-link>Your listings</a>'); return; }
    setMeta(l.title);
    var sold = l.status === "sold";
    app.innerHTML = '<div class="view">' + topbar({ back: true, title: "Listing" }) + '<a class="card-row" style="margin-top:8px" href="/shop/' + l.id + '" data-link><img src="' + esc(l.photo_url) + '" alt=""><div style="flex:1;min-width:0"><b>' + esc(l.title) + "</b><small>" + money(l.price) + " · " + (sold ? "Sold" : "View in shop") + "</small></div>" + I.chev + "</a>" +
      '<div class="sect"><div class="prow">' + (sold ? '<button class="btn sec" style="flex:1" id="relist">Mark available</button>' : '<button class="btn" style="flex:1" id="msold">Mark sold</button>') + '<button class="btn ghost" style="flex:1" id="del">Delete</button></div><a class="btn sec full" style="margin-top:8px" id="edit" href="/you/item/' + l.id + '/edit" data-link>Edit listing</a></div>' +
      '<div class="sect"><h3>Where it\'s listed</h3><div class="mk">' + logo("fashionistas") + '<div class="nm"><b>fashionistas.ai</b><small class="' + (sold ? "" : "st-ok") + '">' + (sold ? "Sold" : "Live") + "</small></div></div>" + (sold ? "" : '<div id="shops"></div>') + "</div></div>";
    if (!sold) { drawShops(); extCheck(); }
    if ($("#msold")) $("#msold").onclick = function () { soldSheet(l); };
    if ($("#relist")) $("#relist").onclick = function () { api("/api/listings/" + l.id, { method: "PUT", body: JSON.stringify({ status: "active" }) }).then(function () { MARKET = null; toast("Back on sale"); render(); }).catch(function (e) { toast(e.message); }); };
    $("#del").onclick = function () {
      var s = sheet("Delete listing?", '<p style="margin:0">“' + esc(l.title) + "” will be removed from fashionistas.ai. Listings on other sites stay up until you take them down there.</p>", '<button class="btn ghost" style="flex:1" data-close2>Cancel</button><button class="btn" style="flex:1;background:var(--err);color:#fff" id="delok">Delete</button>');
      $("[data-close2]", s).onclick = function () { closeSheet(); };
      $("#delok", s).onclick = function () { api("/api/listings/" + l.id, { method: "DELETE" }).then(function () { MARKET = null; MINE = null; closeSheet(true); toast("Deleted"); nav("/you", true); }).catch(function (e) { toast(e.message); }); };
    };
  }).catch(function () { app.innerHTML = topbar({ back: true, title: "Listing" }) + emptyState(I.alert, "Couldn't load", "Check your connection and try again.", '<button class="btn" onclick="location.reload()">Try again</button>'); });
}
function soldSheet(l) {
  var live = Object.keys(l.shops || {}).filter(function (k) { return k !== "fashionistas" && /listed|active/.test(l.shops[k].status); });
  var s = sheet("Mark as sold", '<label class="field"><span>Sold for</span><span class="pre" style="display:block"><b>$</b><input class="in" id="sp" inputmode="decimal" value="' + esc(l.price) + '"></span></label>' + (live.length ? '<p class="hint" style="margin:0">' + (hasExt() ? "We'll also take it down on " : "Remember to take it down on ") + live.map(function (k) { return (MKBY[k] || [0, k])[1]; }).join(", ") + ".</p>" : ""), '<button class="btn full" id="sok">Mark sold</button>');
  $("#sok", s).onclick = function () {
    var price = Number($("#sp", s).value) || Number(l.price) || 0, b = this; b.disabled = true;
    fetch("/api/crosslist/status", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Authorization: "Bearer " + TOKEN }, body: JSON.stringify({ listing_id: l.id, platform: "fashionistas", status: "sold", price: price }) }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || "Couldn't save");
      if (hasExt() && live.length) { var urls = {}; live.forEach(function (k) { if (l.shops[k].url) urls[k] = l.shops[k].url; }); window.postMessage({ type: "FA_DELIST", job: { urls: urls } }, location.origin); }
      MARKET = null; closeSheet(true); toast("Marked sold 🎉"); render();
    }).catch(function (e) { b.disabled = false; toast(e.message); });
  };
}
route(/^\/you\/item\/(\d+)$/, manageView);
function editView(id) {
  if (!TOKEN) return nav("/signin?next=" + encodeURIComponent(location.pathname), true);
  app.innerHTML = topbar({ back: true, title: "Edit listing" }) + '<div class="sk" style="height:320px;margin:16px"></div>';
  loadMine(true).then(function (L) {
    var l = L.find(function (x) { return Number(x.id) === Number(id); });
    if (!l) { app.innerHTML = topbar({ back: true, title: "Edit listing" }) + emptyState(I.hanger, "Listing not found", "It may have been deleted.", '<a class="btn" href="/you" data-link>Your listings</a>'); return; }
    setMeta("Edit " + l.title); var cond = l.condition;
    app.innerHTML = '<div class="view">' + topbar({ back: true, title: "Edit listing" }) + '<div class="pad">' + (l.photo_url ? '<div class="revhead"><img src="' + esc(l.photo_url) + '" alt=""></div>' : "") +
      '<label class="field"><span>Title</span><input class="in" id="e-title" maxlength="80" value="' + esc(l.title) + '"></label>' +
      '<label class="field"><span>Price</span><span class="pre" style="display:block"><b>$</b><input class="in" id="e-price" inputmode="decimal" value="' + esc(l.price) + '"></span></label>' +
      '<label class="field"><span>Category</span><select class="in select" id="e-cat">' + catOptions(l.category) + "</select></label>" +
      '<div class="field"><span>Condition</span><div class="wrap" id="e-cond">' + CONDS.map(function (c) { return '<button type="button" class="chip' + (cond === c ? " on" : "") + '" data-ec="' + esc(c) + '">' + esc(CONDLBL[c]) + "</button>"; }).join("") + "</div></div>" +
      '<label class="field"><span>Size</span><input class="in" id="e-size" value="' + esc(l.size || "") + '"></label>' +
      '<label class="field"><span>Brand <em>optional</em></span><input class="in" id="e-brand" value="' + esc(l.brand || "") + '"></label>' +
      '<label class="field"><span>Color <em>optional</em></span><input class="in" id="e-color" value="' + esc(l.color || "") + '"></label>' +
      '<label class="field"><span>Description</span><textarea class="in" id="e-desc" maxlength="2000">' + esc(l.description || "") + "</textarea></label>" +
      '<div style="height:80px"></div></div><div class="footcta"><div class="footcta-in"><button class="btn" id="esave">Save changes</button></div></div></div>';
    $$("[data-ec]").forEach(function (b) { b.onclick = function () { tap(); cond = b.dataset.ec; $$("[data-ec]").forEach(function (o) { o.classList.toggle("on", o === b); }); }; });
    $("#e-price").oninput = function (e) { e.target.value = e.target.value.replace(/[^0-9.]/g, ""); };
    $("#esave").onclick = function () {
      var b = this, t = $("#e-title").value.trim(), pr = Number($("#e-price").value);
      if (t.length < 3) return toast("Add a title (3+ characters)"); if (!(pr > 0)) return toast("Add a price");
      b.disabled = true; b.innerHTML = '<span class="spin"></span> Saving…';
      var body = { title: t, price: pr, category: $("#e-cat").value || l.category, condition: cond, size: $("#e-size").value.trim(), brand: $("#e-brand").value.trim(), color: $("#e-color").value.trim(), description: $("#e-desc").value.trim() };
      api("/api/listings/" + l.id, { method: "PUT", body: JSON.stringify(body) }).then(function () { MARKET = null; MINE = null; toast("Saved ✓"); nav("/you/item/" + l.id, true); })
        .catch(function (e) { b.disabled = false; b.textContent = "Save changes"; toast(e.message || "Couldn't save"); });
    };
  }).catch(function () { app.innerHTML = topbar({ back: true, title: "Edit listing" }) + emptyState(I.alert, "Couldn't load", "Check your connection and try again.", '<button class="btn" onclick="location.reload()">Try again</button>'); });
}
route(/^\/you\/item\/(\d+)\/edit$/, editView);

route(/^\/you\/shops$/, function () {
  if (!TOKEN) return nav("/signin?next=/you/shops", true);
  CUR = null; setMeta("Connected shops");
  app.innerHTML = '<div class="view">' + topbar({ back: true, title: "Connected shops" }) + '<div class="sect"><p style="margin-top:8px">Sign into a marketplace in this browser and it shows up here. Switch on the ones you want new listings posted to.</p><div id="shops"></div></div></div>';
  loadPref().then(function () { drawShops(); extCheck(); });
});

/* ================= MESSAGES ================= */
var UNREAD = 0;
function pollUnread() { if (!TOKEN) { UNREAD = 0; return; } api("/api/dm").then(function (d) { var n = (d.contacts || []).reduce(function (a, c) { return a + (Number(c.unread) || 0); }, 0); if (n !== UNREAD) { UNREAD = n; tabs(); } }).catch(function () {}); }
route(/^\/you\/messages$/, function () {
  if (!TOKEN) return nav("/signin?next=/you/messages", true);
  setMeta("Messages");
  app.innerHTML = '<div class="view">' + topbar({ back: true, title: "Messages" }) + '<div id="cl"><div class="sk" style="height:64px;margin:16px"></div></div></div>';
  api("/api/dm").then(function (d) {
    var c = (d.contacts || []).filter(function (x) { return x.last || x.unread; });
    $("#cl").innerHTML = c.length ? c.map(function (x) { var last = x.last && (x.last.body || x.last) || ""; return '<a class="lrow" style="min-height:72px" href="/you/messages/' + x.id + '" data-link><span class="av">' + esc(String(x.name || "?").charAt(0)) + '</span><div class="nm"><b>' + esc(x.name) + '</b><small style="color:var(--ink2);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(typeof last === "string" ? last : "") + "</small></div>" + (x.unread ? '<span class="dot" style="position:static">' + x.unread + "</span>" : "") + "</a>"; }).join("")
      : emptyState(I.chat, "No messages yet", "When you message a seller or a buyer messages you, it shows up here.", '<a class="btn" href="/" data-link>Browse the shop</a>');
  }).catch(function () { $("#cl").innerHTML = emptyState(I.alert, "Couldn't load messages", "Check your connection and try again.", '<button class="btn" onclick="location.reload()">Try again</button>'); });
});
route(/^\/you\/messages\/(\d+)$/, function (peer) {
  if (!TOKEN) return nav("/signin?next=" + encodeURIComponent(location.pathname + location.search), true);
  var itemId = new URLSearchParams(location.search).get("item"), item = itemId && (MARKET || []).find(function (x) { return String(x.id) === itemId; });
  var name = item && item.seller ? (item.seller.display_name || item.seller.username) : "Messages";
  app.innerHTML = '<div class="view">' + topbar({ back: true, title: name }) + (item ? '<a class="card-row" style="margin-top:8px" href="/shop/' + item.id + '" data-link><img src="' + esc(item.photo_url) + '" alt=""><div style="flex:1;min-width:0"><b>' + esc(item.title) + "</b><small>" + money(item.price) + "</small></div></a>" : "") + '<div class="thread" id="th"><div class="sk" style="height:40px;width:60%"></div></div><div style="height:72px"></div><form class="compose" id="cf"><div class="compose-in"><input class="in" id="ci" placeholder="Write a message…" autocomplete="off" aria-label="Message"><button class="btn sm" style="height:48px;border-radius:24px" type="submit">Send</button></div></form></div>';
  if (item) $("#ci").value = "Hi! Is “" + item.title + "” still available?";
  var seen = {};
  function mineMsg(m) { var s = m.sender_id != null ? m.sender_id : m.from_id != null ? m.from_id : m.from != null ? m.from : m.user_id; return m.mine === true || (USER && Number(s) === Number(USER.id)); }
  function bub(m) { return '<div class="bub' + (mineMsg(m) ? " me" : "") + '">' + esc(m.body) + "<small>" + esc(String(m.created_at || "").slice(5, 16).replace("T", " ")) + "</small></div>"; }
  function load(first) {
    api("/api/dm/" + peer + "?after=0").then(function (d) {
      var th = $("#th"); if (!th) return; var ms = d.messages || [];
      if (d.peer && d.peer.name && name === "Messages") { name = d.peer.name; $(".top h1").textContent = name; }
      if (first) { th.innerHTML = ms.length ? "" : '<p class="sub" style="text-align:center;margin:24px 0">Say hi — ask about fit, condition or shipping.</p>'; }
      var add = ms.filter(function (m) { return !seen[m.id]; }); add.forEach(function (m) { seen[m.id] = 1; }); if (add.length) { var e = th.querySelector(".sub"); if (e) e.remove(); th.insertAdjacentHTML("beforeend", add.map(bub).join("")); scrollTo(0, document.body.scrollHeight); }
      if (first) pollUnread();
    }).catch(function (e) { if (first) $("#th").innerHTML = emptyState(I.alert, "Couldn't open this chat", e.message, ""); });
  }
  load(true); clearInterval(window.__dmT); window.__dmT = setInterval(function () { if (/^\/you\/messages\/\d+$/.test(location.pathname)) load(false); else clearInterval(window.__dmT); }, 5000);
  $("#cf").onsubmit = function (e) {
    e.preventDefault(); var i = $("#ci"), v = i.value.trim(); if (!v) return; i.value = ""; tap();
    var tmp = document.createElement("div"); tmp.className = "bub me"; tmp.innerHTML = esc(v) + "<small>Sending…</small>"; $("#th").appendChild(tmp); var e2 = $("#th .sub"); if (e2) e2.remove(); scrollTo(0, document.body.scrollHeight);
    api("/api/dm/" + peer, { method: "POST", body: JSON.stringify({ body: v }) }).then(function (d) { if (d.message && d.message.id) seen[d.message.id] = 1; tmp.querySelector("small").textContent = "Sent"; })
      .catch(function (x) { tmp.querySelector("small").textContent = "Not sent — " + x.message; tmp.style.opacity = .6; });
  };
});

/* ================= BOOT ================= */
tabs(); render();
setTimeout(function () { extHello(); pollUnread(); }, 800); setInterval(pollUnread, 60000);
})();
