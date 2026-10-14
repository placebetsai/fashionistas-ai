/**
 * Speed: server-rendered first paint for /shop and /shop/<id>.
 *
 * The app used to paint these pages only after the deferred 325 KB bundle ran
 * and fetched /w/api/market, so phones saw a blank page for seconds. This
 * renders the same markup the app's renderShop()/marketCard() and the top of
 * the item view produce (same classes, same order: id desc, junk rows hidden),
 * shows #view-app straight away, and lets the app re-render on top. Keep it in
 * step with assets/app.*.js if those templates change.
 */
const DEPTS = ["Women", "Men", "Kids", "Home", "Art"];
const e = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => { n = Number(n) || 0; return "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }); };
export function isJunk(m) {
  if (!m || !m.photo_url) return true;
  const t = String(m.title || "").toLowerCase();
  if (!t.trim()) return true;
  if (/\b(qa|test|bulk|dummy|asdf|lorem|sample listing|verify crosspost|category proof)\b/i.test(t)) return true;
  if (/^qa\b/i.test(t) || /\bqa\s*v?\d/i.test(t)) return true;
  if (/bulk\s*[ab0-9]/i.test(t)) return true;
  return false;
}
const IMG_RE = /^https:\/\/fashionistas-api\.fashionistas1979\.workers\.dev\/api\/images\/(u\/\d+\/[\w.\-]+)$/;
/** Same attributes as thumbAttrs() in the app bundle: WebP thumbs from /img/<w>/<key>. */
export function thumbAttrs(u, sizes) {
  const m = IMG_RE.exec(String(u || ""));
  if (!m) return `src="${e(u)}"`;
  const k = m[1];
  return `src="/img/480/${k}" srcset="/img/240/${k} 240w, /img/480/${k} 480w, /img/800/${k} 800w" sizes="${sizes}"`;
}
export function thumbPreload(u, sizes) {
  const m = IMG_RE.exec(String(u || ""));
  if (!m) return u ? `<link rel="preload" as="image" href="${e(u)}" fetchpriority="high">` : "";
  const k = m[1];
  return `<link rel="preload" as="image" href="/img/480/${k}" imagesrcset="/img/240/${k} 240w, /img/480/${k} 480w, /img/800/${k} 800w" imagesizes="${sizes}" fetchpriority="high">`;
}
export const TILE_SIZES = "(max-width:640px) 50vw, 240px", ITEM_SIZES = "(max-width:640px) 100vw, 560px";
const clean = (v) => { v = String(v || "").trim(); return v && !/^(n\/?a|none|not visible|unknown|-)$/i.test(v) ? v : ""; };
function tile(m, i) {
  const sub = [m.size, m.condition].map(clean).filter(Boolean).join(" · ");
  const img = `<img ${i === 0 ? 'fetchpriority="high"' : i < 4 ? "" : 'loading="lazy"'} ${thumbAttrs(m.photo_url, TILE_SIZES)} alt="" onerror="this.remove()">`;
  return `<div class="ux-tile" style="--gi:${i}"><a class="ux-tile-open" href="/shop/${Number(m.id)}"><span class="ux-tile-img">${img}</span>` +
    `<span class="ux-tile-p">${money(m.price)}</span><span class="ux-tile-t">${e(m.title || "Untitled")}</span>` +
    (sub ? `<span class="ux-tile-s">${e(sub)}</span>` : "") + `</a>` +
    (m.photo_url && /^(women|men|kids)/i.test(String(m.category || "")) ? `<a class="ux-tile-try" href="/try-on/?item=${encodeURIComponent(m.photo_url)}&title=${encodeURIComponent(String(m.title || "").slice(0, 80))}" aria-label="Try it on: ${e(m.title || "this item")}">Try it on</a>` : "") + `</div>`;
}
export function shopScreen(market) {
  const rows = (market || []).filter((m) => !isJunk(m)).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  const chip = (l, on) => `<button type="button" class="chip${on ? " on" : ""}" aria-pressed="${on}">${e(l)}</button>`;
  const other = rows.some((m) => !DEPTS.includes(String(m.category || "").split("/")[0]));
  return `<div class="closet-tools ux-search"><input class="input" id="ssr-q" placeholder="Search brand, size, or item" aria-label="Search brand, size, or item" style="margin:0">` +
    `<select class="input" aria-label="Sort" style="margin:0"><option>Newest</option></select></div>` +
    `<div id="market-nav"><div class="chips" id="market-subs" aria-label="Find">${chip("All", true)}${DEPTS.map((d) => chip(d, false)).join("")}${other ? chip("Other", false) : ""}</div></div>` +
    `<p class="mut" id="market-count" style="margin:2px 0 8px">${rows.length ? rows.length + (rows.length === 1 ? " item" : " items") : ""}</p>` +
    `<div class="grid" id="market-grid" data-ssr="${rows.map((m) => Number(m.id)).join(",")}">${rows.map(tile).join("")}</div>`;
}
export function itemScreen(m) {
  return `<div class="ux-item"><a class="ux-back" href="/shop" aria-label="Back to Shop"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M15 5l-7 7 7 7'/></svg></a>` +
    (m.photo_url ? `<div class="ux-item-img"><img ${thumbAttrs(m.photo_url, ITEM_SIZES)} alt="${e(m.title || "")}" fetchpriority="high"></div>` : "") +
    `<div class="ux-item-body"><div class="ux-item-price">${money(m.price)}</div><p class="ux-item-title" style="font-weight:800">${e(m.title || "Untitled")}</p></div></div>`;
}
/** Show the app view (not the landing) and drop the prerendered screen into it. */
export function prerenderInto(html, title, screen) {
  return lateScripts(html)
    .replace(/<html([^>]*)>/i, (m0, a) => /class="/.test(a) ? m0.replace(/class="/, 'class="mt-app h-app ') : `<html${a} class="mt-app h-app">`)
    .replace(/(<section id="view-auth" class="hidden">)<script>[\s\S]*?<\/script>/, "$1")
    .replace('<section id="view-app" class="hidden">', '<section id="view-app">')
    .replace('<h2 id="view-title">Closet</h2>', `<h2 id="view-title">${e(title)}</h2>`)
    .replace('<div id="screen"></div>', `<div id="screen">${screen}</div>`);
}

