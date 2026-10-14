
const API = "/w";
let TOKEN = localStorage.getItem("fash_token") || "";
let USER = JSON.parse(localStorage.getItem("fash_user") || "null");
let S = { listings: [], orders: [], items: [] };
let MAP_OBJ = null;   // the Leaflet map instance, one at a time
let CURRENT = {};

const $ = (s) => document.querySelector(s);
const view = (name) => { document.querySelectorAll("body > section[id^=view-], nav.tabbar").forEach(el => el.classList.toggle("hidden", el.id !== "view-"+name && el.id !== "tabbar")); };
const toast = (m, ms=2200) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove("show"), ms); };
const money = (n) => "$" + (Number(n)||0).toLocaleString("en-US", { minimumFractionDigits: (Number(n)||0) % 1 === 0 ? 0 : 2, maximumFractionDigits: (Number(n)||0) % 1 === 0 ? 0 : 2 });
const fmt = (d) => { if(!d) return ""; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString(undefined,{month:"short",day:"numeric"}); };

/* ---- theme: OS preference by default, explicit choice wins and persists ---- */
const THEME_KEY = "fash_theme";
function readStoredTheme(){ try{ const t = localStorage.getItem(THEME_KEY); return (t === "dark" || t === "light") ? t : null; }catch(e){ return null; } }
function applyTheme(t){ if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
function toggleTheme(){
 const isDark = document.documentElement.getAttribute("data-theme") === "dark"
   || (!document.documentElement.hasAttribute("data-theme") && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
 const next = isDark ? "light" : "dark";
 try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
 applyTheme(next);
}
applyTheme(readStoredTheme());

/* ---- kinetic type for section headers (plain text stays if this is skipped) ---- */
function kineticTitle(text){
 const el = document.getElementById("view-title");
 const plain = text == null ? "" : String(text);
 if (!el) return;
 el.textContent = plain;
 try{
  if (!plain) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const frag = document.createDocumentFragment();
  let n = 0;
  for (const ch of plain){
   if (ch === " "){ frag.appendChild(document.createTextNode(" ")); continue; }
   const s = document.createElement("span");
   s.className = "kt";
   s.textContent = ch;
   s.style.animationDelay = (n * 0.026).toFixed(3) + "s";
   frag.appendChild(s);
   n++;
  }
  el.textContent = "";
  el.appendChild(frag);
 }catch(e){ el.textContent = plain; }
}

function showLoader(html) { return `<div class="card"><div class="spinner"></div>${html||""}</div>`; }

async function api(path, opts={}) {
 const headers = { "Content-Type": "application/json", ...(opts.headers||{}) };
 if (TOKEN) headers["Authorization"] = "Bearer " + TOKEN;
 const r = await fetch(API + path, { ...opts, headers });
 let d = null; try { d = await r.json(); } catch {}
 if (r.status === 401) {
  // A 401 from the auth routes means those credentials were wrong — never tear a
  // working session down over a typo, and never tell an anonymous visitor their
  // "session expired".
  if (path.indexOf("/api/auth/") === 0) throw new Error((d && d.error) || "Wrong username or password.");
  if (!TOKEN) throw new Error("Sign in first to do that.");
  // Confirm the token itself is dead before signing anyone out: routes answer 401
  // for plenty of reasons that have nothing to do with the session. The auth gate
  // runs before routing, so /api/auth/me is 401 only for a dead token.
  const dead = await fetch(API + "/api/auth/me", { headers: { Authorization: "Bearer " + TOKEN } }).then(x => x.status === 401).catch(() => false);
  if (dead) { toast("Session expired — sign in again, it only takes seconds.", 4000); setTimeout(()=>logout(), 1200); }
  else toast("You are signed in — that step is not available on your account yet.", 4000);
  throw new Error("unauthorized");
 }
 if (!r.ok) throw new Error(d?.error || "Request failed (" + r.status + ")");
 return d;
}

/* ================= AUTH ================= */
// Demo CTA on the auth screen. Uses the seeded demo-seller credentials.
async function demoLogin(){ try { const d = await api("/api/auth/demo", { method:"POST", body:"{}" }); afterAuth(d); } catch(e){ toast(e.message); } }
async function doLogin(){
 const u = $("#login-u").value.trim(), p = $("#login-p").value;
 if (!u || !p) return toast("Enter username and password");
 try {
 const d = await api("/api/auth/login", { method:"POST", body: JSON.stringify({ username:u, password:p }) });
 afterAuth(d);
 } catch(e){ toast(e.message); }
}
async function doSignup(){
 const u = $("#su-u").value.trim(), e = $("#su-e").value.trim(), p = $("#su-p").value;
 if (u.length < 3) return toast("Username needs 3+ characters");
 if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast("Enter a valid email");
 if (p.length < 6) return toast("Password needs 6+ characters");
 try {
 const d = await api("/api/auth/register", { method:"POST", body: JSON.stringify({ username:u, email:e, password:p }) });
 afterAuth(d);
 } catch(e){ toast(e.message); }
}
function afterAuth(d){ TOKEN = (d && d.token) || ""; USER = (d && d.user) || (d && d.id ? { id: d.id, email: d.email, username: d.username || d.email } : null); if (TOKEN) localStorage.setItem("fash_token", TOKEN); else localStorage.removeItem("fash_token"); localStorage.setItem("fash_user", JSON.stringify(USER)); $("#view-auth").classList.add("hidden"); $("#view-app").classList.remove("hidden"); $("#tabbar").classList.remove("hidden"); $("#guide-fab").classList.remove("hidden"); const resumed = resumeAfterAuth(); syncSessionChrome(); const who = (USER && (USER.username || USER.email)) || "you"; if (!resumed) toast("Signed in as " + who + " — next: Connect your shop, then Sell to post an item.", 6000); }
function logout(){ TOKEN = ""; USER = null; localStorage.removeItem("fash_token"); localStorage.removeItem("fash_user"); $("#view-app").classList.add("hidden"); $("#tabbar").classList.add("hidden"); $("#guide-fab").classList.add("hidden"); guideToggle(false); $("#view-auth").classList.remove("hidden"); syncSessionChrome(); }

/* Session restore: the stored token is checked once at boot so a signed-in user
   is never silently dumped back at the sign-in screen, and a dead one is
   explained instead of failing on the first click. */
async function restoreSession(){
 if (!TOKEN) return;
 try {
  const r = await fetch(API + "/api/auth/me", { headers: { Authorization: "Bearer " + TOKEN } });
  if (r.status === 401){
   TOKEN = ""; USER = null;
   localStorage.removeItem("fash_token"); localStorage.removeItem("fash_user");
   toast("Your session ended — sign in again to pick up where you left off.", 5000);
   return;
  }
  /* Sliding session — "sign in once, forever". A live token comes back
     re-signed with a fresh expiry; store it and this account never asks for a
     password again on this device (it would take a year of not opening the app). */
  const d = await r.json().catch(() => null);
  if (d && d.token && d.token !== TOKEN){ TOKEN = d.token; localStorage.setItem("fash_token", TOKEN); }
 } catch(e){ /* offline or the API is unreachable: keep what we have */ }
}

/* 402 — the site is free. A direct eBay/Etsy post is off because keys are unset,
   not because the seller needs a plan. Send them to copy-and-open. */
function guideSubscribe(what){
 toast(what + " has no direct post yet. The site is free — copy the listing and open their sell page.", 5500);
}
function showAuth(tab){
  $("#view-app").classList.add("hidden");
  $("#tabbar").classList.add("hidden");
  $("#guide-fab").classList.add("hidden");
  guideToggle(false);
  $("#view-auth").classList.remove("hidden");
  authTab(tab || "login");
  const c = document.querySelector(".land-card");
  if (c) c.scrollIntoView({ behavior:"smooth", block:"center" });
}
function renderAuthPrompt(title, subtitle){
  return `<div class="card" style="text-align:center;padding:32px 20px;max-width:440px;margin:24px auto;">`
    + `<div class="brand" style="justify-content:center;margin-bottom:12px">`
    + `<span class="mark" aria-hidden="true"><svg class="mark-fb" width="22" height="22" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"><path d="M32 28v-4.5a6 6 0 1 1 6-6"/><path d="M10 46 32 28l22 18z"/></svg></span>fashionistas.ai`
    + `</div>`
    + `<h3 style="margin:0 0 8px">${escapeHtml(title || "Log in to your account")}</h3>`
    + `<p class="mut" style="margin:0 0 20px">${escapeHtml(subtitle || "Sign in to see your clothes, sales and seller tools.")}</p>`
    + `<div style="display:flex;flex-direction:column;gap:10px;align-items:center">`
    + `<button class="btn btn-primary" onclick="showAuth('login')" style="width:100%;max-width:280px" data-tip="Open the sign-in screen to type your username and password." title="Open the sign-in screen to type your username and password.">Log in</button>`
    + `<button class="btn btn-accent" onclick="showAuth('signup')" style="width:100%;max-width:280px" data-tip="Create a free seller account with username, email and password." title="Create a free seller account with username, email and password.">Create free account</button>`
    + `<button class="btn btn-soft btn-sm" onclick="demoLogin()" style="width:100%;max-width:280px;margin-top:4px" data-tip="Try the app with the seeded demo account first." title="Try the app with the seeded demo account first.">Log in as demo seller</button>`
    + `<button class="btn btn-ghost btn-sm" onclick="go('shop')" style="width:100%;max-width:280px" data-tip="See what is for sale from other sellers without signing in." title="See what is for sale from other sellers without signing in.">Browse the shop instead</button>`
    + `</div>`
    + `</div>`;
}

/* ================= NAV ================= */
/* The bottom tabs are the single source of truth for what this app contains.
   The top bar (web) and the hamburger drawer (phone) are built from the same
   anchors, so the three can never drift apart. */
function navBuild(){
  const top = document.getElementById("topnav");
  const drw = document.getElementById("drawer-links");
  const src = document.querySelectorAll("nav.tabbar a");
  if (!top || !drw || !src.length) return;
  top.innerHTML = ""; drw.innerHTML = "";
  src.forEach(a => { top.appendChild(a.cloneNode(true)); drw.appendChild(a.cloneNode(true)); });
}
function landNavToggle(){
  const m = document.getElementById("ln-links"), b = document.getElementById("ln-burger");
  if (!m) return;
  const open = !m.classList.contains("open");
  m.classList.toggle("open", open);
  if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
}
function landNavClose(){
  const m = document.getElementById("ln-links"), b = document.getElementById("ln-burger");
  if (!m || !m.classList.contains("open")) return;
  m.classList.remove("open");
  if (b) b.setAttribute("aria-expanded", "false");
}
function navDrawer(open){
  const d = document.getElementById("drawer");
  const v = document.getElementById("drawer-veil");
  const b = document.getElementById("nav-burger");
  if (!d || !v) return;
  d.classList.toggle("hidden", !open);
  v.classList.toggle("hidden", !open);
  if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
  document.body.style.overflow = open ? "hidden" : "";
}
document.addEventListener("keydown", e => { if (e.key === "Escape") navDrawer(false); });
const TITLES = { home:["Home",""], shop:["Shop",""], closet:["My clothes",""], snap:["Sell",""], sell:["Sell",""], xl:["Shops",""], map:["Near you",""], more:["More",""] };
function syncSessionChrome(){
  var on = !!(TOKEN && USER);
  document.querySelectorAll("button").forEach(function(b){
    if ((b.getAttribute("onclick") || "").indexOf("logout(") !== -1) b.style.display = on ? "" : "none";
  });
  /* A guest who arrived at /shop/<id> from a link needs a door back into their
     account: the chrome only ever offered "Sign out" (hidden for guests), so
     nobody could sign in without going back to the landing page. */
  document.querySelectorAll("#signin-btn, #drawer-signin").forEach(function(b){
    b.style.display = on ? "none" : "";
  });
  document.querySelectorAll('a[href="/account/delete/"], a[href="/seller/stats/"]').forEach(function(a){
    a.style.display = on ? (a.classList.contains("drawer-delete") ? "block" : "") : "none";
  });
}
function enterBrowse(v){
  var auth = document.getElementById("view-auth");
  var app = document.getElementById("view-app");
  var bar = document.getElementById("tabbar");
  if (auth) auth.classList.add("hidden");
  if (app) app.classList.remove("hidden");
  if (bar) bar.classList.remove("hidden");
  syncSessionChrome();
  go(v || "shop");
}
async function go(v){
  try{ document.documentElement.dataset.view = v; }catch(e){}
  document.querySelectorAll("nav.tabbar a, #topnav a, #drawer-links a").forEach(a => a.classList.toggle("on", a.dataset.v === v));
  navDrawer(false);
  /* A sheet belongs to the screen you opened it from. Leave it hanging around
     and it covers the next screen: a buyer sheet stayed open over the Sell
     wizard and swallowed a drag-and-drop meant for the photo drop zone. */
  if (document.getElementById("sheet")) { try{ closeSheet(); }catch(e){} }
  /* Move on and the floating checklist stops covering whatever you moved to;
     it is one tap away and the user can reopen it. */
  if (typeof SCCollapse === "function") { try{ SCCollapse(); }catch(e){} }
  /* The marketplace is addressable: /shop opens it directly, and leaving an
     item never strands /shop/<id> in the bar. replaceState keeps the back
     button about views, not about every tab click. */
  try{ if (v === "shop" && (location.pathname || "").replace(/\/$/, "") !== "/shop") history.replaceState(history.state, "", "/shop"); }catch(e){}
  const [t, sub] = TITLES[v] || ["",""]; if (t) document.title = t + " — fashionistas.ai";
  kineticTitle(t); $("#view-sub").textContent = sub;
  const el = $("#screen");
  el.classList.remove("view-in"); void el.offsetWidth; el.classList.add("view-in");
  if (v === "home") return renderHome(el);
  if (v === "shop") return renderShop(el);
  if (v === "closet") return renderCloset(el);
  if (v === "snap") { try{ if (window.SellerCoach) SellerCoach.mark("photo"); }catch(e){} return renderSnap(el); }
  if (v === "sell") return renderSell(el);
  if (v === "xl") { try{ if (window.SellerCoach) SellerCoach.mark("multilist"); }catch(e){} return renderXL(el); }
  if (v === "map") return renderMap(el);
  if (v === "more") return renderMore(el);
}

/* ================= ROLE SWITCH + SHOP (buyer marketplace) ================= */
function getRole(){ try{ return localStorage.getItem("fash_role") || "shopping"; }catch(e){ return "shopping"; } }
function setRole(r){ try{ localStorage.setItem("fash_role", r); }catch(e){} if (r === "shopping") go("shop"); else go("home"); }
function roleSwitchHtml(){
  const r = getRole();
  return `<div class="ux-seg" role="group" aria-label="Selling or shopping">`
  + `<button type="button" class="${r==="selling"?"on":""}" aria-pressed="${r==="selling"}" onclick="setRole('selling')">Selling</button>`
  + `<button type="button" class="${r==="shopping"?"on":""}" aria-pressed="${r==="shopping"}" onclick="setRole('shopping')">Shopping</button>`
  + `</div>`;
}
function refreshTips(){ try{ if (window.syncTips) window.syncTips(document); }catch(e){} try{ if (window.SellerCoach) window.SellerCoach.refresh(); }catch(e){} }
S.market = S.market || []; S.marketCount = S.marketCount || 0;
S.marketQ = S.marketQ || ""; S.marketCat = S.marketCat || ""; S.marketSort = S.marketSort || "new";
/* Public Shop feed hygiene (client-side): hide QA/test/bulk + no-photo junk,
   and normalize platform pills to the six draft targets. API still returns
   the full set — clean at display time until the worker filters. */
const SHOP_SIX = ["depop","ebay","poshmark","mercari","vinted","grailed"];
const SHOP_SIX_LABEL = { depop:"Depop", ebay:"eBay", poshmark:"Poshmark", mercari:"Mercari", vinted:"Vinted", grailed:"Grailed" };
function shopPlatformCanon(p){
  const k = String(p||"").trim().toLowerCase().replace(/[\s_-]+/g,"");
  const map = {
    depop:"depop", depopalt:"depop", depopalt2:"depop",
    ebay:"ebay",
    poshmark:"poshmark", posh:"poshmark", poshalt:"poshmark",
    mercari:"mercari",
    vinted:"vinted",
    grailed:"grailed"
  };
  return map[k] || null;
}
function shopNormalizePlatforms(list){
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach(p => {
    const id = shopPlatformCanon(p);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(SHOP_SIX_LABEL[id] || id);
  });
  return out;
}
function shopIsJunkListing(m){
  if (!m) return true;
  if (!m.photo_url) return true;
  const t = String(m.title || "").toLowerCase();
  if (!t.trim()) return true;
  // QA / test / bulk / verify patterns from staging feed
  if (/\b(qa|test|bulk|dummy|asdf|lorem|sample listing|verify crosspost|category proof)\b/i.test(t)) return true;
  if (/^qa\b/i.test(t) || /\bqa\s*v?\d/i.test(t)) return true;
  if (/bulk\s*[ab0-9]/i.test(t)) return true;
  return false;
}
function shopPublicRows(list){
  return (list || []).filter(m => !shopIsJunkListing(m));
}

/* ================= CATEGORY TREE (module scope — see note) =================
   Real two-level categories, the way eBay and Craigslist organise a catalogue:
   DEPARTMENT -> SUBCATEGORY. Stored as one slash-joined path in the existing
   `category` column, so no schema change is needed (remote D1 is read-only
   here). Old rows still hold a single flat word ("Tops", "Shoes") — LEGACY
   maps those onto the new tree so nothing is stranded and no re-write is
   required.

   IMPORTANT: this must stay at module scope. It used to be declared INSIDE
   renderShop(), while marketRows() and the item-detail builder call it from
   outside. The initial load was shielded by `if (S.marketCat)`, so the Shop
   looked fine until a shopper clicked a category chip — then it threw
   "ReferenceError: canonCat is not defined" and the filter silently did
   nothing. */
/* Tree now comes from the shared category table (functions/_lib/categories.js
   -> assets/categories.js, window.FASH_CAT). Departments: Women, Men, Kids,
   Home, Art. Stored value is "Dept/Sub". Every older value (flat "Tops", the
   previous "Women's Clothing/Tops & Shirts" tree) resolves through LEGACY so
   existing listings still load and filter. */
const FCAT = (typeof window !== "undefined" && window.FASH_CAT) || { departments:[], categories:[], sizes:{}, legacy:{} };
const TAX = {};
FCAT.departments.forEach(d => { TAX[d] = FCAT.categories.filter(c => c.dept === d).map(c => c.sub); });
const TAX_LEGACY = FCAT.legacy || {};
function catRow(raw){ const p = taxPath(raw); if (!p || p.indexOf("/") < 0) return null; return FCAT.categories.find(c => c.path === p) || null; }
/* Shop's own category path for a stored value ("Womenswear > Tops"), "" if the shop has none. */
function shopCatPath(raw, shop){ const r = catRow(raw); if (!r) return ""; if (shop === "ebay") return r.ebay.id; if (shop === "etsy") return r.etsy || ""; return (r.shops && r.shops[shop]) || ""; }
function catSizes(raw){ const r = catRow(raw); return r ? (FCAT.sizes[r.size] || []) : []; }
function taxDepts(){ return Object.keys(TAX); }
function taxSubs(dept){ return (TAX[dept] || []).slice(); }
/* Any stored value -> canonical path ("", "Dept" or "Dept/Sub"). */
function taxPath(raw){
  if (typeof raw !== "string") return "";
  /* Tolerate a leading slash: older rows were keyed "/tops", and a value that
     can't be resolved is worse than one resolved one step loosely. */
  const v = raw.trim().replace(/^\/+/, ""); if (!v) return "";
  const lk = v.toLowerCase().replace(/\s*\/\s*/g, "/");
  if (TAX_LEGACY[lk]) return TAX_LEGACY[lk];
  if (v.indexOf("/") > -1){
    const parts = v.split("/").map(s => s.trim()).filter(Boolean);
    if (parts.length >= 1 && TAX[parts[0]]) {
      const sub = parts[1];
      if (!sub) return parts[0];
      return taxSubs(parts[0]).indexOf(sub) > -1 ? parts[0] + "/" + sub : parts[0];
    }
  }
  const k = v.toLowerCase();
  if (TAX_LEGACY[k]) return TAX_LEGACY[k];
  /* exact department name, any capitalisation */
  const hit = taxDepts().find(d => d.toLowerCase() === k);
  if (hit) return hit;
  /* exact subcategory name on its own -> attach to its department */
  for (const d of taxDepts()) if (taxSubs(d).some(s => s.toLowerCase() === k)) return d + "/" + v;
  return "";
}
function taxDept(p){ p = p || ""; return p.split("/")[0] || ""; }
function taxSub(p){ p = p || ""; return p.split("/").slice(1).join("/"); }
function taxLabel(p){ p = p || ""; return p ? p.split("/").pop() : ""; }
/* Does this stored value sit under the selected path? A bare department
   matches everything beneath it; a full path matches only itself (and
   anything deeper, should a third level ever be added). */
function taxMatches(raw, sel){
  if (!sel) return true;
  const p = taxPath(raw); if (!p) return false;
  return p === sel || p.indexOf(sel + "/") === 0;
}
/* Back-compatible helper used by the item pill: shows the most specific
   name we can resolve for a stored value. */
function canonCat(c){ return taxLabel(taxPath(c)); }
/* Safe to drop inside an inline onclick="…" attribute. escapeAttr() only
   handles double quotes, and department names contain apostrophes
   ("Women's Clothing"), which would truncate the call and throw a syntax
   error on click. Encoded, the attribute holds no quote characters at all. */
function taxQ(s){ return encodeURIComponent(String(s == null ? "" : s)).replace(/'/g, "%27"); }
function taxUnq(s){ try { return decodeURIComponent(String(s || "")); } catch(e){ return String(s || ""); } }

/* ================= GRAPHICS, BACKDROPS + MOVING WORDS =================
   Hero banners and department tiles for the buyer (Shop) and seller (Closet)
   screens. Every card carries a word; the artwork is a gradient plus a drawn
   mark from this file, so nothing depends on an external image host and the
   cards still read correctly with images blocked. */
function REDUCED(){ try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e){ return false; } }
const ICONS = {
  dress:'<path d="M9 3h6l-1 4.5 6.5 4.2-2.2 9.3H5.7L3.5 11.7 10 7.5 9 3Z"/>',
  shirt:'<path d="M8.5 3 12 4.6 15.5 3 20 6l-2.2 3.4L16.5 8.4V21h-9V8.4L6.2 9.4 4 6l4.5-3Z"/>',
  kid:'<path d="M12 3.5 14.2 9l5.8.3-4.5 3.6 1.6 5.6L12 15.6 6.9 18.5l1.6-5.6L4 9.3 9.8 9 12 3.5Z"/>',
  shoe:'<path d="M2.6 16.4h7.6l3 1.6H21a1 1 0 0 1 1 1v1.4H2.6v-4Zm1.3-1.2V9.3l3.2-1.5 2.1 2.5 3-1.6-4.2-4.8H5.7L3.2 8.4V15h.7Z"/>',
  bag:'<path d="M5.6 8h12.8l-1 12.6H6.6L5.6 8Z"/><path d="M9 8V6.3a3 3 0 0 1 6 0V8"/>',
  gem:'<path d="M12 3.5 20 9l-8 11.5L4 9l8-5.5Z"/><path d="M4 9h16M12 3.5 8.4 9l3.6 11.5L15.6 9 12 3.5Z"/>',
  bolt:'<path d="M13.5 2.5 5 13.4h5.6L9.8 21.5 19 10.4h-5.7l.2-7.9Z"/>',
  tag:'<path d="M3.5 11.4V4.5h6.9l9.1 9.1-6.9 6.9-9.1-9.1Z"/><circle cx="7.5" cy="8.5" r="1.4"/>'
};
const DEPT_ART = {
  "Women":               { a:"#ff8a3d", b:"#ff3d6e", ic:"dress" },
  "Men":                 { a:"#4f7cff", b:"#7c5cff", ic:"shirt" },
  "Kids":                { a:"#24c6a5", b:"#2f80ed", ic:"kid"   },
  "Home":                { a:"#f7971e", b:"#c84b31", ic:"tag"   },
  "Art":                 { a:"#c8860a", b:"#8b5cf6", ic:"gem"   },
  "Women's Clothing":    { a:"#ff8a3d", b:"#ff3d6e", ic:"dress" },
  "Men's Clothing":      { a:"#4f7cff", b:"#7c5cff", ic:"shirt" },
  "Kids & Baby":         { a:"#24c6a5", b:"#2f80ed", ic:"kid"   },
  "Shoes":               { a:"#ff5e3a", b:"#b13cff", ic:"shoe"  },
  "Bags & Luggage":      { a:"#f7971e", b:"#c84b31", ic:"bag"   },
  "Accessories":         { a:"#00c2ff", b:"#5b5bd6", ic:"gem"   },
  "Vintage & Designer":  { a:"#c8860a", b:"#8b5cf6", ic:"tag"   },
  "Sports & Outdoor":    { a:"#1f9d55", b:"#11998e", ic:"bolt"  }
};
const DEFAULT_ART = { a:"#ff8a3d", b:"#7c5cff", ic:"tag" };
function deptArt(d){ return DEPT_ART[d] || DEFAULT_ART; }
function deptIcon(d){
  const s = ICONS[(DEPT_ART[d] || DEFAULT_ART).ic] || ICONS.tag;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
}
/* Rolling words. Every candidate sits in the same grid cell, so the box sizes
   itself to the widest word — no fixed line-height arithmetic to break. */
let ROLL_TIMERS = [];
function stopRolls(){ try{ ROLL_TIMERS.forEach(clearInterval); }catch(e){} ROLL_TIMERS = []; }
function rollHtml(words){
  const w = (words || []).filter(Boolean);
  if (!w.length) return "";
  if (REDUCED()) return `<span class="roll static">${w.map(x => `<b class="on">${escapeHtml(x)}</b>`).join("")}</span>`;
  return `<span class="roll" data-roll>${w.map((x,i) => `<b class="${i?"":"on"}">${escapeHtml(x)}</b>`).join("")}</span>`;
}
function startRolls(root){
  if (REDUCED()) return;
  (root || document).querySelectorAll("[data-roll]").forEach(el => {
    if (el.__rolled) return; el.__rolled = true;
    const items = [...el.querySelectorAll("b")];
    if (items.length < 2) return;
    let i = 0;
    ROLL_TIMERS.push(setInterval(() => {
      i = (i + 1) % items.length;
      items.forEach((n,k) => n.classList.toggle("on", k === i));
    }, 2600));
  });
}
/* The seller stat strip. The count-up itself is the app's own number roll
   (`countUp`, [data-count]/[data-pre]) — declared further down this file, so a
   second definition here would have silently overridden it. Figures come from
   /api/analytics when we have it, so "Sold" matches the home screen. */
function sellerStatsHtml(){
  const st = S.stats || {};
  const known = st && (st.activeListings != null || st.sales != null);
  const active = known ? (Number(st.activeListings) || 0) : (S.listings || []).length;
  const sold = known ? (Number(st.sales) || 0) : (S.listings || []).length - active;
  const value = (S.listings || []).reduce((s,l) => s + (Number(l.price) || 0), 0);
  const box = (v, pre, label) => `<div class="stat-box"><b data-count="${Math.round(v)||0}"${pre?` data-pre="${pre}"`:""}>0</b><span>${label}</span></div>`;
  return `<div class="stat-strip" id="seller-stats" data-tip="Live figures from your account.">`
    + box(active, "", "For sale")
    + box(sold, "", "Sold")
    + box(value, "$", "Listed value")
    + `</div>`;
}
/* Fetch the real numbers once, then repaint the strip in place. */
function statsRefresh(){
  if (S.statsPromise) return S.statsPromise;
  S.statsPromise = api("/api/analytics").then(a => {
    S.stats = a.stats || a;
    const old = document.getElementById("seller-stats");
    if (old){
      const tmp = document.createElement("div");
      tmp.innerHTML = sellerStatsHtml();
      old.replaceWith(tmp.firstElementChild);
      countUp(document.getElementById("screen"));
    }
    return S.stats;
  }).catch(e => { S.statsPromise = null; return null; });
  return S.statsPromise;
}
/* Department tile: graphic card + word + count, in a swipeable rail. */
function catRailHtml(kind, depts, countFn, selectedDept, id){
  if (!depts.length) return `<p class="catrail-empty">No departments to show yet.</p>`;
  return `<div class="catrail"${id ? ` id="${id}"` : ""} data-tip="Swipe sideways through the departments.">` + depts.map((d,i) => {
    const art = deptArt(d), n = countFn(d), on = selectedDept === d;
    const tip = (n ? n + " item" + (n===1?"":"s") + " in " : "Nothing in ") + d + " yet. Click to look inside.";
    return `<button type="button" class="catcard${on?" on":""}" aria-pressed="${on}" style="--a:${art.a};--b:${art.b};--i:${i}"`
      + ` onclick="${kind}Pick(decodeURIComponent('${taxQ(d)}'))" data-tip="${escapeAttr(tip)}" title="${escapeAttr(tip)}">`
      + `<span class="catcard-ico">${deptIcon(d)}</span>`
      + `<span class="catcard-word">${escapeHtml(d)}</span>`
      + `<span class="catcard-n">${n} ${n===1?"item":"items"}</span>`
      + `</button>`;
  }).join("") + `</div>`;
}
function heroArt(file){
  return `<div class="hero-art" style="background-image:url('${file}')"></div>`;
}
/* BUYER — top of the Shop. Leads with the market, then the moving words. */
function buyerHero(){
  const n = (S.market || []).length;
  const caps = Object.keys(TAX).length;
  return `<section class="hero">`
    + heroArt("assets/fashionistas-bg-aurora-animated.svg")
    + `<div class="hero-scrim"></div>`
    + `<img class="hero-mono" src="assets/fashionistas-monogram-animated.svg" alt="" aria-hidden="true">`
    + `<div class="hero-in">`
    + `<div class="hero-eyebrow">Buy from real sellers</div>`
    + `<h2 class="hero-h">Find your next ${rollHtml(["vintage","statement piece","designer find","one-off","steal"])}</h2>`
    + `<p class="hero-sub">${n} item${n===1?"":"s"} live across ${caps} departments. Search by photo, then narrow it down department by department.</p>`
    + `<div class="hero-cta">`
    + `<button type="button" class="btn btn-accent" onclick="document.getElementById('market-nav').scrollIntoView({behavior:'smooth',block:'start'})" data-tip="Jump straight to the departments." title="Jump straight to the departments.">Browse departments</button>`
    + `<button type="button" class="btn btn-soft" onclick="go('snap')" data-tip="Photograph something and we'll tell you what it is and what it sells for." title="Photograph something to identify it.">Search by photo</button>`
    + `</div>`
    + `<div class="hero-tags"><span class="hero-tag">${n} items live</span><span class="hero-tag">${caps} departments</span><span class="hero-tag">Photo search</span><span class="hero-tag">Price check</span></div>`
    + `</div></section>`;
}
/* SELLER — top of the Closet. Live counts, counted up on arrival. */
function sellerHero(){
  return `<section class="hero">`
    + heroArt("assets/fashionistas-bg-ribbon.svg")
    + `<div class="hero-scrim"></div>`
    + `<img class="hero-mono" src="assets/fashionistas-monogram-animated.svg" alt="" aria-hidden="true">`
    + `<div class="hero-in">`
    + `<div class="hero-eyebrow">Your selling space</div>`
    + `<h2 class="hero-h">Turn your closet into ${rollHtml(["cash","a shop","a stall","a side income"])}</h2>`
    + `<p class="hero-sub">Snap it, price it, file it in a department, and put it in front of buyers. Everything you own is filed below.</p>`
    + `<div class="hero-cta">`
    + `<button type="button" class="btn btn-accent" onclick="go('snap')" data-tip="Open the camera to photograph an item and have it identified." title="Open the camera.">Add an item</button>`
    + `<button type="button" class="btn btn-soft" onclick="go('sell')" data-tip="Ask what your item is realistically worth before you list it." title="Ask what it's worth.">Check a price</button>`
    + `</div>`
    + sellerStatsHtml()
    + `</div></section>`;
}
/* ================= MAP + POP-UP STORES ================= */
let LEAFLET_P = null;
function loadLeaflet(){
  if (window.L) return Promise.resolve(true);
  if (LEAFLET_P) return LEAFLET_P;
  LEAFLET_P = new Promise(res => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => res(true); s.onerror = () => res(false);
    document.head.appendChild(s);
  });
  return LEAFLET_P;
}
async function geocode(q){
  const u = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q);
  const r = await fetch(u, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("Place search is unavailable right now (HTTP " + r.status + ").");
  const a = await r.json().catch(()=>[]);
  if (!Array.isArray(a) || !a.length) return null;
  return { lat: parseFloat(a[0].lat), lng: parseFloat(a[0].lng), label: a[0].display_name };
}
function mapTools(){
  return `<div class="map-tools">
    <div class="closet-tools" style="margin-bottom:9px">
      <input class="input" id="map-q" placeholder="Search a town or area…" value="${escapeAttr(S.mapQ||"")}"
        onkeydown="if(event.key==='Enter')mapSearch()" data-tip="Type a place — a town, a city, a postcode — and we'll centre the map there." style="margin:0">
      <button class="btn btn-accent" onclick="mapSearch()" data-tip="Move the map to that place.">Search</button>
    </div>
    <div class="map-btns">
      <button class="btn btn-soft" onclick="mapLocate()" data-tip="Use this device's location to sort what's closest to you."><svg class="i16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Near me</button>
      <button class="btn btn-ghost" onclick="mapOpenForm()" data-tip="Put your own pop-up shop on the map so people nearby can find it.">List your pop-up</button>
      <button class="btn btn-ghost" onclick="mapLoad()" data-tip="Reload the list of pop-ups.">Refresh</button>
    </div>
    <p class="mut" id="map-where" style="margin:9px 0 0;font-size:13px">${escapeHtml(S.mapWhere || "Showing every pop-up shop listed so far.")}</p>
  </div>`;
}
async function renderMap(el){
  el.innerHTML = mapTools()
    + `<div class="map-canvas" id="map-canvas"><div class="map-wait"><span class="spin"></span><span>Opening the map…</span></div></div>`
    + `<div id="map-list" class="map-list"></div>`;
  refreshTips();
  await mapLoad();
}
async function mapSearch(){
  const q = ($("#map-q") || {}).value || "";
  S.mapQ = q.trim();
  if (!S.mapQ) return mapLoad();
  const box = document.getElementById("map-canvas");
  if (box) box.innerHTML = `<div class="map-wait"><span class="spin"></span><span>Looking up that place…</span></div>`;
  try{
    const g = await geocode(S.mapQ);
    if (!g){
      S.mapWhere = "";
      if (box) box.innerHTML = `<div class="map-wait" style="color:var(--mut)">We couldn't find that place. Check the spelling.</div>`;
      return;
    }
    await mapLoad(g.lat, g.lng, "Near " + S.mapQ + ".");
  }catch(e){
    if (box) box.innerHTML = `<div class="map-wait" style="color:var(--mut)">${escapeHtml(e.message||"That search failed.")}</div>`;
    console.error("map search", e);
  }
}
function mapLocate(){
  const box = document.getElementById("map-canvas");
  if (!navigator.geolocation) return toast("This browser can't share a location");
  if (box) box.innerHTML = `<div class="map-wait"><span class="spin"></span><span>Getting your location…</span></div>`;
  navigator.geolocation.getCurrentPosition(
    p => mapLoad(p.coords.latitude, p.coords.longitude, "Nearest to you first."),
    err => {
      console.error("geolocation", err);
      if (box) box.innerHTML = `<div class="map-wait" style="color:var(--mut)">Location was refused — search a place instead.</div>`;
      mapLoad();
    },
    { timeout: 12000, maximumAge: 300000 }
  );
}
async function mapLoad(lat, lng, where){
  const box = document.getElementById("map-canvas");
  const list = document.getElementById("map-list");
  try{
    const qs = [];
    if (Number.isFinite(lat) && Number.isFinite(lng)) { qs.push("lat=" + lat, "lng=" + lng); }
    if (S.mapQ && !Number.isFinite(lat)) qs.push("near=" + encodeURIComponent(S.mapQ));
    const r = await fetch(API + "/api/popups" + (qs.length ? "?" + qs.join("&") : ""));
    const d = await r.json().catch(()=>null);
    if (!r.ok) throw new Error((d && d.error) || ("Could not load pop-ups (HTTP " + r.status + ")."));
    S.popups = d.popups || [];
    S.mapLat = Number.isFinite(lat) ? lat : (d.coords ? d.coords.lat : null);
    S.mapLng = Number.isFinite(lng) ? lng : (d.coords ? d.coords.lng : null);
    S.mapWhere = where || (S.popups.length
      ? (S.mapQ ? "Matching \"" + S.mapQ + "\"." : "Showing every pop-up shop listed so far.")
      : "No pop-up shops listed yet — yours could be the first.");
    const w = document.getElementById("map-where");
    if (w) w.textContent = S.mapWhere + " (" + S.popups.length + " found)";
    if (list) list.innerHTML = mapListHtml();
    if (box) await mapDraw(box);
  }catch(e){
    if (box) box.innerHTML = `<div class="map-wait" style="color:var(--mut)">${escapeHtml(e.message||"The map failed to load.")}</div>`;
    if (list) list.innerHTML = "";
    console.error("map load", e);
  }
  refreshTips();
}
function mapListHtml(){
  const rows = S.popups || [];
  if (!rows.length){
    return `<div class="empty"><svg class="i20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>
      <p>No pop-up shops on the map yet.</p>
      <button class="btn btn-accent" onclick="mapOpenForm()" data-tip="Put yours on the map so people nearby can find it.">List yours — it takes a minute</button></div>`;
  }
  return `<h3 class="map-h">Pop-up shops (${rows.length})</h3>` + rows.map(p => `
    <div class="map-row">
      <div class="map-row-b">
        <b>${escapeHtml(p.name)}</b>
        <span>${escapeHtml([p.address, p.city].filter(Boolean).join(", "))}</span>
        ${p.starts_at || p.ends_at ? `<span class="map-when">${escapeHtml([p.starts_at, p.ends_at].filter(Boolean).join(" → "))}</span>` : ""}
        ${p.description ? `<span class="map-desc">${escapeHtml(p.description)}</span>` : ""}
        <span class="map-meta">Run by ${escapeHtml(p.owner || "a seller")}${p.km != null ? ` · ${p.km} km away` : ""}</span>
      </div>
      <div class="map-row-a">
        <a class="btn btn-soft btn-sm" href="https://www.openstreetmap.org/directions?to=${encodeURIComponent((p.lat!=null&&p.lng!=null)?p.lat+","+p.lng:[p.address,p.city].filter(Boolean).join(", "))}" target="_blank" rel="noopener noreferrer" data-tip="Opens directions in a new tab.">Directions</a>
      </div>
    </div>`).join("");
}
async function mapDraw(box){
  const ok = await loadLeaflet();
  if (!ok){
    box.innerHTML = `<div class="map-wait" style="color:var(--mut)">The map itself couldn't load (no connection to the map service) — the list below still works.</div>`;
    return;
  }
  const pins = (S.popups || []).filter(p => p.lat != null && p.lng != null);
  const hasMe = Number.isFinite(S.mapLat) && Number.isFinite(S.mapLng);
  if (MAP_OBJ){ try{ MAP_OBJ.remove(); }catch(e){} MAP_OBJ = null; }
  box.innerHTML = "";
  const c = hasMe ? [S.mapLat, S.mapLng] : (pins.length ? [pins[0].lat, pins[0].lng] : [22, 0]);
  MAP_OBJ = L.map(box, { scrollWheelZoom: true, worldCopyJump: true }).setView(c, hasMe ? 11 : (pins.length ? 5 : 2));
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(MAP_OBJ);
  const you = L.icon({ iconUrl: "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="#2f80ed" stroke="#fff" stroke-width="3"/></svg>'),
    iconSize: [22, 22], iconAnchor: [11, 11] });
  if (hasMe) L.marker([S.mapLat, S.mapLng], { icon: you, title: "You are here" }).addTo(MAP_OBJ).bindPopup("You are here");
  pins.forEach(p => {
    L.marker([p.lat, p.lng]).addTo(MAP_OBJ).bindPopup(
      "<b>" + escapeHtml(p.name) + "</b><br>" + escapeHtml([p.address, p.city].filter(Boolean).join(", ")) +
      (p.starts_at ? "<br>" + escapeHtml(p.starts_at) : "")
    );
  });
  if (pins.length > 1 && !hasMe){
    MAP_OBJ.fitBounds(pins.map(p => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 12 });
  }
  if (!pins.length && !hasMe){
    const note = document.createElement("div");
    note.className = "map-empty";
    note.innerHTML = `<b>No pop-up shops listed yet.</b>
      <span>The map is live — yours pins here the moment you add it.</span>
      <button class="btn btn-accent btn-sm" onclick="mapOpenForm()" data-tip="Put yours on the map so people nearby can find it.">List your pop-up</button>`;
    box.appendChild(note);
  }
  setTimeout(()=>{ try{ MAP_OBJ && MAP_OBJ.invalidateSize(); }catch(e){} }, 200);
}
function mapOpenForm(){
  if (!TOKEN) return toast("Sign in to list your pop-up");
  let m = document.getElementById("map-form-modal");
  if (!m){
    m = document.createElement("div");
    m.id = "map-form-modal"; m.className = "modal hidden";
    m.innerHTML = `<div class="modal-card"><div class="modal-head"><h3>List your pop-up shop</h3>
      <button class="modal-x" onclick="document.getElementById('map-form-modal').classList.add('hidden')" aria-label="Close" data-tip="Closes this box without saving anything." title="Closes this box without saving anything.">×</button></div>
      <p class="mut" style="margin:0 0 12px;font-size:13.5px">Give the address and we'll pin it. Buyers see the town, and can open directions straight to you.</p>
      <label>What's it called?</label>
      <input class="input" id="pu-name" maxlength="80" placeholder="e.g. Sunday Rail Market stall 12">
      <label>Address</label>
      <input class="input" id="pu-addr" autocomplete="street-address" maxlength="200" placeholder="12 Market Street" data-tip="Where people physically turn up. Street or venue, not your home unless it is one.">
      <div class="two">
        <div><label>Town / city</label><input class="input" id="pu-city" autocomplete="address-level2" maxlength="80" placeholder="Bristol"></div>
        <div><label>ZIP code</label><input class="input" id="pu-post" autocomplete="postal-code" maxlength="40" placeholder="e.g. 78701"></div>
      </div>
      <div class="two">
        <div><label>First day</label><input class="input" id="pu-from" type="date"></div>
        <div><label>Last day</label><input class="input" id="pu-to" type="date"></div>
      </div>
      <label>What can people expect?</label>
      <textarea class="input" id="pu-desc" rows="3" maxlength="600" placeholder="What you sell, when you're open, anything worth knowing."></textarea>
      <div style="height:12px"></div>
      <button class="btn btn-accent" id="pu-save" onclick="mapSave()" style="width:100%" data-tip="Works out where that address is, then pins your pop-up on the map." title="Works out where that address is, then pins your pop-up on the map.">Put it on the map</button>
      <div id="pu-err" class="hidden" style="color:var(--danger,#c0392b);font-size:13.5px;margin-top:9px"></div>
      <p class="mut" style="margin:9px 0 0;font-size:12.5px">Your browser fills the address boxes in if you've saved one before.</p>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
  }
  m.classList.remove("hidden");
  refreshTips();
}
async function mapSave(){
  const g = id => ((document.getElementById(id) || {}).value || "").trim();
  const name = g("pu-name"), address = g("pu-addr"), city = g("pu-city"),
        post = g("pu-post"), from = g("pu-from"), to = g("pu-to"), desc = g("pu-desc");
  const errBox = document.getElementById("pu-err");
  const show = m => { if (errBox){ errBox.textContent = m; errBox.classList.remove("hidden"); } };
  errBox && errBox.classList.add("hidden");
  if (!name) return show("Give it a name first.");
  if (!address) return show("An address is needed so people can find it.");
  if (to && from && to < from) return show("The last day is before the first day.");
  const btn = document.getElementById("pu-save");
  if (btn){ btn.disabled = true; btn.textContent = "Pin it…"; }
  try{
    let lat = null, lng = null;
    try{
      const full = [address, city, post].filter(Boolean).join(", ");
      const g2 = await geocode(full);
      if (g2){ lat = g2.lat; lng = g2.lng; }
    }catch(e){ console.error("popup geocode", e); }
    const body = { name, address, city, lat, lng, description: desc, starts_at: from, ends_at: to };
    const r = await fetch(API + "/api/popups", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(()=>null);
    if (!r.ok) throw new Error((d && d.error) || ("Couldn't save that (HTTP " + r.status + ")."));
    document.getElementById("map-form-modal").classList.add("hidden");
    ["pu-name","pu-addr","pu-city","pu-post","pu-from","pu-to","pu-desc"].forEach(i => { const e = document.getElementById(i); if (e) e.value = ""; });
    toast("Your pop-up is on the map ✓");
    await mapLoad(lat, lng, "Your pop-up is now showing.");
  }catch(e){
    show(e.message || "That didn't save.");
    console.error("popup save", e);
  }finally{
    if (btn){ btn.disabled = false; btn.textContent = "Put it on the map"; }
  }
}

/* ================= SHOP BY PHOTO ================= */
function photoSearchCard(){
  const has = S.photo;
  return `<div class="ps-card" data-tip="Take or pick a photo and we'll name the item, then show what it's selling for here and on the big marketplaces.">
    <div class="ps-head">
      <svg class="i20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5h-5L8 7.5H4.5A1.5 1.5 0 0 0 3 9v9a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9a1.5 1.5 0 0 0-1.5-1.5H16z"/><circle cx="12" cy="13" r="3.4"/></svg>
      <div><h3 style="margin:0">Shop by photo</h3><p class="mut" style="margin:2px 0 0">Snap the thing you're after — we'll tell you what it is and what it's going for.</p></div>
    </div>
    <div class="ps-body">
      ${has ? `<img class="ps-shot" src="${S.photo}" alt="Your photo">` : `<div class="ps-ph"><svg class="i20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg><span>No photo yet</span></div>`}
      <div class="ps-actions">
        <button class="btn btn-accent" onclick="psCam()" data-tip="Opens your camera so you can shoot the item right now.">
          <svg class="i16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5h-5L8 7.5H4.5A1.5 1.5 0 0 0 3 9v9a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9a1.5 1.5 0 0 0-1.5-1.5H16z"/><circle cx="12" cy="13" r="3.4"/></svg>
          ${has ? "Retake with camera" : "Take a photo"}
        </button>
        <label class="btn btn-soft ps-btn">
          <input type="file" accept="image/*" class="ps-input" onchange="photoSearchPick(this.files[0])" data-tip="Pick a photo you already have on this device.">
          Choose from files
        </label>
        <button class="btn btn-accent" id="ps-go" onclick="photoSearchGo()" ${has?"":"disabled"} data-tip="We'll name it and find matching items.">
          <span id="ps-go-l">Find this item</span>
        </button>
        ${has ? `<button class="btn btn-ghost btn-sm" onclick="photoClear()" data-tip="Drop the photo and start again.">Clear</button>` : ""}
      </div>
    </div>
    <div id="ps-out" class="hidden"></div>
  </div>`;
}
/* Affiliate money — checked by hand, only programmes with a real public
   sign-up page. Rates and windows come from each shop's own pages; the
   "checked" date is shown so nobody thinks a stale figure is live. */
function affCard(){
  /* Never hand a raw path ("Women's Clothing/Tops & Shirts") to the matcher —
     use what the shopper is actually looking at, in words. */
  const term = (S.marketQ||"").trim() || taxLabel(S.marketCat) || "vintage clothing";
  const q = encodeURIComponent(term);
  const rows = [
    { n:"eBay",   u:`https://www.ebay.com/sch/i.html?_nkw=${q}` },
    { n:"Etsy",   u:`https://www.etsy.com/search?q=${q}` },
    { n:"Depop",  u:`https://www.depop.com/search/?q=${q}` },
    { n:"Poshmark",u:`https://poshmark.com/search?query=${q}` },
    { n:"Vinted", u:`https://www.vinted.com/catalog?search_text=${q}` },
    { n:"Grailed",u:`https://www.grailed.com/search?query=${q}` },
  ].map(p => `
    <div class="af-row">
      <div class="af-b">
        <b>${escapeHtml(p.n)}</b>
      </div>
      <a class="btn btn-soft btn-sm af-go" href="${p.u}" target="_blank" rel="noopener noreferrer sponsored" data-tip="Opens ${escapeHtml(p.n)} in a new tab, searched for what you typed." title="Opens ${escapeHtml(p.n)} in a new tab, searched for what you typed.">Search ${escapeHtml(p.n)} ↗</a>
    </div>`).join("");
  /* Every href above is that shop's own SEARCH url for the query, not a listing
     of ours. Labeling the button as a cross-listing promised one we do not
     have — a dead promise. Say what the click does. */
  return `
  <div class="aff">
    <div class="aff-head">
      <span class="af-kick">Search around</span>
      <h3>Can't find it here? Search these shops for the same thing.</h3>
    </div>
    ${rows}
    <div class="af-rest">
      <span>Each link opens that marketplace's search for what you typed — we don't post there for you.</span>
      <span class="af-date">Search links, not our listings.</span>
    </div>
  </div>`;
}
function photoClear(){ S.photo = null; S.photoResult = null; renderShop($("#screen")); }
/* Open the existing camera modal, but with the shutter wired to the photo
   search instead of the Snap screen. */
var PS_CAM = false;
function psCam(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    return toast("This browser can't open a camera here — use Choose from files.");
  PS_CAM = true;
  openCamera();
}
/* The Files button inside the camera box. If we opened the camera for the
   photo search, the picked picture has to land there — not on the Snap screen. */
function camFiles(){
  const forPhotoSearch = PS_CAM;
  if (!forPhotoSearch) return $("#file").click();
  closeCamera();
  const picker = document.querySelector("#screen .ps-actions input[type=file]");
  if (picker) picker.click();
  else $("#file").click();
}
function photoSearchPick(file){
  if (!file) return;
  if (!/^image\//.test(file.type)) return toast("That isn't an image file");
  if (file.size > 4_000_000) return toast("That photo is too big — pick one under 4 MB");
  const fr = new FileReader();
  fr.onload = () => {
    S.photo = fr.result;
    S.photoResult = null;
    renderShop($("#screen"));
    setTimeout(photoSearchGo, 60);
  };
  fr.onerror = () => toast("Couldn't read that file");
  fr.readAsDataURL(file);
}
async function photoSearchGo(){
  if (!S.photo) return;
  const out = document.getElementById("ps-out"), go = document.getElementById("ps-go"), lbl = document.getElementById("ps-go-l");
  if (out){ out.classList.remove("hidden"); out.innerHTML = `<div class="ps-wait"><span class="spin"></span><span>Looking at your photo…</span></div>`; }
  if (go) go.disabled = true;
  if (lbl) lbl.textContent = "Looking…";
  const t0 = Date.now();
  try{
    const b64 = (S.photo.split(",")[1] || "").replace(/[^A-Za-z0-9+/=]/g, "");
    const r = await fetch(API + "/api/shop/photo-search", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),
      body: JSON.stringify({ image: b64 }),
    });
    const d = await r.json().catch(()=>null);
    if (!r.ok) throw new Error((d && d.error) || ("That didn't work (HTTP " + r.status + ")."));
    S.photoResult = d;
    if (out) out.innerHTML = photoResultsHtml(d, Math.round((Date.now()-t0)/100)/10);
  }catch(e){
    if (out) out.innerHTML = `<div class="ps-err"><b>Couldn't read that photo.</b><p class="mut" style="margin:6px 0 10px">${escapeHtml(e.message||"")}</p><button class="btn btn-soft btn-sm" onclick="photoSearchGo()" data-tip="Reads your photo and finds matching items for sale." title="Reads your photo and finds matching items for sale.">Try again</button></div>`;
    console.error("photo-search", e);
  }finally{
    if (go) go.disabled = false;
    if (lbl) lbl.textContent = "Find this item";
    refreshTips();
  }
}
function photoResultsHtml(d, secs){
  const ident = d.identification;
  const visionOff = d.vision !== "ai";
  const head = visionOff
    ? `<div class="ps-note">The photo reader wasn't available just now, so we searched your photo's words instead.</div>`
    : (ident ? `<div class="ps-id">
        <div class="ps-id-t">${escapeHtml(ident.type || "Your photo")}</div>
        <div class="pills">
          ${ident.brand && !/^(unknown|n\/a|none)$/i.test(ident.brand) ? `<span class="pill">${escapeHtml(ident.brand)}</span>` : ""}
          ${ident.color ? `<span class="pill">${escapeHtml(ident.color)}</span>` : ""}
          ${ident.category ? `<span class="pill">${escapeHtml(ident.category)}</span>` : ""}
          ${ident.confidence != null ? `<span class="pill conf">${Number(ident.confidence)||0}% sure</span>` : ""}
        </div>
        <p class="mut" style="margin:9px 0 0">Read in ${secs}s. Searching for <b>${escapeHtml(d.query || "")}</b>.</p>
      </div>` : `<div class="ps-note">We couldn't make out what that is. Try a clearer, closer photo.</div>`);

  const ours = (d.ours || []).map(x => `
    <a class="ps-hit" href="/shop/${Number(x.id)}" onclick="openMarketItem(${Number(x.id)});return false" data-tip="Opens the full details for this item." title="Opens the full details for this item.">
      ${x.photo_url ? `<img src="${escapeAttr(x.photo_url)}" alt="" loading="lazy">` : `<span class="ps-hit-noimg">No photo</span>`}
      <span class="ps-hit-b">
        <span class="ps-hit-t">${escapeHtml(x.title)}</span>
        <span class="ps-hit-s">${escapeHtml([x.condition, x.size, x.ship_city].filter(Boolean).join(" · "))}${x.seller && x.seller.username ? ` · from ${escapeHtml(x.seller.username)}` : ""}</span>
      </span>
      <b class="ps-hit-p">${money(x.price)}</b>
    </a>`).join("");

  const others = (d.marketplaces || []).map(m =>
    `<a class="ps-mk" href="${escapeAttr(m.url)}" target="_blank" rel="noopener noreferrer sponsored" data-tip="Opens ${escapeHtml(m.name)} in a new tab.">${escapeHtml(m.name)}</a>`
  ).join("");

  return `<div class="ps-res">
    ${head}
    ${d.count ? `<h4 class="ps-h">On our market (${d.count})</h4><div class="ps-hits">${ours}</div>` : `<div class="ps-note">Nothing matching here yet — try the marketplaces below.</div>`}
    ${others ? `<h4 class="ps-h">Also for sale elsewhere</h4><div class="ps-mks">${others}</div>
      <p class="mut" style="margin:8px 0 0;font-size:12px">We don't take a cut of these — they're just where else it's listed.</p>` : ""}
    <div class="ps-again"><button class="btn btn-ghost btn-sm" onclick="photoClear()" data-tip="Start over with a different photo.">Start again</button></div>
  </div>`;
}

async function renderShop(el){
  /* Speed: /shop arrives server-rendered (functions/_lib/prerender.js). Keep that
     markup and its painted images; only wire it up, instead of redrawing. */
  const ssrGrid = el.querySelector("#market-grid[data-ssr]");
  if (!ssrGrid) el.innerHTML = showLoader("<p class='mut' style='text-align:center'>Loading what is for sale…</p>");
  refreshTips();
  let httpStatus = 0, body = null, failMsg = "";
  try{
    const headers = {};
    if (TOKEN) headers["Authorization"] = "Bearer " + TOKEN;
    const r = await fetch(API + "/api/market", { headers });
    httpStatus = r.status;
    try{ body = await r.json(); }catch(e){ body = null; }
    if (!r.ok) throw new Error("Could not load what is for sale (HTTP " + httpStatus + ").");
    const m = (body && body.market) || [];
    S.market = m;
    S.marketCount = (body && body.count != null) ? body.count : m.length;
  }catch(e){ failMsg = e.message || ("Could not load what is for sale (HTTP " + httpStatus + ")."); }
  if (failMsg){
    el.innerHTML = `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>`
    + `<p>${escapeHtml(failMsg)}</p>`
    + `<button class="btn btn-soft" onclick="renderShop($('#screen'))" data-tip="Try loading what is for sale again.">Try again</button></div>`;
    refreshTips();
    return;
  }
  if (S.photoPending){ S.photoPending = false; setTimeout(photoSearchGo, 90); }
  if (S.photoPending){ S.photoPending = false; setTimeout(photoSearchGo, 90); }
  stopRolls();
  if (ssrGrid && ssrGrid.isConnected && hydrateShop(el, ssrGrid)) { refreshTips(); startRolls(el); countUp(el); return; }
  el.innerHTML = `<div class="closet-tools ux-search">`
  + `<input class="input" id="market-search" placeholder="Search brand, size, or item" value="${escapeAttr(S.marketQ||"")}" oninput="marketQ(this.value)" aria-label="Search brand, size, or item" style="margin:0">`
  + `<select class="input" id="market-sort" onchange="marketSort(this.value)" data-tip="Change the order of the items you see." style="margin:0">`
  + marketSortOptions()
  + `</select></div>`
  + `<div id="market-nav">${marketNavHtml()}</div>`
  + `<div id="market-filters">${marketFiltersHtml()}</div>`
  + `<p class="mut" id="market-count" style="margin:2px 0 8px"></p>`
  + `<div class="grid" id="market-grid"></div>`
  + `<div id="market-more"></div>`
  + photoSearchCard()
  + affCard();
  refreshTips();
  marketRefresh();
  startRolls(el);
  countUp(el);
}
function shopToolsHtml(){
  return `<div class="closet-tools ux-search">`
  + `<input class="input" id="market-search" placeholder="Search brand, size, or item" value="${escapeAttr(S.marketQ||"")}" oninput="marketQ(this.value)" aria-label="Search brand, size, or item" style="margin:0">`
  + `<select class="input" id="market-sort" onchange="marketSort(this.value)" data-tip="Change the order of the items you see." style="margin:0">`
  + marketSortOptions()
  + `</select></div>`;
}
function hydrateShop(el, grid){
  const tools = el.querySelector(".closet-tools");
  const typed = el.querySelector("#ssr-q");
  if (typed && typed.value) S.marketQ = typed.value;
  const focused = document.activeElement === typed;
  if (tools) tools.outerHTML = shopToolsHtml();
  if (focused){ const q = document.getElementById("market-search"); if (q){ q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  const nav = document.getElementById("market-nav");
  if (nav) nav.innerHTML = marketNavHtml();
  if (nav && !document.getElementById("market-filters")) nav.insertAdjacentHTML("afterend", `<div id="market-filters">${marketFiltersHtml()}</div>`);
  if (!document.getElementById("market-more")) grid.insertAdjacentHTML("afterend", `<div id="market-more"></div>`);
  const ids = marketRows().slice(0, MARKET_PAGE).map(m => Number(m.id)).join(",");
  if (ids === grid.getAttribute("data-ssr")){
    grid.querySelectorAll("a.ux-tile-open").forEach(a => {
      const id = Number((a.getAttribute("href")||"").split("/").pop());
      a.setAttribute("onclick", `openMarketItem(${id});return false`);
      a.setAttribute("data-tip", "Opens the full details for this item.");
    });
    const cc = document.getElementById("market-count");
    if (cc && S.marketQ) marketRefresh(); else if (cc) { const n = marketRows().length; cc.textContent = n ? n + (n===1?" item":" items") + marketWhere() : ""; }
  } else marketRefresh();
  grid.removeAttribute("data-ssr");
  marketUrlSync();
  grid.insertAdjacentHTML("afterend", photoSearchCard() + affCard());
  return true;
}
/* Department -> subcategory browser plus breadcrumb. Split out of renderShop so
   picking a department repaints the nav in place instead of refetching the
   whole feed (which also would have thrown away whatever the shopper typed). */
function marketChip(path, label){
  const on = (S.marketCat || "") === path;
  return `<button type="button" class="chip${on?" on":""}" aria-pressed="${on?"true":"false"}" onclick="marketPick(decodeURIComponent('${taxQ(path)}'))">${escapeHtml(label)}</button>`;
}
/* Departments come from the shared category table, not a hardcoded women's
   row. A men's jacket and a coffee maker were on the feed and invisible the
   moment a shopper left All, because the only chips were Women's tops, jeans,
   dresses, jackets and bags. */
function marketNavHtml(){
  const cat = S.marketCat || "";
  const dept = cat && cat !== "__other__" ? taxDept(cat) : "";
  let h = `<div class="chips" id="market-subs" aria-label="Find">`;
  h += marketChip("", "All");
  for (const d of taxDepts()) h += marketChip(d, d);
  if (shopPublicRows(S.market || []).some(m => !taxPath(m.category))) h += marketChip("__other__", "Other");
  h += `</div>`;
  if (dept && taxSubs(dept).length){
    h += `<div class="chips" aria-label="${escapeAttr(dept)} categories">`;
    for (const s of taxSubs(dept)) h += marketChip(dept + "/" + s, s);
    h += `</div>`;
  }
  return h;
}
function marketQ(v){ S.marketQ = v || ""; S.marketPage = 1; marketRefresh(); }
function marketSort(v){ S.marketSort = v || "new"; S.marketPage = 1; if (v === "popular") loadPopular(); marketRefresh(); }
/* ---- Search, filters, sorts, pagination (2026-10-14) ---- */
const MARKET_PAGE = 24;
S.mf = S.mf || { size:"", color:"", cond:"", price:"", saved:false }; S.marketPage = S.marketPage || 1;
function marketSortOptions(){
  return [["new","Newest"],["popular","Popular"],["az","A–Z"],["za","Z–A"],["price-lo","Price low to high"],["price-hi","Price high to low"]]
    .map(o => `<option value="${o[0]}"${S.marketSort===o[0]?" selected":""}>${o[1]}</option>`).join("");
}
function mfClean(v){ v = String(v||"").trim(); return (v && !/^(n\/?a|none|not visible|unknown|-)$/i.test(v)) ? v : ""; }
function mfValues(key){
  const seen = new Map();
  for (const m of shopPublicRows(S.market || [])){ const v = mfClean(m[key]); if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v); }
  return [...seen.values()].sort((a,b)=>a.localeCompare(b));
}
function mfSelect(id, label, key, vals){
  if (!vals.length) return "";
  return `<select class="input mf-sel" aria-label="${label}" onchange="marketFilter('${key}', this.value)">`
    + `<option value="">${label}</option>`
    + vals.map(v => `<option value="${escapeAttr(v)}"${String(S.mf[key]).toLowerCase()===v.toLowerCase()?" selected":""}>${escapeHtml(v)}</option>`).join("")
    + `</select>`;
}
function marketFiltersHtml(){
  const prices = [["25","Under $25"],["50","Under $50"],["100","Under $100"],["250","Under $250"]];
  const nSaved = savedIds().length;
  return `<div class="mf-row">`
    + mfSelect("mf-size","Size","size",mfValues("size"))
    + mfSelect("mf-color","Colour","color",mfValues("color"))
    + mfSelect("mf-cond","Condition","cond",mfValues("condition"))
    + `<select class="input mf-sel" aria-label="Price" onchange="marketFilter('price', this.value)"><option value="">Price</option>${prices.map(p=>`<option value="${p[0]}"${S.mf.price===p[0]?" selected":""}>${p[1]}</option>`).join("")}</select>`
    + (nSaved ? `<button type="button" class="chip${S.mf.saved?" on":""}" aria-pressed="${S.mf.saved?"true":"false"}" onclick="marketFilter('saved', !S.mf.saved)">Saved (${nSaved})</button>` : "")
    + `</div>`;
}
function marketFilter(key, v){ S.mf[key] = v; S.marketPage = 1; const f = document.getElementById("market-filters"); if (f) f.innerHTML = marketFiltersHtml(); marketRefresh(); }
/* AdSense in the app: only on pages with real content (policy: no ads on thin or empty
   screens). Space is reserved up front so a fill never shifts the layout. */
function adBox(kind){ return `<div data-ad-slot="${kind}" class="ad-reserve" aria-label="Advertisement" style="grid-column:1/-1;min-height:280px;margin:12px 0"></div>`; }
function fillAds(){ try { if (window.fashMountAds) window.fashMountAds(); } catch(e){} }
function itemAd(m){
  const body = document.querySelector(".ux-item-body");
  if (!body || body.querySelector("[data-ad-slot]")) return;
  if (String(m.description || "").trim().length < 120) return; // thin listing: no ad
  body.insertAdjacentHTML("beforeend", adBox("inContent")); fillAds();
}
function marketMore(){ S.marketPage = (S.marketPage || 1) + 1; marketRefresh(true); }
function loadPopular(){
  if (S.pop) return;
  S.pop = {};
  fetch("/api/stats/popular").then(r => r.json()).then(j => { S.pop = (j && j.popular) || {}; if (S.marketSort === "popular") marketRefresh(); }).catch(()=>{});
}
function savedIds(){ try { return JSON.parse(localStorage.getItem("fash_saved") || "[]").map(Number); } catch(e){ return []; } }
function toggleSave(id, btn){
  id = Number(id); let ids = savedIds(); const on = !ids.includes(id);
  ids = on ? [id].concat(ids).slice(0, 200) : ids.filter(x => x !== id);
  try { localStorage.setItem("fash_saved", JSON.stringify(ids)); } catch(e){}
  if (on) fashTrack(id, "save");
  if (btn){ btn.setAttribute("aria-pressed", on ? "true" : "false"); btn.textContent = on ? "♥ Saved" : "♡ Save"; }
}
function fashTrack(id, kind, mkt){
  try {
    if (kind === "view"){ const k = "fv" + id; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); }
    const body = JSON.stringify({ listing_id: Number(id), kind, mkt: mkt || "" });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "text/plain" }));
    else fetch("/api/events", { method:"POST", body, keepalive:true }).catch(()=>{});
  } catch(e){}
}
function mktFromHost(h){
  h = String(h||"").toLowerCase();
  for (const m of ["ebay","etsy","depop","poshmark","mercari","vinted","grailed","facebook","whatnot","shopify"]) if (h.indexOf(m) !== -1) return m;
  return "other";
}
/* Outbound clicks and buy taps on an item page are counted (real taps only). */
document.addEventListener("click", function(e){
  const item = e.target.closest && e.target.closest(".ux-item"); if (!item || !CURRENT.market) return;
  const id = CURRENT.market.id;
  const a = e.target.closest("a[href]");
  if (a && /^https?:/i.test(a.href) && a.host !== location.host) return fashTrack(id, "click", mktFromHost(a.host));
  const b = e.target.closest("button"); const oc = b ? (b.getAttribute("onclick") || "") : "";
  if (/buy/i.test(oc) || /^\s*buy/i.test(b ? b.textContent : "")) fashTrack(id, "click", "fashionistas");
  else if (/share/i.test(oc)) fashTrack(id, "share");
}, true);
const FASH_LAND = location.pathname;
function marketUrlSync(){
  /* A category/brand landing keeps its own indexable address while it is unchanged. */
  if (/^\/shop\/[cb]\//.test(FASH_LAND) && ((window.__FASH_CAT__ && S.marketCat === window.__FASH_CAT__ && !(S.marketQ||"").trim()) || (window.__FASH_Q__ && S.marketQ === window.__FASH_Q__ && !S.marketCat))) {
    if (location.pathname !== FASH_LAND) { try { history.replaceState(history.state, "", FASH_LAND); } catch(e){} }
    return;
  }
  if (!/^\/shop\/?$/.test(location.pathname) && !/^\/shop\/[cb]\//.test(location.pathname)) return;
  const p = new URLSearchParams();
  if ((S.marketQ||"").trim()) p.set("q", S.marketQ.trim());
  if (S.marketSort && S.marketSort !== "new") p.set("sort", S.marketSort);
  if (S.marketCat) p.set("cat", S.marketCat);
  const qs = p.toString();
  try { history.replaceState(history.state, "", "/shop/" + (qs ? "?" + qs : "")); } catch(e){}
}
(function(){
  if (window.__FASH_CAT__) S.marketCat = window.__FASH_CAT__;
  if (window.__FASH_Q__) S.marketQ = window.__FASH_Q__;
  if (!/^\/shop\/?$/.test(location.pathname)) return;
  const p = new URLSearchParams(location.search);
  if (p.get("q")) S.marketQ = p.get("q");
  if (p.get("sort")) S.marketSort = p.get("sort");
  if (p.get("cat")) S.marketCat = p.get("cat");
  if (S.marketSort === "popular") loadPopular();
})();
function marketPick(path){
  /* Normalise through taxPath so "Women's Clothing/Tops & Shirts" (and any
     stray legacy spelling) land on one canonical value. Tapping the step you
     are already on climbs one level back up, so the nav is never a dead end.
     "__other__" is not a category path — it is the chip for listings the
     table could not file. taxPath() would turn it into "" and clear the filter. */
  const raw = taxUnq(path);
  if (raw === "__other__"){
    S.marketCat = S.marketCat === "__other__" ? "" : "__other__";
    const nav = document.getElementById("market-nav");
    if (nav) nav.innerHTML = marketNavHtml();
    marketRefresh();
    refreshTips();
    return;
  }
  const p = taxPath(raw);
  S.marketCat = (p && p === S.marketCat) ? (taxSub(p) ? taxDept(p) : "") : p;
  const nav = document.getElementById("market-nav");
  if (nav) nav.innerHTML = marketNavHtml();
  marketRefresh();
  refreshTips();
}
function marketRows(){
  const q = (S.marketQ || "").toLowerCase().trim();
  let rows = shopPublicRows(S.market || []).slice();
  /* Client-side search, mirroring the API's own field list exactly. Brand,
     colour, material, size and seller handle are all omitted here before this
     change, so a shopper could type "Versace", "wool" or the seller's handle
     and get an empty grid while the item sat right there in S.market — the
     server had already learned to find it, the grid had not. */
  if (q) rows = rows.filter(m=>[
      m.title, m.description, m.category, m.brand, m.color, m.material, m.size,
      m.condition, m.seller && m.seller.username, m.seller && m.seller.display_name,
    ].filter(Boolean).join(" ").toLowerCase().includes(q));
  if (S.marketCat === "__other__") rows = rows.filter(m => !taxPath(m.category));
  else if (S.marketCat) rows = rows.filter(m => taxMatches(m.category, S.marketCat));
  const eq = (a, b) => mfClean(a).toLowerCase() === String(b).toLowerCase();
  if (S.mf.size) rows = rows.filter(m => eq(m.size, S.mf.size));
  if (S.mf.color) rows = rows.filter(m => eq(m.color, S.mf.color));
  if (S.mf.cond) rows = rows.filter(m => eq(m.condition, S.mf.cond));
  if (S.mf.price) rows = rows.filter(m => Number(m.price) > 0 && Number(m.price) < Number(S.mf.price));
  if (S.mf.saved){ const sv = savedIds(); rows = rows.filter(m => sv.includes(Number(m.id))); }
  const n2 = v => Number(v) || 0;
  const t = m => String(m.title || "").toLowerCase();
  rows.sort((a,b)=>{
    if (S.marketSort === "price-lo") return n2(a.price) - n2(b.price);
    if (S.marketSort === "price-hi") return n2(b.price) - n2(a.price);
    if (S.marketSort === "az") return t(a).localeCompare(t(b));
    if (S.marketSort === "za") return t(b).localeCompare(t(a));
    if (S.marketSort === "popular") return (n2((S.pop||{})[b.id]) - n2((S.pop||{})[a.id])) || (n2(b.id) - n2(a.id));
    return n2(b.id) - n2(a.id);
  });
  return rows;
}
function marketRefresh(append){
  const grid = document.getElementById("market-grid");
  if (!grid) return;
  marketUrlSync();
  const all = marketRows();
  const shown = Math.min(all.length, MARKET_PAGE * (S.marketPage || 1));
  const rows = all;
  /* Name where the shopper is, not just a bare number: a count with no
     context reads like a bug when a filter is on. */
  const where = marketWhere();
  const qbit = (S.marketQ||"").trim() ? (' for "' + S.marketQ.trim() + '"') : "";
  const cc = document.getElementById("market-count");
  if (cc){
    const raw = (S.market||[]).length;
    const pub = shopPublicRows(S.market||[]).length;
    const hidden = Math.max(0, raw - pub);
    const base = rows.length ? (rows.length + (rows.length===1?" item":" items") + qbit + where) : "";
    const note = base;
    cc.textContent = note;
  }
  if (!rows.length){
    const mo = document.getElementById("market-more"); if (mo) mo.innerHTML = "";
    const filtered = !!(S.marketCat || (S.marketQ||"").trim() || S.mf.size || S.mf.color || S.mf.cond || S.mf.price || S.mf.saved);
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>`
    + `<p>${filtered ? "Nothing here matches" + (qbit||"") + where + "." : "Nothing is for sale right now. Check back soon, or list your own item to get started."}</p>`
    + `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">`
    + (filtered ? `<button type="button" class="btn btn-soft" onclick="marketClearFilters()" data-tip="Show everything for sale again." title="Show everything for sale again.">Clear filters</button>` : "")
    + `<button type="button" class="btn btn-accent" onclick="go('snap')" data-tip="Photograph an item and describe it — it lands here for buyers." title="Photograph an item and describe it.">List your own item</button>`
    + `</div></div>`;
    refreshTips();
    return;
  }
  const cards = rows.slice(0, shown).map((m,i)=>marketCard(m,i));
  for (let k = 8; k < cards.length; k += 13) cards.splice(k, 0, adBox("inContent")); // 1 ad per ~12 tiles, only with 9+ items
  grid.innerHTML = cards.join("");
  if (cards.length > shown) fillAds();
  const mo = document.getElementById("market-more");
  if (mo) mo.innerHTML = shown < all.length
    ? `<button type="button" class="btn btn-soft" style="width:100%;margin:14px 0" onclick="marketMore()">Show more (${all.length - shown} left)</button>`
    : "";
  refreshTips();
}
/* " in Women's Clothing › Tops & Shirts", or "" at the top of the catalogue. */
function marketWhere(){
  if (!S.marketCat) return "";
  if (S.marketCat === "__other__") return " with no department";
  const d = taxDept(S.marketCat), s = taxSub(S.marketCat);
  return " in " + d + (s ? " › " + s : "");
}
function marketClearFilters(){
  S.marketQ = "";
  S.marketCat = "";
  S.mf = { size:"", color:"", cond:"", price:"", saved:false }; S.marketPage = 1;
  const mf = document.getElementById("market-filters"); if (mf) mf.innerHTML = marketFiltersHtml();
  const si = document.getElementById("market-search"); if (si) si.value = "";
  const nav = document.getElementById("market-nav"); if (nav) nav.innerHTML = marketNavHtml();
  marketRefresh();
  refreshTips();
}
/* Buyer-only preview button on a search-result card. Never blank — an object
   we can't classify still opens the room placer with its photo. */
/* The grid tile used to end with a "Try it on" button. It is gone: a search
   result is a list of things, not a thing you are trying on, and seven of
   them at once read as noise — the owner's words were "on the search screen,
   what the fuck are you trying on". The CTA still exists exactly where it
   means something, on the item itself: placementCtaHtml() is called from the
   detail render, so you open the item and then decide. */
/* Speed: responsive WebP thumbnails from /img/<w>/<key> (R2, see functions/img).
   A missing thumb redirects to the original, so this is always safe to use. */
function thumbAttrs(u, sizes){
  const m = /^https:\/\/fashionistas-api\.fashionistas1979\.workers\.dev\/api\/images\/(u\/\d+\/[\w.\-]+)$/.exec(String(u||""));
  if (!m) return `src="${escapeAttr(u)}"`;
  const k = m[1];
  return `src="/img/480/${k}" srcset="/img/240/${k} 240w, /img/480/${k} 480w, /img/800/${k} 800w" sizes="${sizes}"`;
}
function marketCard(m, i){
  const photo = m.photo_url
    ? `<img loading="lazy" ${thumbAttrs(m.photo_url, "(max-width:640px) 50vw, 240px")} alt="" onerror="this.remove()">`
    : `<div class="ph"><span class="ph-ico">${catEmoji(m.category||"item")}</span></div>`;
  const sub = [m.size, m.condition].map(v => String(v||"").trim()).filter(v => v && !/^(n\/?a|none|not visible|unknown|-)$/i.test(v)).join(" · ");
  return `<div class="ux-tile" style="--gi:${Number(i)||0}">`
  + `<a class="ux-tile-open" href="/shop/${Number(m.id)}" onclick="openMarketItem(${Number(m.id)});return false" data-tip="Opens the full details for this item.">`
  + `<span class="ux-tile-img">${photo}</span>`
  + `<span class="ux-tile-p">${money(m.price)}</span>`
  + `<span class="ux-tile-t">${escapeHtml(m.title||"Untitled")}</span>`
  + (sub ? `<span class="ux-tile-s">${escapeHtml(sub)}</span>` : "")
  + `</a>`
  + tileTryHtml(m)
  + `</div>`;
}
/* Wearable tiles get their own "Try it on" (same rule as the server-rendered grid). */
function tileTryHtml(m){
  if (!m || !m.photo_url || !/^(women|men|kids)/i.test(String(m.category || "")) || /bag|purse|jewel|shoe|sneaker|boot|accessor|watch/i.test(String(m.category || "") + " " + String(m.title || ""))) return "";
  return `<a class="ux-tile-try" href="/try-on/?id=${Number(m.id)}&item=${encodeURIComponent(m.photo_url)}&title=${encodeURIComponent(String(m.title || "").slice(0, 80))}" aria-label="Try it on: ${escapeAttr(m.title || "this item")}">Try it on</a>`;
}

/* ================= PLACEMENT MODE (P0-B/C — free Instant space placer) ================
   Infer clothing | wall | floor | table | none from category/title. table = sits ON
   a surface (counter, table, shelf) — the "see it in my kitchen" case for objects.
   Wire CTAs to /try-on/ or /see-in-space/. Client-side only; placement_mode may
   also be set on a listing. */
function inferPlacementMode(item){
  { const r = item && catRow(item.category); if (r && r.place) return r.place; }
  if (item && typeof item.placement_mode === "string"){
    const e = item.placement_mode.trim().toLowerCase();
    if (e === "clothing" || e === "wall" || e === "floor" || e === "table" || e === "none") return e;
  }
  const src = [item && item.category, item && item.title, item && item.description].filter(Boolean).join(" ");
  if (!src.trim()) return "none";
  if (/\b(paintings?|posters?|prints?|canvas(?:es)?|wall\s*arts?|framed\s+arts?|artworks?|tapestr(?:y|ies)|wall\s*hang(?:ing)?s?|mirrors?|wall\s*decors?|photo\s*frames?|gallery\s*walls?)\b/i.test(src)) return "wall";
  if (/\b(furniture|sofas?|couches?|chairs?|tables?|desks?|lamps?|rugs?|carpets?|ottomans?|bookshelves?|bookcases?|dressers?|nightstands?|bed\s*frames?|cabinets?|stools?|benches?|wardrobes?|armoires?|coffee\s*tables?|side\s*tables?|floor\s*lamps?)\b/i.test(src)) return "floor";
  if (/\b(coffee\s*makers?|espresso|toasters?|blenders?|kettles?|mixers?|microwaves?|air\s*fryers?|slow\s*cookers?|pressure\s*cookers?|kitchen|vases?|mugs?|cups|bowls|plates|platters|trays|candles?|perfume|diffusers?|speakers?|soundbars?|monitors?|tvs?|television|clocks?|radios?|cameras?|projectors?|laptops?|desk\s*lamps?|figurines?|ornaments?|dolls?|toys?|plush(?:ies)?|stuffed\s+animals?|board\s*games?|puzzles?|planters?|house\s*plants?|jewel(?:l)ery\s*boxes?|keepsakes?|collectibles?)\b/i.test(src)) return "table";
  if (/\bhome\s*&\s*decor\b/i.test(src)){
    if (/wall|poster|print|mirror|painting/i.test(src)) return "wall";
    if (/rug|furniture|lamp|lighting|accent/i.test(src)) return "floor";
    return "table";
  }
  if (/\b(women'?s\s+clothing|men'?s\s+clothing|kids?\s*&?\s*baby)\b/i.test(src)) return "clothing";
  if (/\b(clothing|apparel|garments?|tops?|shirts?|t-?shirts?|tees?|blouses?|bottoms?|pants?|trousers?|jeans?|shorts?|skirts?|dresses?|gowns?|outerwear|jackets?|coats?|parkas?|blazers?|hoodies?|sweaters?|cardigans?|shoes?|sneakers?|boots?|heels?|sandals?|activewear|swimwear|lingerie|suits?|bags?|handbags?|purses?|accessories|jewellery|jewelry)\b/i.test(src)) return "clothing";
  return "none";
}
function placementCtaHtml(item){
  const mode = inferPlacementMode(item || {});
  const photo = (item && item.photo_url) ? encodeURIComponent(item.photo_url) : "";
  const title = encodeURIComponent(String((item && item.title) || "").slice(0, 80));
  const qs = (m) => {
    const p = [];
    if (m) p.push("mode=" + encodeURIComponent(m));
    if (item && item.id) p.push("id=" + Number(item.id));
    if (photo) p.push("item=" + photo);
    if (title) p.push("title=" + title);
    return p.length ? ("?" + p.join("&")) : "";
  };
  const btn = (href, label, tip) =>
    `<a class="btn btn-soft" href="${href}" data-tip="${escapeAttr(tip)}" title="${escapeAttr(tip)}">${escapeHtml(label)}</a>`;
  const bits = [];
  bits.push(`<div class="ux-try">`);
  if (mode === "clothing"){
    bits.push(`<a class="btn btn-accent" href="/try-on/${qs("")}">Try it on</a>`);
    bits.push(`<p class="ux-item-note">A photo of you wearing it. The model redraws the picture — it is not a sticker on top.</p>`);
  } else if (mode === "wall"){
    bits.push(btn("/see-in-space/" + qs("wall"), "See it on my wall", "Add a photo of your wall and hang this on it. Free."));
  } else if (mode === "floor"){
    bits.push(btn("/see-in-space/" + qs("floor"), "See it in my room", "Add a photo of your room and place this item in it. Free."));
  } else if (mode === "table"){
    bits.push(btn("/see-in-space/" + qs("table"), "See it on my counter", "Add a photo of your counter, table or shelf and place this on it. Free."));
  } else {
    /* Never an empty string: every object used to lose its entry point here.
       An unclassifiable item still gets the room placer with its own photo. */
    bits.push(btn("/see-in-space/" + qs(""), "See it in my space", "Place this in a photo of your room — free Instant preview."));
  }
  bits.push(`</div>`);
  return bits.join("");
}

/* Every listing gets a real address — /shop/<id>. Before this, opening an item
   only re-rendered the screen: the URL never changed, so a listing could not be
   linked, shared, bookmarked, indexed or opened cold. The document title moves
   with it so a search result reads "Blue Henley Shirt · $20 — fashionistas.ai"
   instead of the site-wide default. */
function itemPath(id){ return "/shop/" + Number(id); }
function setItemUrl(id, m, mode){
  try{
    const p = itemPath(id);
    if (location.pathname !== p){
      const fn = mode === "replace" ? "replaceState" : "pushState";
      history[fn]({ item: Number(id) }, "", p);
    }
    if (m && m.title){
      document.title = m.title + (m.price ? " · " + money(m.price) : "") + " — fashionistas.ai";
      const t = document.querySelector('meta[property="og:title"]'); if (t) t.setAttribute("content", String(m.title).slice(0, 70));
      const u = document.querySelector('meta[property="og:url"]'); if (u) u.setAttribute("content", location.origin + p);
      const d = document.querySelector('meta[name="description"]'); if (d) d.setAttribute("content", String(m.description || m.title).slice(0, 155));
    }
  }catch(e){ /* file:// or a stripped history API — the item still renders */ }
}
/* A delisted / unknown item must not keep the dead URL in the address bar. */
function dropItemUrl(){
  try{
    if ((location.pathname || "").indexOf("/shop/") === 0){
      history.replaceState(history.state, "", "/shop");
      document.title = "Shop — fashionistas.ai";
    }
  }catch(e){}
}
async function openMarketItem(id, opts){
  opts = opts || {};
  kineticTitle("This item"); $("#view-sub").textContent = "Details from the seller — check it before you buy.";
  const el = $("#screen");
  el.innerHTML = showLoader();
  let m = (S.market || []).find(x=>Number(x.id)===Number(id)) || null;
  if (!m){
    try{
      const headers = {};
      if (TOKEN) headers["Authorization"] = "Bearer " + TOKEN;
      const r = await fetch(API + "/api/market", { headers });
      const st = r.status;
      let b = null; try{ b = await r.json(); }catch(e){}
      if (!r.ok) throw new Error("Could not load this item (HTTP " + st + ").");
      S.market = (b && b.market) || [];
      m = S.market.find(x=>Number(x.id)===Number(id)) || null;
    }catch(e){ dropItemUrl(); el.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="go('shop')" data-tip="Back to everything that is for sale.">Back to Shop</button><div class="empty">${escapeHtml(e.message)}</div>`; refreshTips(); return; }
  }
  if (!m){ dropItemUrl(); el.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="go('shop')" data-tip="Back to everything that is for sale.">Back to Shop</button><div class="empty"><p>This item is no longer for sale.</p></div>`; refreshTips(); return; }
  const seller = (m.seller && (m.seller.display_name || m.seller.username)) || (m.seller && m.seller.username) || "Seller";
  const sellerU = (m.seller && m.seller.username) || "";
  /* Your own listing must not offer to message or buy you: the API answers
     422 "That is you" and 409 "This is your own listing." — correct, but a
     button that always errors is still a broken button. */
  const isMine = !!(USER && m.seller && Number(m.seller.id) === Number(USER.id));
  const plats = shopNormalizePlatforms(m.platforms);
  CURRENT.market = m;
  fashTrack(m.id, "view");
  setTimeout(function(){ itemAd(m); }, 0);
  const clean = v => { v = String(v||"").trim(); return (v && !/^(n\/?a|none|not visible|unknown|-)$/i.test(v)) ? v : ""; };
  /* Every field the API returns for this item, shown to the buyer.
     This list used to be Size / Condition / Category and nothing else, while
     the API was already handing over brand, colour, material and where it
     ships from. The data existed and the page threw it away — which is what
     "the listings are missing so many things" meant. A shopper cannot judge a
     $200 handbag on a colour-less, brand-less card. */
  const catFull = canonCat(m.category) || "";
  const facts = [
    ["Brand", clean(m.brand)],
    ["Size", clean(m.size)],
    ["Colour", clean(m.color)],
    ["Material", clean(m.material)],
    ["Condition", clean(m.condition)],
    ["Department", catFull ? taxLabel(catFull) || catFull : ""],
  ].filter(r => r[1]);
  /* Where it ships from, which is the other thing a buyer asks before making
     an offer. Omitted entirely when the seller never filled it in. */
  const from = [clean(m.ship_city), clean(m.ship_country)].filter(Boolean).join(", ");
  /* One-of-a-kind is the whole premise of this shop, so say it where the buy
     button is rather than leaving the buyer assuming there may be more. */
  const scarce = m.status === "active" ? `<p class="ux-item-note">One of a kind &mdash; there is only this one.</p>` : "";
  kineticTitle(""); $("#view-sub").textContent = "";
  el.innerHTML = `<div class="ux-item">`
  + `<button type="button" class="ux-back" onclick="go('shop')" aria-label="Back to Shop"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M15 5l-7 7 7 7'/></svg></button>`
  + (m.photo_url ? `<div class="ux-item-img"><img ${thumbAttrs(m.photo_url, "(max-width:640px) 100vw, 560px")} alt="${escapeAttr(m.title||"")}" onerror="this.parentNode.remove()"></div>` : "")
  + `<div class="ux-item-body">`
  + `<div class="ux-item-price">${money(m.price)} <button type="button" class="btn btn-ghost btn-sm ux-save" style="float:right" aria-pressed="${savedIds().includes(Number(m.id))?"true":"false"}" onclick="toggleSave(${Number(m.id)}, this)">${savedIds().includes(Number(m.id))?"♥ Saved":"♡ Save"}</button></div>`
  + `<h1 class="ux-item-title">${escapeHtml(m.title||"Untitled")}</h1>`
  + (facts.length ? `<dl class="ux-facts">` + facts.map(r => `<div><dt>${r[0]}</dt><dd>${escapeHtml(r[1])}</dd></div>`).join("") + `</dl>` : "")
  + (from ? `<p class="ux-item-note">Ships from ${escapeHtml(from)}${m.local_pickup ? " &middot; local pickup available" : ""}</p>` : (m.local_pickup ? `<p class="ux-item-note">Local pickup available.</p>` : ""))
  + placementCtaHtml(m)
  + scarce
  + (m.description ? `<p class="ux-item-desc">${escapeHtml(m.description)}</p>` : "")
  + `<div class="ux-seller"><span class="ux-av">${escapeHtml(String(seller).slice(0,1).toUpperCase())}</span><span><b>${escapeHtml(seller)}</b>${sellerU?`<small>@${escapeHtml(sellerU)}</small>`:""}</span></div>`
  + `</div>`
  + (isMine
      ? `<div class="ux-buybar"><button class="btn btn-soft" onclick="go('closet')">Manage listing</button><button class="btn btn-accent" onclick="editFromItem(${Number(m.id)})">Edit listing</button></div>`
      : `<div class="ux-buybar"><button class="btn btn-soft" onclick="dmOrSignIn(${dmPeerRef(m, sellerU||seller)}, '${escapeAttr(seller)}')">Message</button><button class="btn btn-accent" onclick="buySheet(${Number(m.id)})">Buy now</button></div>`)
  + `</div>`;
  setItemUrl(id, m, opts.url);
  refreshTips();
  /* "Buy on <shop>" — only where the seller confirmed it's listed and gave the link. */
  if (!isMine) fetch("/api/crosslist/links?id=" + Number(m.id)).then(r => r.json()).then(b => {
    const L = (b && b.links) || []; const bar = el.querySelector(".ux-buybar"); if (!L.length || !bar) return;
    const d = document.createElement("div"); d.className = "ux-also";
    d.innerHTML = `<p class="ux-item-note">Also listed by this seller on:</p>` + L.map(x => `<a class="btn btn-ghost btn-sm" href="${escapeAttr(x.url)}" target="_blank" rel="noopener sponsored" onclick="fashTrack(${Number(m.id)},'click','${escapeAttr(x.platform)}')">Buy on ${escapeHtml(x.name)} ↗</a>`).join(" ");
    bar.parentNode.insertBefore(d, bar);
  }).catch(() => {});
}
/* ── Reserve / Message from an item page ─────────────────────────────────
   /api/dm/<peer> is addressed by numeric user id; sending a handle answers
   404 "Not found" and the conversation dies before it starts. The listing
   payload carries seller.id, so prefer it and keep the handle as fallback. */
/* Open the editor straight from a listing of your own. LW.edit() works off the
   owner's list, which the item page has not loaded yet, so fetch it first. */
function editFromItem(id){
  (async () => {
    try{
      if (!(S.listings || []).some(x => Number(x.id) === Number(id))){
        const d = await api("/api/listings"); S.listings = (d && d.listings) || [];
      }
      const it = (S.listings || []).find(x => Number(x.id) === Number(id));
      if (it && window.LW) return LW.edit(it);
      toast("Could not open that listing for editing.");
    }catch(e){ toast("Could not open the editor: " + e.message); }
  })();
}
function dmPeerRef(m, fallback){
  const id = m && m.seller && Number(m.seller.id);
  if (id) return String(id);
  return "'" + escapeAttr(String((m && m.seller && (m.seller.username || m.seller.display_name)) || fallback || "")) + "'";
}
/* Sign-in must not eat the intent: remember what they tapped so afterAuth()
   can finish it. sessionStorage, so it dies with the tab. */
function setPendingIntent(data){
  try{ sessionStorage.setItem("fash_pending", JSON.stringify(Object.assign({ path: location.pathname, at: Date.now() }, data))); }catch(e){}
}
function takePendingIntent(){
  try{
    const raw = sessionStorage.getItem("fash_pending"); if (!raw) return null;
    sessionStorage.removeItem("fash_pending");
    const p = JSON.parse(raw);
    if (!p || (Date.now() - (p.at || 0)) > 15 * 60000) return null;
    return p;
  }catch(e){ return null; }
}
function dmOrSignIn(peer, label){
  if (!TOKEN){ setPendingIntent({ action:"message", peer: peer, label: label || "" }); toast("Sign in to message them"); showAuth("login"); return; }
  threadScreen(peer, label);
}
/* Returns true when it put the user back where they chose, so the caller can
   skip the generic "you're signed in" nudge. */
function resumeAfterAuth(){
  const p = takePendingIntent();
  if (p && p.action === "reserve" && p.id){
    (async () => { try{ await openMarketItem(Number(p.id)); buySheet(Number(p.id)); setTimeout(() => confirmBuy(Number(p.id)), 250); }catch(e){ go("home"); } })();
    return true;
  }
  if (p && p.action === "message" && p.peer !== undefined && p.peer !== null && p.peer !== ""){
    (async () => { try{ await threadScreen(p.peer, p.label || ""); }catch(e){ go("home"); } })();
    return true;
  }
  /* Coming back to an addressable page must land on that page — /shop/<id>
     used to render Home while the bar still claimed the item. */
  const path = (location.pathname || "").replace(/\/$/, "");
  const item = path.match(/^\/shop\/(\d+)$/);
  if (item){ openMarketItem(Number(item[1])); return true; }
  if (path === "/shop"){ go("shop"); return true; }
  if (/^\/shop\/[cb]\//.test(path)){ if (window.__FASH_CAT__) S.marketCat = window.__FASH_CAT__; go("shop"); setTimeout(marketUrlSync, 50); setTimeout(marketUrlSync, 900); return true; }
  go("home");
  return false;
}
function buySheet(id){
  const m = CURRENT.market && Number(CURRENT.market.id)===Number(id) ? CURRENT.market : ((S.market||[]).find(x=>Number(x.id)===Number(id)) || {});
  const seller = (m.seller&&(m.seller.username||m.seller.display_name))||"the seller";
  openSheet(`
  <div class="ux-buy">
  ${m.photo_url ? `<img src="${escapeAttr(m.photo_url)}" alt="">` : ""}
  <div><b>${escapeHtml(m.title||"This item")}</b><span>${money(m.price)} · from ${escapeHtml(seller)}</span></div>
  </div>
  <p class="mut" style="margin:12px 0">No charge. Reserve it, then message ${escapeHtml(seller)}.</p>
  <button class="btn btn-accent" style="width:100%" onclick="confirmBuy(${Number(id)},this)">Reserve it</button>
  <button class="btn btn-soft" style="width:100%;margin-top:8px" onclick="closeSheet();dmOrSignIn(${dmPeerRef(m, seller)}, '${escapeAttr(seller)}')">Message ${escapeHtml(seller)}</button>
  <div id="buy-out" style="margin-top:10px"></div>
  `);
  refreshTips();
}
async function confirmBuy(id, btn){
  const out = document.getElementById("buy-out");
  if (!TOKEN){ closeSheet(); setPendingIntent({ action:"reserve", id: Number(id) }); toast("Sign in to reserve it"); try{ showAuth("login"); }catch(e){} return; }
  if (btn){ btn.disabled = true; btn.textContent = "Reserving…"; }
  try{
    const r = await fetch(API + "/api/market/" + id + "/buy", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+TOKEN } });
    if (r.status === 401){ closeSheet(); setPendingIntent({ action:"reserve", id: Number(id) }); toast("Sign in to reserve it"); try{ showAuth("login"); }catch(e){} return; }
    if (r.ok){
      if (out) out.innerHTML = `<p class="ux-ok">Reserved. No money has moved — message the seller to sort out payment and delivery.</p>`;
      if (btn) btn.remove();
      return;
    }
    let msg = ""; try{ const b = await r.json(); msg = (b && (b.error || b.message)) || ""; }catch(e){}
    if (out) out.innerHTML = `<p class="ux-err">${escapeHtml(/own|yourself/i.test(msg) ? "That's your own listing." : /sold|not available|unavailable/i.test(msg) ? "Sorry, this item isn't available any more." : "That didn't go through. Please try again, or message the seller.")}</p>`;
  }catch(e){
    if (out) out.innerHTML = `<p class="ux-err">No connection. Check your internet and try again.</p>`;
  }
  if (btn && btn.isConnected){ btn.disabled = false; btn.textContent = "Reserve it"; }
}
function onsaleState(l){
  if (!l) return false;
  if (l.onsale || l.on_sale) return true;
  var p = l.platforms;
  if (typeof p === "string") { try { p = JSON.parse(p); } catch (e) { p = []; } }
  return Array.isArray(p) && p.indexOf("fashionistas") >= 0;
}
async function toggleOnsale(id, btn){
  try{ if (window.event) window.event.stopPropagation(); }catch(e){}
  const l = (S.listings || []).find(x=>Number(x.id)===Number(id)) || ((CURRENT.listing && Number(CURRENT.listing.id)===Number(id)) ? CURRENT.listing : null);
  const cur = l ? onsaleState(l) : false;
  const next = !cur;
  if (btn) btn.disabled = true;
  try{
    const headers = { "Content-Type":"application/json" };
    if (TOKEN) headers["Authorization"] = "Bearer " + TOKEN;
    const r = await fetch(API + "/api/listings/" + id + "/onsale", { method:"POST", headers, body: JSON.stringify({ on: next }) });
    let b = null; try{ b = await r.json(); }catch(e){}
    if (!r.ok) throw new Error("Could not update (HTTP " + r.status + ").");
    if (l){ l.onsale = next; l.on_sale = next; }
    if (CURRENT.listing && Number(CURRENT.listing.id)===Number(id)){ CURRENT.listing.onsale = next; CURRENT.listing.on_sale = next; }
    toast(next ? "Now visible to buyers" : "Hidden from buyers");
    if (document.getElementById("closet-grid")) closetRefresh();
    if (document.getElementById("onsale-btn")){ const nb = document.getElementById("onsale-btn"); nb.textContent = next ? "Stop selling here" : "Sell it here too"; nb.classList.toggle("btn-accent", !next); nb.classList.toggle("btn-soft", next); }
  }catch(e){ toast(e.message); }
  if (btn) btn.disabled = false;
  refreshTips();
}

/* ================= HOME ================= */

/* ================= SHOP CONNECT (multilist) =================
   Guidance panel for every Multilist shop. eBay keeps real BYO OAuth;
   the other shops post through the extension in your own browser session.
   Connection state is local-only until the API worker stores real tokens. */
const XL_CONNECT_KEY = "fash_connect_v1";
const XL_EBAY_KEYS_KEY = "fash_ebay_keys_v1";
const XL_EBAY_REDIRECT = "https://fashionistas.ai/api/ebay/oauth/callback";
let XL_SHOP_GUIDE_ID = null;

const XL_CONNECT_SHOPS = [
  {
    id: "depop", name: "Depop", oauth: false,
    signup: "https://www.depop.com/signup/",
    createListing: "https://www.depop.com/sell/",
    hive: [
      "Create a free Depop seller account (email or app signup).",
      "Verify email / phone if Depop asks — finish profile basics.",
      "Open Sell / new listing on Depop (deep link below).",
      "fashionistas.ai writes the title, price, tags and description, then posts it to Depop."
    ],
    honest: "Depop has <b>no public seller OAuth</b> for fashionistas.ai. We never invent API keys or take your password. The extension opens Depop in your browser and submits the listing for you. Optional <b>I've connected</b> is a local flag only."
  },
  {
    id: "ebay", name: "eBay", oauth: true,
    signup: "https://signup.ebay.com/",
    createListing: "https://www.ebay.com/sl/sell",
    hive: [
      "Create an eBay seller account (and a developer app if you want OAuth).",
      "Verify identity / payouts on eBay as required.",
      "Open List an item — or Connect OAuth after pasting your own Client ID + Secret.",
      "Connect eBay with OAuth, or let the extension post it for you."
    ],
    honest: "We do <b>not</b> create eBay seller or developer accounts for you. Paste your own Client ID + Secret (BYO), then <b>Connect OAuth</b> opens eBay's login (requests <b>sell.inventory</b> + <b>sell.account</b> scopes). After Connected, Multilist can <b>Create on eBay</b> via Inventory/Offer APIs (sandbox recommended). Re-connect if you connected before scopes were added. Paste kits always work. fashionistas.ai never invents credentials."
  },
  {
    id: "poshmark", name: "Poshmark", oauth: false,
    signup: "https://poshmark.com/signup",
    createListing: "https://poshmark.com/create-listing",
    hive: [
      "Create a free Poshmark closet (signup link below).",
      "Verify email / complete closet basics if prompted.",
      "Open Sell / create-listing on Poshmark.",
      "fashionistas.ai fills the Poshmark listing form and presses List."
    ],
    honest: "Poshmark has <b>no public seller OAuth</b> for fashionistas.ai. No fake API credentials. the extension fills the form and posts it from your signed-in browser session."
  },
  {
    id: "mercari", name: "Mercari", oauth: false,
    signup: "https://www.mercari.com/signup/",
    createListing: "https://www.mercari.com/sell/",
    hive: [
      "Create a Mercari account and set a payout method.",
      "Verify phone / identity if Mercari asks.",
      "Open Sell / new listing on Mercari.",
      "Title, price and description are filled in automatically, then listed."
    ],
    honest: "Mercari has <b>no public seller OAuth</b> for fashionistas.ai. We do not create accounts or store Mercari passwords. The extension fills the form and posts it; mark Connected once you have an account."
  },
  {
    id: "vinted", name: "Vinted", oauth: false,
    signup: "https://www.vinted.com/member/register/select_type",
    createListing: "https://www.vinted.com/items/new",
    hive: [
      "Register on Vinted (select account type).",
      "Verify email / complete seller basics.",
      "Open Items → new listing (deep link below).",
      "The extension fills the Vinted form and publishes it."
    ],
    honest: "Vinted has <b>no public seller OAuth</b> for fashionistas.ai. The extension opens Vinted and posts it from your own session."
  },
  {
    id: "grailed", name: "Grailed", oauth: false,
    signup: "https://www.grailed.com/signup",
    createListing: "https://www.grailed.com/sell",
    hive: [
      "Sign up at Grailed.",
      "Verify email / seller profile as needed.",
      "Open Sell / new listing on Grailed.",
      "Title, measurements and description are filled in automatically, then listed."
    ],
    honest: "Grailed has <b>no public seller OAuth</b> for fashionistas.ai. No invented API keys. The extension posts from your browser; <b>I've connected</b> just records your account."
  }
];

function xlConnectShopById(id){
  return XL_CONNECT_SHOPS.find(s => s.id === id) || null;
}
function xlConnectLoad(){
  try {
    const raw = localStorage.getItem(XL_CONNECT_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return (o && typeof o === "object") ? o : {};
  } catch { return {}; }
}
function xlConnectSave(state){
  try { localStorage.setItem(XL_CONNECT_KEY, JSON.stringify(state || {})); } catch {}
}
/**
 * Status: needs | ready | unverified | connected.
 *
 * "connected" is reserved for a session the EXTENSION actually observed —
 * libs/login-detect.js reading a real rendered marketplace page (a logout
 * control or an avatar, and no password field), returned through
 * `{type:"status"}`. A button the user pressed cannot produce it.
 *
 * A manual mark still counts for something, but it reports itself honestly as
 * "unverified" instead of claiming a session we never saw. An extension "not
 * logged in" verdict falls through to the normal ready/needs logic rather than
 * forcing needs, because "no live session" is not the same as "no account" —
 * which is why eBay's saved keys still upgrade it to ready.
 */
function xlConnectStatus(id){
  const s = xlConnectLoad()[id];
  if (s && s.via === "extension" && s.status === "connected") return "connected";
  if (s && s.status === "connected") return "unverified";   // manual / legacy local mark
  if (s && s.status === "ready") return "ready";
  if (id === "ebay") {
    const keys = xlEbayKeysLoad();
    if (keys && keys.clientId) return "ready";
  }
  return "needs";
}
function xlConnectStatusTag(st){
  if (st === "connected") return `<span class="tag connected">Connected</span>`;
  if (st === "ready") return `<span class="tag ready">Ready to guide</span>`;
  if (st === "unverified") return `<span class="tag needs" title="You marked this yourself — the extension has not confirmed a live logged-in session.">Unverified</span>`;
  return `<span class="tag needs">Needs account</span>`;
}
function xlConnectMarkReady(id){
  const state = xlConnectLoad();
  const cur = state[id];
  if (cur && cur.status === "connected") return;
  state[id] = { status: "ready", via: "guide", at: new Date().toISOString() };
  xlConnectSave(state);
}
function xlConnectRowsHtml(){
  const shops = xlConnectShopsMerged();
  return shops.map(shop => {
    const st = xlConnectStatus(shop.id);
    const connected = st === "connected";
    const via = (xlConnectLoad()[shop.id] || {}).via || "";
    const statusTag = xlConnectStatusTag(st);
    let actions = "";
    if (connected) {
      actions = `<button type="button" class="btn btn-soft btn-sm" onclick="xlShopOpenGuide('${shop.id}')" data-tip="Re-open the ${escapeHtml(shop.name)} connect guide.">Guide</button>`
        + `<button type="button" class="btn btn-ghost btn-sm" onclick="xlConnectDisconnect('${shop.id}')" data-tip="Clears the local Connected flag for this shop.">Disconnect</button>`;
    } else {
      const connectLabel = shop.oauth ? ("Connect " + shop.name) : ("Connect " + shop.name);
      actions = `<button type="button" class="btn btn-accent btn-sm" onclick="xlShopOpenGuide('${shop.id}')" data-tip="Opens the ${escapeHtml(shop.name)} connect guidance panel.">${escapeHtml(connectLabel)}</button>`
        + `<a class="btn btn-soft btn-sm" href="${escapeHtml(shop.signup)}" target="_blank" rel="noopener noreferrer" data-tip="Opens ${escapeHtml(shop.name)} signup.">Signup</a>`;
      // The honest path first: ask the extension what it can actually see.
      // The manual mark is a fallback for when the extension is absent, and it
      // now reports as Unverified rather than Connected.
      if (typeof EXT_LIVE !== "undefined" && EXT_LIVE) {
        actions += `<button type="button" class="btn btn-soft btn-sm" onclick="xlConnectVerify('${shop.id}')" data-tip="Asks your extension to look for a live logged-in ${escapeHtml(shop.name)} session. Booleans only — no cookie or password is ever read.">Verify session</button>`;
      }
      actions += `<button type="button" class="btn btn-ghost btn-sm" onclick="xlConnectMarkLocal('${shop.id}')" data-tip="Manual mark only. Shows Unverified until the extension confirms a live session.">I've connected</button>`;
    }
    const detail = connected
      ? (via === "extension"
          ? "Extension-verified · a live session was observed in your browser"
          : (shop.oauth ? "Manually marked · paste until worker tokens land" : "Manually marked · not yet verified"))
      : (shop.oauth
          ? (st === "ready" ? "Keys ready · finish OAuth or paste drafts" : "BYO keys + OAuth guide · or paste drafts")
          : (st === "ready" ? "Guide open · signup → verify → list → paste" : "No public seller OAuth · guide + paste"));
    return `<div class="xl-connect-row" data-shop="${shop.id}">
      <div class="xl-connect-name"><b>${escapeHtml(shop.name)}</b><span>${detail}</span></div>
      <div class="xl-connect-status">${statusTag}</div>
      <div class="xl-connect-actions">${actions}</div>
    </div>`;
  }).join("");
}
/** Merge API marketplaces (extra shops) onto the six with the same guide pattern when easy. */
function xlConnectShopsMerged(){
  const base = XL_CONNECT_SHOPS.slice();
  const seen = new Set(base.map(s => s.id));
  const extras = (S && S.markets) ? S.markets : [];
  extras.forEach(m => {
    const id = String(m.id || "").toLowerCase();
    if (!id || seen.has(id)) return;
    if (id === "fashionistas" || id === "fashionistas.ai") return;
    seen.add(id);
    const name = m.name || id;
    const signup = m.signup || m.url || ("https://www.google.com/search?q=" + encodeURIComponent(name + " seller signup"));
    const createListing = m.createListing || m.sellUrl || signup;
    base.push({
      id, name, oauth: false,
      signup, createListing,
      hive: [
        "Create a seller account on " + name + ".",
        "Verify email / identity if the shop asks.",
        "Open a new listing on " + name + ".",
        "fashionistas.ai writes it, then posts it to " + name + "."
      ],
      honest: escapeHtml(name) + " has <b>no public seller OAuth</b> wired here. Guided open + paste only — we never invent API credentials or take passwords. <b>I've connected</b> is local."
    });
  });
  return base;
}
function xlConnectRefresh(){
  const grid = document.querySelector("#xl-connect .xl-connect-grid");
  if (grid) grid.innerHTML = xlConnectRowsHtml();
  try { xlReadyStripRefresh(); } catch(e){}
  refreshTips();
}
/**
 * MANUAL mark. It no longer claims "Connected": it stores via:"manual" and the
 * row renders as "Unverified" until the extension confirms a live session.
 * Kept because the extension can be absent, and the seller still needs a way
 * to say "yes, I have an account here".
 */
function xlConnectMarkLocal(id){
  const state = xlConnectLoad();
  state[id] = { status: "connected", via: "manual", at: new Date().toISOString() };
  xlConnectSave(state);
  toast(id + " marked manually — shown as Unverified until your extension confirms a live session.");
  xlConnectRefresh();
  try { xlShopPaintStatus(id); } catch {}
}

/**
 * VERIFIED mark: ask the extension to probe this shop's live session.
 *
 * The answer comes from probeShop() -> probeViaPage(), which inspects a real
 * rendered page for a logout control / avatar / Sell and for the absence of a
 * password field, then runs libs/login-detect.js. Booleans only — we never ask
 * for or receive a cookie, a token or a password — and nothing is probed from
 * our servers: it runs entirely inside the seller's own logged-in browser.
 */
async function xlConnectVerify(id){
  const r = await extSend({ type: "status" });
  if (!r || !r.ok) {
    toast("Extension not reachable — open fashionistas.ai with the extension enabled, then retry.");
    return { ok: false, reason: "extension_unavailable" };
  }
  const sessions = r.sessions || {};
  const known = Object.prototype.hasOwnProperty.call(sessions, String(id));
  const on = !!sessions[id];
  const state = xlConnectLoad();
  state[id] = on
    ? { status: "connected", via: "extension", at: new Date().toISOString() }
    : { status: "needs", via: "extension", at: new Date().toISOString(),
        reason: known ? "session_absent" : "shop_not_probeable" };
  xlConnectSave(state);
  xlConnectRefresh();
  try { xlShopPaintStatus(id); } catch {}
  toast(on ? id + ": live session confirmed by the extension."
           : id + ": no live session found — open the site in a tab while logged in, then verify again.");
  return { ok: true, connected: on };
}

/**
 * Reconcile every row against what the extension actually observes, once the
 * extension ping succeeds — so the grid reflects reality on load instead of
 * whatever an older build stored. Only shops we render are touched, and a
 * "ready" row (guide opened / keys saved) is never downgraded by a negative
 * probe: that verdict is about the session, not about the account.
 */
async function xlConnectSyncFromExtension(ping){
  const r = ping || await extSend({ type: "status" });
  if (!r || !r.ok) return false;
  const sessions = r.sessions || {};
  const ids = new Set(xlConnectShopsMerged().map(s => s.id));
  const state = xlConnectLoad();
  let changed = false;
  Object.keys(sessions).forEach((shop) => {
    if (!ids.has(shop)) return;
    const on = !!sessions[shop];
    const cur = state[shop];
    if (!on && cur && cur.status === "ready") return;
    const next = on
      ? { status: "connected", via: "extension", at: new Date().toISOString() }
      : { status: "needs", via: "extension", at: new Date().toISOString(), reason: "session_absent" };
    if (cur && cur.status === next.status && cur.via === next.via) return;
    state[shop] = next;
    changed = true;
  });
  if (changed) xlConnectSave(state);
  xlConnectRefresh();
  return changed;
}
function xlConnectDisconnect(id){
  const state = xlConnectLoad();
  delete state[id];
  xlConnectSave(state);
  if (id === "ebay") { /* keep BYO keys; status falls back to ready if keys exist */ }
  toast(id + " set back to Needs account / Ready to guide");
  xlConnectRefresh();
  try { xlShopPaintStatus(id); } catch {}
}
function xlConnectOpenGuide(mktName){
  // Opens the global Guide A to Z coach (not the per-shop Connect panel).
  try { hcToggle(); } catch {}
  toast("Guide A to Z — follow the " + mktName + " account steps, then hit Sell everywhere.");
}

function xlEbayKeysLoad(){
  try {
    const raw = localStorage.getItem(XL_EBAY_KEYS_KEY);
    if (!raw) return null;
    const jsonStr = decodeURIComponent(escape(atob(raw)));
    const o = JSON.parse(jsonStr);
    if (!o || typeof o !== "object") return null;
    return {
      clientId: String(o.clientId || "").trim(),
      clientSecret: String(o.clientSecret || "").trim(),
      redirectUri: String(o.redirectUri || XL_EBAY_REDIRECT).trim() || XL_EBAY_REDIRECT,
      env: (String(o.env || "sandbox").trim().toLowerCase() === "production") ? "production" : "sandbox"
    };
  } catch { return null; }
}
function xlEbayKeysSave(obj){
  const payload = {
    clientId: String(obj.clientId || "").trim(),
    clientSecret: String(obj.clientSecret || "").trim(),
    redirectUri: String(obj.redirectUri || XL_EBAY_REDIRECT).trim() || XL_EBAY_REDIRECT,
    env: (String(obj.env || "sandbox").trim().toLowerCase() === "production") ? "production" : "sandbox"
  };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  localStorage.setItem(XL_EBAY_KEYS_KEY, b64);
  return payload;
}
function xlEbayKeysClear(){
  try { localStorage.removeItem(XL_EBAY_KEYS_KEY); } catch {}
}

function xlShopPaintStatus(id){
  const row = document.getElementById("shop-cg-status-row");
  if (!row) return;
  const st = xlConnectStatus(id || XL_SHOP_GUIDE_ID);
  row.innerHTML = xlConnectStatusTag(st) + `<span class="mut" style="font-size:12px">Local status · not a password vault</span>`;
}
function xlShopCloseGuide(){
  const ov = document.getElementById("shop-connect-overlay");
  if (ov) ov.classList.add("hidden");
  XL_SHOP_GUIDE_ID = null;
}
function xlShopOpenGuide(id){
  const shop = xlConnectShopById(id) || xlConnectShopsMerged().find(s => s.id === id);
  const ov = document.getElementById("shop-connect-overlay");
  const body = document.getElementById("shop-cg-body");
  const title = document.getElementById("shop-cg-title");
  const sub = document.getElementById("shop-cg-sub");
  if (!shop || !ov || !body) { toast("Connect panel missing for " + id); return; }
  XL_SHOP_GUIDE_ID = shop.id;
  xlConnectMarkReady(shop.id);
  xlConnectRefresh();
  if (title) title.textContent = "Connect " + shop.name;
  if (sub) sub.textContent = shop.oauth
    ? "Free guide · your developer keys · OAuth opens on eBay"
    : "The extension fills this shop in your browser. You still press Post there.";
  xlShopPaintStatus(shop.id);

  const hiveLis = (shop.hive || []).map(s => `<li>${s}</li>`).join("");
  let oauthBlock = "";
  if (shop.oauth) {
    const saved = xlEbayKeysLoad();
    const statusTxt = saved && saved.clientId
      ? ("Keys saved in this browser · Client ID ends …" + saved.clientId.slice(-6) + " · " + (saved.env || "sandbox"))
      : "No keys saved yet in this browser.";
    oauthBlock = `
   <div class="shop-cg-runame">
    <label>RuName / redirect URI (register exactly)</label>
    <code id="ebay-cg-redirect">${escapeHtml(XL_EBAY_REDIRECT)}</code>
    <div class="row">
     <button type="button" class="btn btn-soft btn-sm" onclick="xlEbayCopyRedirect()" data-tip="Copies the redirect URI to your clipboard.">Copy URI</button>
     <a class="btn btn-soft btn-sm" href="https://developer.ebay.com/" target="_blank" rel="noopener noreferrer" data-tip="Opens the eBay developer portal.">Open developer portal</a>
    </div>
   </div>
   <div class="shop-cg-form">
    <label for="ebay-cg-client-id">Client ID (App ID)</label>
    <input id="ebay-cg-client-id" type="text" autocomplete="off" spellcheck="false" placeholder="Your eBay App ID / Client ID" />
    <label for="ebay-cg-client-secret">Client Secret (Cert ID)</label>
    <input id="ebay-cg-client-secret" type="password" autocomplete="off" spellcheck="false" placeholder="Your eBay Cert ID / Client Secret" />
    <label for="ebay-cg-env">Environment</label>
    <select id="ebay-cg-env">
     <option value="sandbox"${(!saved || saved.env !== "production") ? " selected" : ""}>Sandbox (recommended first)</option>
     <option value="production"${(saved && saved.env === "production") ? " selected" : ""}>Production</option>
    </select>
    <p class="hint">Keys stay in this browser (<code>localStorage</code> base64 stub — not strong encryption). Prefer a private device. Cloudflare env secrets still work as a fallback when set.</p>
   </div>
   <div class="shop-cg-actions">
    <button type="button" class="btn btn-soft" onclick="xlEbaySaveKeys()" data-tip="Saves Client ID + Secret in this browser only.">Save keys</button>
    <button type="button" class="btn btn-accent" onclick="xlEbayConnectStart()" data-tip="Starts eBay OAuth using saved or typed keys (or Cloudflare env).">Connect OAuth</button>
    <button type="button" class="btn btn-ghost btn-sm" onclick="xlEbayClearKeys()" data-tip="Removes saved keys from this browser.">Clear saved keys</button>
    <button type="button" class="btn btn-soft btn-sm" onclick="xlConnectVerify('ebay')" data-tip="Asks your extension whether a live eBay session is present. Booleans only.">Verify session</button>
    <button type="button" class="btn btn-ghost btn-sm" onclick="xlConnectMarkLocal('ebay')" data-tip="Manual mark only — displays Unverified until the extension confirms a live session.">I've connected</button>
   </div>
   <p class="shop-cg-foot" id="ebay-cg-status">${escapeHtml(statusTxt)}</p>`;
  } else {
    oauthBlock = `
   <div class="shop-cg-actions">
    <a class="btn btn-accent" href="${escapeHtml(shop.createListing)}" target="_blank" rel="noopener noreferrer" data-tip="Opens ${escapeHtml(shop.name)} create-listing.">Open create listing</a>
    <a class="btn btn-soft" href="${escapeHtml(shop.signup)}" target="_blank" rel="noopener noreferrer" data-tip="Opens ${escapeHtml(shop.name)} signup.">Open signup</a>
    ${(typeof EXT_LIVE !== "undefined" && EXT_LIVE)
      ? `<button type="button" class="btn btn-accent" onclick="xlConnectVerify('${shop.id}')" data-tip="Asks your extension for a live ${escapeHtml(shop.name)} session. Booleans only.">Verify session</button>`
      : `<button type="button" class="btn btn-soft" onclick="extConnectPrompt()" data-tip="Install the Crosslister so Verify session and Sell everywhere work.">Connect extension first</button>`}
    <button type="button" class="btn btn-ghost btn-sm" onclick="xlConnectMarkLocal('${shop.id}')" data-tip="Manual mark only — shows Unverified until the extension confirms a live session.">I've connected</button>
    <button type="button" class="btn btn-ghost btn-sm" onclick="xlShopCloseGuide();xlConnectOpenGuide('${escapeHtml(shop.name)}')" data-tip="Also opens Guide A to Z for ${escapeHtml(shop.name)}.">Guide A to Z</button>
   </div>
   <p class="shop-cg-foot" id="shop-cg-foot">No API keys. Create the ${escapeHtml(shop.name)} account → stay logged in in Chrome → Verify session → Multilist → Sell everywhere.</p>`;
  }

  body.innerHTML = `
   <p class="shop-cg-honest"><b>Honest:</b> ${shop.honest}</p>
   <div class="shop-cg-hive" aria-label="Hive coach checklist">
    <p class="kicker">Hive coach · checklist</p>
    <ol>${hiveLis}</ol>
   </div>
   <div class="shop-cg-links">
    <a class="btn btn-soft btn-sm" href="${escapeHtml(shop.signup)}" target="_blank" rel="noopener noreferrer" data-tip="Public signup URL for ${escapeHtml(shop.name)}.">Signup deep link</a>
    <a class="btn btn-soft btn-sm" href="${escapeHtml(shop.createListing)}" target="_blank" rel="noopener noreferrer" data-tip="Public create-listing URL for ${escapeHtml(shop.name)}.">Create-listing deep link</a>
   </div>
   ${oauthBlock}`;

  ov.classList.remove("hidden");
  if (shop.oauth) {
    const saved = xlEbayKeysLoad();
    const idEl = document.getElementById("ebay-cg-client-id");
    const secEl = document.getElementById("ebay-cg-client-secret");
    if (idEl) idEl.value = saved ? saved.clientId : "";
    if (secEl) secEl.value = saved ? saved.clientSecret : "";
  }
  refreshTips();
  try {
    const focusEl = document.getElementById("ebay-cg-client-id") || body.querySelector("a.btn");
    focusEl && focusEl.focus();
  } catch {}
}

function xlEbayOpenGuide(){ xlShopOpenGuide("ebay"); }
function xlEbayCloseGuide(){ xlShopCloseGuide(); }

function xlEbayCopyRedirect(){
  const v = XL_EBAY_REDIRECT;
  const done = () => toast("Redirect URI copied");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(v).then(done).catch(() => { prompt("Copy this redirect URI:", v); });
  } else {
    prompt("Copy this redirect URI:", v);
  }
}
function xlEbaySaveKeys(){
  const clientId = (document.getElementById("ebay-cg-client-id") || {}).value || "";
  const clientSecret = (document.getElementById("ebay-cg-client-secret") || {}).value || "";
  const env = (document.getElementById("ebay-cg-env") || {}).value || "sandbox";
  if (!String(clientId).trim() || !String(clientSecret).trim()) {
    toast("Paste both Client ID and Client Secret before saving");
    return;
  }
  const saved = xlEbayKeysSave({ clientId, clientSecret, redirectUri: XL_EBAY_REDIRECT, env });
  xlConnectMarkReady("ebay");
  xlConnectRefresh();
  xlShopPaintStatus("ebay");
  const st = document.getElementById("ebay-cg-status");
  if (st) st.textContent = "Saved in this browser · Client ID ends …" + saved.clientId.slice(-6) + " · " + saved.env;
  toast("eBay keys saved in this browser (not uploaded to a key vault yet)");
}
function xlEbayClearKeys(){
  xlEbayKeysClear();
  const idEl = document.getElementById("ebay-cg-client-id");
  const secEl = document.getElementById("ebay-cg-client-secret");
  if (idEl) idEl.value = "";
  if (secEl) secEl.value = "";
  const st = document.getElementById("ebay-cg-status");
  if (st) st.textContent = "No keys saved yet in this browser.";
  xlConnectRefresh();
  xlShopPaintStatus("ebay");
  toast("Cleared saved eBay keys from this browser");
}
function xlEbayReadFormOrStorage(){
  const idEl = document.getElementById("ebay-cg-client-id");
  const secEl = document.getElementById("ebay-cg-client-secret");
  const envEl = document.getElementById("ebay-cg-env");
  const fromForm = {
    clientId: String((idEl && idEl.value) || "").trim(),
    clientSecret: String((secEl && secEl.value) || "").trim(),
    redirectUri: XL_EBAY_REDIRECT,
    env: ((envEl && envEl.value) || "sandbox").toLowerCase() === "production" ? "production" : "sandbox"
  };
  if (fromForm.clientId && fromForm.clientSecret) return fromForm;
  return xlEbayKeysLoad();
}
async function xlEbayConnectStart(){
  toast("Starting eBay OAuth…");
  const keys = xlEbayReadFormOrStorage();
  try {
    const opts = { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "cache-control": "no-store" } };
    if (keys && keys.clientId && keys.clientSecret) {
      opts.body = JSON.stringify({
        clientId: keys.clientId,
        clientSecret: keys.clientSecret,
        redirectUri: keys.redirectUri || XL_EBAY_REDIRECT,
        env: keys.env || "sandbox"
      });
      try {
        opts.headers["Authorization"] = "EbayKeys " + btoa(unescape(encodeURIComponent(JSON.stringify({
          clientId: keys.clientId,
          clientSecret: keys.clientSecret,
          redirectUri: keys.redirectUri || XL_EBAY_REDIRECT,
          env: keys.env || "sandbox"
        })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      } catch {}
    } else {
      opts.body = JSON.stringify({});
    }
    const r = await fetch("/api/ebay/oauth/start", opts);
    const data = await r.json().catch(() => ({}));
    if (data && data.authorizeUrl) {
      xlShopCloseGuide();
      window.location.href = data.authorizeUrl;
      return;
    }
    const next = data && data.nextStep ? (" Next: " + data.nextStep) : "";
    const msg = (data && (data.message || data.error)) || ("eBay OAuth not configured (" + r.status + ")");
    toast(msg);
    const st = document.getElementById("ebay-cg-status");
    if (st) st.textContent = msg + next;
    try { console.info("[ebay-oauth]", { status: r.status, error: data && data.error, missing: data && data.missing }); } catch {}
  } catch (e) {
    toast("eBay OAuth unreachable — paste keys in the guide or set Cloudflare secrets");
    try { console.info("[ebay-oauth]", "network_error"); } catch {}
  }
}
function xlEbayHandleCallbackParams(){
  try {
    const u = new URL(location.href);
    const ebay = u.searchParams.get("ebay_oauth");
    if (!ebay) return;
    if (ebay === "ok") {
      const state = xlConnectLoad();
      state.ebay = { status: "connected", via: "oauth", at: new Date().toISOString() };
      xlConnectSave(state);
      toast("eBay Connected — OAuth token saved (listing create is a follow-up)");
    } else {
      toast("eBay connect failed: " + (u.searchParams.get("ebay_error") || ebay));
    }
    u.searchParams.delete("ebay_oauth");
    u.searchParams.delete("ebay_error");
    history.replaceState({}, "", u.pathname + u.search + u.hash);
    if (typeof go === "function") setTimeout(() => go("xl"), 50);
  } catch {}
}
document.addEventListener("DOMContentLoaded", () => {
  try { restoreSession(); } catch {}
  try { xlEbayHandleCallbackParams(); } catch {}
  try {
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") xlShopCloseGuide();
    });
    const ov = document.getElementById("shop-connect-overlay");
    if (ov) ov.addEventListener("click", (ev) => { if (ev.target === ov) xlShopCloseGuide(); });
  } catch {}
});

/* Canonical fee table — Vinted 0% seller fee, Poshmark flat $2.95 under $15 / 20% at $15+.
   Multilist "kept" figures use this so Vinted stays 0% even if API feePct drifts. */
const FEE_TABLE = [
  { id:"depop", name:"Depop", feePct:3.3, feeFixed:0.45, note:"0% commission + 3.3% + $0.45 processing" },
  { id:"ebay", name:"eBay", feePct:13.6, feeFixed:0.4, note:"13.6% final value fee + $0.40 per order" },
  { id:"poshmark", name:"Poshmark", feePct:20, note:"20% at $15+; $2.95 under $15", special:"posh" },
  { id:"mercari", name:"Mercari", feePct:10, note:"~10% selling fee" },
  { id:"vinted", name:"Vinted", feePct:0, note:"0% seller fee in most countries" },
  { id:"grailed", name:"Grailed", feePct:9, note:"~9% commission" }
];
function feeTableById(id){
  const k = String(id||"").toLowerCase();
  return FEE_TABLE.find(m => m.id === k) || null;
}
function feeEstimateAmount(m, price){
  const p = Number(price)||0;
  if (!m) return 0;
  if (m.special === "posh") return p < 15 ? 2.95 : p * 0.20;
  return p * ((Number(m.feePct)||0)/100) + (Number(m.feeFixed)||0);
}
function marketsForSixDisplay(apiMarkets){
  /* Prefer the six FEE_TABLE shops; merge API maxChar/signup when present. */
  const byId = {};
  (apiMarkets||[]).forEach(m => { if (m && m.id) byId[String(m.id).toLowerCase()] = m; });
  return FEE_TABLE.map(ft => {
    const api = byId[ft.id] || {};
    return {
      id: ft.id,
      name: api.name || ft.name,
      feePct: ft.feePct,
      feeFixed: ft.feeFixed || api.feeFixed || 0,
      special: ft.special || null,
      note: ft.note,
      maxChar: api.maxChar || ({depop:80,ebay:80,poshmark:80,mercari:80,vinted:100,grailed:80}[ft.id]) || null,
      signup: api.signup || (XL_CONNECT_SHOPS.find(s=>s.id===ft.id)||{}).signup || "#"
    };
  });
}

/* ================= MULTILIST HUB (marketplace lister + admin) ================= */
async function renderXL(el){
  if (!TOKEN || !USER) {
    el.innerHTML = renderAuthPrompt("Log in to multilist", "Sign in to prepare your listings for every shop and track fees and admin.");
    refreshTips();
    return;
  }
  el.innerHTML = showLoader();
  try {
    const [mp, ld] = await Promise.all([api("/api/marketplaces"), api("/api/listings")]);
    S.markets = mp.marketplaces || [];
    const six = marketsForSixDisplay(S.markets);
    const items = ld.listings || [];
    S.listings = items;
    const live = items.filter(x => x.status === "active");
    // `platforms` is stored on every listing as JSON — parsing it gives the
    // real "prepared for" count per shop without one request per listing.
    const prepared = {};
    items.forEach(x => {
      let p = []; try { p = JSON.parse(x.platforms || "[]"); } catch {}
      p.forEach(pid => { prepared[pid] = (prepared[pid] || 0) + 1; });
    });
    const EXAMPLE = 50;
    el.innerHTML = `
    <div class="xl-hero">
      <div class="xl-hero-tag">Marketplace lister &amp; admin</div>
      <h2>Write it once. Sell everywhere.</h2>
      <p>Pick an item and we walk you through every shop: the title, description and price are written for each one and copied for you, the photos go straight into the shop's app, and you tap Post. It's on fashionistas.ai the moment you list it. Nothing to install.</p>
      <div class="xl-hero-actions">
        <button class="btn btn-accent" onclick="xlPickItem()" data-tip="Pick an item below, choose the shops, and we'll hand you the copy for each.">Start multilisting →</button>
        <button class="btn btn-soft" onclick="go('closet')" data-tip="Open everything you're selling.">See my items</button>
      </div>
      <div class="xl-hero-stats">
        <span><b>${six.length}</b> shops</span>
        <span><b>${items.length}</b> items</span>
        <span><b>${live.length}</b> live</span>
      </div>
    </div>

    <div class="card" id="xl-connect">
      <h3 style="margin-top:0">How posting works</h3>
      <p class="mut" style="margin-top:0">Works on your phone, nothing to install. Here's exactly what happens for each shop:</p>
      <div class="xl-how">
        <div class="xl-mkt"><div class="xl-mkt-name"><b>fashionistas.ai</b><span class="mut">Automatic — live the moment you tap List it.</span></div></div>
        <div class="xl-mkt"><div class="xl-mkt-name"><b>Depop · Poshmark · Mercari · Vinted · Grailed</b><span class="mut">Guided — about a minute each. Photos go to their app through your share sheet, every field is one tap to copy, you press Post there and tick it off here.</span></div></div>
        <div class="xl-mkt"><div class="xl-mkt-name"><b>eBay</b><span class="mut">Guided today. Direct posting from here is coming once eBay sign-in is switched on.</span></div></div>
        <div class="xl-mkt"><div class="xl-mkt-name"><b>Etsy</b><span class="mut">Guided today. Connect is coming soon.</span></div></div>
      </div>
      <p class="mut" style="font-size:12.5px;margin:10px 0 0">A shop only shows as Posted after you confirm it — we never mark anything Posted on our own.</p>
    </div>

    <div class="card">
      <h3 style="margin-top:0">Every shop we prepare for</h3>
      <p class="mut" style="margin-top:0">Their cut, the title length they allow, and how many of your items are already written up for them. The <b>kept</b> figure is what lands in your pocket from a ${money(EXAMPLE)} sale.</p>
      <p class="mut" style="font-size:12px;margin:0 0 10px">Fee % is an estimate from this page's own fee table (Vinted 0% seller fee). Kept = $${EXAMPLE} sale minus estimated fee.</p>
      ${six.length ? six.map(m => {
          const fee = feeEstimateAmount(m, EXAMPLE);
          const kept = EXAMPLE - fee;
          const feeLabel = m.special === "posh" ? "Poshmark tiered" : ((Number(m.feePct)||0) + "% fee");
          return `
        <div class="xl-mkt">
          <div class="xl-mkt-name"><b>${escapeHtml(m.name)}</b><span class="mut">${feeLabel} · title up to ${m.maxChar || "any length"} · <b>${prepared[m.id]||0}</b> prepared</span></div>
          <div class="xl-mkt-keep"><b>${money(kept)}</b><span class="mut">kept</span></div>
          <a class="btn btn-soft btn-sm" href="${escapeHtml(m.signup||"#")}" target="_blank" rel="noopener noreferrer" data-tip="Opens ${escapeHtml(m.name)} in a new tab.">Open</a>
        </div>`; }).join("") : `<div class="empty">Could not load the shops — pull to refresh.</div>`}
    </div>

    <div class="card" id="xl-hub-items">
      <h3 style="margin-top:0">Pick an item to send out</h3>
      <p class="mut" style="margin-top:0">Opens the step-by-step for that item: photos, copy-paste fields and a checklist per shop.</p>
      ${items.length ? items.slice(0,14).map(x => `
        <button class="xl-item" onclick="xlOpen(${x.id})" data-tip="Opens the step-by-step posting screen for this item.">
          <span class="xl-item-t">${escapeHtml(x.title || "Untitled")}</span>
          <span class="xl-item-p">${money(x.price)}</span>
        </button>`).join("") : `<div class="empty">Nothing to send yet — add an item first, then it can go to every shop at once.</div>`}
    </div>

    <div class="card">
      <h3 style="margin-top:0">Administration</h3>
      <p class="mut" style="margin-top:0">Everything about running the shops in one place.</p>
      <div class="xl-admin">
        <button class="btn btn-soft" onclick="go('sell')" data-tip="See what each shop takes and what you keep at any price.">Fees &amp; pricing</button>
        <button class="btn btn-soft" onclick="go('more')" data-tip="Your sales, orders and profit.">Sales &amp; profit</button>
        <button class="btn btn-soft" onclick="go('closet')" data-tip="Edit, reprice or retire anything you're selling.">Manage listings</button>
        <a class="btn btn-soft" href="${API}/api/export/inventory.csv" onclick="return xlExport(event,'inventory.csv')" data-tip="Downloads every listing as a spreadsheet file.">Export inventory</a>
        <a class="btn btn-soft" href="${API}/api/export/orders.csv" onclick="return xlExport(event,'orders.csv')" data-tip="Downloads every sale as a spreadsheet file.">Export orders</a>
      </div>
    </div>`;
    refreshTips();
  } catch(e){
    if (e.message === "unauthorized") {
      el.innerHTML = renderAuthPrompt("Session expired — please log in", "Your session has ended. Sign in to use the multilister.");
      refreshTips();
      return;
    }
    el.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
  }
}
function xlPickItem(){
  const t = document.getElementById("xl-hub-items");
  if (t) t.scrollIntoView({ behavior:"smooth", block:"start" });
}
function xlOpen(id){
  if (window.LW) return LW.post(id);
  openListing(id).then(() => {
    setTimeout(() => {
      const p = document.getElementById("xl-pick");
      if (p) p.scrollIntoView({ behavior:"smooth", block:"center" });
    }, 350);
  }).catch(() => {});
}
// CSV exports need the bearer token, so they cannot be a plain link.
async function xlExport(ev, name){
  ev.preventDefault();
  try {
    const r = await fetch(API + "/api/export/" + name, { headers:{ Authorization:"Bearer "+TOKEN } });
    if (!r.ok) throw new Error("download failed (" + r.status + ")");
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    toast("Downloaded " + name);
  } catch(e){ toast(e.message); }
  return false;
}

/* ================= HOME ================= */
/* Background layer for a card: a drifting field of letters/words that are
   relevant to what that card says (SELL/TAG for stock, SOLD for sales,
   $/% for money, real shop names for sources). Built once, CSS animates it. */
function fxBg(words){
 return `<div class="fx-bg" aria-hidden="true">${words.map((w,i)=>{
   const t = 5 + ((i*29) % 72), l = 3 + ((i*37) % 76);
   const dly = (i*1.35).toFixed(2), dur = (11 + (i%4)*2.5).toFixed(1);
   const fs = i % 2 ? 15 : 20;
   return `<span style="--t:${t}%;--l:${l}%;--dly:${dly}s;--dur:${dur}s;--fs:${fs}px">${escapeHtml(w)}</span>`;
 }).join("")}</div>`;
}

/* Kinetic titles: split a [data-kt] heading into per-letter spans that rise in.
   aria-label keeps the real text for screen readers; letters are aria-hidden. */
function ktSplit(root){
 const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 (root||document).querySelectorAll("[data-kt]").forEach(el=>{
   if (el.__ktDone) return;
   el.__ktDone = 1;
   const txt = el.textContent;
   el.setAttribute("aria-label", txt);
   el.innerHTML = [...txt].map((ch,i)=>
     `<i aria-hidden="true" style="animation-delay:${(i*0.045).toFixed(3)}s">${(ch===" "||ch==="\u00A0")?"&nbsp;":escapeHtml(ch)}</i>`
   ).join("");
   if (reduce) el.querySelectorAll("i").forEach(n=>{ n.style.animation = "none"; });
 });
}

async function renderHome(el){
 if (!TOKEN || !USER) {
   el.innerHTML = roleSwitchHtml() + renderAuthPrompt("Log in to see your home screen", "Sign in to see your sales, active listings and daily profit.");
   refreshTips();
   return;
 }
 el.innerHTML = showLoader();
 try {
 const [a, p, mp] = await Promise.all([ api("/api/analytics"), api("/api/profit/summary"), api("/api/marketplaces") ]);
 S.markets = mp.marketplaces;
  const st = a.stats || {};
  el.innerHTML = roleSwitchHtml() + `
  <div class="hero">
 <h2 style="font-size:26px;margin:0 0 4px">Hey ${USER.username}</h2>
 <p>${st.activeListings||0} for sale · ${st.sales||0} sold · ${money(st.profit)} profit</p>
 <div class="hero-tick"><span class="ht-dot"></span><span class="ht-clip"><span id="hero-word">Snap it.</span></span></div>
 </div>
 <button type="button" class="btn btn-accent ux-big" onclick="go('snap')"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='6' width='18' height='14' rx='3'/><path d='M8.5 6 10 3.5h4L15.5 6'/><circle cx='12' cy='13' r='3.8'/></svg> Sell an item</button>
 <div class="three">
 <div class="card fx fx-sale" style="margin:0;text-align:center" data-tip="Items you could sell right now — open My clothes to see them.">${fxBg(["SELL","LIST","TAG","NEW","FOR SALE","HANG"])}<div class="stat"><svg class="fx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 12 4.8H4.8V12l8.6 8.6a2 2 0 0 0 2.8 0l4.4-4.4a2 2 0 0 0 0-2.8Z"/><circle cx="8.4" cy="8.4" r="1.4"/></svg><b data-count="${Number(st.activeListings)||0}">0</b><span>For sale</span></div></div>
 <div class="card fx fx-sold" style="margin:0;text-align:center" data-tip="How many items you've sold so far.">${fxBg(["SOLD","SHIPPED","SOLD","DONE","SOLD","\u2713"])}<div class="stat"><svg class="fx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.2 12.4 2.6 2.6 5-5.6"/></svg><b data-count="${Number(st.sales)||0}">0</b><span>Sold</span></div></div>
 <div class="card fx fx-money" style="margin:0;text-align:center" data-tip="What you actually kept after fees, postage and what it cost you.">${fxBg(["$","%","PROFIT","$","+","KEPT"])}<div class="stat"><svg class="fx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M14.7 9.3c-.6-.9-1.7-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2 0 2.7 5.7 1.3 5.7 4.1 0 1.3-1.2 2.1-2.9 2.1-1.3 0-2.5-.5-3.1-1.5M12 6.1v1.5M12 16.3v1.5"/></svg><b data-count="${Number(st.profit)||0}" data-pre="$" data-dec="2">$0.00</b><span>Profit</span></div></div>
 </div>
<div class="card fx fx-money">
<h3 class="kt kt-sheen" data-kt style="margin-top:0">Money in · last 30 days</h3>
  ${fxBg(["$","MONEY IN","+","CASH","$","\u2191"])}
 ${await revenueChart(a.byDay||[])}
 </div>
<div class="card fx fx-shops">
<h3 class="kt kt-sheen" data-kt style="margin-top:0">Where your sales came from</h3>
  ${fxBg((a.byPlatform||[]).slice(0,4).map(r=>String(r.platform||"").toUpperCase()).concat(["DEPOP","POSHMARK"]))}
 ${renderPlatforms(a.byPlatform||[])}
 </div>
<div class="card fx fx-sale">
<h3 class="kt kt-sheen" data-kt style="margin-top:0">Shortcuts</h3>
  ${fxBg(["SNAP IT","TAP","LIST","GO","SELL","\u2192"])}
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
 <button class="btn btn-soft" data-tip="Everything you're selling — search it, sort it, fix it." onclick="go('closet')"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z'/></svg> See my clothes</button>
 <button class="btn btn-soft" data-tip="No camera handy? Type the details in yourself." onclick="openAdd()"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 5v14M5 12h14'/></svg> Add without a photo</button>
 <button class="btn btn-soft" data-tip="Enter a price and see what's left after each shop takes its cut." onclick="go('sell')"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 3.5v17M7.5 20.5h9M4 8.5h16M7.5 8.5 4.5 15a3 3 0 0 0 6 0zM16.5 8.5l-3 6.5a3 3 0 0 0 6 0z'/></svg> What will I make?</button>
 </div>
 </div>`;
  countUp(el); ktSplit(el); startHeroTick(); refreshTips();
 } catch(e){
  if (e.message === "unauthorized") {
    el.innerHTML = roleSwitchHtml() + renderAuthPrompt("Session expired — please log in", "Your session has ended. Sign in to see your listings and profit.");
    refreshTips();
    return;
  }
  el.innerHTML = `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>${escapeHtml(e.message)}</div>`;
 }
}

/* animated number roll-up */
function countUp(root){
 const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 (root||document).querySelectorAll("[data-count]").forEach(el=>{
   const target = parseFloat(el.getAttribute("data-count"));
   const pre = el.getAttribute("data-pre") || "";
   const dec = parseInt(el.getAttribute("data-dec") || "0", 10);
   if (!isFinite(target)) return;
   /* Count each number ONCE. countUp's own text writes are DOM mutations, and
      the #screen observer re-ran countUp on every mutation — so the stats
      restarted from 0 forever (the "blinking" on phones). */
   if (el.__counted === target) return;
   el.__counted = target;
   const fmtV = v => pre + v.toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec});
   if (reduce){ el.textContent = fmtV(target); return; }
   let t0 = 0; const dur = 1100;
   requestAnimationFrame(function step(ts){
     if (!t0) t0 = ts;
     const p = Math.min(1,(ts-t0)/dur), e = 1-Math.pow(1-p,3);
     el.textContent = fmtV(p===1 ? target : target*e);
     if (p < 1) requestAnimationFrame(step);
   });
 });
}

/* rotating word chip in the dashboard hero */
var HERO_TICK = null;
function startHeroTick(){
 const w = document.getElementById("hero-word");
 if (HERO_TICK){ clearInterval(HERO_TICK); HERO_TICK = null; }
 if (!w) return;
 if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
 const WORDS = ["Snap it.","Price it.","Sell everywhere.","Watch it post.","It sells.","Get paid."];
 let i = 0;
 HERO_TICK = setInterval(()=>{
   const el = document.getElementById("hero-word");
   if (!el){ clearInterval(HERO_TICK); HERO_TICK = null; return; }
   el.classList.add("out");
   setTimeout(()=>{
     i = (i+1) % WORDS.length;
     const w = WORDS[i];
     el.innerHTML = [...w].map((ch,ci)=>
       `<i aria-hidden="true" style="display:inline-block;font-style:normal;animation:ktIn .5s cubic-bezier(.22,1,.36,1) ${(ci*0.04).toFixed(3)}s both">${ch===" "?"&nbsp;":escapeHtml(ch)}</i>`).join("");
     el.setAttribute("aria-label", w);
     el.classList.remove("out");
   }, 420);
 }, 2400);
}
async function revenueChart(days){
 if (!days.length) return `<div class="chart-empty"><svg viewBox="0 0 320 92" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4e3a" stop-opacity=".42"/><stop offset="1" stop-color="#ff4e3a" stop-opacity="0"/></linearGradient></defs><g stroke="rgba(0,0,0,.07)" stroke-width="1"><path d="M0 23H320M0 46H320M0 69H320"/></g><path d="M0 70 40 62 80 66 120 50 160 56 200 40 240 46 280 30 320 36V92H0Z" fill="url(#ceFill)"/><path d="M0 70 40 62 80 66 120 50 160 56 200 40 240 46 280 30 320 36" fill="none" stroke="#ff4e3a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".8" class="chip-draw"/></svg><p class="mut">No sales yet — take a photo of your first item and get it listed.</p></div>`;
 const max = Math.max(...days.map(d=>d.rev||0), 1);
 const bars = days.slice(-14).map((d,bi)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><bar style="width:100%;margin:0"><i class="bar-grow" style="height:${Math.max(4,((d.rev||0)/max)*100)}%;min-height:4px;animation-delay:${(bi*0.05).toFixed(2)}s"></i></bar><span class="mut" style="font-size:9.5px">${fmt(d.d)}</span></div>`).join("");
 return `<div style="display:flex;gap:6px;align-items:flex-end;height:110px">${bars}</div>`;
}
function renderPlatforms(rows){
 if (!rows.length) return `<div class="chart-empty"><svg viewBox="0 0 320 92" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ceBars" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4e3a" stop-opacity=".92"/><stop offset="1" stop-color="#c05cff" stop-opacity=".45"/></linearGradient></defs><g stroke="rgba(0,0,0,.07)" stroke-width="1"><path d="M0 23H320M0 46H320M0 69H320"/></g><g fill="url(#ceBars)"><rect class="bar-grow" style="animation-delay:.05s" x="26" y="50" width="42" height="34" rx="7"/><rect class="bar-grow" style="animation-delay:.13s" x="92" y="34" width="42" height="50" rx="7"/><rect class="bar-grow" style="animation-delay:.21s" x="158" y="58" width="42" height="26" rx="7"/><rect class="bar-grow" style="animation-delay:.29s" x="224" y="26" width="42" height="58" rx="7"/><rect class="bar-grow" style="animation-delay:.37s" x="278" y="46" width="34" height="38" rx="7"/></g></svg><p class="mut">Sales you write down show up here, shop by shop.</p></div>`;
 const maxRev = Math.max(...rows.map(r=>Number(r.rev)||0), 1);
 return rows.map((r,ri)=>{
  const share = Math.round(((Number(r.rev)||0)/maxRev)*100);
  const d = (ri*0.09).toFixed(2);
  return `<div class="plat-row" style="display:flex;flex-direction:column;padding:8px 0;border-bottom:1px solid var(--line);animation-delay:${d}s"><div style="display:flex;justify-content:space-between;gap:8px"><b>${r.platform||"other"}</b><span class="mut">${r.c} sales · ${money(r.rev)}</span></div><div class="plat-bar"><i style="--w:${share}%;animation-delay:${d}s"></i></div></div>`;
 }).join("");
}

/* ================= CLOSET ================= */
async function renderCloset(el){
 if (!TOKEN || !USER) {
   el.innerHTML = renderAuthPrompt("Log in to see your clothes", "Sign in to search, sort and manage everything you are selling.");
   refreshTips();
   return;
 }
 el.innerHTML = showLoader();
 try {
 const d = await api("/api/listings");
 S.listings = d.listings || [];
 await loadMarketplaces();
 if (!S.listings.length) {
 stopRolls();
 el.innerHTML = sellerHero() + `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M4.2 8h15.6l-1.1 11.2A2 2 0 0 1 16.7 21H7.3a2 2 0 0 1-2-1.8z'/><path d='M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8'/></svg><p class="ds-empty-p">Nothing here yet. Tap “Add an item” above to snap your first piece.</p><button class="btn btn-ghost btn-sm" onclick="openAdd()" data-tip="Adds an item to your closet by hand." title="Adds an item to your closet by hand.">Or add one by hand</button></div>`;
 startRolls(el);
 countUp(el);
 return;
 }
 S.closetStatus = S.closetStatus || "";
 S.closetCat = S.closetCat || "";
 /* If the chosen type no longer exists (you deleted the last pair of shoes),
    closetNavHtml() drops the filter so the closet can't silently show nothing. */
   stopRolls();
   const nSale = S.listings.filter(l => l.status !== "sold").length, nSold = S.listings.length - nSale;
   el.innerHTML = `<div class="ux-closethead"><span><b>${S.listings.length}</b> item${S.listings.length===1?"":"s"}${nSold?` · <b>${nSold}</b> sold`:""}</span><button type="button" class="btn btn-accent btn-sm" onclick="go('snap')">+ Sell an item</button></div>
 <div class="closet-tools">
 <button type="button" class="btn btn-soft closet-select" id="closet-select" data-tip="Tick several items to copy, duplicate or delete together." onclick="closetSelMode()">Select</button>
 <input class="input" id="closet-search" placeholder="Search your clothes\u2026" oninput="closetRefresh()" style="margin:0">
 <select class="input" id="closet-sort" onchange="closetRefresh()" style="margin:0">
 <option value="new">Newest</option>
 <option value="price-hi">Price \u2193</option>
 <option value="price-lo">Price \u2191</option>
 <option value="title">Name A\u2013Z</option>
 <option value="status">Status</option>
 </select></div>
 <div class="chips" id="closet-status">
 <button type="button" class="chip${S.closetStatus===""?" on":""}" data-tip="Show everything, sold and unsold." onclick="closetStatus('',this)">All</button>
 <button type="button" class="chip${S.closetStatus==="active"?" on":""}" data-tip="Only the ones still waiting to sell." onclick="closetStatus('active',this)">For sale</button>
 <button type="button" class="chip${S.closetStatus==="sold"?" on":""}" data-tip="Only the ones you've already sold." onclick="closetStatus('sold',this)">Sold</button>
 </div>
  <div id="closet-nav">${closetNavHtml()}</div>
  <div class="grid" id="closet-grid"></div>
  <div class="card" id="quality-card" style="margin-top:16px" data-tip="Checks your photos, title, description and price before you post it.">
  <h3 style="margin-top:0">Is this listing ready?</h3>
  <p class="mut" style="margin-top:0">Checks your photos, title, description and price before you post it, and tells you what to fix.</p>
  <button type="button" class="btn btn-ghost" style="width:100%" onclick="qualityCheck()" data-tip="Checks every listing for missing or thin details and tells you what to fix." title="Checks every listing for missing or thin details and tells you what to fix.">Check my listings</button>
  <div id="quality-out"></div>
  </div>
 <div id="closet-bulk" class="hidden"></div>`;
 closetRefresh();
 startRolls(el);
 countUp(el);
 statsRefresh();
 } catch(e){
  if (e.message === "unauthorized") {
    el.innerHTML = renderAuthPrompt("Session expired — please log in", "Your session has ended. Sign in to view and edit your closet.");
    refreshTips();
    return;
  }
  el.innerHTML = `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>${escapeHtml(e.message)}</div>`;
 }
}
/* photo-less tiles fall back to the matching flat-lay artwork shipped in ./assets */
const PH_ASSET = { Outerwear:"assets/listing-placeholder-jacket.svg", Dresses:"assets/listing-placeholder-dress.svg", Tops:"assets/listing-placeholder-shirt.svg" };
function liGrid(l, i){
 const cat = l.category || "item";
 const sel = S.selMode && S.sel && S.sel.has(l.id);
 const box = S.selMode
   ? `<label class="sel-box${sel?" on":""}" onclick="event.stopPropagation()"><input type="checkbox" ${sel?"checked":""} onchange="closetToggleSel(${l.id},this)"></label>`
   : "";
 const art = PH_ASSET[cat];
 const photo = l.photo_url
   ? `<img loading="lazy" src="${l.photo_url}" onerror="this.remove()"><div class="badge"></div>`
   : `<div class="ph${art?" has-img":""}">${art?`<img class="ph-img" src="${art}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('has-img');this.remove()">`:""}<span class="ph-ico">${catEmoji(cat)}</span></div>`;
 return `<div class="gitem${sel?" is-sel":""}" style="--gi:${Number(i)||0}" data-id="${l.id}" onclick="${S.selMode?`closetToggleSel(${l.id},null)`:`openListing(${l.id})`}">
 ${box}${photo}
 <div class="meta"><div class="t">${escapeHtml(l.title||"Untitled")}</div><div class="p">${money(l.price)}${l.status==='sold'?' <span class="tag sold" style="margin-left:4px">Sold</span>':''}</div></div>
 </div>`;
}
function closetStatus(st, btn){
 S.closetStatus = st;
 const bar = document.getElementById("closet-status");
 if (bar) [...bar.querySelectorAll(".chip")].forEach(c=>c.classList.toggle("on", c===btn));
 closetRefresh();
}
function filterCloset(){ closetRefresh(); }
S.selMode = false; S.sel = new Set();
function closetSelMode(){
 S.selMode = !S.selMode; S.sel = new Set();
 const b = document.getElementById("closet-select");
 if (b){ b.classList.toggle("on", S.selMode); b.textContent = S.selMode ? "Cancel" : "Select"; }
 renderBulk(); closetRefresh();
}
function closetToggleSel(id, cb){
 if (!S.selMode) return openListing(id);
 const on = !S.sel.has(id);
 if (on) S.sel.add(id); else S.sel.delete(id);
 if (cb) cb.checked = on;
 // update only this card — rebuilding the grid detaches live nodes
 const card = document.querySelector('.gitem[data-id="' + id + '"]');
 if (card){
   card.classList.toggle("is-sel", on);
   const box = card.querySelector(".sel-box");
   if (box) box.classList.toggle("on", on);
   const input = box && box.querySelector("input");
   if (input) input.checked = on;
 }
 renderBulk();
}
function closetSelAll(){ (S.listings||[]).forEach(l=>S.sel.add(l.id)); renderBulk(); closetRefresh(); }
function closetSelClear(){ S.sel = new Set(); renderBulk(); closetRefresh(); }
function renderBulk(){
 const bar = document.getElementById("closet-bulk"); if(!bar) return;
 if (!S.selMode || !S.sel.size){ bar.className = "hidden"; bar.innerHTML = ""; return; }
 const n = S.sel.size;
 bar.className = "bulk-bar";
 bar.innerHTML = `<span class="mut" id="closet-n">${n} picked</span>
 <button class="btn btn-soft btn-sm" onclick="closetSelAll()" data-tip="Ticks every item in your closet." title="Ticks every item in your closet.">All</button>
 <button class="btn btn-soft btn-sm" onclick="closetSelClear()" data-tip="Unticks everything you selected." title="Unticks everything you selected.">None</button>
 <span style="flex:1"></span>
  <button class="btn btn-soft btn-sm" onclick="bulkKit()" data-tip="Runs the same fix across every item you ticked." title="Runs the same fix across every item you ticked.">Copy the words</button>
  <button class="btn btn-soft btn-sm" onclick="bulkDuplicate()" data-tip="Makes a copy of every item you ticked." title="Makes a copy of every item you ticked.">Make copies</button>
  <button class="btn btn-danger btn-sm" onclick="bulkDelete()" data-tip="Removes these items for good.">Delete ${n}</button>`;
}
function bulkDelete(){
 const n = S.sel.size; if(!n) return;
 if (!confirm("Delete " + n + " listing" + (n===1?"":"s") + "? This cannot be undone.")) return;
 const ids=[...S.sel];
 Promise.all(ids.map(id=>api("/api/listings/"+id, {method:"DELETE"}).catch(()=>null))).then(()=>{
   S.listings = (S.listings||[]).filter(l=>!S.sel.has(l.id));
   S.sel = new Set();
   toast(n + " listing" + (n===1?"":"s") + " deleted");
   renderBulk(); closetRefresh();
 }).catch(e=>toast(e.message));
}
function bulkKit(){
 const items = (S.listings||[]).filter(l=>S.sel.has(l.id));
 if(!items.length) return;
 const kit = items.map(l=>SHOP_SIX.map(s=>xlKit(l,s)).join('\n\n')).join("\n\n" + "\u2500".repeat(42) + "\n\n");
 let copied=false;
 if (navigator.clipboard) navigator.clipboard.writeText(kit).then(()=>{copied=true;}).catch(()=>{});
 openSheet(`
 <h3 style="margin:0 0 4px">Copy all at once \u2014 ${items.length} item${items.length===1?"":"s"}</h3>
 <p class="mut" style="margin-top:0">One block of text with every item you ticked. The extension then opens each shop and posts it for you.</p>
 <div class="xl-note"><b>What actually happens:</b> this writes the copy for you. Nothing is sent to any shop — there is no link to any shop account behind this app.</div>
 <div class="xl-row" style="border-bottom:none;padding-bottom:0"><div class="mut" style="font-size:12px">${items.length} listings</div>
 <button class="btn btn-soft btn-sm" onclick="xlCopy(this)" data-kit="${escapeHtml(kit).replace(/"/g,"&quot;")}" data-tip="Copies the finished words for this shop so you can paste them straight in." title="Copies the finished words for this shop so you can paste them straight in.">Copy the words</button></div>
 <pre class="xl-kit">${escapeHtml(kit)}</pre>
 <button class="btn btn-primary" style="width:100%" onclick="closeSheet()" data-tip="Closes this panel." title="Closes this panel.">Done</button>`);
}
async function bulkDuplicate(){
  const items = (S.listings||[]).filter(l=>S.sel.has(l.id)).map(l=>({ title:l.title, description:l.description, price:l.price, size:l.size, condition:l.condition, category:l.category, photo_url:l.photo_url }));
  if(!items.length) return toast("Select at least one listing first");
  try {
    const d = await api("/api/listings/bulk", { method:"POST", body: JSON.stringify({ items }) });
    toast("Created " + d.created + " listing" + (d.created===1?"":"s"));
    const fresh = await api("/api/listings");
    S.listings = fresh.listings || [];
    S.sel = new Set();
    renderBulk(); closetRefresh();
  } catch(e){ toast(e.message); }
}
async function qualityCheck(){
  const out = document.getElementById("quality-out");
  if(!out) return;
  out.innerHTML = `<div class="spinner"></div>`;
  try {
    const d = await api("/api/listings/quality");
    const items = d.items || [];
    if(!items.length){ out.innerHTML = `<p class="mut">No listings to score yet.</p>`; return; }
    out.innerHTML = items.map(l=>`<div style="padding:7px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px"><b style="flex:1">${escapeHtml(l.title||"Untitled")}</b><b>${l.score}/100</b></div><bar><i style="width:${Math.max(3,Number(l.score)||0)}%"></i></bar><div class="mut" style="font-size:12px">${escapeHtml(qualityTip(l))}</div></div>`).join("");
  } catch(e){ out.innerHTML = `<p class="mut">${escapeHtml(e.message)}</p>`; }
}
function qualityTip(l){
  const tips = [];
  if(!l.photo_url) tips.push("add a photo (+15)");
  if(!(l.title && l.title.length > 5)) tips.push("write a longer title (+10)");
  if(!l.description) tips.push("add a description (+15)");
  else if(l.description.length <= 80) tips.push("expand description past 80 chars (+10)");
  if(!l.price) tips.push("set a price (+8)");
  if(!(l.size && l.condition)) tips.push("fill in size and condition (+7)");
  return tips.length ? tips.join(" · ") : "complete — no fixes needed";
}
/* Same department -> subcategory browser for the seller's own closet, built
   from what they actually own — departments with nothing in them are not
   offered, so the list stays short. Items saved before a category was picked
   are grouped under "Uncategorised" so they can be found and fixed instead of
   sitting invisible in the list. */
const CLOSET_NONE = "__none";
function closetPaths(){ return (S.listings||[]).map(l => taxPath(l.category)); }
function closetNavHtml(){
  const owned = closetPaths().filter(Boolean);
  const hasNone = (S.listings||[]).some(l => !taxPath(l.category));
  if (S.closetCat === CLOSET_NONE && !hasNone) S.closetCat = "";
  if (S.closetCat && S.closetCat !== CLOSET_NONE){
    const d = taxDept(S.closetCat);
    if (!d || owned.indexOf(S.closetCat) < 0 && !owned.some(p => p.indexOf(S.closetCat + "/") === 0 || p === S.closetCat)) S.closetCat = "";
  }
  const sel = S.closetCat;
  const cDept = sel === CLOSET_NONE ? "" : taxDept(sel);
  const cSub  = sel === CLOSET_NONE ? "" : taxSub(sel);
  const n = p => owned.filter(x => p ? taxMatches(x, p) : true).length;
  const chip = (label, path, on, tip) => `<button type="button" class="chip${on?" on":""}" aria-pressed="${on?"true":"false"}" onclick="closetPick(decodeURIComponent('${taxQ(path)}'))" data-tip="${escapeAttr(tip)}" title="${escapeAttr(tip)}">${escapeHtml(label)}<b class="cnt">${path ? n(path) : (S.listings||[]).length}</b></button>`;

  let out = `<nav aria-label="Where you are in your closet" data-tip="Where you are in your own catalogue. Click a step to go back up." style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:2px 0 8px;font-size:13px">`
    + `<button type="button" class="chip${!sel?" on":""}" aria-pressed="${!sel}" style="font-size:12px" onclick="closetPick('')" data-tip="Show everything in your closet.">All types</button>`
    + (cDept ? `<span style="opacity:.5">›</span><button type="button" class="chip${cDept&&!cSub?" on":""}" aria-pressed="${cDept&&!cSub}" style="font-size:12px" onclick="closetPick(decodeURIComponent('${taxQ(cDept)}'))" data-tip="Everything you have in ${escapeAttr(cDept)}.">${escapeHtml(cDept)}</button>` : "")
    + (cSub ? `<span style="opacity:.5">›</span><button type="button" class="chip on" aria-pressed="true" style="font-size:12px;cursor:default" data-tip="Currently showing ${escapeAttr(cSub)} only.">${escapeHtml(cSub)}</button>` : "")
    + (sel === CLOSET_NONE ? `<span style="opacity:.5">›</span><button type="button" class="chip on" aria-pressed="true" style="font-size:12px;cursor:default" data-tip="Items you saved without picking a category.">Uncategorised</button>` : "")
    + `</nav>`;

  const ownedDeptList = taxDepts().filter(d => owned.some(p => taxMatches(p, d)));
  out += `<div class="cat-lead">Browse your closet by department <span style="text-transform:none;letter-spacing:0;font-weight:600;opacity:.72">— swipe sideways for more</span></div>`
    + catRailHtml("closet", ownedDeptList, d => owned.filter(p => taxMatches(p, d)).length, cDept, "closet-rail");

  if (cDept){
    out += `<div class="cat-lead">Type of item in ${escapeHtml(cDept)}</div>`
      + `<div class="chips" id="closet-subs" aria-label="Types of item" data-tip="Types of item inside this department.">`
      + `<button type="button" class="chip${!cSub?" on":""}" aria-pressed="${!cSub}" onclick="closetPick(decodeURIComponent('${taxQ(cDept)}'))" data-tip="Everything in ${escapeAttr(cDept)}, whatever type it is.">All ${escapeHtml(cDept)}<b class="cnt">${n(cDept)}</b></button>`
      + taxSubs(cDept).filter(s => n(cDept + "/" + s))
          .map(s => chip(s, cDept + "/" + s, cSub === s, "Show only " + s.toLowerCase() + " items.")).join("")
      + `</div>`;
  }
  if (hasNone){
    out += `<div class="chips" id="closet-unfiled">`
      + chip("Uncategorised", CLOSET_NONE, sel === CLOSET_NONE, "Items you saved without picking a category. Give them one so buyers can find them.")
      + `</div>`;
  }
  return out;
}
function closetPick(path){
  const raw = taxUnq(path);
  const p = raw === CLOSET_NONE ? CLOSET_NONE : taxPath(raw);
  /* Same gesture as the shop: tap what you already have to climb one level. */
  if (p && p === S.closetCat) S.closetCat = (p !== CLOSET_NONE && taxSub(p)) ? taxDept(p) : "";
  else S.closetCat = p;
  const nav = document.getElementById("closet-nav");
  if (nav) nav.innerHTML = closetNavHtml();
  closetRefresh();
  refreshTips();
}
function closetRefresh(){
 const grid = document.getElementById("closet-grid");
 if (!grid) return;
 const q = ((document.getElementById("closet-search")||{}).value||"").toLowerCase().trim();
 const sort = ((document.getElementById("closet-sort")||{}).value) || "new";
 let rows = (S.listings||[]).slice();
 if (q) rows = rows.filter(l=>((l.title||"")+" "+(l.description||"")+" "+(l.brand||"")+" "+(l.category||"")).toLowerCase().includes(q));
 if (S.closetStatus) rows = rows.filter(l=>(l.status||"active")===S.closetStatus);
 /* Category filter: a bare department matches everything under it, a full
    path matches only that subcategory, "__none" catches the uncategorised. */
 if (S.closetCat){
   rows = S.closetCat === CLOSET_NONE
     ? rows.filter(l => !taxPath(l.category))
     : rows.filter(l => taxMatches(l.category, S.closetCat));
 }
 const n2 = v => Number(v)||0;
 rows.sort((a,b)=>{
   if (sort==="price-hi") return n2(b.price)-n2(a.price);
   if (sort==="price-lo") return n2(a.price)-n2(b.price);
   if (sort==="title") return String(a.title||"").localeCompare(String(b.title||""));
   if (sort==="status") return String(a.status||"active").localeCompare(String(b.status||"active")) || n2(b.id)-n2(a.id);
   return n2(b.id)-n2(a.id);
 });
  grid.innerHTML = rows.length
    ? rows.map((l,i)=>liGrid(l,i)).join("")
    : (() => {
        const filtered = !!(S.closetCat || S.closetStatus || q);
        const where = S.closetCat === CLOSET_NONE ? " in Uncategorised"
          : S.closetCat ? " in " + taxDept(S.closetCat) + (taxSub(S.closetCat) ? " › " + taxSub(S.closetCat) : "") : "";
        const bits = [];
        if (q) bits.push('for "' + q + '"');
        if (S.closetStatus) bits.push(S.closetStatus === "sold" ? "you've sold" : "still for sale");
        const why = bits.length ? " " + bits.join(" and ") : "";
        return `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='6.5'/><path d='m15.8 15.8 4.7 4.7'/></svg>`
          + `<p>${filtered ? "Nothing in your closet matches" + why + where + "." : "Nothing here yet — tap Add an item above to snap your first piece."}</p>`
          + `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">`
          + (filtered
              ? `<button type="button" class="btn btn-soft" onclick="closetClearFilters()" data-tip="Show your whole closet again." title="Show your whole closet again.">Clear filters</button>`
              : `<button type="button" class="btn btn-ghost btn-sm" onclick="openAdd()" data-tip="Adds an item to your closet by hand." title="Adds an item to your closet by hand.">Or add one by hand</button>`)
          + `</div></div>`;
      })();
  refreshTips();
}
/* One switch back to "everything", across search + status + category. */
function closetClearFilters(){
  S.closetCat = "";
  S.closetStatus = "";
  const s = document.getElementById("closet-search"); if (s) s.value = "";
  const st = document.getElementById("closet-status");
  if (st) [...st.querySelectorAll(".chip")].forEach(b => b.classList.toggle("on", (b.innerText||"").trim() === "All"));
  const nav = document.getElementById("closet-nav"); if (nav) nav.innerHTML = closetNavHtml();
  closetRefresh();
  refreshTips();
}
const catEmoji = (c)=>"<svg width='46' height='46' viewBox='0 0 64 64' fill='none' stroke='currentColor' stroke-width='4.4' stroke-linecap='round' stroke-linejoin='round'><path d='M32 28v-4.5a6 6 0 1 1 6-6'/><path d='M10 46 32 28l22 18z'/></svg>";

/* ================= SNAP (AI identify) ================= */
function renderSnap(el){
  if (window.LW) return LW.mount(el);
  CURRENT.ai = null;
  el.innerHTML = roleSwitchHtml() + `
  <div id="snap-pre">
 <div class="upload-zone" id="upload-zone" onclick="openCamera()" data-tip="Opens your camera. You can also pick a photo from your files below.">
 <div class="big-ico"><svg class='i44' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='6' width='18' height='14' rx='3'/><path d='M8.5 6 10 3.5h4L15.5 6'/><circle cx='12' cy='13' r='3.8'/><path d='m14.2 15.2 2.3 2.3 3.5-3.5'/></svg></div>
 <b>Take a photo of your item</b>
 <p class="mut" style="margin:6px 0 0">Point at your item and tap the shutter — we'll name it, size it and suggest a price.<br>Or pick a photo you already have.</p>
 </div>
 <div class="snap-alt"><button class="btn btn-soft btn-sm" onclick="$('#file').click()" data-tip="Opens your files so you can pick a photo you already have." title="Opens your files so you can pick a photo you already have.">Choose a photo I already have</button></div>
 <input type="file" id="file" accept="image/*" capture="environment" class="hidden" onchange="onPhoto(this)">
 <p class="mut" style="text-align:center;margin-top:12px">Prefer a sample? <a class="link" href="javascript:useSample()">Try a sample jacket</a></p>
 </div>
  <div id="snap-work" class="hidden"></div>`;
  refreshTips();
}
function onPhoto(inp){
 const f = inp.files[0]; if (!f) return;
 const img = new Image();
 const url = URL.createObjectURL(f);
 img.onload = () => {
 // downscale to 1024px max so base64 stays reasonable
 const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
 const c = document.createElement("canvas");
 c.width = Math.round(img.width*scale); c.height = Math.round(img.height*scale);
 c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
 const b64 = c.toDataURL("image/jpeg", 0.85).split(",")[1];
 analyzeImage(b64, url);
 };
 img.src = url;
}

/* ================= CAMERA ================= */
var CAM_STREAM = null;
function camSetErr(msg){
 var e = document.getElementById("cam-err"); if(!e) return;
 if(msg){ e.textContent = msg; e.classList.remove("hidden"); } else e.classList.add("hidden");
}
function stopCamera(){
 if (CAM_STREAM){ try{ CAM_STREAM.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} CAM_STREAM = null; }
 var v = document.getElementById("cam-video"); if (v){ try{ v.srcObject = null; }catch(e){} }
}
function closeCamera(){ PS_CAM = false; stopCamera(); var m = document.getElementById("cam-modal"); if(m) m.classList.add("hidden"); }
function camFail(msg){
 camSetErr(msg);
 var s = document.getElementById("cam-shot"); if (s) s.disabled = true;
}
async function openCamera(){
 var m = document.getElementById("cam-modal"); if(!m) return;
 // The Snap screen normally owns this modal. When we opened it for the Shop's
 // photo search we must not yank the user off the Shop screen.
 if(!document.getElementById("snap-pre") && !PS_CAM) go("snap");
 m.classList.remove("hidden");
 camSetErr("");
 var shot = document.getElementById("cam-shot"); if (shot) shot.disabled = false;
 var video = document.getElementById("cam-video");
 if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
   return camFail('This browser cannot open a camera here. Tap "Files" to pick a photo instead.');
 }
 stopCamera();
 try {
   CAM_STREAM = await navigator.mediaDevices.getUserMedia({
     video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
     audio: false
   });
   video.srcObject = CAM_STREAM;
   await video.play();
   camSetErr("");
 } catch(err){
   camFail('Camera unavailable (' + ((err && err.name) || "error") + '). Allow camera permission, or tap "Files".');
 }
}
function shoot(){
 var video = document.getElementById("cam-video");
 if(!video || !video.videoWidth) return camFail("Camera isn't ready yet — give it a second, then tap Shutter.");
 var scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
 var c = document.createElement("canvas");
 c.width = Math.round(video.videoWidth * scale);
 c.height = Math.round(video.videoHeight * scale);
 c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
 var data = c.toDataURL("image/jpeg", 0.85);
 var toPhotoSearch = PS_CAM;
 closeCamera();
 if (toPhotoSearch){
   S.photo = data; S.photoResult = null; S.photoPending = true;
   go("shop");
   return;
 }
 analyzeImage(data.split(",")[1], data);
}
document.addEventListener("keydown", function(e){ if(e.key === "Escape") closeCamera(); });
async function analyzeImage(b64, previewUrl){
 if (window.LW) { if (!LW.mounted()) go("snap"); return LW.addPhotoB64(b64, previewUrl); }
 // always make sure the Snap screen is mounted before touching it
 if (!document.getElementById("snap-pre")) { go("snap"); if (!document.getElementById("snap-pre")) return toast("Snap screen isn't ready yet"); }
 $("#snap-pre").classList.add("hidden");
 const w = $("#snap-work"); if (!w) return toast("Snap screen isn't ready yet"); w.classList.remove("hidden");
 w.innerHTML = `<div class="card">${showLoader().split("</div>")[0]}<p style="text-align:center" class="mut">Looking at your item…</p></div>`;
 try {
 const d = await identifyPhoto(b64, previewUrl);
 if (d.source === "error") throw new Error(d.error || "could not read the photo");
 const norm = (window.IdentifyFill && IdentifyFill.normalizeIdentify)
   ? IdentifyFill.normalizeIdentify(d)
   : d;
 CURRENT.ai = { ...norm, _preview: previewUrl, _b64: b64 };
 try { if (window.SellerCoach) { SellerCoach.mark("photo"); SellerCoach.mark("identify"); } } catch (e) {}
 w.innerHTML = aiResult(norm, previewUrl);
 } catch(e){
 w.innerHTML = `<div class="card"><div class="empty" style="padding:12px"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='4' y='7.5' width='16' height='12' rx='3.5'/><path d='M12 4v3.5M9 13v1.6M15 13v1.6'/><path d='M9.5 19.5v1.5M14.5 19.5v1.5'/></svg>We couldn't read that photo: <br><span class="mut">${escapeHtml(e.message)}</span><br><br><button class="btn btn-soft btn-sm" onclick="renderSnap($('#screen'))" data-tip="Starts a fresh photo of an item." title="Starts a fresh photo of an item.">Try again</button></div></div>`;
 }
}
/** Pages /api/ai/analyze first (better prompt + fill normalize); workers.dev fallback. */
async function identifyPhoto(b64, previewUrl){
  const hint = /sample-jacket/i.test(String(previewUrl || "")) ? "denim jacket product photo" : "";
  const body = JSON.stringify({ image: b64, ...(hint ? { hint } : {}) });
  // Same-origin Pages function — does not need the workers.dev session token.
  try {
    const r = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}) },
      body,
    });
    let d = null; try { d = await r.json(); } catch {}
    if (r.ok && d && d.source !== "error" && (d.type || d.category)) return d;
    if (r.status && r.status !== 404 && r.status !== 405) {
      console.warn("pages analyze", r.status, d);
    }
  } catch (e) {
    console.warn("pages analyze failed", e);
  }
  // Legacy API worker (auth required)
  return api("/api/ai/analyze", { method: "POST", body: JSON.stringify({ image: b64 }) });
}
function aiResult(d, previewUrl){
 const cat = d.category || "Tops";
 return `<div class="card">
 ${previewUrl ? `<img class="img" style="max-height:240px;object-fit:contain;background:#f1ece4" src="${previewUrl}">` : ""}
 <h3 style="margin-top:12px">${escapeHtml(d.type||"Clothing item")}</h3>
 <div>
 <span class="pill">${escapeHtml(d.brand||"Unknown brand")}</span>
 <span class="pill">${escapeHtml(d.color||"")}</span>
 <span class="pill">${escapeHtml(condFull(d.condition)||"Good")}</span>
 <span class="pill conf">${d.confidence||0}% confident</span>
 </div>
 <p class="mut" style="margin:10px 0">Suggesting a resale range of <b>${money(d.priceMin)} – ${money(d.priceMax)}</b> in <b>${escapeHtml(d.category)}</b>. ${d.material ? "Material: "+escapeHtml(d.material)+". " : ""}${d.sizeHint ? "Likely size: "+escapeHtml(d.sizeHint)+". " : ""}${d.note?escapeHtml(d.note):""}</p>
 <button class="btn btn-accent" onclick="toListingForm()" data-tip="Opens the full listing form with every detail you can fill in." title="Opens the full listing form with every detail you can fill in.">Fill in the listing →</button>
 <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px" onclick="renderSnap($('#screen'))" data-tip="Starts a fresh photo of an item." title="Starts a fresh photo of an item.">⟲ Take a photo of a different item</button>
 </div>`;
}
function condFull(c){ return c ? c[0].toUpperCase()+c.slice(1) : ""; }

function toListingForm(){
 const a = CURRENT.ai || {};
 const fields = (window.IdentifyFill && IdentifyFill.listingFieldsFromIdentify)
   ? IdentifyFill.listingFieldsFromIdentify(a)
   : null;
 const payload = fields || {
   title: titleCase(((a.brand && !/^unknown/i.test(a.brand)) ? a.brand + " " : "") + (a.color ? a.color + " " : "") + (a.type || "Clothing item")),
   category: a.category || "Tops",
   condition: a.condition || "Good",
   price: (Number(a.priceMin) && Number(a.priceMax)) ? Math.round((Number(a.priceMin) + Number(a.priceMax)) / 2) : (Number(a.priceMin) || Number(a.priceMax) || ""),
   brand: a.brand && !/^unknown/i.test(a.brand) ? a.brand : "",
   color: a.color || "",
   material: a.material || "",
   description: [
     [a.color, a.brand, String(a.type || "item").toLowerCase()].filter(Boolean).join(" ").replace(/^./, (c) => c.toUpperCase()) + ".",
     a.material ? "Material: " + a.material + "." : "",
     a.sizeHint ? "Size " + a.sizeHint + "." : "",
     "Condition: " + (condFull(a.condition) || "Good") + ".",
     a.note || ""
   ].filter(Boolean).join(" "),
   priceMax: a.priceMax,
   sizeHint: a.sizeHint || "",
   _conf: a.confidence,
 };
 renderListingForm({
   ...payload,
   _preview: a._preview,
   _b64: a._b64,
   _conf: payload._conf != null ? payload._conf : a.confidence,
 });
 try { if (window.SellerCoach) SellerCoach.mark("listing"); } catch (e) {}
}

/* ================= LISTING FORM (create/edit) ================= */
function fSubInner(dept, sel){
  if (!dept) return `<p class="mut" style="margin:6px 0 0">Choose a department above, then the type of item.</p>`;
  const chipB = s => `<button type="button" class="chip ${s===sel?"on":""}" onclick="pickSub(this)" data-tip="Files this item under ${escapeAttr(s.toLowerCase())}." title="Files this item under ${escapeAttr(s.toLowerCase())}.">${escapeHtml(s)}</button>`;
  const subs = taxSubs(dept);
  /* Long departments (Women, Men) read better split into Clothing / Shoes / Bags & jewelry / Accessories. */
  if (subs.length > 12) {
    const GL = { clothing:"Clothing", shoes:"Shoes", bags:"Bags & jewelry", jewelry:"Bags & jewelry", accessory:"Accessories" };
    const rows = (FCAT.categories||[]).filter(c => c.dept === dept);
    const order = []; const by = {};
    rows.forEach(c => { const g = GL[c.group] || "Other"; if (!by[g]) { by[g] = []; order.push(g); } by[g].push(c.sub); });
    return `<div id="f-sub" data-tip="The type of item inside this department.">`
      + order.map(g => `<div class="cat-lead" style="margin:10px 0 4px">${escapeHtml(g)}</div><div class="chips">${by[g].map(chipB).join("")}</div>`).join("")
      + `</div>`;
  }
  return `<div class="chips" id="f-sub" data-tip="The type of item inside this department.">`
    + subs.map(chipB).join("")
    + `</div>`;
}
function pickSub(el){
  /* Scope to the chips' own container rather than a fixed id, so the same
     handler works on the main form and the "add by hand" sheet. */
  const box0 = el && el.parentNode; if (!box0) return;
  const box = box0.closest("#f-sub") || box0;
  [...box.querySelectorAll(".chip")].forEach(x => x.classList.toggle("on", x === el));
  const wrap = box.closest("[id$='-sub-wrap']");
  if (wrap) sizeRefresh(wrap.id);
}
/* Per-category size picker: the subcategory decides the size system (letter,
   waist, shoe, kids, one size, none for art/home). Free text always works. */
function sizeIdFor(wrapId){ return wrapId === "m-sub-wrap" ? "m-size" : "f-size"; }
function sizeChipsHtml(path, cur){
  const sizes = catSizes(path);
  const row = catRow(path);
  if (row && row.size === "dims") return `<p class="mut" style="margin:6px 0 0;font-size:12.5px">No size for this type — put width × height in the description.</p>`;
  if (!sizes.length) return "";
  return `<div class="chips" style="margin:8px 0 0" data-tip="Sizes the shops accept for this type of item. Tap one, or type your own.">`
    + sizes.map(z => `<button type="button" class="chip ${String(cur||"")===z?"on":""}" style="padding:5px 11px;font-size:12.5px" onclick="pickSize(this)">${escapeHtml(z)}</button>`).join("")
    + `</div>`;
}
function sizeRefresh(wrapId){
  const sid = sizeIdFor(wrapId);
  const inp = document.getElementById(sid); const out = document.getElementById(sid + "-chips");
  if (!inp || !out) return;
  const deptId = wrapId === "m-sub-wrap" ? "m-dept" : "f-dept";
  const path = fReadCat(deptId, wrapId);
  out.innerHTML = sizeChipsHtml(path, inp.value.trim());
  const row = catRow(path);
  if (row && row.size === "one_size" && !inp.value.trim()) inp.value = "One size";
}
function pickSize(el){
  const box = el.parentNode; [...box.querySelectorAll(".chip")].forEach(x => x.classList.toggle("on", x === el));
  const out = box.parentNode; const inp = out && document.getElementById(out.id.replace(/-chips$/, ""));
  if (inp) { inp.value = el.textContent.trim(); inp.dispatchEvent(new Event("input", { bubbles:true })); }
}
function fDeptChange(deptId, wrapId){
  deptId = deptId || "f-dept"; wrapId = wrapId || "f-sub-wrap";
  const box = document.getElementById(wrapId); if (!box) return;
  box.innerHTML = fSubInner(((document.getElementById(deptId)||{}).value || ""), "");
  sizeRefresh(wrapId);
}
/* Current picker state -> stored path, e.g. "Women's Clothing/Tops & Shirts". */
function fReadCat(deptId, subWrapId){
  const d = ((document.getElementById(deptId)||{}).value || "").trim();
  if (!d) return "";
  const subEl = document.querySelector("#" + subWrapId + " .chip.on");
  const s = subEl ? (subEl.textContent || "").trim() : "";
  return s ? d + "/" + s : d;
}
function renderListingForm(it){
 if (window.LW) return LW.edit(it);
 const edit = !!it.id;
 CURRENT.form = { ...it, _b64: it._b64||null };
 /* Always resolve to a department + subcategory pair. An item saved before the
    tree existed holds a flat word ("Tops"); taxPath() maps it onto the new
    tree so the seller sees where it currently sits and can move it. */
 const COND_OPTS = ["Poor","Fair","Good","Excellent"];
 const wantPath = taxPath(it.category);
 const wantDept = taxDept(wantPath), wantSub = taxSub(wantPath);
 const wantCond = COND_OPTS.includes(it.condition) ? it.condition : COND_OPTS[2];
 $("#screen").innerHTML = `
 <div class="card">
 ${it._preview ? `<img class="img" style="max-height:230px;object-fit:contain;background:#f1ece4" src="${it._preview}">` : ""}
 <div id="form-ai" class="hidden"></div>
 <label>Title</label>
 <input class="input" id="f-title" value="${escapeAttr(it.title||"")}">
 <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px" onclick="optimizeTitle()" data-tip="Rewrites the title so it fits every shop length limit and still reads well." title="Rewrites the title so it fits every shop length limit and still reads well."><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M11 4.5 12.5 9l4.5 1.5L12.5 12 11 16.5 9.5 12 5 10.5 9.5 9z'/><path d='m18.5 15 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'/></svg> Let AI improve this title</button>
 <label>Department</label>
 <select class="input" id="f-dept" onchange="fDeptChange()" data-tip="Pick which part of the shop this belongs in. Buyers browse departments first, then the type of item." title="Pick which part of the shop this belongs in.">
 <option value="">Choose a department…</option>
 ${taxDepts().map(d=>`<option value="${escapeAttr(d)}"${d===wantDept?" selected":""}>${escapeHtml(d)}</option>`).join("")}
 </select>
 <label>Type of item</label>
 <div id="f-sub-wrap">${fSubInner(wantDept, wantSub)}</div>
 <div class="two">
 <div><label>Price ($)</label><input class="input" id="f-price" type="number" min="1" step="1" value="${it.priceMin||it.price||""}" placeholder="Sale price" data-tip="What the buyer pays. Use a number in the AI's range, then check what you keep after fees on Sell."></div>
 <div><label>Size</label><input class="input" id="f-size" value="${escapeAttr(it.sizeHint||it.size||"")}" placeholder="e.g. M / 10" data-tip="Size buyers filter by. Copy the label in the garment so the right people find it."><div id="f-size-chips">${sizeChipsHtml(wantPath, it.sizeHint||it.size||"")}</div></div>
 </div>
 <label>Condition</label>
 <div id="f-cond" data-tip="How used does it look? Be honest — buyers trust you more.">${COND_OPTS.map(c=>`<button class="chip ${c===wantCond?"on":""}" onclick="pickCond(this,'${c}')" data-tip="Sets the condition for this listing." title="Sets the condition for this listing.">${c}</button>`).join("")}</div>
 <fieldset class="form-sec" data-tip="These are the fields shoppers filter and search by — filling them in is what gets you found.">
  <legend>What it is</legend>
  <div class="two">
   <div><label>Brand</label><input class="input" id="f-brand" autocomplete="off" value="${escapeAttr(it.brand||"")}" placeholder="e.g. Levi's" data-tip="Brand helps search. Leave blank if you are not sure — never guess a designer name."></div>
   <div><label>Colour</label><input class="input" id="f-color" autocomplete="off" value="${escapeAttr(it.color||"")}" placeholder="e.g. Light blue"></div>
  </div>
  <div class="two">
   <div><label>Material</label><input class="input" id="f-material" autocomplete="off" value="${escapeAttr(it.material||"")}" placeholder="e.g. 100% cotton"></div>
   <div><label>Weight (oz)</label><input class="input" id="f-weight" type="number" min="0" step="0.1" inputmode="decimal" value="${it.weight_oz||""}" placeholder="For postage" data-tip="Used to work out postage. Weigh it packed if you can."></div>
  </div>
 </fieldset>

 <label>Description</label>
 <textarea class="input" id="f-desc" rows="4" placeholder="Measurements, any imperfections, why it's a steal…">${escapeAttr(it.description||defaultDesc(it))}</textarea>

 <fieldset class="form-sec" data-tip="Where the item posts from. The browser fills this from an address you've saved before.">
  <legend>Where it ships from</legend>
  <p class="mut" style="margin:0 0 8px">Buyers see the town, never your street.</p>
  <div class="two">
   <div><label>Town / city</label><input class="input" id="f-city" autocomplete="address-level2" value="${escapeAttr(it.ship_city||"")}" placeholder="e.g. Austin"></div>
   <div><label>ZIP code</label><input class="input" id="f-postcode" autocomplete="postal-code" value="${escapeAttr(it.ship_postcode||"")}" placeholder="e.g. 78701"></div>
  </div>
  <div><label>Country</label><input class="input" id="f-country" autocomplete="country-name" value="${escapeAttr(it.ship_country||"")}" placeholder="e.g. United States"></div>
  <label class="check" data-tip="Tick this if the buyer can collect from you instead of paying postage.">
   <input type="checkbox" id="f-pickup" ${it.local_pickup?"checked":""}> Buyer can collect in person
  </label>
 </fieldset>

 <fieldset class="form-sec ship-opt-wrap" data-tip="How the item actually reaches the buyer. Pick whichever suits you.">
  <legend>How your buyer gets it</legend>
  <div class="ship-opt"><b>You post it</b><span>Sell on eBay, Poshmark, Depop or wherever and that shop prints the postage label for you. We work out what to charge from the weight above, so postage never comes out of your pocket.</span></div>
  <div class="ship-opt"><b>They collect it</b><span>Tick the box above and the buyer comes to you — no label, no queue, no fee. Pop-up stores on the Map screen work exactly this way.</span></div>
  <div class="ship-opt"><b>We stay with you</b><span>Once something sells, Guide A to Z walks you through packing, the label and tracking, one plain step at a time.</span></div>
  <p class="mut ship-none"><b>No Shopify, no website, no middleman cut.</b> Your listings live in your account right here. The only money that moves is what the shop you sold on takes — and we show you that cut before you post.</p>
 </fieldset>

 <div style="height:12px"></div>
 <button class="btn btn-primary" onclick="saveListing()" data-tip="Saves this listing to your closet." title="Saves this listing to your closet.">${edit?"Save changes":"Save to my clothes"}</button>
 ${edit?`<button class="btn btn-danger btn-sm" style="width:100%;margin-top:8px" onclick="delListing(${it.id})" data-tip="Removes it for good.">Delete listing</button>`:""}
 </div>`;
}
/* Scope to the clicked chip's OWN container. These used to hard-code "#f-cond .chip",
   so chips in the pricing tool (#sp-cond) and the "add by hand" sheet (#m-cond)
   never cleared each other: several stayed `.on`, the read returned the first
   one, and both tools silently kept reporting the default value. */
function pickCond(el, c){ const box = el && el.parentNode; if (box) [...box.querySelectorAll(".chip")].forEach(x => x.classList.toggle("on", x === el)); }
function defaultDesc(it){ return `${it.brand&&it.brand!=="Unknown"?"Brand: "+it.brand+". ":""}${it.color?"Color: "+it.color+". ":""}${it.sizeHint?"Size: "+it.sizeHint+". ":""}${it.condition?"Condition: "+it.condition+". ":""}Ships fast, smoke-free home. Open to reasonable offers.`; }
async function optimizeTitle(){
 const title = $("#f-title").value.trim();
 if (!title) return toast("Enter a title first");
 toast("AI is rewriting your title…");
 try {
 const c = CURRENT.form;
 const d = await api("/api/ai/title-optimizer", { method:"POST", body: JSON.stringify({ title, category:c.category, brand:c.brand, size:c.sizeHint, condition:c.condition }) });
 $("#f-title").value = d.optimized || title;
 toast("Title optimized ✓");
 } catch(e){ toast(e.message); }
}
async function saveListing(){
 const c = CURRENT.form;
 const title = $("#f-title").value.trim();
 const price = parseFloat($("#f-price").value);
 if (!title || !price || isNaN(price)) return toast("Title and a valid price are required");
 /* Category is a department + type pair. Required, the way a real marketplace
    requires it — an item with nowhere to live can never be browsed to. */
 const category = fReadCat("f-dept", "f-sub-wrap");
 if (!category) return toast("Pick a department so buyers can find this item");
 const condition = ((($("#f-cond .on")||{}).textContent)||"Good").trim();
 const size = $("#f-size").value.trim();
 const desc = $("#f-desc").value.trim();
 // optional detail fields — an empty box means "unknown", not "0"
 const val = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };
 const numOrNull = (id) => { const v = parseFloat(val(id)); return Number.isFinite(v) ? v : null; };
 const pickup = document.getElementById("f-pickup");
 try {
 let photo_url = c._photo_url || null;
 if (c._b64) { photo_url = await uploadB64(c._b64, title); }
 const body = {
   title, description: desc, price, size, condition, category, photo_url, ai_confidence: c._conf ?? null,
   brand: val("f-brand"), color: val("f-color"), material: val("f-material"),
   weight_oz: numOrNull("f-weight"),
   ship_city: val("f-city"), ship_postcode: val("f-postcode"), ship_country: val("f-country"),
   local_pickup: !!(pickup && pickup.checked),
   status: "active", platforms: ["fashionistas"],
 };
 if (c._b64 && !photo_url) return toast("The photo didn't upload, so this isn't in Shop yet. Try again.");
 const d = await api(c.id ? `/api/listings/${c.id}` : "/api/listings", { method: c.id?"PUT":"POST", body: JSON.stringify(body) });
 toast(c.id ? "Listing updated ✓" : "Listed on fashionistas ✓");
 openListing(d.listing ? d.listing.id : c.id || d.listing?.id);
 } catch(e){ toast(e.message); }
}
async function uploadB64(b64, name){
 try {
 const bin = atob(b64);
 const bytes = Uint8Array.from(bin.split("").map(ch=>ch.charCodeAt(0)));
 const blob = new Blob([bytes], { type: "image/jpeg" });
 const fd = new FormData();
 fd.append("file", blob, (name||"item").slice(0,40).replace(/[^a-z0-9]+/gi,"-") + ".jpg");
 const r = await fetch(API + "/api/images/upload", { method:"POST", headers:{ Authorization:"Bearer "+TOKEN }, body: fd });
 const d = await r.json();
 if (!r.ok) throw new Error(d.error||"upload failed");
 return d.url;
 } catch(e){ console.error(e); return null; }
}
async function delListing(id){
 if (!confirm("Delete this listing?")) return;
 try { await api("/api/listings/"+id, { method:"DELETE" }); toast("Deleted"); go("closet"); } catch(e){ toast(e.message); }
}

/* ================= LISTING DETAIL ================= */
async function openListing(id){
 const l = (S.listings || []).find(x=>x.id===id) || await (await api("/api/listings")).listings.find(x=>x.id===id);
 if (!l) return toast("Not found");
 S.listings = S.listings.filter(x=>x.id!==id).concat([l]);
 CURRENT.listing = l;
 await loadMarketplaces();
 let platforms = [];
 try { platforms = (await api(`/api/listings/${id}/platforms`)).platforms || []; } catch {}
 kineticTitle("This item"); $("#view-sub").textContent = "One piece from your clothes — edit it, check it, post it.";
 $("#screen").innerHTML = `
 <div class="card">
 ${l.photo_url ? `<img class="detail-img" src="${l.photo_url}" onerror="this.remove()"><div style="height:10px"></div>` : ""}
 <h3 style="margin:4px 0 2px">${escapeHtml(l.title||"Untitled")}</h3>
 <div class="mut">${escapeHtml(l.description||"")}</div>
 <div style="margin:10px 0"><span class="pill">${escapeHtml(l.category||"")}</span><span class="pill">${escapeHtml(l.size||"")}</span><span class="pill">${escapeHtml(l.condition||"")}</span></div>
 <h2 style="margin:4px 0">${money(l.price)}</h2>
  <div class="two">
  <button class="btn btn-accent ${l.status==='sold'?'hidden':''}" onclick="soldSheet(${id})" data-tip="It sold! Write down the price and we'll do the maths.">Mark sold</button>
  <button class="btn btn-soft" onclick="renderListingForm(${JSON.stringify({id:l.id,title:l.title,category:l.category,condition:l.condition,priceMin:l.price,sizeHint:l.size,description:l.description,brand:l.brand,color:l.color,material:l.material,weight_oz:l.weight_oz,ship_city:l.ship_city,ship_postcode:l.ship_postcode,ship_country:l.ship_country,local_pickup:l.local_pickup,_photo_url:l.photo_url}).replace(/"/g,'&quot;')})" data-tip="Change the words, price or photo.">Edit</button>
  </div>
  <div style="height:10px"></div>
  <button id="onsale-btn" class="btn ${onsaleState(l)?"btn-soft":"btn-accent"}" style="width:100%" onclick="toggleOnsale(${id},this)" data-tip="Show this item to buyers in Shop, or hide it again.">${onsaleState(l)?"Stop selling here":"Sell it here too"}</button>
  <p class="mut" style="margin:6px 0 0">When this is on, buyers can see it in Shop.</p>
  </div>
 <div class="card lw-postcard">
 <h3 style="margin-top:0">Post it to my other shops</h3>
 <p class="mut" style="margin-top:0">Depop, Poshmark, Mercari, Vinted, Grailed, eBay and Etsy — about a minute each. We copy the words and send the photos straight into each shop's app; you tap Post there. Nothing to install.</p>
 <button class="btn btn-accent" style="width:100%" onclick="LW.post(${id})" data-tip="Step by step for each shop: photos, copy-paste fields, then you confirm it's live.">Post to my shops \u2192</button>
 </div>
 ${(typeof EXT_LIVE !== "undefined" && EXT_LIVE) ? `<details class="card"><summary style="cursor:pointer;font-weight:700">Desktop: Chrome extension (optional)</summary><p class="mut">Your Crosslister extension is connected. Tick shops, then <b>Get ready to post</b>.</p><div id="xl-pick"></div><button class="btn btn-primary" onclick="crosspost(${id})" data-tip="Queues the shops for your extension — it never marks anything Posted by itself.">Get ready to post \u2192</button></details>` : ""}
 <div class="card">
 <h3 style="margin-top:0">How good is this listing?</h3>
 ${qualityBars(l)}
 </div>
 <div class="card">
 <h3 style="margin-top:0">Shops I've prepared it for</h3>
 ${platforms.length ? [...new Map(platforms.map(p=>[p.platform,p])).values()].map(p=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><b>${platformName(p.platform)}</b><span class="tag active">${p.status||"draft"}</span></div>`).join("") : `<p class="mut">Nothing prepared for a shop yet.</p>`}
 </div>
 <button class="btn btn-danger btn-sm" style="width:100%" onclick="delListing(${id})" data-tip="Removes it for good.">Delete listing</button>`;
 const pick = $("#xl-pick");
 if (pick) pick.innerHTML = `<div class="xl-bar">
 <button type="button" class="btn btn-soft btn-sm" onclick="xlAll(true)" data-tip="Tick every shop at once.">Select all</button>
 <button type="button" class="btn btn-soft btn-sm" onclick="xlAll(false)" data-tip="Untick everything.">Clear</button>
 <span class="mut" id="xl-count">0 shops picked</span></div>`
 + (S.markets||[]).map(m=>`<label style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--line);border-radius:13px;padding:11px 13px;margin:7px 0;cursor:pointer"><input type="checkbox" value="${m.id}" style="transform:scale(1.2)" onchange="xlCount()"><b style="flex:1">${m.name}</b><span class="mut">they take ${m.feePct}%</span></label>`).join("");
  CURRENT.xl = []; xlCount();
  refreshTips();
}
function qualityBars(l){
 const bars = [];
 bars.push(["Photo", l.photo_url ? 100 : 0]);
 bars.push(["Title", Math.min(100, ((l.title||"").length/20)*100)]);
 bars.push(["Description", Math.min(100, ((l.description||"").length/100)*100)]);
 bars.push(["Price + size + condition", Math.min(100, ((l.price?25:0)+(l.size?25:0)+(l.condition?25:0)+(l.category?25:0)))]);
 return bars.map(([k,v])=>`<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${k}</span><b>${Math.round(v)}%</b></div><bar><i style="width:${Math.max(3,v)}%"></i></bar></div>`).join("");
}
function platformName(id){ return (S.markets||[]).find(m=>m.id===id)?.name || id; }
function xlChecks(){ return [...document.querySelectorAll("#xl-pick input[type=checkbox]")]; }
function xlAll(on){ xlChecks().forEach(c=>{ c.checked = on; }); xlCount(); }
function xlCount(){ const all=xlChecks(); const n=all.filter(c=>c.checked).length; const e=$("#xl-count"); if(e) e.textContent = n+" of "+all.length+" shops picked"; }

/* Per-shop paste kits — title rules, tags, tone, field hints aligned with MKT_CARD. */
const XL_KIT_RULES = {
  depop: {
    id:"depop", name:"Depop", titleMax:80,
    tags:["#vintage","#thrift","#y2k","#resale","#rework","#preloved"],
    tone:"Casual, emoji-light, honest sizing. Lead with brand + piece.",
    fields:["title","brand","category","size","condition","price","description","tags"],
    fieldHints:"Depop: title · brand · category · size · condition · price · description · up to 5 tags.",
    cats:{Tops:"Shirts & Tops",Bottoms:"Trousers & Jeans",Dresses:"Dresses",Outerwear:"Jackets & Coats",Shoes:"Footwear",Accessories:"Accessories"}
  },
  ebay: {
    id:"ebay", name:"eBay", titleMax:80,
    tags:["vintage","thrift","resale","pre-owned"],
    tone:"Search-friendly item specifics. No hashtag spam — comma keywords OK in description.",
    fields:["title","brand","category","size","condition","color","price","description","item specifics"],
    fieldHints:"eBay: title (≤80) · brand/size/color specifics · condition · fixed price · description + measurements.",
    cats:{Tops:"Tops & Shirts",Bottoms:"Jeans & Trousers",Dresses:"Dresses",Outerwear:"Jackets & Coats",Shoes:"Shoes",Accessories:"Accessories"}
  },
  poshmark: {
    id:"poshmark", name:"Poshmark", titleMax:80,
    tags:[],
    tone:"Clean closet voice. Mention bundle-friendly. No hashtag walls.",
    fields:["title","category","brand","size","price","description","cover photo"],
    fieldHints:"Poshmark: title · Category · Brand · Size · Price · description · 1 strong cover shot. Share to Parties after.",
    cats:{Tops:"Tops",Bottoms:"Bottoms",Dresses:"Dresses",Outerwear:"Outerwear",Shoes:"Shoes",Accessories:"Accessories"}
  },
  mercari: {
    id:"mercari", name:"Mercari", titleMax:80,
    tags:[],
    tone:"Offer-friendly. Clear condition first. Price near AI range.",
    fields:["title","condition","price","description","brand","size"],
    fieldHints:"Mercari: title · condition · price · description. Leave Smart Pricing off at first.",
    cats:{Tops:"Tops",Bottoms:"Bottoms",Dresses:"Dresses",Outerwear:"Outerwear",Shoes:"Shoes",Accessories:"Accessories"}
  },
  vinted: {
    id:"vinted", name:"Vinted", titleMax:100,
    tags:[],
    tone:"EU/INTL sizing. Concise; buyers pay protection fee — your price is what you keep.",
    fields:["title","size (EU/INTL)","condition","price","description","photos (app)"],
    fieldHints:"Vinted: title · EU/INTL size · condition · price · description. Prefer app photo upload.",
    cats:{Tops:"Tops",Bottoms:"Bottoms",Dresses:"Dresses",Outerwear:"Outerwear",Shoes:"Shoes",Accessories:"Accessories"}
  },
  grailed: {
    id:"grailed", name:"Grailed", titleMax:80,
    tags:[],
    tone:"Menswear/streetwear. Measurements + authenticity notes matter more than tags.",
    fields:["title","brand","size","measurements","condition","retail price","resale price","description"],
    fieldHints:"Grailed: brand + title · size · measurements · condition · original + asking price · flat-lay photos.",
    cats:{Tops:"Tops",Bottoms:"Bottoms",Dresses:"Dresses",Outerwear:"Outerwear",Shoes:"Shoes",Accessories:"Accessories"}
  }
};

function xlKitRules(shopId){
  const k = String(shopId||"").toLowerCase();
  return XL_KIT_RULES[k] || XL_KIT_RULES.depop;
}

function xlKitTags(rules, l){
  const brand = String(l.brand||"resale").replace(/\s+/g,"");
  const cat = String(l.category||"fashion").replace(/\s+/g,"");
  if (rules.id === "ebay"){
    const base = rules.tags.slice();
    if (brand) base.unshift(brand.toLowerCase());
    if (cat) base.push(cat.toLowerCase());
    return [...new Set(base)].join(", ");
  }
  if (rules.id === "depop"){
    const extra = ["#"+brand, "#"+cat].filter(t => t.length > 2);
    return [...new Set(rules.tags.concat(extra))].slice(0, 8).join(" ");
  }
  /* Posh/Mercari/Vinted/Grailed — optional soft tags only if brand known */
  if (brand && brand.toLowerCase() !== "unknown"){
    return rules.id === "grailed" ? "" : "";
  }
  return "";
}

function xlKitDescription(rules, l){
  const brand = l.brand || "";
  const size = l.size || l.sizeHint || "";
  const cond = l.condition || "";
  const color = l.color || "";
  const cat = l.category || "";
  const base = String(l.description||"").trim();
  const bits = [];
  if (rules.id === "ebay"){
    bits.push(base || (brand + " " + (cat||"item") + " in " + (cond||"good") + " condition.").trim());
    bits.push("");
    bits.push("Item specifics:");
    if (brand) bits.push("Brand: " + brand);
    if (size) bits.push("Size: " + size);
    if (color) bits.push("Color: " + color);
    if (cat) bits.push("Category: " + (shopCatPath(cat, rules.id) || (rules.cats&&rules.cats[cat]) || cat));
    if (cond) bits.push("Condition: " + cond);
    bits.push("");
    bits.push("Keywords: " + xlKitTags(rules, l));
    return bits.join("\n").trim();
  }
  if (rules.id === "grailed"){
    bits.push(base || ("Clean " + (brand||"") + " " + (cat||"piece") + " — measurements in photos/description.").replace(/\s+/g," ").trim());
    bits.push("");
    if (size) bits.push("Size: " + size + " (see measurements)");
    if (cond) bits.push("Condition: " + cond);
    if (color) bits.push("Color: " + color);
    bits.push("Ships with tracking. Serious offers welcome.");
    return bits.join("\n").trim();
  }
  if (rules.id === "vinted"){
    bits.push(base || ((brand?brand+" ":"") + (cat||"Item") + " · " + (cond||"Good")).trim());
    if (size) bits.push("Size (EU/INTL): " + size);
    if (color) bits.push("Color: " + color);
    bits.push("Smoke-free home. Message with questions.");
    return bits.join("\n").trim();
  }
  if (rules.id === "poshmark"){
    bits.push(base || ((brand?brand+" ":"") + (cat||"Item") + " — " + (cond||"Good") + " condition.").trim());
    if (size) bits.push("Size: " + size);
    bits.push("Bundle to save on shipping. Fast shipper.");
    return bits.join("\n").trim();
  }
  if (rules.id === "mercari"){
    bits.push(base || ((brand?brand+" ":"") + (cat||"Item") + ".").trim());
    if (cond) bits.push("Condition: " + cond);
    if (size) bits.push("Size: " + size);
    bits.push("Offers welcome — priced to move.");
    return bits.join("\n").trim();
  }
  /* depop default */
  bits.push(base || ((brand?brand+" ":"") + (cat||"piece") + " ready to rewear ✨").replace(/\s+/g," ").trim());
  if (size) bits.push("Size " + size);
  if (cond) bits.push(cond + " condition");
  if (color) bits.push(color);
  const tags = xlKitTags(rules, l);
  if (tags){ bits.push(""); bits.push(tags); }
  return bits.join("\n").trim();
}

function xlKitTitle(rules, l){
  const brand = (l.brand && String(l.brand).toLowerCase() !== "unknown") ? String(l.brand).trim() : "";
  const cat = l.category || "";
  const size = l.size || l.sizeHint || "";
  let title = String(l.title||"").trim();
  if (!title){
    title = [brand, cat || "Fashion item", size ? "Size "+size : ""].filter(Boolean).join(" ");
  }
  if (rules.id === "grailed" && brand && title.toLowerCase().indexOf(brand.toLowerCase()) < 0){
    title = brand + " " + title;
  }
  if (rules.id === "ebay"){
    /* Prefer search keywords: Brand + item + size */
    if (brand && title.toLowerCase().indexOf(brand.toLowerCase()) < 0) title = brand + " " + title;
    if (size && !/\bsize\b/i.test(title)) title = title + " Size " + size;
  }
  const max = Number(rules.titleMax) || 80;
  if (title.length <= max) return title;
  return title.slice(0, max - 1).replace(/\s+\S*$/, "") + "\u2026";
}

function xlKit(l, shopId){
  const rules = xlKitRules(shopId);
  const title = xlKitTitle(rules, l);
  const price = l.price != null && l.price !== "" ? ("$"+Number(l.price).toFixed(2)) : "";
  const catLabel = shopCatPath(l.category, rules.id) || (rules.cats && rules.cats[l.category]) || l.category || "";
  const meta = [l.brand, sizeLine(l), l.condition, catLabel].filter(Boolean).join(" \u00b7 ");
  const desc = xlKitDescription(rules, l);
  const tags = xlKitTags(rules, l);
  const lines = [
    "=== " + rules.name + " kit ===",
    "TITLE: " + title,
    price ? ("PRICE: " + price) : "",
    meta ? ("META: " + meta) : "",
    rules.fieldHints ? ("FIELDS: " + rules.fieldHints) : "",
    rules.tone ? ("TONE: " + rules.tone) : "",
    "",
    "DESCRIPTION:",
    desc
  ];
  if (tags && rules.id !== "ebay"){ /* ebay tags already in description */
    lines.push(""); lines.push("TAGS: " + tags);
  }
  return lines.filter((x,i)=>!(x==="" && lines[i-1]==="")).join("\n").trim();
}
function sizeLine(l){ return l.size ? ("Size "+l.size) : (l.sizeHint ? ("Size "+l.sizeHint) : ""); }

async function crosspost(id){
 const picks = xlChecks().filter(c=>c.checked).map(c=>c.value);
 if (!picks.length) return toast("Select at least one marketplace first");
 const l = (S.listings||[]).find(x=>x.id===id) || {};
 const kits = {};
 picks.forEach(pid => { kits[pid] = xlKit(l, pid); });
 const allKit = picks.map(pid => kits[pid]).join("\n\n" + "\u2500".repeat(42) + "\n\n");
 let copied = false;
 try { await navigator.clipboard.writeText(allKit); copied = true; } catch(e){}
 try { await api(`/api/listings/${id}/crosspost`, { method:"POST", body: JSON.stringify({ platforms: picks }) }); } catch(e){}
 xlSheet(l, picks, copied, kits, allKit);
}


/* ══════════════════ AUTO-FILL HANDOFF (no extension, no passwords) ══════════════════
   Shops with a real server API (eBay, Etsy) post for you through /api/list/*.
   The other nine expose no seller API and return no Access-Control-Allow-Origin
   header (probed 2026-10-03), and their session cookies are scoped to their own
   domain — so a web page physically cannot submit on their behalf. That is a
   browser rule, not a missing feature.

   The honest ceiling in-app, which is what this does:
     1. formats that shop's payload for you,
     2. puts it on your clipboard in the SAME gesture as opening their form
        (no hunting for text boxes, no separate copy step),
     3. opens that shop's create-listing page,
     4. records `awaiting_publish` — never `posted` — until you confirm.
   Status is persisted per shop per listing, so a shop is only ever marked
   posted when you say it is. We never take a marketplace password.          */
const HANDOFF_KEY = "fash_handoff_v1";
const HANDOFF_API_HOSTS = { ebay: "/api/list/ebay", etsy: "/api/list/etsy" };
/* Shops beyond the six Connect rows — same handoff path, no API claimed. */
const HANDOFF_EXTRA_SHOPS = [
  { id: "facebook",  name: "Facebook Marketplace", createListing: "https://www.facebook.com/marketplace/create/" },
  { id: "vestiaire", name: "Vestiaire Collective", createListing: "https://us.vestiairecollective.com/sell/" },
  { id: "whatnot",   name: "Whatnot",              createListing: "https://www.whatnot.com/sell" }
];

function handoffLoad(){ try { return JSON.parse(localStorage.getItem(HANDOFF_KEY) || "{}"); } catch(e){ return {}; } }
function handoffSave(o){ try { localStorage.setItem(HANDOFF_KEY, JSON.stringify(o)); } catch(e){} }
function handoffStateOf(shopId, lid){
  const all = handoffLoad();
  const per = all[String(lid)] || {};
  return per[shopId] || null;
}
function handoffSet(shopId, lid, status, extra){
  const all = handoffLoad();
  const key = String(lid);
  all[key] = all[key] || {};
  if (status) {
    const row = { status: status, at: new Date().toISOString() };
    if (extra && typeof extra === "object") {
      if (extra.url) row.url = String(extra.url);
      if (extra.error) row.error = String(extra.error);
    }
    all[key][shopId] = row;
  } else delete all[key][shopId];
  handoffSave(all);
}
function handoffLabel(status){
  if (status === "posted") return "Posted";
  if (status === "queued") return "Queued";
  if (status === "awaiting_publish") return "Open in shop";
  if (status === "posting") return "Posting…";
  if (status === "failed") return "Failed";
  if (status === "capped") return "Rate limited";
  return null;
}
function handoffChip(shopId, lid){
  const st = handoffStateOf(shopId, lid);
  const label = handoffLabel(st && st.status);
  if (!label) return "";
  const cls = (st.status === "posted") ? "handoff-chip handoff-chip-ok"
    : (st.status === "failed" || st.status === "capped") ? "handoff-chip handoff-chip-bad"
    : "handoff-chip";
  const urlBit = (st.status === "posted" && st.url)
    ? ` <a class="handoff-url" href="${escapeHtml(st.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">View</a>`
    : "";
  const tip = st.error ? ` title="${escapeHtml(st.error)}"` : "";
  return `<span class="${cls}"${tip}>${label}${urlBit}</span>`;
}

/** Everything needed to paste into one shop's form, formatted for that shop. */
function handoffPayload(shopId, l){
  const rules = xlKitRules(shopId);
  const m = (S.markets || []).find(x => x.id === shopId) || {};
  return {
    title: xlKitTitle(rules, l),
    price: (l.price != null && isFinite(Number(l.price))) ? Number(l.price) : null,
    description: l.description || l.notes || "",
    condition: l.condition || "",
    brand: l.brand || "",
    size: l.size || "",
    category: shopCatPath(l.category, shopId) || l.category || "",
    categoryPath: l.category || "",
    hints: rules.fieldHints || m.createHints || "",
    url: (xlConnectShopById(shopId) || {}).createListing || m.createListing || m.sellUrl || m.signup || ""
  };
}

/**
 * One gesture: copy that shop's payload, open their create-listing form,
 * and mark it `awaiting_publish`. `posted` is only ever set by handoffConfirm
 * or by a real API response — never by merely opening a page.
 */

/* ═════════════════ EXTENSION BRIDGE — the key-free path ═════════════════
   WHY THIS IS THE SCALABLE ONE: the extension runs inside the user's own
   browser session, so it needs NO per-shop API key, NO developer app, NO app
   review and has NO API rate limit to negotiate — queue.js paces itself with
   waitForGap() like a person would. That is why it covers all 11 shops while
   server APIs only cover eBay + Etsy.

   Contract (apps/extension/background.js, onMessageExternal, origin-checked
   to fashionistas.ai):
     {type:"publish", shop, payload} -> {ok:true, queued:true}
     {type:"status"}                 -> {ok:true, sessions:{...}}
     {type:"results"}                -> {ok:true, results:[{job_id,status,
                                         listing_url,shop,reported_at}]}

   Set the ID once with extSetId("<32-char id>") — Chrome shows it at
   chrome://extensions → Details. Without it we fall back to the one-tap
   clipboard handoff, so the button always does something honest.          */
const FASH_EXT_KEY = "fash_ext_id";

/* ── Web Store extension ID — the ONE place a published ID is baked in.
   Empty until Chrome Web Store publish (do NOT invent). Until then sellers
   use Load unpacked: content/announce.js posts chrome.runtime.id to this
   page, localStorage (fash_ext_id / extSetId) keeps it, and Connect →
   Advanced paste covers the rare case announce.js cannot run.            */
const FASH_EXT_IDS = [];

/** True only after a ping to the extension has actually succeeded. */
let EXT_LIVE = false;
let EXT_DETECTED = "";

function extCandidates(){
  const out = [];
  try { const v = (localStorage.getItem(FASH_EXT_KEY) || "").trim(); if (v) out.push(v); } catch(e){}
  FASH_EXT_IDS.forEach(v => { const c = String(v || "").trim(); if (c && !out.includes(c)) out.push(c); });
  if (EXT_DETECTED && !out.includes(EXT_DETECTED)) out.unshift(EXT_DETECTED);
  return out;
}
function extId(){ return extCandidates()[0] || ""; }
function extSetId(id){
  const v = String(id || "").trim();
  try { v ? localStorage.setItem(FASH_EXT_KEY, v) : localStorage.removeItem(FASH_EXT_KEY); } catch(e){}
}
function extRuntime(){
  return (typeof chrome !== "undefined" && chrome && chrome.runtime && chrome.runtime.sendMessage) ? chrome.runtime : null;
}
/** Try every candidate ID in turn; first non-error reply wins. */
function extSend(msg){
  return new Promise((resolve) => {
    const rt = extRuntime(), ids = extCandidates();
    if (!rt || !ids.length) return resolve(null);
    let idx = 0;
    const tryNext = () => {
      if (idx >= ids.length) return resolve(null);
      const id = ids[idx++];
      let done = false;
      const timer = setTimeout(() => { if (!done){ done = true; tryNext(); } }, 3000);
      try {
        rt.sendMessage(id, msg, (resp) => {
          if (done) return;
          done = true; clearTimeout(timer);
          if (rt.lastError) return tryNext();        // wrong id / not installed
          resolve(resp || null);
        });
      } catch(e){ if (!done){ done = true; clearTimeout(timer); tryNext(); } }
    };
    tryNext();
  });
}

/* Learn the ID from the extension itself — no user input, no paste box. */
window.addEventListener("message", (ev) => {
  if (ev.source !== window) return;
  const d = ev.data;
  if (!d || d.source !== "fashionistas-ext" || d.type !== "fash-ext-ready") return;
  const id = String(d.id || "").trim();
  if (!id) return;
  EXT_DETECTED = id;
  try { localStorage.setItem(FASH_EXT_KEY, id); } catch(e){}
  extAutoDetect();
});

/** Ping on load. The Connect button is rendered only if this fails. */
async function extAutoDetect(){
  const r = await extSend({ type: "status" });
  EXT_LIVE = !!(r && r.ok);
  const btn = document.querySelector("#xl-ext-connect");
  if (btn) btn.style.display = EXT_LIVE ? "none" : "";
  const banner = document.querySelector("#xl-ext-banner");
  if (banner) banner.style.display = EXT_LIVE ? "none" : "block";
  const mode = document.querySelector("#xl-handoff-mode");
  if (mode) mode.textContent = EXT_LIVE
    ? "Posts through your extension — no API keys, no Stripe."
    : "No Crosslister yet — each shop opens with its kit ready to paste.";
  try { xlReadyStripRefresh(); } catch(e){}
  // Extension is answering: reconcile the Connect grid against what it can
  // actually see, so a stale "Connected" from an older build is corrected on
  // load instead of silently persisting. Best effort — never blocks boot.
  if (EXT_LIVE) {
    try { await xlConnectSyncFromExtension(r); } catch(e){ /* non-fatal */ }
  }
  return EXT_LIVE;
}
/** Connect is shown only when the ping failed. Never a paste prompt. */
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => extAutoDetect(), { once: true });
else setTimeout(() => extAutoDetect(), 600);
/** Readiness for true one-click multilist (extension path — no Stripe / API keys). */
function xlConnectedShopCount(){
  try {
    const state = xlConnectLoad();
    let n = 0;
    Object.keys(state || {}).forEach((id) => {
      if (xlConnectStatus(id) === "connected") n++;
    });
    return n;
  } catch(e){ return 0; }
}
/**
 * Gate for one-click Sell everywhere.
 * ready = extension answering. connected shops are coached but not a hard block
 * (extension can still queue if the seller is logged in).
 */
function xlOneClickGate(){
  const ext = !!(typeof EXT_LIVE !== "undefined" && EXT_LIVE);
  const connected = xlConnectedShopCount();
  if (!ext) {
    return {
      ready: false,
      ext: false,
      connected,
      reason: "Install the Crosslister to post by itself.",
      next: "Set up extension"
    };
  }
  if (connected < 1) {
    return {
      ready: true,
      ext: true,
      connected: 0,
      reason: "Log into each shop in this Chrome, then Verify session.",
      next: "Verify session"
    };
  }
  return {
    ready: true,
    ext: true,
    connected,
    reason: null,
    next: null
  };
}
function xlReadyStripHtml(){
  const g = xlOneClickGate();
  const cls = g.ready && g.connected > 0 ? "ok" : "warn";
  const title = g.ready && g.connected > 0
    ? `<b>Ready.</b> ${g.connected} shop${g.connected===1?"":"s"} connected — Sell everywhere posts to every ticked shop equally.`
    : (g.ext
      ? `<b>Almost there.</b> ${escapeHtml(g.reason)}`
      : `<b>One-click blocked.</b> No Crosslister yet — each shop still posts from its own kit.`);
  const setupBtn = g.ext ? "" : ` <button type="button" class="btn btn-soft btn-sm" style="margin-left:6px" onclick="extConnectPrompt()" data-tip="Installs the optional Crosslister so posts go out by themselves.">Get one-click</button>`;
  return `<div id="xl-ready-strip" class="xl-ready-strip ${cls}" role="status">${title}${setupBtn}</div>`;
}
function xlReadyStripRefresh(){
  const el = document.getElementById("xl-ready-strip");
  if (!el) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = xlReadyStripHtml();
  const next = wrap.firstElementChild;
  if (next) el.replaceWith(next);
}
function extConnectBtnHtml(){
  return `<button id="xl-ext-connect" type="button" class="btn btn-soft btn-sm"` +
    ` style="display:${EXT_LIVE ? "none" : ""}" onclick="extConnectPrompt()"` +
    ` data-tip="Confirms the Fashionistas Crosslister is installed and enabled.">Connect extension</button>`;
}
/** Re-check first; if still dark, open the install / ID panel so a seller can finish alone. */
async function extConnectPrompt(){
  const live = await extAutoDetect();
  if (live) { toast("Connected — extension detected automatically."); return; }
  extInstallSheet();
}
/** Full setup sheet: zip → Load unpacked → auto-detect, with optional ID paste. */
function extInstallSheet(){
  const known = extId();
  openSheet(`
 <h3 style="margin:0 0 4px">Get one-click posting</h3>
 <p class="mut" style="margin-top:0">Optional — without it, each shop still posts from its own kit.</p>
 <ol style="margin:8px 0 12px;padding-left:1.2em;line-height:1.55;font-size:13.5px">
  <li>Download and unzip the extension.</li>
  <li>In Chrome open <code>chrome://extensions</code>, turn on <b>Developer mode</b>, then <b>Load unpacked</b> and pick the unzipped folder.</li>
  <li>Stay on <b>fashionistas.ai</b> and tap <b>Re-check</b>.</li>
 </ol>
 <div class="xl-row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
  <a class="btn btn-accent btn-sm" href="/chrome-store/fashionistas-extension-v1.0.1.zip" download data-tip="Downloads the Crosslister zip.">Download extension</a>
  <button type="button" class="btn btn-soft btn-sm" onclick="extConnectRecheck()" data-tip="Pings the extension again.">Re-check</button>
 </div>
 <details style="margin:8px 0 4px">
  <summary style="cursor:pointer;font-weight:700;font-size:13px">Trouble?</summary>
  <p class="mut" style="font-size:12px;margin:6px 0">Browsers block links to <code>chrome://extensions</code> — type it in the address bar yourself.</p>
  <p class="mut" style="font-size:12px;margin:6px 0">If Re-check finds nothing, paste the ID from Chrome → Extensions → Details (32 characters).</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
   <input id="ext-id-input" type="text" spellcheck="false" autocomplete="off" placeholder="32-character extension id" value="${escapeHtml(known)}" style="flex:1;min-width:180px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:inherit"/>
   <button type="button" class="btn btn-accent btn-sm" onclick="extSaveIdFromInput()" data-tip="Saves the ID in this browser and pings the extension.">Save &amp; connect</button>
  </div>
 </details>
 <p class="mut" style="font-size:12px;margin-top:10px">Details: <code>docs/MULTILIST-ONE-CLICK.md</code>.</p>
 <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="closeSheet()">Done</button>`);
}
async function extConnectRecheck(){
  const live = await extAutoDetect();
  if (live) { toast("Connected — extension is live."); try { closeSheet(); } catch(e){} }
  else toast("Still not detected — confirm Developer mode + Load unpacked, then reload this tab.");
}
function extSaveIdFromInput(){
  const el = document.getElementById("ext-id-input");
  const v = el ? String(el.value || "").trim() : "";
  if (!/^[a-p]{32}$/i.test(v)) { toast("That does not look like a Chrome extension ID (32 letters a–p)."); return; }
  extSetId(v);
  EXT_DETECTED = v;
  extConnectRecheck();
}

async function extAvailable(){ const r = await extSend({ type: "status" }); return !!(r && r.ok); }
async function extPublish(shop, payload){ return extSend({ type: "publish", shop: shop, payload: payload }); }
async function extResults(){ const r = await extSend({ type: "results" }); return (r && r.results) || []; }


/** Listing -> the exact payload shape queue.js/runPublish expects. */
function extPayload(l, p){
  const photos = [];
  [l.photo, l.image, l.img, l.cover, l.photoUrl, l.imageUrl].forEach(x => { if (x) photos.push(String(x)); });
  if (Array.isArray(l.images)) l.images.forEach(x => { if (x) photos.push(String(x)); });
  if (Array.isArray(l.photos)) l.photos.forEach(x => { if (x) photos.push(String(x)); });
  return {
    title: p.title || l.title || "",
    description: p.description || "",
    price: p.price != null ? String(p.price) : "",
    condition: p.condition || "",
    brand: p.brand || "",
    size: p.size || "",
    category: p.category || "",
    categoryPath: p.categoryPath || l.category || "",
    color: l.color || "",
    material: l.material || "",
    tags: l.tags || "",
    photos: photos.filter(Boolean)
  };
}

/** Poll the extension for outcomes of jobs we queued; flip queued/posting -> posted/failed. */
let EXT_POLL_TIMER = null;
function extPollStart(lid){
  if (EXT_POLL_TIMER) clearInterval(EXT_POLL_TIMER);
  let ticks = 0;
  EXT_POLL_TIMER = setInterval(async () => {
    ticks++;
    const results = await extResults();
    let changed = false;
    const all = handoffLoad();
    Object.keys(all).forEach(key => {
      Object.keys(all[key] || {}).forEach(shop => {
        const st = all[key][shop];
        if (!st) return;
        // After the first tick with no result yet, show posting so the sheet moves.
        if ((st.status === "queued") && ticks >= 1) {
          all[key][shop] = Object.assign({}, st, { status: "posting" });
          changed = true;
        }
        const live = all[key][shop];
        if (!live || (live.status !== "queued" && live.status !== "posting")) return;
        const hit = results.find(r => r && r.shop === shop && r.reported_at && r.reported_at >= (st.at || ""));
        if (!hit) return;
        const ok = hit.status === "posted";
        const capped = hit.status === "capped";
        all[key][shop] = {
          status: ok ? "posted" : (capped ? "capped" : "failed"),
          at: hit.reported_at,
          url: hit.listing_url || null,
          error: hit.error || null
        };
        changed = true;
      });
    });
    if (changed) { handoffSave(all); try { xlSheetRefresh(lid); } catch(e){} }
    // ~3 min of polling so slow CAPTCHA / multi-shop runs still surface a URL.
    if (ticks >= 60) { clearInterval(EXT_POLL_TIMER); EXT_POLL_TIMER = null; }
  }, 3000);
}

async function handoffOpen(shopId, lid){
  const l = (S.listings || []).find(x => x.id === Number(lid)) || CURRENT.listing || null;
  if (!l) { toast("No listing selected yet — snap one first."); return; }
  const p = handoffPayload(shopId, l);
  const name = ((xlConnectShopById(shopId) || {}).name) || platformName(shopId);

  // ── PATH A: the extension posts it in the user's own session (no API key) ──
  if (await extAvailable()) {
    handoffSet(shopId, l.id, "queued");
    try { xlSheetRefresh(lid); } catch(e){}
    const r = await extPublish(shopId, extPayload(l, p));
    if (r && r.ok) {
      toast(name + " queued — the extension posts it in your session. No API key involved.");
      extPollStart(lid);
    } else {
      handoffSet(shopId, l.id, "failed");
      toast(name + " could not be queued: " + ((r && r.error) || "no response from the extension"));
    }
    try { xlSheetRefresh(lid); } catch(e){}
    return;
  }

  // ── PATH B: no extension installed — one-tap clipboard handoff ──

  let copied = false;
  const text = [p.title, p.price != null ? "$" + p.price.toFixed(2) : "", p.condition, p.brand, p.size, p.description]
    .filter(Boolean).join("\n");
  try { await navigator.clipboard.writeText(text); copied = true; } catch(e){}

  handoffSet(shopId, l.id, "awaiting_publish");

  if (p.url) window.open(p.url, "_blank", "noopener,noreferrer");
  toast(copied
    ? name + " opened · payload copied. Publish there, then tap Posted."
    : name + " opened · copy blocked by the browser — select the payload manually.");
  try { xlSheetRefresh(lid); } catch(e){}
}

/** User confirms they really published it. This is the only path to `posted` for the nine. */
function handoffConfirm(shopId, lid){
  const name = ((xlConnectShopById(shopId) || {}).name) || platformName(shopId);
  handoffSet(shopId, lid, "posted");
  toast(name + " marked Posted — this stays on your device.");
  try { xlSheetRefresh(lid); } catch(e){}
}

function handoffReset(shopId, lid){
  handoffSet(shopId, lid, null);
  try { xlSheetRefresh(lid); } catch(e){}
}

/**
 * Real API post for eBay / Etsy. Maps the gate's own answers to plain words:
 * 401 → sign in, 402 → copy-and-open (no plan to buy), 503 → name the missing key. Never claims a
 * listing when the API did not return an id.
 */
async function handoffApi(shopId, lid){
  const host = HANDOFF_API_HOSTS[shopId];
  if (!host) { toast(platformName(shopId) + " posts through the handoff, not the API."); return; }
  const l = (S.listings || []).find(x => x.id === Number(lid)) || CURRENT.listing || null;
  if (!l) { toast("No listing selected yet."); return; }
  const name = platformName(shopId);
  const payload = shopId === "etsy"
    ? { title: l.title, description: l.description || "", price: String(l.price || "0"), photoUrl: l.photo || l.image || "", category: l.category || "", materials: l.material ? [l.material] : [], quantity: 1 }
    : { title: l.title, description: l.description || "", price: String(l.price || "0"), photoUrl: l.photo || l.image || "", category: l.category || "", brand: l.brand || "", size: l.size || "", color: l.color || "", material: l.material || "", condition: (l.condition || "USED_EXCELLENT").toUpperCase().replace(/\s+/g, "_") };

  handoffSet(shopId, l.id, "posting");
  try { xlSheetRefresh(lid); } catch(e){}

  let res, data = null;
  try {
    res = await fetch(API + host, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer " + (TOKEN || "") },
      body: JSON.stringify(payload)
    });
    try { data = await res.json(); } catch(e){ data = null; }
  } catch(e){
    handoffSet(shopId, l.id, "failed");
    toast(name + " failed: " + (e && e.message || "network error"));
    try { xlSheetRefresh(lid); } catch(e2){}
    return;
  }

  if (res.status === 401){ handoffSet(shopId, l.id, null); toast("Sign in first — " + name + " needs a session."); }
  else if (res.status === 402){ handoffSet(shopId, l.id, null); guideSubscribe(name); }
  else if (res.status === 503 && data && data.error === "env_missing"){ handoffSet(shopId, l.id, null); toast(name + " cannot post yet — the server is missing " + (data.missing || []).join(", ") + ". This shop is switched off until it is set.", 5500); }
  else if (res.ok && data && data.listingId){ handoffSet(shopId, l.id, "posted"); toast(name + " posted · listing " + data.listingId); }
  else {
    handoffSet(shopId, l.id, "failed");
    toast(name + " failed: " + ((data && (data.detail || data.error)) || ("HTTP " + res.status)));
  }
  try { xlSheetRefresh(lid); } catch(e){}
}

/**
 * Sell everywhere: prefer the Chrome extension for EVERY shop (including eBay /
 * Etsy). That path needs no Stripe subscription and no server API secrets —
 * the extension posts from the seller's own logged-in Chrome session.
 *
 * Without the extension: eBay/Etsy still try the server API (may 402/503 when
 * Stripe or keys are empty); the other shops get clipboard + open-form handoff.
 */
async function handoffSellAll(lid, picksArg){
  // picksArg (optional): explicit shop ids — the wizard's "Post everywhere"
  // button passes its own list. Without it, the multilist sheet's checkboxes.
  const picks = (Array.isArray(picksArg) && picksArg.length)
    ? picksArg.map(String)
    : xlChecks().filter(c=>c.checked).map(c=>c.value);
  if (!picks.length) { toast("Select at least one marketplace first"); return; }
  const l = (S.listings||[]).find(x=>x.id===Number(lid));
  const api  = picks.filter(p => HANDOFF_API_HOSTS[p]);
  const rest = picks.filter(p => !HANDOFF_API_HOSTS[p]);

  // Extension present: EVERY picked shop queues through it — no Stripe, no API keys.
  if (await extAvailable()) {
    let ok = 0, bad = [];
    for (const shop of picks) {
      const p = handoffPayload(shop, l || {});
      handoffSet(shop, lid, "queued");
      const r = await extPublish(shop, extPayload(l || {}, p));
      if (r && r.ok) ok++;
      else {
        bad.push(shop);
        handoffSet(shop, lid, "failed", { error: (r && r.error) || "no response from the extension" });
      }
    }
    try { xlSheetRefresh(lid); } catch(e){}
    if (ok) {
      extPollStart(lid);
      toast(ok + " queued to the extension" + (bad.length ? " · " + bad.length + " failed" : "") + " — watch queued → posting → posted (View when a URL is captured). Nothing is marked Posted until the extension reports it.");
    } else {
      toast("Nothing queued — extension did not accept any shop. Stay logged in on each marketplace tab, tap Verify session, then retry. We did not mark anything Posted.");
    }
    return;
  }

  // No extension: eBay/Etsy still try server-side (needs Stripe + secrets);
  // the rest need one tap each (clipboard handoff). Never claim Posted here.
  for (const p of api) await handoffApi(p, lid);
  rest.forEach(p => handoffSet(p, lid, "awaiting_publish"));
  if (l && rest.length) await handoffOpen(rest[0], lid);
  try { xlSheetRefresh(lid); } catch(e){}
  toast("One-click blocked — extension not detected. " + api.length + " shop(s) tried the server API (needs Stripe + secrets when empty) · " + (rest.length ? 1 : 0) + " opened with paste kit · " + Math.max(0, rest.length - 1) + " waiting. Set up extension (Load unpacked) for true multilist — nothing was marked Posted.");
}

/** Re-render the sheet's handoff rows without reopening it. */
function xlSheetRefresh(lid){
  const box = document.querySelector("#sheet");
  if (!box || !lid) return;
  const l = (S.listings || []).find(x => x.id === Number(lid));
  if (!l) return;
  box.querySelectorAll("[data-handoff]").forEach(row => {
    const shopId = row.getAttribute("data-handoff");
    const st = handoffStateOf(shopId, l.id);
    const host = row.querySelector(".xl-kit-head > div") || row.querySelector(".xl-kit-head");
    let chip = row.querySelector(".handoff-chip");
    const html = handoffChip(shopId, l.id);
    if (html) {
      if (chip) {
        const wrap = document.createElement("span");
        wrap.innerHTML = html;
        const next = wrap.firstElementChild;
        chip.replaceWith(next);
        chip = next;
      } else if (host) {
        host.insertAdjacentHTML("afterbegin", html);
      }
    } else if (chip) {
      chip.remove();
    }
    const confirmBtn = row.querySelector("[data-handoff-confirm]");
    if (confirmBtn) confirmBtn.style.display = (st && st.status === "awaiting_publish") ? "" : "none";
  });
}

function xlTitleFor(m, title){
 const max = Number(m && m.maxChar) || 0;
 const base = String(title || "Untitled").trim();
 if (!max || base.length <= max) return base;
 return base.slice(0, max - 1).replace(/\s+\S*$/, "") + "\u2026";
}
function xlSheet(l, picks, copied, kits, allKit){
 kits = kits || {};
 const ebayConnected = xlConnectStatus("ebay") === "connected";
 const rows = picks.map(pid=>{
 const m=(S.markets||[]).find(x=>x.id===pid)||{};
 const rules = xlKitRules(pid);
 const label=platformName(pid);
 const t=xlKitTitle(rules, l);
 const kit = kits[pid] || xlKit(l, pid);
 const ebayBtn = (pid === "ebay" && ebayConnected)
  ? `<button type="button" class="btn btn-accent btn-sm" onclick="xlEbayCreateListingFromId(${Number(l.id)||0})" data-tip="Uses your eBay OAuth cookie to create inventory + offer (sandbox/production per Connect).">Create on eBay</button>`
  : (pid === "ebay"
    ? `<button type="button" class="btn btn-soft btn-sm" onclick="xlShopOpenGuide('ebay')" data-tip="Connect eBay OAuth first for API create.">Connect for API</button>`
    : "");
 return `<div class="xl-kit-block" data-shop="${escapeHtml(pid)}" data-handoff="${escapeHtml(pid)}">
 <div class="xl-kit-head"><b>${escapeHtml(label)}</b>
 <div style="display:flex;gap:6px;flex-wrap:wrap">
  ${handoffChip(pid, Number(l.id)||0)}
  <button class="btn btn-accent btn-sm" onclick="handoffOpen('${escapeHtml(pid)}', ${Number(l.id)||0})" data-tip="One tap: copies this shop's payload and opens their listing form.">Sell to ${escapeHtml(label)}</button>
  <button class="btn btn-soft btn-sm" style="display:none" data-handoff-confirm onclick="handoffConfirm('${escapeHtml(pid)}', ${Number(l.id)||0})" data-tip="Confirms you published it on ${escapeHtml(label)}.">Published</button>
  ${ebayBtn}
 </div></div>
 <p class="xl-kit-hint">${escapeHtml(rules.fieldHints||"")} · title ≤ ${rules.titleMax||"\u221e"} · fee ~${m.feePct!=null?m.feePct:(feeTableById(pid)||{}).feePct||"?"}%</p>
 <div class="xl-title">${escapeHtml(t)}</div>
 <pre class="xl-kit">${escapeHtml(kit)}</pre>
</div>`;
 }).join("");

 const gate = xlOneClickGate();
 const ebayBanner = picks.includes("ebay") ? (
  EXT_LIVE
   ? `<div class="xl-ebay-create"><p><b>eBay:</b> queued like every other shop — equal with every shop, no eBay API keys.</p></div>`
   : (ebayConnected
     ? `<div class="xl-ebay-create" id="xl-ebay-create-box"><p><b>eBay:</b> use your kit, or connect eBay's own API with</p><div id="xl-ebay-create-msg" class="mut" style="font-size:12px"></div></div>`
     : `<div class="xl-ebay-create"><p><b>eBay:</b> use your kit, or connect eBay's own API with <button type="button" class="link" style="background:none;border:0;padding:0;font:inherit;cursor:pointer;color:var(--accent);font-weight:700" onclick="xlShopOpenGuide('ebay')">Connect OAuth</button> + secrets — or paste the kit.</p></div>`)
 ) : "";

 openSheet(`
 <h3 style="margin:0 0 4px">Ready to post \u2014 ${picks.length} shop${picks.length===1?"":"s"}</h3>
 <p class="mut" style="margin-top:0">Each shop keeps its own title rules. Tick the shops you want, then <b>Sell everywhere</b>.</p>
 ${xlReadyStripHtml()}
 <div class="xl-note">Nothing is marked Posted until it really is, and we never take your shop password.</div>
 ${ebayBanner}
 <div style="max-height:48vh;overflow:auto;margin-top:10px">${rows}</div>
 <div class="xl-row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:10px">
 <div class="mut" style="font-size:12px" id="xl-handoff-mode">${gate.ext?"Posts through your extension.":(gate.reason||"Each shop opens with its kit ready to paste.")}</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap">
 <button class="btn btn-accent btn-sm" onclick="handoffSellAll(${Number(l.id)||0})" data-tip="${gate.ext?"Queues every selected shop to your extension — equal treatment, no API keys.":"Extension missing — will open paste kits / optional API. Set up extension for true one-click."}" ${gate.ext?"":'aria-describedby="xl-handoff-mode"'}>Sell everywhere</button>
 ${extConnectBtnHtml()}</div>
 <button class="btn btn-primary" style="width:100%" onclick="closeSheet()" data-tip="Closes this panel." title="Closes this panel.">Done</button>`);
}
function xlCopy(btn){ const t=btn&&btn.getAttribute("data-kit")||""; navigator.clipboard&&navigator.clipboard.writeText(t).then(()=>toast("Kit copied")).catch(()=>toast("Copy blocked by browser")); }

function xlEbayCreateListingFromId(id){
  const l = (S.listings||[]).find(x=>x.id===id) || {};
  return xlEbayCreateListing({
    id: l.id,
    title: l.title,
    description: l.description,
    brand: l.brand,
    size: l.size || l.sizeHint,
    condition: l.condition,
    category: l.category,
    color: l.color,
    price: l.price
  });
}
async function xlEbayCreateListing(item){
  const msg = document.getElementById("xl-ebay-create-msg");
  const setMsg = (html, isErr) => {
    if (msg){ msg.innerHTML = html; msg.className = isErr ? "err" : "mut"; msg.style.fontSize = "12.5px"; }
  };
  setMsg("Creating on eBay\u2026", false);
  toast("Creating eBay inventory / offer\u2026");
  const keys = xlEbayKeysLoad() || {};
  const payload = {
    id: item && item.id,
    title: item && item.title,
    description: item && item.description,
    brand: item && item.brand,
    size: item && item.size,
    condition: item && item.condition,
    category: item && item.category,
    color: item && item.color,
    price: item && item.price,
    publish: false,
    env: keys.env || "sandbox",
    clientId: keys.clientId || "",
    clientSecret: keys.clientSecret || ""
  };
  try {
    const r = await fetch("/api/ebay/listing", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (r.ok && data && data.ok){
      const bits = [
        data.published ? "Published" : "Draft offer ready",
        data.sku ? ("SKU "+data.sku) : "",
        data.offerId ? ("offer "+data.offerId) : "",
        data.env ? ("env "+data.env) : ""
      ].filter(Boolean).join(" · ");
      setMsg("<b>Success:</b> "+escapeHtml(bits)+(data.note ? "<br>"+escapeHtml(data.note) : ""), false);
      toast("eBay listing created ✓");
      return;
    }
    const err = (data && data.error) || ("http_"+r.status);
    const message = (data && data.message) || "Create failed";
    const next = (data && data.nextStep) || "";
    setMsg("<b>"+escapeHtml(err)+":</b> "+escapeHtml(message)+(next ? "<br><b>Next:</b> "+escapeHtml(next) : "")+(data && data.sku ? "<br>SKU: "+escapeHtml(data.sku) : ""), true);
    toast("eBay create blocked — see panel");
  } catch(e){
    setMsg("<b>network_error:</b> Could not reach /api/ebay/listing. Paste kit instead.", true);
    toast("eBay create network error");
  }
}

/* ================= SOLD SHEET ================= */
function soldSheet(id){
 openSheet(`
 <h3 style="margin:0 0 4px">Mark it as sold</h3>
 <p class="mut" style="margin-top:0">Write down what you got for it — we'll work out what you kept.</p>
 <label>Sold for ($)</label>
 <input class="input" id="s-price" type="number" step="1" value="${S.listings.find(l=>l.id===id)?.price||""}">
 <div class="two">
 <div><label>Which shop</label><select class="input" id="s-plat">${(S.markets||[]).map(m=>`<option value="${m.id}">${m.name}</option>`).join("")}</select></div>
 <div><label>Their cut ($)</label><input class="input" id="s-fee" type="number" step="0.01" placeholder="platform fee"></div>
 </div>
 <div class="two">
 <div><label>Postage I paid ($)</label><input class="input" id="s-ship" type="number" step="0.01" value="0"></div>
 <div><label>What it cost me ($)</label><input class="input" id="s-cogs" type="number" step="0.01" value="0"></div>
 </div>
 <p class="mut" id="s-prev" style="text-align:center;font-size:14px">—</p>
 <div style="height:10px"></div>
 <button class="btn btn-accent" onclick="markSold(${id})" data-tip="Saves the sale and updates what you've made.">Save this sale</button>
 `);
 const calc = () => {
 const price=parseFloat($("#s-price").value)||0, fee=parseFloat($("#s-fee").value)||0, ship=parseFloat($("#s-ship").value)||0, cogs=parseFloat($("#s-cogs").value)||0;
 $("#s-prev").textContent = `You keep: ${money(price-fee-ship-cogs)}`;
 };
 ["s-price","s-fee","s-ship","s-cogs"].forEach(i=>$("#"+i).addEventListener("input", calc));
 calc();
}
async function markSold(id){
 const data = { sold_price: parseFloat($("#s-price").value)||0, sold_platform: $("#s-plat").value, fee: parseFloat($("#s-fee").value)||0, shipping: parseFloat($("#s-ship").value)||0 };
 try { await api(`/api/listings/${id}/sold`, { method:"POST", body: JSON.stringify(data) }); closeSheet(); toast("Sale saved ✓"); go("closet"); } catch(e){ toast(e.message); }
}

/* ================= SELL ================= */
async function renderSell(el){
 if (window.LW) return LW.mount(el);
 el.innerHTML = showLoader();
 try {
 await loadMarketplaces();
 el.innerHTML = `
 <div class="card">
 <h3 style="margin-top:0"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='2.5' y='6' width='19' height='12' rx='2.5'/><circle cx='12' cy='12' r='3'/><path d='M6 10v.01M18 14v.01'/></svg> What will I actually make?</h3>
 <label>Selling price ($)</label>
 <input class="input" id="fc-price" type="number" value="48">
 <label>Which shop</label>
 <select class="input" id="fc-plat">${(S.markets||[]).map(m=>`<option value="${m.id}">${m.name}</option>`).join("")}</select>
 <div style="height:10px"></div>
 <div style="display:flex;gap:8px">
 <button class="btn btn-primary" style="flex:1" onclick="calcFees()" data-tip="Enter a price, pick a shop, see what's left after their cut.">See what I'd keep</button>
 <button class="btn btn-soft" style="flex:1" onclick="netItOut()" data-tip="Compare every shop at once and see which keeps you the most.">Compare all shops</button>
 </div>
 <div id="fc-out"></div>
 </div>
 <div class="card">
 <h3 style="margin-top:0"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M2.5 6.5h11v10h-11z'/><path d='M13.5 10h4l3.5 3.5v3h-7.5z'/><circle cx='7' cy='18.5' r='2'/><circle cx='17' cy='18.5' r='2'/></svg> What will postage cost?</h3>
 <label>How much does it weigh? (oz)</label>
 <input class="input" id="fw-oz" type="number" value="8">
 <label>Who will post it?</label>
 <div id="fw-car"><button class="chip on" onclick="pickCar(this,'usps')" data-tip="Uses the post office rate." title="Uses the post office rate.">USPS</button><button class="chip" onclick="pickCar(this,'pirate')" data-tip="Checks a cheaper courier rate instead." title="Checks a cheaper courier rate instead.">Pirate Ship (−20%)</button></div>
 <div style="height:10px"></div>
 <button class="btn btn-soft" style="width:100%" onclick="calcShipping()" data-tip="Weigh your item and compare the carriers.">Work out postage</button>
 <div id="fw-out"></div>
 </div>
 <div class="card">
 <h3 style="margin-top:0"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M9.5 17.5h5M10.5 21h3'/><path d='M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1.9 1.8v.4h5.4v-.4c0-.7.3-1.3.9-1.8A6 6 0 0 0 12 3z'/></svg> What should I charge?</h3>
 <label>Department</label>
 <select class="input" id="sp-dept" onchange="fDeptChange('sp-dept','sp-sub-wrap')" data-tip="Pick which part of the shop this item belongs in. Buyers browse departments first, then the type of item." title="Pick which part of the shop this belongs in.">
 <option value="">Choose a department…</option>
 ${taxDepts().map(d=>`<option value="${escapeAttr(d)}">${escapeHtml(d)}</option>`).join("")}
 </select>
 <label>Type of item</label>
 <div id="sp-sub-wrap">${fSubInner("", "")}</div>
 <label>Brand (if you know it)</label>
 <input class="input" id="sp-brand" placeholder="e.g. Levi's">
 <label>Condition</label>
 <div id="sp-cond">${["Poor","Fair","Good","Excellent"].map(c=>`<button class="chip ${c==="Good"?"on":""}" onclick="pickCond(this,'${c}')" data-tip="Sets the condition for this listing." title="Sets the condition for this listing.">${c}</button>`).join("")}</div>
 <div style="height:10px"></div>
 <button class="btn btn-soft" style="width:100%" onclick="suggestPrice()" data-tip="Tell us the type, brand and condition and we'll suggest a fair price.">Suggest a price</button>
 <div id="sp-out"></div>
 </div>`;
 document.querySelectorAll("#fw-car .chip").length;
 } catch(e){ el.innerHTML = `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>${escapeHtml(e.message)}</div>`; }
}
let CARRIER = "usps";
function pickCar(el, c){ document.querySelectorAll("#fw-car .chip").forEach(x=>x.classList.remove("on")); el.classList.add("on"); CARRIER = c; }
async function calcFees(){
 const price = parseFloat($("#fc-price").value); const plat = $("#fc-plat").value;
 if (!price) return toast("Enter a price");
 try {
 const d = await api("/api/fees/estimate", { method:"POST", body: JSON.stringify({ price, platform: plat }) });
 const lines = (d.lines||[]).map(l=>`<p style="margin:5px 0">${escapeHtml(l.label)} <b style="float:right">${money(l.amount)}</b></p>`).join("")
 || `<p style="margin:5px 0">Platform fees <b style="float:right">${money(0)}</b></p>`;
 $("#fc-out").innerHTML = `
 <div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px">
 ${lines}
 <p style="margin:5px 0">You keep <b style="float:right;color:var(--good)">${money(d.net)}</b></p>
 <bar><i style="width:${d.takeRate}%"></i></bar>
 <p class="mut">You keep ${d.takeRate}% — ${money(d.net)} of every ${money(price)}.</p>
 <p class="mut" style="font-size:12px">${d.verified ? "✓ " : "~ "}${escapeHtml(d.note||"")}</p>
 </div>`;
 } catch(e){ toast(e.message); }
}
async function netItOut(){
 const price = parseFloat($("#fc-price").value);
 if (!price) return toast("Enter a price");
 try {
 const d = await api("/api/fees/compare", { method:"POST", body: JSON.stringify({ price }) });
 const rows = d.ranked.map((r,i)=>`
 <div style="display:flex;align-items:baseline;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)">
 <span class="mut" style="width:20px;text-align:right">${i+1}</span>
 <span style="flex:1"><b>${escapeHtml(r.name)}</b>${r.verified?"":` <span class="mut" style="font-size:11px">estimate</span>`}
 <div class="mut" style="font-size:11px">${escapeHtml(r.lines.length?r.lines.map(l=>l.label+" "+money(l.amount)).join(" · "):"no seller fee")}</div></span>
 <b style="color:${i===0?"var(--good)":"inherit"}">${money(r.net)}</b>
 </div>`).join("");
 $("#fc-out").innerHTML = `
 <div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px">
 <p style="margin:0 0 8px">Best shop: <b>${escapeHtml(d.best.name)}</b> — you'd keep <b style="color:var(--good)">${money(d.best.net)}</b>
 · worst shop: <b>${escapeHtml(d.worst.name)}</b> — you'd keep ${money(d.worst.net)}</p>
 <p class="mut" style="font-size:12px">Difference between the best and worst shop on one ${money(price)} sale: <b>${money(d.spread)}</b>.
 ${d.verifiedCount} of ${d.count} of these shop fee lists were checked against their published rates.</p>
 ${rows}
 <p class="mut" style="font-size:11px;margin-top:10px">${escapeHtml(d.note)}</p>
 </div>`;
 } catch(e){ toast(e.message); }
}
async function calcShipping(){
 const w = parseFloat($("#fw-oz").value);
 try {
 const d = await api("/api/shipping/estimate", { method:"POST", body: JSON.stringify({ weightOz: w, carrier: CARRIER }) });
 $("#fw-out").innerHTML = `<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:10px;text-align:center"><b style="font-size:22px">${money(d.cost)}</b> <span class="mut">via ${d.carrier}</span></div>`;
 } catch(e){ toast(e.message); }
}
async function suggestPrice(){
 /* Department + type, flattened to a readable path ("Women's Clothing, Tops & Shirts")
    so the pricing model gets both pieces of context instead of one ambiguous word. */
 const path = fReadCat("sp-dept", "sp-sub-wrap");
 if (!path) return toast("Pick a department so we know what to price");
 const cat = path.split("/").join(", ");
 const cond = document.querySelector("#sp-cond .on").textContent;
 const brand = $("#sp-brand").value.trim();
 const btn = this; 
 toast("Asking the AI…");
 try {
 const d = await api("/api/listings/suggest-price", { method:"POST", body: JSON.stringify({ category: cat, brand, condition: cond }) });
 $("#sp-out").innerHTML = `
 <div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px">
 <div class="three" style="text-align:center">
 <div class="stat" data-tip="The lowest it usually sells for."><b>${money(d.lowPrice)}</b><span>Low</span></div>
 <div class="stat" data-tip="Our suggestion — a fair, sellable price."><b style="color:var(--accent)">${money(d.suggestedPrice)}</b><span>Suggested</span></div>
 <div class="stat" data-tip="The most a buyer would usually pay."><b>${money(d.highPrice)}</b><span>High</span></div>
 </div>
 <p class="mut">${escapeHtml(d.compsNote||"")}</p>
 </div>`;
 } catch(e){ toast(e.message); }
}

/* ================= MESSAGES (account to account) ================= */
function dmRender(el, nodes){
  el.innerHTML = `<div id="dm-list">${nodes}</div>`;
}
async function messagesScreen(){
  clearInterval(CURRENT.dmTimer);
  kineticTitle("Messages");
  document.title = "Messages — fashionistas.ai";
  if (typeof SCCollapse === "function") { try{ SCCollapse(); }catch(e){} }
  $("#view-sub").textContent = "Talk to other accounts right inside the app.";
  const el = $("#screen"); el.innerHTML = showLoader();
  try {
    const [d, bl] = await Promise.all([api("/api/dm"), api("/api/dm/blocks")]);
    const c = d.contacts || []; S.dmContacts = c;
    const blocked = (bl.blocked || []); S.dmBlocked = blocked;
    const active = c.filter(x => x.last || x.unread);
    const fresh  = c.filter(x => !x.last && !x.unread);
    const row = (x) => `
      <div class="dm-row" role="button" tabindex="0" onclick="threadScreen(${x.id})" data-tip="Open your conversation with ${escapeHtml(x.name)}.">
        <span class="dm-av">${escapeHtml(String(x.name||"?").slice(0,1).toUpperCase())}</span>
        <span class="dm-txt">
          <span class="dm-top"><b>${escapeHtml(x.name)}</b><i>${escapeHtml(String(x.lastAt||"").slice(5,16))}</i></span>
          <span class="dm-last">${x.lastMine?"You: ":""}${escapeHtml(x.last || "No messages yet")}</span>
        </span>
        ${x.unread ? `<span class="dm-badge">${x.unread}</span>` : ""}
      </div>`;
    dmRender(el, `
      <button class="btn btn-ghost btn-sm" onclick="go('more')" data-tip="Opens the rest of your tools in one place." title="Opens the rest of your tools in one place.">← Back</button>
      <div class="card" style="padding:6px 14px">
        ${active.length ? active.map(row).join("") : `<div class="empty" style="margin:10px 0">No conversations yet. Pick someone below to start one.</div>`}
      </div>
      ${fresh.length ? `<div class="card" style="padding:10px 14px">
        <h3 style="margin:4px 0 8px;font-size:15px">Start a message</h3>
        <div class="dm-chips">${fresh.slice(0,24).map(x=>`<button class="btn btn-soft btn-sm" onclick="threadScreen(${x.id})" data-tip="Opens the conversation with this buyer." title="Opens the conversation with this buyer.">${escapeHtml(x.name)}</button>`).join("")}</div>
      </div>` : ""}
      ${blocked.length ? `<div class="card" style="padding:10px 14px">
        <h3 style="margin:4px 0 4px;font-size:15px">Blocked</h3>
        <p class="mut" style="margin:0 0 8px">These people can't message you and you can't message them. Their old messages come straight back if you unblock.</p>
        ${blocked.map(x=>`<div class="dm-row" style="cursor:default">
          <span class="dm-av" style="filter:grayscale(1)">${escapeHtml(String(x.name||"?").slice(0,1).toUpperCase())}</span>
          <span class="dm-txt"><span class="dm-top"><b>${escapeHtml(x.name)}</b></span></span>
          <button class="btn btn-soft btn-sm" onclick="dmUnblock(${x.id})" data-tip="Lets you both message each other again.">Unblock</button>
        </div>`).join("")}
      </div>` : ""}`);
  } catch(e){ dmRender(el, `<div class="empty">${escapeHtml(e.message)}</div>`); }
}
async function threadScreen(id, label){
  clearInterval(CURRENT.dmTimer);
  const who = (S.dmContacts||[]).find(x => x.id === id);
  CURRENT.dmPeer = id;
  const name = label || (who ? who.name : "Messages");
  kineticTitle(name);
  document.title = name + " — fashionistas.ai";
  if (typeof SCCollapse === "function") { try{ SCCollapse(); }catch(e){} }
  $("#view-sub").textContent = "Messages between you and this account.";
  const el = $("#screen");
  const isBlocked = (S.dmBlocked||[]).some(x=>x.id===id);
  el.innerHTML = `
    <div class="dm-head">
      <button class="btn btn-ghost btn-sm" onclick="messagesScreen()" data-tip="Opens your messages." title="Opens your messages.">← All messages</button>
      <button class="btn btn-ghost btn-sm" id="dm-block-btn" onclick="dmBlock(${id})"
        data-tip="Stops them messaging you and hides this conversation. You can undo it any time.">${isBlocked?"Unblock":"Block"}</button>
    </div>
    <div class="card" id="dm-thread" style="padding:12px 14px;min-height:200px"></div>
    <div class="dm-compose">
      <input class="input" id="dm-input" placeholder="Write a message…" autocomplete="off"
        data-tip="Write a message to this seller." title="Write a message to this seller."
        onkeydown="if(event.key==='Enter'){event.preventDefault();dmSend()}">
      <button class="btn btn-accent" onclick="dmSend()" data-tip="Send this message to them." title="Send this message to them.">Send</button>
    </div>`;
  await dmLoad(true);
  CURRENT.dmTimer = setInterval(() => dmLoad(false), 4000);
  const i = document.getElementById("dm-input"); if (i) i.focus();
}
async function dmBlock(id){
  const blocked = (S.dmBlocked||[]).some(x=>x.id===id);
  try {
    if (blocked) { await api(`/api/dm/block/${id}`, { method:"DELETE" }); toast("Unblocked"); }
    else {
      if (!confirm("Block this person? They won't be able to message you, and you won't see them in your list.")) return;
      await api(`/api/dm/block/${id}`, { method:"POST" }); toast("Blocked");
    }
    messagesScreen();
  } catch(e){ toast(e.message); }
}
async function dmUnblock(id){
  try { await api(`/api/dm/block/${id}`, { method:"DELETE" }); toast("Unblocked"); messagesScreen(); }
  catch(e){ toast(e.message); }
}
function dmBubble(m){
  const time = String(m.at||"").slice(11,16);
  return `<div class="dm-msg ${m.mine?"mine":""}"><span>${escapeHtml(m.body)}</span><i>${m.read?"Read":time}</i></div>`;
}
async function dmLoad(fresh){
  const t = document.getElementById("dm-thread"); if (!t || !CURRENT.dmPeer) return;
  try {
    const d = await api(`/api/dm/${CURRENT.dmPeer}?after=${fresh ? 0 : (CURRENT.dmAfter||0)}`);
    const got = d.messages || [];
    if (fresh){ t.innerHTML = ""; CURRENT.dmSeen = new Set(); }
    if (!CURRENT.dmSeen) CURRENT.dmSeen = new Set();
    // Every bubble we render gets its id recorded. A message we already sent
    // optimistically comes back on the next poll and must not be drawn twice.
    const add = got.filter(m => !CURRENT.dmSeen.has(m.id));
    got.forEach(m => CURRENT.dmSeen.add(m.id));
    if (add.length){
      const empty = t.querySelector(".empty"); if (empty) empty.remove();
      t.insertAdjacentHTML("beforeend", add.map(dmBubble).join(""));
      t.scrollTop = t.scrollHeight;
    } else if (fresh && !got.length){
      t.innerHTML = `<div class="empty" style="margin:14px 0">No messages yet — say hello.</div>`;
    }
    CURRENT.dmAfter = fresh ? (d.latest||0) : Math.max(CURRENT.dmAfter||0, d.latest||0);
    if (!fresh){
      const w = (S.dmContacts||[]).find(x=>x.id===CURRENT.dmPeer);
      if (w) w.unread = 0;
    }
  } catch(e){
    // A block turns the thread read-only: stop polling and say why once,
    // instead of leaving a compose box that silently rejects everything.
    const msg = String((e && e.message) || "");
    if (/turned off/.test(msg)){
      clearInterval(CURRENT.dmTimer);
      if (!t.dataset.blocked){
        t.dataset.blocked = "1";
        t.innerHTML = `<div class="empty" style="margin:14px 0">${escapeHtml(msg)}</div>`;
        const c = document.querySelector(".dm-compose"); if (c) c.style.display = "none";
      }
    }
    // any other failure is transient — never clear the thread over it
  }
}
async function dmSend(){
  const i = document.getElementById("dm-input");
  if (!i) return;
  const body = i.value.trim(); if (!body) return;
  i.value = "";
  try {
    const d = await api(`/api/dm/${CURRENT.dmPeer}`, { method:"POST", body: JSON.stringify({ body }) });
    const t = document.getElementById("dm-thread"); if (!t) return;
    const empty = t.querySelector(".empty"); if (empty) empty.remove();
    const id = d.message && d.message.id;
    if (id){ CURRENT.dmSeen = CURRENT.dmSeen || new Set(); CURRENT.dmSeen.add(id); }
    // 201 means the server already stored it, so stamp the real send time.
    // A permanent "Sending…" would claim a state we actually know is wrong.
    // dmAfter is deliberately NOT advanced here: if it were, the poll would
    // query id > (our id) and could skip a message the other person wrote
    // in the meantime. The dmSeen set is what prevents the duplicate instead.
    const n = new Date();
    const hh = String(n.getHours()).padStart(2,"0") + ":" + String(n.getMinutes()).padStart(2,"0");
    t.insertAdjacentHTML("beforeend", `<div class="dm-msg mine"><span>${escapeHtml(body)}</span><i>${hh}</i></div>`);
    t.scrollTop = t.scrollHeight;
  } catch(e){ toast(e.message); i.value = body; }
}

/* ================= GUIDE CHATBOT ================= */
let GUIDE_HIST = [];
let GUIDE_MODE = "guide";
function guideToggle(open){
  const p = document.getElementById("guide-panel"); if (!p) return;
  const show = open === undefined ? p.classList.contains("hidden") : open;
  p.classList.toggle("hidden", !show);
  if (show){ const i = document.getElementById("guide-input"); if (i) i.focus(); }
}
// Each mode is a different bot with its own prompt and its own data, so
// switching wipes the transcript — carrying the old one over would let one
// bot answer as if it had been in the conversation all along.
function botMode(m){
  const next = ["guide","ideas","items"].includes(m) ? m : "guide";
  if (next === GUIDE_MODE) return;
  GUIDE_MODE = next;
  GUIDE_HIST = [];
  document.querySelectorAll(".g-mode").forEach(b=>{
    const on = b.dataset.mode === GUIDE_MODE;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const b = document.getElementById("guide-log");
  if (b){
    b.innerHTML = `<div class="g-msg"><span>${
      GUIDE_MODE === "ideas" ? "I'm the ideas bot — I look at what's actually listed on here right now. What should you hunt for next?"
      : GUIDE_MODE === "items" ? "I'm your items bot — I can see your listings. Ask me what to reprice, rewrite or list next."
      : "I'm the help bot — photos, pricing, fees, postage, getting paid."}</span></div>`;
    b.dataset.empty = "0";
    b.scrollTop = 0;
  }
  const i = document.getElementById("guide-input");
  if (i){
    i.placeholder = GUIDE_MODE === "ideas" ? "What should I look for next?"
      : GUIDE_MODE === "items" ? "What should I change about my listings?"
      : "Ask about pricing, postage, photos…";
    i.focus();
  }
}
// The source is printed on EVERY answer. Nothing in this window is ever
// presented as an agent's reply unless an agent actually produced it — but
// the label stays neutral: no provider or model names ever reach the screen.
function srcLabel(source, reason){
  if (source === "agent")
    return `<i class="g-src" data-tip="Answered by an agent.">Agent</i>`;
  if (source === "backup")
    return `<i class="g-src" data-tip="The agent didn't answer this one, so the backup did${reason ? " (" + String(reason).slice(0,60) + ")" : ""}.">Backup answer</i>`;
  return `<i class="g-src" data-tip="No agent was reachable — this is the app's own built-in reply, not a model's.">Built-in answer</i>`;
}
function guidePush(who, text, pending){
  const b = document.getElementById("guide-log"); if (!b) return;
  if (b.dataset.empty === "1"){ b.innerHTML = ""; b.dataset.empty = "0"; }
  b.insertAdjacentHTML("beforeend",
    `<div class="g-msg ${who === "me" ? "mine" : ""}"><span${pending ? ' class="g-pending"' : ""}>${escapeHtml(text)}</span></div>`);
  b.scrollTop = b.scrollHeight;
}
async function guideSend(){
  const i = document.getElementById("guide-input"); if (!i) return;
  const text = i.value.trim(); if (!text) return;
  i.value = "";
  const mode = GUIDE_MODE;
  guidePush("me", text);
  guidePush("guide", "Thinking…", true);
  try {
    const d = await api("/api/chat", { method:"POST", body: JSON.stringify({ message: text, history: GUIDE_HIST, mode }) });
    const b = document.getElementById("guide-log");
    const box = b && b.querySelector(".g-msg:last-child");
    const span = box && box.querySelector("span.g-pending");
    const reply = d.reply || "I could not answer that just now.";
    if (span){ span.classList.remove("g-pending"); span.textContent = reply; }
    else { guidePush("guide", reply); }
    const target = b && b.querySelector(".g-msg:last-child");
    if (target) target.insertAdjacentHTML("beforeend", srcLabel(d.source, d.fallback_reason));
    if (b) b.scrollTop = b.scrollHeight;
    // the user may have switched bots mid-flight; only record history for the
    // bot that actually answered
    if (mode === GUIDE_MODE){
      GUIDE_HIST.push({ who:"me", text }, { who:"guide", text: reply });
      GUIDE_HIST = GUIDE_HIST.slice(-20);
    }
  } catch(e){
    const b = document.getElementById("guide-log");
    const last = b && b.querySelector(".g-msg:last-child .g-pending");
    if (last){ last.classList.remove("g-pending"); last.textContent = "Could not send: " + e.message; }
    else guidePush("guide", "Could not send: " + e.message);
  }
}

/* ================= MORE ================= */
async function renderMore(el){
 el.innerHTML = `
 <div class="card">
 <h3 style="margin-top:0">Try it on</h3>
 <p class="mut" style="margin-top:0">Your photo, any item from the shop or a link. See it on you.</p>
 <a class="btn btn-accent" style="width:100%" href="/try-on/">Open try-on</a>
 </div>
 <div class="card">
 <h3 style="margin-top:0">Crosslist board</h3>
 <p class="mut" style="margin-top:0">Every item, every shop: copy &amp; open each marketplace, then mark it listed or sold. Free.</p>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px"><a class="btn btn-primary" href="/seller/board/">Open board</a><a class="btn btn-soft" href="/seller/stats/">Stats</a></div>
 </div>
 <div class="card" data-tip="Messages between you and the other accounts on here.">
 <h3 style="margin-top:0">Messages</h3>
 <p class="mut" style="margin-top:0">Talk to other accounts directly — ask about an item, make an offer, answer a buyer.</p>
 <button class="btn btn-primary" style="width:100%" onclick="messagesScreen()" data-tip="Opens your conversations and lets you start a new one."><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M20.5 12.5c0 4-3.8 7.2-8.5 7.2a9.9 9.9 0 0 1-2.6-.34L4.5 21l1.2-3.4A6.9 6.9 0 0 1 3.5 12.5c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 3.2z'/></svg> Open messages</button>
 </div>
 <div class="card" data-tip="See pop-up shops and sellers on a map near you.">
 <h3 style="margin-top:0">Near you (map)</h3>
 <p class="mut" style="margin-top:0">Pop-up shops and sellers close to you.</p>
 <button class="btn btn-soft" style="width:100%" onclick="go('map')" data-tip="Opens the map of nearby pop-ups.">Open map</button>
 </div>
 <div class="card" data-tip="Everything you've sold, and what you kept from it.">
 <h3 style="margin-top:0">Your sales and money</h3>
 <p class="mut" style="margin-top:0">See what sold, and what you kept after fees and postage.</p>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
 <button class="btn btn-primary" data-tip="Every sale you've written down, with what you kept." onclick="ordersScreen()"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z'/><path d='M9 8.5h6M9 12.5h6'/></svg> My sales</button>
 <button class="btn btn-soft" data-tip="Money in, fees out, and what's actually left." onclick="profitScreen()"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M4 19V5M4 19h16M7.5 15.5l3.5-4 3 2.5 4.5-6'/></svg> What I made</button>
 </div>
 </div>
 <div class="card" data-tip="Write down each trip: where you went, what you bought, what it cost.">
 <h3 style="margin-top:0">Shopping trips</h3>
 <p class="mut" style="margin-top:0">Log a thrifting trip and see whether it paid you back.</p>
 <button class="btn btn-ghost" style="width:100%" data-tip="Add a trip: where you went and what you spent." onclick="haulsScreen()"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='4' width='18' height='4.5' rx='1.5'/><path d='M4.5 8.5v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-10M10 13h4'/></svg> Open my shopping trips</button>
 </div>
 <div class="card" data-tip="Ready-made replies to buyers, plus short reads on selling.">
 <h3 style="margin-top:0">Messages and tips</h3>
 <p class="mut" style="margin-top:0">Copy a friendly reply for a buyer, or read a quick tip.</p>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
 <button class="btn btn-soft" data-tip="Tap a message to copy it, then paste it into the shop's chat." onclick="templatesScreen()"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M20.5 12.5c0 4-3.8 7.2-8.5 7.2a9.9 9.9 0 0 1-2.6-.34L4.5 21l1.2-3.4A6.9 6.9 0 0 1 3.5 12.5c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z'/></svg> Replies</button>
 <button class="btn btn-soft" data-tip="Short articles to help you sell more." onclick="blogScreen()"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M4 5.5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z'/><path d='M17 9h3v8.5a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h4'/></svg> Selling tips</button>
 </div>
 </div>
 <div class="card" data-tip="Save your list as a file you can open in Excel or Google Sheets.">
 <h3 style="margin-top:0">Download my list</h3>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
 <a class="btn btn-soft" data-tip="A file of everything in your closet." href="${API}/api/export/inventory.csv" target="_blank" onclick="return exportSafe(event,'export/inventory.csv')">My clothes</a>
 <a class="btn btn-soft" data-tip="A file of every sale you've recorded." href="${API}/api/export/orders.csv" target="_blank" onclick="return exportSafe(event,'export/orders.csv')"><svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z'/><path d='M9 8.5h6M9 12.5h6'/></svg> My sales</a>
 </div>
 <p class="mut" style="margin:8px 0 0">Both are plain files that open in Excel or Google Sheets.</p>
 </div>
 <details class="card" id="more-ext" data-tip="Only for people listing from a desktop computer in Chrome.">
 <summary style="cursor:pointer;font-weight:700;min-height:28px">Desktop power users · Chrome extension (optional)</summary>
 <p class="mut">You don't need this — posting works from your phone without installing anything. If you list from a desktop computer in Chrome, the optional Crosslister extension can fill shop forms for you (Load unpacked, developer mode).</p>
 <button class="btn btn-soft btn-sm" onclick="extConnectPrompt()" data-tip="Opens the optional desktop extension setup.">Set up the desktop extension</button>
 </details>
 <button class="btn btn-ghost ux-signout" style="width:100%" onclick="logout()">Sign out</button>
 <a class="btn btn-ghost" style="width:100%;margin-top:8px;display:block;text-align:center" href="/account/delete/">Delete account</a>
 <footer>fashionistas.ai · everything saved to your account<br><a href="/contact/" style="color:inherit">Contact</a> · <a href="/privacy/" style="color:inherit">Privacy</a> · <a href="/about/" style="color:inherit">About</a><br>Powering the independent resale economy.</footer>`;
}
async function exportSafe(e, p){
 try { const r = await fetch(API+"/api/"+p, { headers:{ Authorization:"Bearer "+TOKEN } }); const t = await r.text(); const b = new Blob([t],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=p.replace("/","_"); a.click(); } catch(err){ toast("Download failed"); }
 e.preventDefault(); return false;
}
async function ordersScreen(){
 kineticTitle("My sales"); $("#view-sub").textContent = "Every sale you've written down — and what you kept from it.";
 const el = $("#screen"); el.innerHTML = showLoader();
 try {
 const d = await api("/api/orders");
 const o = d.orders || [];
 if (!(S.listings||[]).length) { try { S.listings = (await api("/api/listings")).listings || []; } catch(e){} }
 el.innerHTML = `
 <button class="btn btn-ghost btn-sm" onclick="go('more')" data-tip="Opens the rest of your tools in one place." title="Opens the rest of your tools in one place.">← Back</button>
 ${o.length ? `<div class="ux-list">${o.map(x=>{ const li=(S.listings||[]).find(y=>Number(y.id)===Number(x.listing_id)); const shop = x.platform && x.platform!=="null" ? platformName(x.platform) : "Other"; return `<button type="button" class="ux-row" onclick="openOrder(${x.id})">${li&&li.photo_url?`<img src="${escapeAttr(li.photo_url)}" alt="">`:`<span class="ux-row-ph"></span>`}<span class="ux-row-m"><b>${escapeHtml((li&&li.title)||("Item #"+(x.listing_id||x.id)))}</b><small>${escapeHtml(shop)} · ${escapeHtml(x.status||"sold")}${x.created_at?" · "+escapeHtml(new Date(String(x.created_at).replace(" ","T")+(/[zZ]|[+-]\d\d:?\d\d$/.test(String(x.created_at))?"":"Z")).toLocaleDateString(undefined,{month:"short",day:"numeric"})):""}</small></span><span class="ux-row-v"><b>${money(x.sale_price)}</b><small style="color:${x.profit>=0?"var(--good)":"var(--bad)"}">kept ${money(x.profit)}</small></span></button>`; }).join("")}</div>`
 : `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='9'/><path d='M12 16.2v-4.6M12 8.2v.01'/></svg>No sales written down yet — mark an item sold to add your first one.</div>`}
 <button class="btn btn-primary" onclick="openOrder(null)" data-tip="Write down a sale that happened outside the app.">+ Add a sale by hand</button>`;
 } catch(e){ el.innerHTML = `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>${escapeHtml(e.message)}</div>`; }
}
function openOrder(id){
 CURRENT.order = id;
 openSheet(`
 <h3 style="margin:0 0 4px">${id?"Sale details":"Add a sale"}</h3>
 ${id?`<p class="mut">Opening order #${id}</p>`:``}
 <label>Sold for ($)</label><input class="input" id="o-price" type="number" step="1">
 <div class="two">
 <div><label>Which shop</label><select class="input" id="o-plat"><option value="">—</option>${(S.markets||[]).map(m=>`<option value="${m.id}">${m.name}</option>`).join("")}</select></div>
 <div><label>Buyer</label><input class="input" id="o-buyer"></div>
 </div>
 <div class="three">
 <div><label>Their cut ($)</label><input class="input" id="o-fee" type="number" value="0"></div>
 <div><label>Postage ($)</label><input class="input" id="o-ship" type="number" value="0"></div>
 <div><label>What it cost me ($)</label><input class="input" id="o-cogs" type="number" value="0"></div>
 </div>
 <div style="height:10px"></div>
 <button class="btn btn-accent" onclick="saveOrder(${id||"null"})" data-tip="Saves this sale against your books." title="Saves this sale against your books.">${id?"Update sale":"Save sale"}</button>
 `);
}
async function saveOrder(id){
 const body = { sale_price: parseFloat($("#o-price").value)||0, platform: $("#o-plat").value||null, buyer: $("#o-buyer").value||null, fee: parseFloat($("#o-fee").value)||0, shipping: parseFloat($("#o-ship").value)||0, cogs: parseFloat($("#o-cogs").value)||0 };
 try {
 if (id) { await api("/api/orders/"+id, { method:"PUT", body: JSON.stringify({ buyer: body.buyer }) }); }
 else { await api("/api/orders", { method:"POST", body: JSON.stringify(body) }); }
 closeSheet(); toast("Sale saved ✓"); ordersScreen();
 } catch(e){ toast(e.message); }
}
async function profitScreen(){
 kineticTitle("How I'm doing"); $("#view-sub").textContent = "What sold, what's still waiting, and what you've actually made.";
 const el = $("#screen"); el.innerHTML = showLoader();
 try {
 const p = await api("/api/profit/summary");
 const rows = [["Money in", p.gross||0, ""],["Fees they took", p.fees||0, "bad"],["Postage paid", null,""],["What it cost you", p.cogs||0, "bad"],["What you kept", p.net_profit||0, "good"]];
 el.innerHTML = `
 <button class="btn btn-ghost btn-sm" onclick="go('more')" data-tip="Opens the rest of your tools in one place." title="Opens the rest of your tools in one place.">← Back</button>
 <div class="card" style="text-align:center" data-tip="Everything you've kept after fees, postage and what it cost you.">
 <p class="mut" style="margin:0">What you've kept, after everything</p>
 <h2 style="font-size:44px;margin:10px 0;color:${(p.net_profit||0)>=0?"var(--good)":"var(--bad)"}">${money(p.net_profit)}</h2>
 <p class="mut">from ${p.sales||0} sales</p>
 </div>
 <div class="card">
 ${[["Money in",p.gross],["Fees they took",p.fees],["What it cost you",p.cogs],["What you kept",p.net_profit]].map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line)"><b>${k}</b><span style="${k==='What you kept'?'font-weight:800;color:'+(v>=0?'var(--good)':'var(--bad)')+'':''}">${money(v)}</span></div>`).join("")}
 </div>`;
 } catch(e){ el.innerHTML = `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>${escapeHtml(e.message)}</div>`; }
}
async function haulsScreen(){
 kineticTitle("Shopping trips"); $("#view-sub").textContent = "What you spent on each trip — and whether it paid back.";
 const el = $("#screen"); el.innerHTML = showLoader();
 try {
 const d = await api("/api/hauls");
 const h = d.hauls || [];
 el.innerHTML = `
 <button class="btn btn-ghost btn-sm" onclick="go('more')" data-tip="Opens the rest of your tools in one place." title="Opens the rest of your tools in one place.">← Back</button>
 ${h.length ? h.map(x=>`
 <div class="card">
 <div style="display:flex;justify-content:space-between;align-items:center">
 <div><h3 style="margin:0">${escapeHtml(x.name||"Haul")}</h3><span class="mut">${escapeHtml(x.store||"")} · ${fmt(x.date)} · ${x.items||0} items</span></div>
 <button class="btn btn-danger btn-sm" onclick="delHaul(${x.id})" data-tip="Delete this trip.">×</button>
 </div>
 <p class="mut" style="margin:8px 0 0">Spent <b>${money(x.spend)}</b>${x.notes?` — ${escapeHtml(x.notes)}`:""}</p>
 </div>`).join("")
 : `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='9'/><path d='M12 16.2v-4.6M12 8.2v.01'/></svg>No shopping trips logged yet.</div>`}
 <button class="btn btn-primary" onclick="newHaul()" data-tip="Write down a trip: where you went and what you spent.">+ Add a shopping trip</button>`;
 } catch(e){ el.innerHTML = `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>${escapeHtml(e.message)}</div>`; }
}
async function delHaul(id){ try { await api("/api/hauls/"+id, { method:"DELETE" }); toast("Trip deleted"); haulsScreen(); } catch(e){ toast(e.message); } }
function newHaul(){
 openSheet(`
 <h3 style="margin:0 0 4px">Add a shopping trip</h3>
 <label>Name</label><input class="input" id="h-name" placeholder="e.g. Goodwill run #12">
 <div class="two">
 <div><label>Store</label><input class="input" id="h-store" placeholder="Goodwill"></div>
 <div><label>What I spent ($)</label><input class="input" id="h-spend" type="number" value="0"></div>
 </div>
 <div class="two">
 <div><label>Items</label><input class="input" id="h-items" type="number" value="1"></div>
 <div><label>Date</label><input class="input" id="h-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
 </div>
 <label>Notes</label><textarea class="input" id="h-notes" rows="2" placeholder="What did you find?"></textarea>
 <div style="height:10px"></div>
 <button class="btn btn-accent" onclick="saveHaul()" data-tip="Saves this shopping trip so it counts towards your profit." title="Saves this shopping trip so it counts towards your profit.">Save trip</button>
 `);
}
async function saveHaul(){
 const body = { name: $("#h-name").value.trim()||"Haul", store: $("#h-store").value.trim()||null, spend: parseFloat($("#h-spend").value)||0, items: parseInt($("#h-items").value)||1, date: $("#h-date").value||null, notes: $("#h-notes").value.trim()||null };
 try { await api("/api/hauls", { method:"POST", body: JSON.stringify(body) }); closeSheet(); toast("Trip saved ✓"); haulsScreen(); } catch(e){ toast(e.message); }
}
async function templatesScreen(){
 kineticTitle("Replies"); $("#view-sub").textContent = "Copy a ready-made message and paste it into the shop's chat.";
 const el = $("#screen"); el.innerHTML = showLoader();
 try {
 const d = await api("/api/messages/templates");
 el.innerHTML = `
 <button class="btn btn-ghost btn-sm" onclick="go('more')" data-tip="Opens the rest of your tools in one place." title="Opens the rest of your tools in one place.">← Back</button>
 <p class="mut">Ready-made replies to buyers. Tap one to copy it, then paste it into the shop's chat.</p>
 ${(d.templates||[]).map(t=>{ const [subj, ...rest] = t.split(":"); return `
 <div class="card" style="cursor:pointer" onclick="copyText('${escapeAttr(t)}')">
 <b>${escapeHtml(subj)}</b><br>
 <span class="mut">${escapeHtml(rest.join(":").trim())}</span>
 <div style="margin-top:8px"><span class="pill">tap to copy</span></div>
 </div>`; }).join("")}`;
 } catch(e){ el.innerHTML = `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>${escapeHtml(e.message)}</div>`; }
}
async function copyText(t){ try{ await navigator.clipboard.writeText(t); toast("Copied to clipboard ✓"); }catch{ toast(t); } }
async function blogScreen(){
 kineticTitle("Selling tips"); $("#view-sub").textContent = "Short reads to help you sell more.";
 const el = $("#screen"); el.innerHTML = showLoader();
 try {
 const d = await api("/api/blog");
 const posts = d.posts || [];
 el.innerHTML = `
 <button class="btn btn-ghost btn-sm" onclick="go('more')" data-tip="Opens the rest of your tools in one place." title="Opens the rest of your tools in one place.">← Back</button>
 ${posts.length ? posts.map(p=>`
 <div class="card">
 <h3 style="margin:0">${escapeHtml(p.title)}</h3>
 <p class="mut" style="margin:6px 0">${escapeHtml(p.excerpt||"")}</p>
 <span class="pill">${escapeHtml(p.category||"Style")}</span>
 <span class="pill">${p.read_time||5} min read</span>
 <span class="pill">${fmt(p.published_at)}</span>
 </div>`).join("")
 : `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='9'/><path d='M12 16.2v-4.6M12 8.2v.01'/></svg>Nothing to read yet.</div>`}`;
 } catch(e){ el.innerHTML = `<div class="empty"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M12 8.5v4.5M12 16.5v.01'/><circle cx='12' cy='12' r='9'/></svg>${escapeHtml(e.message)}</div>`; }
}

/* ================= MANUAL ADD + sheet helpers ================= */
function openAdd(){
 openSheet(`
 <h3 style="margin:0 0 4px">Add an item by hand</h3>
 <p class="mut" style="margin-top:0">No camera? Type the details in yourself.</p>
 <label>Photo URL (optional)</label><input class="input" id="m-photo" placeholder="https://…">
 <label>Title</label><input class="input" id="m-title" placeholder="e.g. Levi's Trucker Jacket">
 <div class="two">
 <div><label>Price ($)</label><input class="input" id="m-price" type="number" min="1"></div>
 <div><label>Size</label><input class="input" id="m-size" placeholder="M"><div id="m-size-chips"></div></div>
 </div>
 <label>Department</label>
 <select class="input" id="m-dept" onchange="fDeptChange('m-dept','m-sub-wrap')" data-tip="Pick which part of the shop this belongs in. Buyers browse departments first, then the type of item." title="Pick which part of the shop this belongs in.">
 <option value="">Choose a department…</option>
 ${taxDepts().map(d=>`<option value="${escapeAttr(d)}">${escapeHtml(d)}</option>`).join("")}
 </select>
 <label>Type of item</label>
 <div id="m-sub-wrap">${fSubInner("", "")}</div>
 <label>Condition</label>
 <div id="m-cond">${["Poor","Fair","Good","Excellent"].map(c=>`<button class="chip ${c==="Good"?"on":""}" onclick="pickCond(this,'${c}')" data-tip="Sets the condition for this listing." title="Sets the condition for this listing.">${c}</button>`).join("")}</div>
 <fieldset class="form-sec" data-tip="These are the fields shoppers filter and search by — filling them in is what gets you found.">
  <legend>What it is</legend>
  <div class="two">
   <div><label>Brand</label><input class="input" id="m-brand" autocomplete="off" placeholder="e.g. Levi's" data-tip="Brand is searched by buyers and used by Google Shopping. Leave blank if unsure — never guess."></div>
   <div><label>Colour</label><input class="input" id="m-color" autocomplete="off" placeholder="e.g. Light blue"></div>
  </div>
  <div><label>Material</label><input class="input" id="m-material" autocomplete="off" placeholder="e.g. 100% cotton"></div>
 </fieldset>
 <label>Description</label><textarea class="input" id="m-desc" rows="3"></textarea>
 <div style="height:10px"></div>
 <button class="btn btn-accent" onclick="saveManual()" data-tip="Saves this sale by hand." title="Saves this sale by hand.">Save to my clothes</button>
 `);
}
async function saveManual(){
 /* The detail fields the hand-add sheet was the only form not sending. Brand,
    colour and material are what a buyer filters and searches on, and what a
    Google Shopping row is built from — leaving them out here meant a listing
    typed by hand was permanently thinner than one created any other way. */
 const mv = id => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };
 const body = { title: $("#m-title").value.trim(), price: parseFloat($("#m-price").value), size: $("#m-size").value.trim(), category: fReadCat("m-dept","m-sub-wrap"), condition: ((($("#m-cond .on")||{}).textContent)||"Good").trim(), description: $("#m-desc").value.trim(), photo_url: $("#m-photo").value.trim()||null, brand: mv("m-brand"), color: mv("m-color"), material: mv("m-material") };
 if (!body.title || !body.price) return toast("Title and price are required");
 /* Same rule as the main form: every item gets a department, or it can never
    be browsed to. The old code read a chip group that no longer exists and
    silently fell back to a fixed category. */
 if (!body.category) return toast("Pick a department so buyers can find this item");
 try { await api("/api/listings", { method:"POST", body: JSON.stringify(body) }); closeSheet(); toast("Added ✓"); go("closet"); } catch(e){ toast(e.message); }
}

function openSheet(html){
 if (typeof SCCollapse === "function") { try{ SCCollapse(); }catch(e){} }
 const el = document.createElement("div");
 el.className = "sheet"; el.id = "sheet";
 el.innerHTML = `<div class="body">${html}<br><button class="btn btn-soft" style="width:100%" onclick="closeSheet()" data-tip="Closes this panel." title="Closes this panel.">Close</button></div>`;
 el.addEventListener("click", e=>{ if (e.target===el) closeSheet(); });
 document.body.appendChild(el);
}
function closeSheet(){ const s = $("#sheet"); if (s) s.remove(); }

/* ================= utils ================= */
function escapeHtml(s){ return String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function escapeAttr(s){ return String(s??"").replace(/"/g,"&quot;"); }
function titleCase(s){ return String(s||"").replace(/\b\w/g, c=>c.toUpperCase()); }
async function loadMarketplaces(){
 if (!S.markets) { try { S.markets = (await api("/api/marketplaces")).marketplaces; } catch { S.markets = []; } }
}
async function useSample(){
 // pull a real, freely-hosted product photo of a jacket for the demo path
 go("snap");
 try {
 const img = new Image();
 img.crossOrigin = "anonymous";
 img.onload = () => {
 const c = document.createElement("canvas");
 c.width = img.width; c.height = img.height;
 c.getContext("2d").drawImage(img,0,0);
 const b64 = c.toDataURL("image/jpeg", .85).split(",")[1];
 analyzeImage(b64, img.src);
 };
 img.onerror = () => toast("Couldn't load sample — tap to take your own photo");
 img.src = "sample-jacket.jpg";
 } catch(e){ toast("Sample unavailable"); }
}

async function identifyItem(previewUrl, b64){
 if (!TOKEN) return toast("Create your account first — then the scan runs on your real items");
 toast(previewUrl ? "AI is identifying your item…" : "AI is identifying a sample…");
 go("snap");
 try {
 const data = b64 || await hcSampleB64();
 analyzeImage(data, previewUrl || "sample-jacket.jpg");
 } catch(e){ toast("Scan failed — " + e.message); }
}

/* ================= HIVE GUIDE (A→Z onboarding walkthrough) ================= */
const GUIDE_MPS = {
 depop: { name:"Depop", icon:"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l7.9 7.9-9.1 9.1z'/><circle cx='8.1' cy='8.5' r='1.5'/></svg>", url:"https://www.depop.com/register", fields:["title","brand","category","size","condition","price","description"], note:"Depop rewards honest sizing — keep your real measurements in the description.",
 steps:["Download the Depop app or visit depop.com — sign up free with email, Google or Apple.","Fill your profile: avatar, location, and 'fast shipping, easy to work with'.","Answer buyer messages quickly and ship within 2-3 days to build standing.","Paste the listing content below into 'Sell an item' and attach your photos."] },
 ebay: { name:"eBay", icon:"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l7.9 7.9-9.1 9.1z'/><circle cx='8.1' cy='8.5' r='1.5'/></svg>", url:"https://signup.ebay.com/", fields:["title","brand","category","size","condition","price","description"], note:"Fill eBay's item specifics (brand/size/color) to rank higher in search.",
 steps:["Go to ebay.com (or the app) and tap Register.","Create a personal or business account — free; selling needs a linked payout method.","Verify your email and add payout details so sales settle.","Use the item specifics below — eBay boosts complete listings in search."] },
 poshmark:{ name:"Poshmark", icon:"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l7.9 7.9-9.1 9.1z'/><circle cx='8.1' cy='8.5' r='1.5'/></svg>", url:"https://poshmark.com/signup", fields:["title","brand","category","size","condition","price","description"], note:"Poshmark bundles encourage bigger sales — mention bundle discounts in your bio.",
 steps:["Install Poshmark or open poshmark.com.","Sign up and pick 'Sell items' during onboarding.","Give your closet a name you'll remember.","Poshmark ships with their own label — your AI price range already accounts for it."] },
 mercari: { name:"Mercari", icon:"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l7.9 7.9-9.1 9.1z'/><circle cx='8.1' cy='8.5' r='1.5'/></svg>", url:"https://www.mercari.com/signup/", fields:["title","brand","category","size","condition","price","description"], note:"Mercari is offer-heavy — aim for the top of your AI price range.",
 steps:["Install Mercari or visit mercari.com.","Create an account and tap + to Sell.","Pick the same category the AI identified for you.","Price near your AI range so buyers can find it."] },
 vinted: { name:"Vinted", icon:"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l7.9 7.9-9.1 9.1z'/><circle cx='8.1' cy='8.5' r='1.5'/></svg>", url:"https://www.vinted.com/signup", fields:["title","brand","category","size","condition","price","description"], note:"Set ~10% headroom on Vinted so offers land at your target price.",
 steps:["Create a free Vinted account (app or web).","Set your default size and select your country.","Post clear photos plus the AI description and condition.","Accept fair offers quickly — Vinted buyers negotiate a lot."] },
 grailed: { name:"Grailed", icon:"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l7.9 7.9-9.1 9.1z'/><circle cx='8.1' cy='8.5' r='1.5'/></svg>", url:"https://www.grailed.com/signup", fields:["title","brand","category","size","condition","price","description"], note:"Grailed buyers want measurements + tag photos — add them to the description.",
 steps:["Join Grailed (streetwear & menswear focus).","Complete profile verification to unlock selling.","Detail authenticity: tags, flaws, provenance in the description.","Ship with tracking within a few days to keep your seller standing."] }
};

const GUIDE_STEPS = [
 { title:"Welcome to fashionistas.ai", emoji:"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#ff4e3a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-3px;margin-right:6px'><path d='M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z'/></svg>",
 body:"fashionistas.ai is free for good. Snap a clothing item and the AI identifies it and suggests a price. The listing goes on fashionistas.ai. Other shops are not posted for you — you copy the listing and press Post there.",
 action:null },
 { title:"Create your account", emoji:"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#ff4e3a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-3px;margin-right:6px'><path d='M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z'/></svg>",
 body:"One tap opens the real sign-up form behind this card: username + email + password and you're in. Your photos and listings are saved to your account. Prefer to poke around first? Tap 'Log in as demo seller' on the auth screen.",
 action:{ label:"Open the sign-up form →", fn:()=>guideAccount() } },
 { title:"Snap any clothing item", emoji:"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#ff4e3a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-3px;margin-right:6px'><path d='M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z'/></svg>",
 body:"On the Snap screen, tap the dashed camera zone and your phone camera opens — or pick from your gallery. Tip: flat lay, natural light, tags visible. The photo stays yours.",
 action:{ label:"Open the Snap camera →", fn:()=>guideSnap() } },
 { title:"AI vision identifies it", emoji:"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#ff4e3a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-3px;margin-right:6px'><path d='M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z'/></svg>",
 body:"The app reads brand, category, size, condition and confidence — then suggests a resale price range and drafts your listing. Tap the button below to run a real sample scan live.",
 action:{ label:"Scan a real sample now →", fn:()=>guideAIScan() } },
 { title:"Manual posting — no API needed", emoji:"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#ff4e3a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-3px;margin-right:6px'><path d='M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z'/></svg>", kind:"marketplaces",
 body:"No integrations, no developer tools. Pick a marketplace below to see exactly how to open your account, then tap 'Generate listing content' — it builds real JSON + CSV from your current listing for anything you'd rather list by hand.",
 action:null },
 { title:"Prepare the listing copy", emoji:"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#ff4e3a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-3px;margin-right:6px'><path d='M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z'/></svg>",
 body:"From any listing, tick the shops and tap Get ready to post — that opens per-shop kits (honest paste fallback). With the Crosslister installed, Sell everywhere queues real posts and shows queued → posting → posted only when the extension reports it. Without the extension, nothing is marked Posted automatically.",
 action:{ label:"Prepare Sell everywhere for this listing →", fn:()=>guideCrosspost() } },
 { title:"Mark sold & track profit", emoji:"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#ff4e3a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-3px;margin-right:6px'><path d='M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z'/></svg>",
 body:"When an item sells, write down what it sold for, the shop's cut, the postage and what it cost you — the profit screen works out what you kept automatically. One tap opens the real 'Mark it as sold' sheet on your current listing.",
 action:{ label:"Open 'Mark it as sold' →", fn:()=>guideMarkSold() } },
 { title:"Profit math, done for you", emoji:"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#ff4e3a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-3px;margin-right:6px'><path d='M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z'/></svg>",
 body:"Every sale lands in your Profit view with zero manual math — gross, platform fees, cost of goods and net, computed from your real sold orders. One tap opens the live dashboard behind this card.",
 action:{ label:"Open the Profit dashboard →", fn:()=>guideProfit() } }
];

let G = { i:0, mp:"depop", mode:"json", payload:null };

function closeGuide(){ $("#guide-overlay").classList.add("hidden"); localStorage.setItem("fash_guide_seen","1"); }
function openGuide(){ $("#guide-overlay").classList.remove("hidden"); guideRender(); }
function guideGo(i){ G.i = Math.max(0, Math.min(GUIDE_STEPS.length-1, i)); guideRender(); }
function guideNext(){ if (G.i >= GUIDE_STEPS.length-1) return closeGuide(); G.i++; guideRender(); }
function guideBack(){ guideGo(G.i-1); }
function guidePause(msg){ closeGuide(); toast(msg || "Action launched — tap '? Help A→Z' to resume the tour whenever you're ready."); }
function guideRequireAuth(idx){ if (TOKEN && USER) return true; toast("You need a free account for this part — jumping to step 2 to create one."); guideGo(1); return false; }
function guideStepAction(i){ const s = GUIDE_STEPS[i]; if (s && s.action) s.action(); }
function guidePickMP(id){ G.mp = id; G.payload = null; guideRender(); }
function guideMode(m){ G.mode = m; guideRender(); }
function guideCopyNow(){ if (G.payload) copyText(G.mode === "json" ? G.payload.json : G.payload.csv); }

function guideRender(){
 const s = GUIDE_STEPS[G.i];
 const total = GUIDE_STEPS.length;
 const dots = `<div class="guide-dots">${GUIDE_STEPS.map((_,k)=>`<i class="${k===G.i?'on':''}"></i>`).join("")}</div>`;
 const nav = `
 <div class="guide-nav">
 <button class="btn btn-ghost btn-sm" onclick="guideBack()" style="${G.i===0?'visibility:hidden':''}" data-tip="Goes back a step." title="Goes back a step.">Back</button>
 <button class="btn btn-primary" onclick="${G.i===total-1?'closeGuide()':'guideNext()'}" data-tip="Carries on to the next step of the guide." title="Carries on to the next step of the guide.">${G.i===total-1?'Finish ✓':'Next →'}</button>
 </div>`;
 let mid = "";
 if (s.kind === "marketplaces") mid = guideMPBlock();
 else if (s.action) mid = `<div style="height:12px"></div><button class="btn btn-accent" onclick="guideStepAction(${G.i})" data-tip="Does this step for you, right now." title="Does this step for you, right now.">${s.action.label}</button>`;
 $("#guide-card").innerHTML = `
 <button class="guide-x" onclick="closeGuide()" aria-label="Close" data-tip="Closes the guide. You can reopen it any time." title="Closes the guide. You can reopen it any time.">×</button>
 <h3 style="margin:2px 0 2px;font-size:20px">${s.emoji} ${escapeHtml(s.title)}</h3>
 <p class="mut" style="margin:8px 0 4px">Step ${G.i+1} of ${total}</p>
 <div style="font-size:14px">${s.body}</div>
 ${mid}
 ${dots}
 ${nav}`;
}

function guideMPBlock(){
 const ids = Object.keys(GUIDE_MPS);
 const chips = `<div style="margin:12px 0 4px">${ids.map(id=>`<button class="guide-mp ${id===G.mp?'on':''}" onclick="guidePickMP('${id}')" data-tip="Switches the guide to this shop." title="Switches the guide to this shop.">${GUIDE_MPS[id].icon} <span style="flex:1">${GUIDE_MPS[id].name}</span><span class="mut" style="font-size:11px">${id===G.mp?'Pick this one':'tap'}</span></button>`).join("")}</div>`;
 const cfg = GUIDE_MPS[G.mp];
 const stepsHtml = `<ol class="guide-ol">${cfg.steps.map(x=>`<li>${x}</li>`).join("")}</ol>`;
 const genBtn = `<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" onclick="guideCopyListing('${G.mp}')" data-tip="Copies these words so you can paste them into the shop." title="Copies these words so you can paste them into the shop.">Generate listing content for ${cfg.name}</button>`;
 let payload = "";
 if (G.payload){
 const v = G.mode === "json" ? G.payload.json : G.payload.csv;
 payload = `
 <div style="height:10px"></div>
 <div class="two">
 <button class="btn btn-soft btn-sm" style="${G.mode==='json'?'background:var(--ink);color:#fff;':''}" onclick="guideMode('json')" data-tip="Shows the guide as copyable text." title="Shows the guide as copyable text.">JSON</button>
 <button class="btn btn-soft btn-sm" style="${G.mode==='csv'?'background:var(--ink);color:#fff;':''}" onclick="guideMode('csv')" data-tip="Shows the guide as a table you can open in a spreadsheet." title="Shows the guide as a table you can open in a spreadsheet.">CSV</button>
 </div>
 <label>${G.mode==='json'?'Copy JSON':'Copy CSV'} — paste into ${cfg.name}</label>
 <textarea class="guide-copy" readonly>${escapeAttr(v)}</textarea>
 <button class="btn btn-accent btn-sm" style="width:100%;margin-top:6px" onclick="guideCopyNow()" data-tip="Copies everything on this step." title="Copies everything on this step.">Copy to clipboard</button>
 <p class="mut" style="font-size:12px;margin:8px 0 0">Generated from your real listing — paste it into ${cfg.name} and tweak.</p>`;
 }
 return `<a class="link" href="${cfg.url}" target="_blank" rel="noopener">Open ${cfg.name} & create your account ↗</a>
 ${stepsHtml}
 ${genBtn}
 ${payload}
 <p class="mut" style="font-size:12px;margin:10px 0 0">${cfg.note}</p>`;
}

function guideListingData(){
 const ai = CURRENT.ai || {};
 const l = CURRENT.listing || (S.listings && S.listings[0]) || ai;
 const brand = l.brand || ai.brand || "";
 const title = l.title || titleCase(((brand && brand!=="Unknown")?brand+" ":"") + (l.type||ai.type||l.category||"clothing item"));
 const size = l.size || ai.sizeHint || l.sizeHint || "";
 const category = l.category || ai.category || "Tops";
 const condition = l.condition || ai.condition || "Good";
 const color = l.color || ai.color || "";
 const price = Math.round(l.price != null ? Number(l.price) : (Number(ai.priceMin)||Number(ai.priceMax)||30));
 const desc = l.description || defaultDesc({ brand, color, sizeHint: size, condition });
 return { title, brand, category, size, condition, color, price, desc, photo: l.photo_url || ai._preview || null, id: l.id || null };
}

async function guideCopyListing(mpId){
 G.mp = mpId;
 const cfg = GUIDE_MPS[mpId];
 let fee = null;
 try { const mp = await api("/api/marketplaces"); S.markets = mp.marketplaces; fee = (S.markets||[]).find(m=>m.id===mpId)?.feePct ?? null; } catch(e){}
 const d = guideListingData();
 const payload = {
 marketplace: cfg.name, platform_link: cfg.url, platform_fee_pct: fee,
 title: d.title, brand: d.brand, category: d.category, size: d.size,
 condition: d.condition, color: d.color, price: d.price,
 description: d.desc, photo_url: d.photo, listing_id: d.id,
 generated_by: "fashionistas.ai Help Guide"
 };
 const esc = (v)=>`"${String(v??"").replace(/"/g,'""')}"`;
 const head = cfg.fields.concat(["photo_url","listing_id"]);
 const row = cfg.fields.map(k=> k==="price" ? money(payload.price) : payload[k]).concat([payload.photo_url, payload.listing_id]);
 G.payload = { json: JSON.stringify(payload, null, 2), csv: head.map(esc).join(",") + "\n" + row.map(esc).join(",") };
 G.mode = "json";
 guideRender();
}

function guideAccount(){
 if (TOKEN && USER) { guidePause("You're already signed in — open the Snap step whenever you're set."); return; }
 authTab("signup");
 guidePause("The real sign-up form is open behind this tour — create your account, then tap '? Help A→Z' to continue step by step.");
}
function guideSnap(){
 if (!guideRequireAuth(2)) return;
 closeGuide(); go("snap");
 toast("Snap screen is open — tap the dashed zone to take or upload a photo.");
}
function guideAIScan(){
 if (!guideRequireAuth(3)) return;
 closeGuide(); identifyItem();
}
async function guideCrosspost(){
 if (!guideRequireAuth(5)) return;
 let l = CURRENT.listing;
 if (!l) l = (S.listings || [])[0];
 if (!l) { guidePause("No listing yet — use the Snap step to create one first."); go("snap"); return; }
 closeGuide();
 try {
 if (!CURRENT.listing) await openListing(l.id);
 document.querySelectorAll("#xl-pick input").forEach(i=>i.checked=true);
 await crosspost(CURRENT.listing.id);
 } catch(e){ toast(e.message); }
}
async function guideMarkSold(){
 if (!guideRequireAuth(6)) return;
 let l = CURRENT.listing;
 if (!l) l = (S.listings || [])[0];
 if (!l) { guidePause("No listing yet — use the Snap step to create one first."); go("snap"); return; }
 closeGuide();
 try {
 if (!CURRENT.listing) await openListing(l.id);
 await loadMarketplaces();
 soldSheet(CURRENT.listing.id);
 } catch(e){ toast(e.message); }
}
function guideProfit(){
 if (!guideRequireAuth(7)) return;
 closeGuide(); go("more"); setTimeout(()=>profitScreen(), 350);
}

/* ================= HIVE GUIDE A→Z (guided onboarding) ================= */
const HC_KEY = "fash_guided";
let HC_I = parseInt(localStorage.getItem("fash_guide_i") || "0", 10) || 0;
let HC_CACHE = {};
let HC_LID = null;
let HC_CACHE_B64 = null;

async function safeApi(path){
 try { const r = await fetch(API + path, { headers: { Authorization: "Bearer " + TOKEN } }); if (!r.ok) return null; return await r.json(); } catch(e){ return null; }
}

const MKT_CARD = {
 "Depop":{
 tags:"#vintage #thrift #y2k #resale #rework #preloved",
 titleMax:80,
 fieldHints:"title · brand · category · size · condition · price · description · up to 5 tags",
 cats:{Tops:"Shirts & Tops",Bottoms:"Trousers & Jeans",Dresses:"Dresses",Outerwear:"Jackets & Coats",Shoes:"Footwear",Accessories:"Accessories"},
 steps:["Install the Depop app and sign up with your email (free).","Tap the + Sell tab — set title, size, price and category from your copied payload.","Add up to 5 product tags — reuse the tags included in the copy helper.","First 10 listings per week are free; a small fee applies after that.","Ship with a Depop label or your own courier, then mark shipped in the app."]
 },
 "eBay":{
 tags:"vintage,thrift,resale,pre-owned",
 titleMax:80,
 fieldHints:"title (≤80) · brand/size/color specifics · condition · fixed price · description + measurements",
 cats:{Tops:"Tops & Shirts",Bottoms:"Jeans & Trousers",Dresses:"Dresses",Outerwear:"Jackets & Coats",Shoes:"Shoes",Accessories:"Accessories"},
 steps:["Go to ebay.com/sell or open the eBay app and register as a seller.","Choose 'List an item' and pick the Clothing category from your payload.","Set the condition, a fixed price, and 1 business-day handling.","Paste your description; add condition notes + measurements for trust.","Offers are enabled by default so buyers can nudge toward your AI-suggested price.","Optional: Connect OAuth in Multilist for API create (sandbox first)."]
 },
 "Poshmark":{
 tags:"",
 titleMax:80,
 fieldHints:"title · Category · Brand · Size · Price · description · 1 strong cover shot",
 cats:{Tops:"Tops",Bottoms:"Bottoms",Dresses:"Dresses",Outerwear:"Outerwear",Shoes:"Shoes",Accessories:"Accessories"},
 steps:["Download Poshmark and sign up — you get a closet URL (posh.mk/…).","Tap + to list: pick Category, Brand, Size and Price from the payload.","Paste the description in, add 1 great cover shot.","Share new items to 'Parties' right after listing for first-day reach.","Sales ship with the flat $7.95 Poshmark label — print from the app."]
 },
 "Mercari":{
 tags:"",
 titleMax:80,
 fieldHints:"title · condition · price · description · brand · size",
 cats:{Tops:"Tops",Bottoms:"Bottoms",Dresses:"Dresses",Outerwear:"Outerwear",Shoes:"Shoes",Accessories:"Accessories"},
 steps:["Install Mercari and verify your phone + payout method in Settings.","Tap the big + to make a listing — choose the condition from your payload.","Paste title + description, set the price from the copy helper.","Mercari suggests a price — compare it with your AI-suggested range.","Leave Smart Pricing off at first; switch it on once you know demand."]
 },
 "Vinted":{
 tags:"",
 titleMax:100,
 fieldHints:"title · EU/INTL size · condition · price · description · app photos",
 cats:{Tops:"Tops",Bottoms:"Bottoms",Dresses:"Dresses",Outerwear:"Outerwear",Shoes:"Shoes",Accessories:"Accessories"},
 steps:["Install Vinted and sign up (EU/INTL sizing is expected).","Upload photos from the app — web upload is limited.","Add size (EU/INTL), condition, and paste the description.","Buyers pay a small protection fee; your price is what you keep.","Enable shipping methods in Settings so orders can be dispatched."]
 },
 "Grailed":{
 tags:"",
 titleMax:80,
 fieldHints:"brand + title · size · measurements · condition · original + asking price · flat-lay photos",
 cats:{Tops:"Tops",Bottoms:"Bottoms",Dresses:"Dresses",Outerwear:"Outerwear",Shoes:"Shoes",Accessories:"Accessories"},
 steps:["Sign up at grailed.com — the menswear-focused marketplace.","Create a listing: include brand + measurements from the payload.","Set an Original (retail) price and your resale price.","Flat-lays on plain backgrounds position best in feed.","Approve offers or run 'List & Promote' after your first sale."]
 },
 "Fashionistas":{
 tags:"",
 cats:{Tops:"Tops",Bottoms:"Bottoms",Dresses:"Dresses",Outerwear:"Outerwear",Shoes:"Shoes",Accessories:"Accessories"},
  steps:["Already done — there is no separate fashionistas.ai shop to set up: your Closet here is the whole thing.","Every item lives in your Closet; listing inside this app saves straight to your own account.","No API needed: your account already holds everything."]
 }
};

function hcAct(label, fn){ return `<button class="btn btn-accent hc-act" style="width:100%" onclick="${fn}" data-tip="Runs this step of the guide." title="Runs this step of the guide.">${label}</button>`; }

function hcMarketStep(mkt){
 const p = MKT_CARD[mkt];
 return {
 id: null,
 title: mkt + " setup",
 sub: "open an account · copy-paste listing",
 render: async ()=>{
 const l = await hcPickListing();
 if (l && !l.fake) HC_LID = l.id;
 let src = "from a demo sample (list your own to use yours)";
 if (l && l.fake && l.unsaved) src = "from your just-scanned item — save it to keep";
 if (l && !l.fake) src = "from your real listing <b>" + escapeHtml(l.title) + "</b>";
 return `
 <p class="mut" style="margin:0 0 4px;text-transform:uppercase;font-size:11px"><b>Opening an account, step by step</b></p>
 <ol class="hc-steps">${p.steps.map(s=>`<li>${s}</li>`).join("")}</ol>
 <p class="mut">When your first item is ready, the <b>copy helper</b> builds the exact content for <b>${mkt}</b> ${src}:</p>
 <div class="two">${hcAct("Copy JSON","hcCopyJson('"+mkt+"')")}${hcAct("Copy CSV","hcCopyCsv('"+mkt+"')")}</div>
 <p class="mut">Paste title/price/size/category into ${mkt}'s list form and the description into the description box. No API keys involved.</p>`;
 }
 };
}

const HC_STEPS = [
 { id:"A", title:"Welcome to fashionistas.ai", sub:"5-minute guided tour",
 render: ()=>`
 <p>fashionistas.ai turns one photo into a finished listing for <b>Poshmark, Mercari, Depop, Vinted, Grailed, eBay, Etsy, Facebook, Vestiaire and Whatnot</b>. Where the shop has no posting API, you press Post in your own tab. Kidizen shut down.</p>
  <p class="mut">It's free for good — no card and nothing to cancel. Ads and affiliate links pay for it. The AI works out of the box with no key or setup.</p>
 <p class="mut">You'll follow A through T, one <b>real</b> action at a time. Tap Next to begin.</p>` },
 { id:"B", title:"Where everything lives", sub:"where you'll work",
 render: ()=>`
 <p>The bottom bar has five places you'll live in:</p>
 <p><b>Home</b> — what's selling and what to do next<br><b>My clothes</b> — everything you're selling<br><b>Photo</b> — take a photo, we write the listing<br><b>Sell</b> — prices, postage, profit<br><b>More</b> — your sales, tips and downloads</p>
 <p class="mut">Go on, tap the tabs — then come back and hit Next.</p>`,
 onShow:()=>{ if (TOKEN) go("home"); } },
 { id:"C", title:"One free account", sub:"30 seconds, no card",
 render: ()=>{
 if (USER) return `<p>You're already in as <b>${escapeHtml(USER.username)}</b> — everything from here is live and saved to your account.</p><p class="mut">Your data and photos are saved to your account. Press Next to keep following along.</p>`;
 return `<p>Every brand-new seller starts here: an account (username · email · password). No credit card — ever.</p>
 ${hcAct("Try the real demo login","hcDemoLogin()")}
 <p class="mut">Or tap <b>Create account</b> under the logo above the form and make your own. Those login/signup buttons are the <b>real</b> ones.</p>`;
 } },
 { id:"D", title:"Your studio", sub:"home screen, live",
 render: ()=>`<p><b>Home</b> shows what you've got for sale, what you've sold, what you've made, and what to do next.</p><p class="mut">Press Next — time to snap your first <b>real</b> item.</p>`,
 onShow:()=>{ if (TOKEN) go("home"); } },
 { id:"E", title:"Snap a photo", sub:"camera or camera roll",
 render: ()=>`
 <p>Every listing starts with one photo of the garment — on a rail, flat on the bed, or on a hanger against a wall.</p>
 ${hcAct("Open the camera","hcCam(true)")}
 ${hcAct("Or upload from your roll","hcCam(false)")}
 <p class="mut">Both call the real photo handler <code>onPhoto()</code> → <code>analyzeImage()</code>, exactly like the Snap tab.</p>`,
 onShow:()=>{ if (TOKEN) go("snap"); } },
 { id:"F", title:"No photo handy?", sub:"real sample image",
 render: ()=>`
 <p>The app ships a <b>real sample photo</b> that flows through the exact same AI vision pipeline:</p>
 ${hcAct("Try the real sample","hcSample()")}
 <p class="mut"><code>identifyItem()</code> loads it, encodes it, and calls the real AI — zero canned previews.</p>` },
 { id:"G", title:"AI identifies it", sub:"live vision run",
 render: async ()=>{
 try {
 const d = await api("/api/ai/analyze", { method:"POST", body: JSON.stringify({ image: await hcSampleB64() }) });
 if (d.source === "error") throw new Error(d.error);
 CURRENT.guide = d;
 return `${hcAct("Run this scan for real →", "identifyItem()")}
 <p class="mut" style="margin:8px 0 0">Or read the live analyzer output from a real sample below — then tap the button to run <code>identifyItem()</code> for real on the Snap screen:</p>
 <div class="hc-live">
 <p style="margin-top:0"><b>${escapeHtml(d.type||"Item")}</b></p>
 <div><span class="pill">${escapeHtml(d.brand||"Unknown brand")}</span><span class="pill">${escapeHtml(d.color||"")}</span><span class="pill">${escapeHtml(condFull(d.condition)||"Good")}</span><span class="pill conf">${d.confidence||0}% confident</span></div>
 <p class="mut" style="margin:8px 0 0">That's the <b>real</b> analyzer output — it suggests <b>${money(d.priceMin)} – ${money(d.priceMax)}</b> resale in <b>${escapeHtml(d.category||"Tops")}</b>.${d.sizeHint?" Likely size: <b>"+escapeHtml(d.sizeHint)+"</b>.":""}</p>
 </div>`;
 } catch(e){
 return `<p class="mut">The live vision call is busy — it runs the moment you snap on the Snap screen. Try the sample there instead:</p>${hcAct("Try sample on Snap","hcSample()")}`;
 }
 } },
 { id:"H", title:"AI price suggestion", sub:"what similar items sold for",
 render: async ()=>{
 try {
 const a = CURRENT.ai || CURRENT.guide || {};
 const d = await api("/api/listings/suggest-price", { method:"POST", body: JSON.stringify({ category:a.category||"Tops", brand:a.brand||"", condition:a.condition||"Good" }) });
 return `<div class="hc-live">
 <div class="three" style="text-align:center">
 <div><b>${money(d.lowPrice)}</b><br><span class="mut">Low</span></div>
 <div><b style="color:var(--accent)">${money(d.suggestedPrice)}</b><br><span class="mut">Suggest</span></div>
 <div><b>${money(d.highPrice)}</b><br><span class="mut">High</span></div>
 </div>
 <p class="mut" style="margin:8px 0 0">Live pricing engine — ${escapeHtml(d.compsNote||"based on comparable sold listings.")}</p>
 </div>`;
 } catch(e){ return `<p class="mut">Pricing AI is busy — you'll see the same suggestion on the Snap result the moment your item is analyzed.</p>`; }
 } },
 { id:"I", title:"The listing form", sub:"real description",
 render: async ()=>{
 const a = Object.assign({}, CURRENT.ai || CURRENT.guide || {}, await hcPickListing());
 const desc = defaultDesc(a);
 return `<p>AI pre-fills the whole listing form — including a description built by the app's own <code>defaultDesc()</code>. Yours looks like:</p>
 <textarea class="input hc-code" rows="5" readonly>${escapeHtml(desc)}</textarea>
 ${hcAct("Open the real listing form","hcListing()")}
 <p class="mut">Title, category, price, size, condition — all ready to tweak and save to your Closet.</p>`;
 } },
 { id:"J", title:"Posting it yourself, the honest way", sub:"you copy and paste",
 render: ()=>`
 <p><b>Listing by hand</b> still works when you want it. Each shop below gets its own package — <b>JSON or CSV</b> your phone can share in seconds.</p>
 <p class="mut">No technical setup. Open a normal seller account and publish — the app builds the exact words for each shop for you.</p>
 <p class="mut"><b>fashionistas.ai</b> is native to this app (no copying) — highlighted a few steps down.</p>` },
 hcMarketStep("Depop"),
 hcMarketStep("eBay"),
 hcMarketStep("Poshmark"),
 hcMarketStep("Mercari"),
 hcMarketStep("Vinted"),
 hcMarketStep("Grailed"),
 { id:"Q", title:"Saved in fashionistas.ai", sub:"stored locally — no copying",
 render: async ()=>{
 const l = await hcPickListing();
 if (!l || l.fake) return `<p class="mut">The draft panel appears on a saved listing. List your first item, then return here — it will already be cued.</p>${hcAct("List an item now","hcCam(true)")}`;
 HC_LID = l.id;
 const d = await safeApi("/api/listings/" + l.id + "/platforms");
 const line = (d && d.platforms && d.platforms.length)
 ? d.platforms.map(p=>`&#8226; ${escapeHtml(platformName(p.platform))}: <span class="tag active">${escapeHtml(p.status||"draft")}</span>`).join("<br>")
 : `<p class="mut" style="margin:0">No draft records yet — the panel below saves them.</p>`;
 return `
 <p>In fashionistas.ai (this app) your item is already <b>stored in your Closet</b>. For other marketplaces you can copy the text and post it yourself:</p>
 ${hcAct("Open the listing panel", "hcCrossPost()")}
 <div class="hc-live">${line}</div>`;
 } },
 { id:"R", title:"Saved & tracked", sub:"draft status",
 render: async ()=>{
 const l = await hcPickListing();
 if (l && !l.fake){
 HC_LID = l.id;
 const d = await safeApi("/api/listings/" + l.id + "/platforms");
 const pstat = (d && d.platforms && d.platforms.length)
 ? d.platforms.map(p=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><b>${escapeHtml(platformName(p.platform))}</b><span class="tag ${escapeHtml((p.status||"draft")==="sold"?"sold":"active")}">${escapeHtml(p.status||"draft")}</span></div>`).join("")
 : `<p class="mut" style="margin:0">Once you've prepared it, each shop shows its status here. Nothing is posted automatically.</p>`;
 return `<p>One press of <b>Sell everywhere</b> posts to each shop you ticked and reports live status for each one:</p><div class="hc-live">${pstat}</div><div class="hc-live"><b style="display:block;margin-bottom:4px">Listing health</b>${qualityBars(l)}</div>`;
 }
  return `<p class="mut">List an item to see its draft status and health score here.</p>${hcAct("List an item","hcCam(true)")}`;
 } },
 { id:"S", title:"Mark sold → profit", sub:"your sales and what you kept",
 render: async ()=>{
 const l = await hcPickListing();
 return `<p>When something sells, tap <b>Mark sold</b>: sold price, platform, fee, shipping, cost of goods — the app computes <b>net profit</b> and files the order automatically.</p>
 ${(l && !l.fake) ? hcAct("See the real Mark-sold form","hcSold()") : ""}
 ${hcAct("Live profit dashboard","hcProfit()")}
 <div style="margin-top:8px">${hcAct("<svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z'/><path d='M9 8.5h6M9 12.5h6'/></svg> — real screen","ordersScreen()")}</div>
 <p class="mut">Your profit is worked out only from sales you've written down.</p>`;
 } },
 { id:"T", title:"You made it — A→Z done", sub:"caught up & exporting",
 render: ()=>`
 <p><b>Welcome to fashionistas.ai.</b> Reopen this tour anytime from the <b>'? Help A→Z'</b> button above the tab bar.</p>
 <p class="mut">Final power move — your data is yours:</p>
 <div class="two">${hcAct("Download my clothes","guideExport('export/inventory.csv')")}${hcAct("<svg class='i16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z'/><path d='M9 8.5h6M9 12.5h6'/></svg> My sales","guideExport('export/orders.csv')")}</div>
 <p class="mut">A plain file straight from your own data — paste it into Sheets or Excel. Happy flipping.</p>` }
];

async function hcPickListing(){
 try { if (!S.listings || !S.listings.length){ const d = await api("/api/listings"); S.listings = d.listings || []; } } catch(e){}
 const l = (S.listings||[]).find(x=>x.status!=="sold") || CURRENT.listing || (S.listings||[])[0];
 if (l) return l;
 const a = Object.assign({}, CURRENT.ai || CURRENT.guide || {});
 if (a.type) return Object.assign({ id:"cur", title:titleCase((a.brand && a.brand!=="Unknown" ? a.brand+" " : "") + (a.type||"Clothing item")), price:a.priceMin, size:a.sizeHint, category:a.category, condition:a.condition, brand:a.brand, color:a.color, sizeHint:a.sizeHint, fake:true, unsaved:true }, a);
 return { id:"demo", title:"Sample: Levi's Trucker Jacket", price:48, size:"M", category:"Outerwear", condition:"Good", brand:"Levi's", color:"Denim blue", sizeHint:"M", fake:true };
}

async function hcBuildPayload(mkt, kind){
 const p = MKT_CARD[mkt] || MKT_CARD["Depop"];
 const l = await hcPickListing();
 const brand = l.brand || "";
 const color = l.color || "";
 const size = l.size || l.sizeHint || "M";
 const cond = l.condition || "Good";
 const price = Number(l.price != null ? l.price : (l.priceMin || 0)) || 0;
 const title = l.title || titleCase((brand && brand!=="Unknown" ? brand+" " : "") + (l.type || "Clothing item"));
 const cat = shopCatPath(l.category, String(p.id || mkt).toLowerCase()) || p.cats[l.category] || l.category || "Tops";
 const desc = defaultDesc(Object.assign({}, l, { brand, color, sizeHint:size, condition:cond }));
 const payload = {
 marketplace: mkt, title, price, size, category:cat, brand, color, condition:cond,
 tags: p.tags,
 description: desc,
 how_to_paste: "Open " + mkt + " → start a new listing → paste title, price and size into the matching fields and the description into the description box. No API key needed."
 };
 if (kind === "csv"){
 const keys = ["marketplace","title","price","size","category","brand","color","condition","tags","description"];
 return keys.join(",") + "\n" + keys.map(k=>'"' + String(payload[k] ?? "").replace(/"/g,'""') + '"').join(",");
 }
 return JSON.stringify(payload, null, 2);
}

async function hcCopyJson(mkt){
 const buf = await hcBuildPayload(mkt, "json");
 try { await copyText(buf); toast(mkt + " JSON copied ✓"); } catch(e){ toast("Copy failed — JSON ready on screen"); }
}
async function hcCopyCsv(mkt){
 const buf = await hcBuildPayload(mkt, "csv");
 try { await copyText(buf); toast(mkt + " CSV copied ✓"); } catch(e){ toast("Copy failed — CSV ready on screen"); }
}

function hcStart(){ hcOpen(HC_I); }
function hcToggle(){ $("#hc-overlay").classList.contains("hidden") ? hcOpen(HC_I) : hcSuspend(); }
function hcOpen(i){
 HC_I = Math.max(0, Math.min(i, HC_STEPS.length - 1));
 $("#hc-overlay").classList.remove("hidden");
 hcRender();
}
function hcSuspend(){ $("#hc-overlay").classList.add("hidden"); }
function hcEnd(){ hcSuspend(); localStorage.setItem(HC_KEY, "1"); toast("Tour complete — ask anytime with '? Help A→Z'"); }
async function hcStep(dir){
 HC_I += dir;
 if (HC_I < 0) return hcSuspend();
 if (HC_I >= HC_STEPS.length) return hcEnd();
 localStorage.setItem("fash_guide_i", HC_I);
 try { if (HC_STEPS[HC_I].onShow) await HC_STEPS[HC_I].onShow(); } catch(e){}
 hcRender();
}
async function hcRender(){
 const st = HC_STEPS[HC_I];
 $("#hc-letter").textContent = st.id || (HC_I + 10).toString(36).toUpperCase();
 $("#hc-title").textContent = st.title;
 $("#hc-sub").innerHTML = st.sub ? `<span class="tag active">${escapeHtml(st.sub)}</span>` : "";
 $("#hc-dots").innerHTML = HC_STEPS.map((s,i)=>`<i class="hc-dot ${i===HC_I?"on":""}"></i>`).join("");
 $("#hc-back").innerHTML = HC_I === 0 ? "Close" : "← Back";
 $("#hc-next").textContent = HC_I === HC_STEPS.length - 1 ? "Finish ✓" : "Next →";
 const body = $("#hc-body");
 body.innerHTML = `<div class="card" style="margin:6px 0"><div class="spinner"></div></div>`;
 try {
 let html = HC_CACHE[HC_I];
 if (html == null){ html = await st.render(); HC_CACHE[HC_I] = html; }
 body.innerHTML = html;
 } catch(e){ body.innerHTML = `<p class="mut">This step hit a snag — tap Next to continue the tour.</p>`; }
}

async function hcDemoLogin(){ hcSuspend(); await demoLogin(); toast("Signed in as demo — tap '? Help A→Z' to resume"); }
function hcCam(cam){
 if (!TOKEN) return toast("Create your account first (step C) — then snap");
 hcSuspend();
 go("snap");
 setTimeout(()=>{ const f = $("#file"); if (!f) return toast("Snap screen isn't ready yet"); if (!cam) f.removeAttribute("capture"); f.click(); }, 350);
}
function hcSample(){
 if (!TOKEN) return toast("Create your account first (step C) — then try the sample");
 hcSuspend(); identifyItem();
}
function hcListing(){
 hcSuspend();
 if (CURRENT.ai) return toListingForm();
 go("snap"); toast("Snap an item first — the AI result opens the listing form");
}
function hcCrossPost(){
 if (!HC_LID) return toast("List an item first — the panel appears on its detail screen");
 hcSuspend(); openListing(HC_LID); toast("Tick shops → Sell everywhere. With the extension: queued → posting → posted. Without it: paste kits open — nothing is marked Posted until you confirm or the extension reports it.");
}
async function hcSold(){
 if (!HC_LID) return toast("Need a real listing first");
 await loadMarketplaces();
 hcSuspend(); soldSheet(HC_LID);
}
function hcProfit(){ hcSuspend(); profitScreen(); }
async function guideExport(p){
 hcSuspend();
 try {
 const r = await fetch(API + "/api/" + p, { headers: { Authorization: "Bearer " + TOKEN } });
 const t = await r.text();
 try { await copyText(t); toast("Real CSV copied — paste into Sheets/Excel ✓"); }
 catch(e){ window.open(API + "/api/" + p, "_blank"); }
 } catch(e){ toast("Download failed"); }
 return false;
}
async function hcSampleB64(){
 if (HC_CACHE_B64) return HC_CACHE_B64;
 const url = "sample-jacket.jpg";
 const img = new Image();
 img.crossOrigin = "anonymous";
 await new Promise((res, rej)=>{ img.onload = res; img.onerror = () => rej(new Error("sample unreachable")); img.src = url; });
 const c = document.createElement("canvas");
 c.width = img.width; c.height = img.height;
 c.getContext("2d").drawImage(img, 0, 0);
 const b64 = c.toDataURL("image/jpeg", .85).split(",")[1];
 HC_CACHE_B64 = b64;
 return b64;
}

/* ================= boot ================= */
function authTab(which){
 const login = which === "login";
 $("#auth-login").classList.toggle("hidden", !login);
 $("#auth-signup").classList.toggle("hidden", login);
 document.querySelectorAll("#view-auth .chip").forEach(c=>c.classList.toggle("on", c.id === "auth-tab-" + (login?"login":"signup")));
}
document.querySelectorAll("#auth-tab-login,#auth-tab-signup").forEach(b=>b.onclick=()=>authTab(b.id==="auth-tab-login"?"login":"signup"));
/* ================= MOTION THAT RE-ARMS ON EVERY RENDER =================
   Screens are rebuilt with innerHTML, so anything set up once at load is
   lost the first time you navigate. A MutationObserver re-runs the hook
   after every paint: count-up numbers, scroll reveals, hover tips.      */
(function(){
  const scr = document.getElementById("screen");
  if (!scr) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let IO = null;
  if (!reduce && "IntersectionObserver" in window){
    IO = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add("in"); IO.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: "0px 0px -30px 0px" });
  }
  function scan(root){
    const els = root.querySelectorAll(".reveal:not(.in)");
    if (!els.length) return;
    if (!IO){ els.forEach(function(el){ el.classList.add("in"); }); return; }
    els.forEach(function(el){ IO.observe(el); });
  }
  let t = null, ft = null;
  function freshen(){
    scr.classList.add("fresh");
    if (ft) clearTimeout(ft);
    ft = setTimeout(function(){ scr.classList.remove("fresh"); }, 950);
  }
  function run(){
    t = null;
    try { countUp(scr); } catch(e){ console.error("countUp", e); }
    try { scan(scr); } catch(e){ console.error("reveal", e); }
    try { refreshTips(); } catch(e){}
  }
  function schedule(){ if (t) clearTimeout(t); t = setTimeout(run, 50); }
  if ("MutationObserver" in window){
    new MutationObserver(function(muts){
      /* Ignore the seller-coach banner and our own count-up text writes —
         they are not a new screen and must not re-trigger this hook. */
      const coach = function(n){ return n && n.nodeType === 1 && n.id === "seller-coach-banner"; };
      muts = muts.filter(function(m){
        if (m.type === "characterData") return false;
        const nodes = [].slice.call(m.addedNodes).concat([].slice.call(m.removedNodes));
        if (nodes.length && nodes.every(function(n){ return coach(n) || n.nodeType === 3; })) return false;
        if (m.target && m.target.closest && m.target.closest("#seller-coach-banner,[data-count]")) return false;
        return true;
      });
      if (!muts.length) return;
      // Only a swapped-out screen re-runs the entrance; a filter that just
      // rewrites a grid must not re-animate the whole page under the user.
      if (muts.some(function(m){ return m.target === scr; })) freshen();
      schedule();
    }).observe(scr, { childList: true, subtree: true });
  }
  freshen();
  run();

  // Spotlight that tracks the pointer across a card (fine pointers only).
  if (window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches){
    document.addEventListener("pointermove", function(e){
      const c = e.target && e.target.closest ? e.target.closest("#screen .card, #screen .ps-card, #screen .xl-cta") : null;
      if (!c) return;
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      c.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
      c.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
    }, { passive: true });
  }
})();

navBuild();
/* Deep links: /shop/<id> opens that listing — logged in or not. A buyer
   following a shared link, a search result or a sitemap entry lands on the
   item itself, never on the sign-in screen. */
function itemFromPath(){
  const m = (location.pathname || "").match(/^\/shop\/(\d+)\/?$/);
  return m ? Number(m[1]) : 0;
}
function routePath(){
  const id = itemFromPath();
  if (id){ enterBrowse("shop"); openMarketItem(id, { url: "replace" }); return true; }
  if ((location.pathname || "").replace(/\/$/, "") === "/shop"){ enterBrowse("shop"); return true; }
  if (/^\/shop\/[cb]\//.test(location.pathname || "")){ if (window.__FASH_CAT__) S.marketCat = window.__FASH_CAT__; enterBrowse("shop"); setTimeout(marketUrlSync, 50); setTimeout(marketUrlSync, 900); return true; }
  return false;
}
function homeOrAuth(){
  if (TOKEN && USER) { $("#view-auth").classList.add("hidden"); $("#view-app").classList.remove("hidden"); $("#tabbar").classList.remove("hidden"); $("#guide-fab").classList.remove("hidden"); go("home"); }
  else { $("#view-auth").classList.remove("hidden"); $("#view-app").classList.add("hidden"); $("#tabbar").classList.add("hidden"); $("#guide-fab").classList.add("hidden"); authTab("login"); }
}
window.addEventListener("popstate", function(){
  if (routePath()) return;
  const p = (location.pathname || "").replace(/\/$/, "");
  if (p === "") homeOrAuth();
});
if (!routePath()) homeOrAuth();
syncSessionChrome();
function openFromHash(){
  var openHash = (location.hash || "").replace("#", "");
  if (openHash === "login" || openHash === "signup") { if (!TOKEN) showAuth(openHash === "signup" ? "signup" : "login"); return; }
  if (openHash === "shop" || openHash === "sell") enterBrowse(openHash);
}
window.addEventListener("hashchange", openFromHash);
setTimeout(openFromHash, 0);

/* ================= motion & polish ================= */
(function(){
 var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 // SMIL inside the inline wordmark is not covered by CSS: pause it for reduced motion
 if (reduce) document.querySelectorAll("svg.wm-art").forEach(function(s){ try{ if (s.pauseAnimations) s.pauseAnimations(); }catch(e){} });
 // duplicate the marketplace track so the marquee loop is seamless
 document.querySelectorAll(".dest-track").forEach(function(t){ t.innerHTML = t.innerHTML + t.innerHTML; });
 countUp(document);

 // animated headline word
 var WORDS = ["One photo.","In the shop.","Try it on."];
 var wi = 0, w = document.getElementById("rot-word");
 if (w && !reduce){
 setInterval(function(){
 w.classList.add("out");
 setTimeout(function(){
 wi = (wi + 1) % WORDS.length;
 w.textContent = WORDS[wi];
 w.classList.remove("out");
 }, 380);
 }, 2800);
 }

 // scroll reveals
 var els = document.querySelectorAll(".reveal");
 if (!els.length) return;
 if (!("IntersectionObserver" in window) || reduce){
 els.forEach(function(el){ el.classList.add("in"); });
 return;
 }
 var io = new IntersectionObserver(function(entries){
 entries.forEach(function(e){
 if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); }
 });
 }, { threshold: .15, rootMargin: "0px 0px -40px 0px" });
 els.forEach(function(el){ io.observe(el); });
})();

/* ================= PLAIN-ENGLISH HOVER TIPS =================
   Hover (or keyboard-focus) anything carrying [data-tip] and one short
   plain sentence appears in a fixed bubble appended to <body>, so it can
   never be clipped by a scrolling container. Touch devices have no hover:
   there the same sentence is handed to the native title attribute.       */
(function(){
 var CAN_HOVER = !!(window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches);
 function nodes(root){
   var out = [];
   if (!root) return out;
   if (root.nodeType === 1 && root.hasAttribute("data-tip")) out.push(root);
   if (root.querySelectorAll) out = out.concat([].slice.call(root.querySelectorAll("[data-tip]")));
   return out;
 }
  function syncTips(root){
    nodes(root).forEach(function(el){
      var tip = el.getAttribute("data-tip");
      if (!tip) return;
      if (!CAN_HOVER){ if (el.getAttribute("title") !== tip) el.setAttribute("title", tip); return; }
      // hover devices get the bubble instead of a second, delayed native one
      if (el.hasAttribute("title")) el.removeAttribute("title");
      if (!el.getAttribute("aria-label") && !(el.textContent || "").trim()) el.setAttribute("aria-label", tip);
    });
  }
  try{ window.syncTips = syncTips; }catch(e){}
 function watch(root){
   if (!window.MutationObserver) return;
   new MutationObserver(function(muts){
     muts.forEach(function(m){
       [].slice.call(m.addedNodes).forEach(function(n){ if (n.nodeType === 1) syncTips(n); });
     });
   }).observe(root, { childList: true, subtree: true });
 }
 syncTips(document);
 watch(document.body || document.documentElement);
 if (!CAN_HOVER) return; // touch: title attributes only, no bubble

 var bubble = null, current = null;
 function ensure(){
   if (!bubble){
     bubble = document.createElement("div");
     bubble.id = "tip-bubble";
     bubble.setAttribute("role", "tooltip");
     bubble.setAttribute("aria-hidden", "true");
     document.body.appendChild(bubble);
   }
   return bubble;
 }
 function show(el){
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
 function hide(){ current = null; if (bubble) bubble.classList.remove("on"); }
 // A screen change removes the hovered element without any mouseout, which
 // left the bubble stuck on screen; drop it as soon as its anchor is gone.
 new MutationObserver(function(){ if (current && !document.body.contains(current)) hide(); })
   .observe(document.body, { childList: true, subtree: true });
 function target(e){
   var n = e.target;
   return (n && n.nodeType === 1 && n.closest) ? n.closest("[data-tip]") : null;
 }
 document.addEventListener("mouseover", function(e){
   var el = target(e);
   if (el){ if (el !== current) show(el); return; }
   if (current && !current.contains(e.target)) hide();
 });
 document.addEventListener("mouseout", function(e){
   if (current && !current.contains(e.relatedTarget)) hide();
 });
 document.addEventListener("focusin", function(e){ var el = target(e); if (el) show(el); });
 document.addEventListener("focusout", hide);
 document.addEventListener("pointerdown", hide);
 window.addEventListener("scroll", hide, true);
 window.addEventListener("resize", hide);
})();