/**
 * Speed (route split): /shop and /shop/<id> are already painted by the server,
 * so the app scripts are not needed for first paint. They load in their
 * original order once the page has loaded (or on the first tap/key), instead of
 * competing with the first paint. The scripts were written for `defer`, so while
 * they load late a DOMContentLoaded/load listener they add runs right away.
 */
export function lateScripts(html, opts) {
  const home = !!(opts && opts.home);
  const s = String(html);
  const a = s.indexOf('<script src="/assets/categories.js');
  const endTag = '<script src="/mobile-nav.js?v=5" defer></script>';
  const b = s.indexOf(endTag);
  if (a < 0 || b < a) return s;
  const block = s.slice(a, b + endTag.length);
  const srcs = [...block.matchAll(/<script src="([^"]+)" defer><\/script>|<script type="module">\s*import \* as IdentifyFill from "([^"]+)";[\s\S]*?<\/script>/g)]
    .map((m) => (m[1] ? { s: m[1] } : { m: m[2] }));
  /* Tap replay: until the app has booted, a click on a button/chip/[onclick]
     (not a plain link, which navigates fine on its own) is held, the app load
     starts at once, and the same element is clicked again when it is ready. */
  const loader = `<script>(function(){var L=${JSON.stringify(srcs)},go=false,ready=false,held=null,d=document,w=window,H=${home};
function start(){if(go)return;go=true;var ae=d.addEventListener,we=w.addEventListener;
d.addEventListener=function(t,f){if(t==="DOMContentLoaded"){setTimeout(f,0);return}return ae.apply(this,arguments)};
w.addEventListener=function(t,f){if(t==="load"&&d.readyState==="complete"){setTimeout(f,0);return}return we.apply(this,arguments)};
var i=0;(function next(){if(i>=L.length){d.addEventListener=ae;w.addEventListener=we;setTimeout(function(){ready=true;w.__FASH_READY__=true;if(held&&held.isConnected)held.click();held=null},30);return}var x=L[i++];
if(x.m){import(x.m).then(function(M){w.IdentifyFill=M}).catch(function(){}).then(next);return}
var e=d.createElement("script");e.src=x.s;e.async=false;e.onload=e.onerror=next;d.body.appendChild(e)})()}
addEventListener("click",function(ev){if(ready)return;var t=ev.target&&ev.target.closest&&ev.target.closest("button,[onclick],[role=button]");
if(!t)return;ev.preventDefault();ev.stopImmediatePropagation();held=t;start()},true);
["pointerdown","keydown","touchstart"].forEach(function(t){addEventListener(t,start,{once:true,capture:true,passive:true})});
var now=H&&(location.search||location.hash||(function(){try{return localStorage.getItem("fash_token")}catch(e){}})());
function later(){requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(function(){if(w.requestIdleCallback)requestIdleCallback(start,{timeout:H?2500:1500});else start()},0)})})}
if(now)start();else if(d.readyState==="complete")later();else addEventListener("load",later,{once:true});})();</script>`;
  return s.slice(0, a) + loader + s.slice(b + endTag.length);
}
