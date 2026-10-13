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
const clean = (v) => { v = String(v || "").trim(); return v && !/^(n\/?a|none|not visible|unknown|-)$/i.test(v) ? v : ""; };
function tile(m, i) {
  const sub = [m.size, m.condition].map(clean).filter(Boolean).join(" · ");
  const img = `<img ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} src="${e(m.photo_url)}" alt="" onerror="this.remove()">`;
  return `<div class="ux-tile" style="--gi:${i}"><a class="ux-tile-open" href="/shop/${Number(m.id)}"><span class="ux-tile-img">${img}</span>` +
    `<span class="ux-tile-p">${money(m.price)}</span><span class="ux-tile-t">${e(m.title || "Untitled")}</span>` +
    (sub ? `<span class="ux-tile-s">${e(sub)}</span>` : "") + `</a></div>`;
}
export function shopScreen(market) {
  const rows = (market || []).filter((m) => !isJunk(m)).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  const chip = (l, on) => `<button type="button" class="chip${on ? " on" : ""}" aria-pressed="${on}">${e(l)}</button>`;
  const other = rows.some((m) => !DEPTS.includes(String(m.category || "").split("/")[0]));
  return `<div class="closet-tools ux-search"><input class="input" id="ssr-q" placeholder="Search brand, size, or item" aria-label="Search brand, size, or item" style="margin:0">` +
    `<select class="input" aria-label="Sort" style="margin:0"><option>Newest</option></select></div>` +
    `<div><div class="chips" aria-label="Find">${chip("All", true)}${DEPTS.map((d) => chip(d, false)).join("")}${other ? chip("Other", false) : ""}</div></div>` +
    `<p class="mut" style="margin:2px 0 8px">${rows.length ? rows.length + (rows.length === 1 ? " item" : " items") : ""}</p>` +
    `<div class="grid">${rows.map(tile).join("")}</div>`;
}
export function itemScreen(m) {
  return `<div class="ux-item"><a class="ux-back" href="/shop" aria-label="Back to Shop"><svg class='i20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M15 5l-7 7 7 7'/></svg></a>` +
    (m.photo_url ? `<div class="ux-item-img"><img src="${e(m.photo_url)}" alt="${e(m.title || "")}" fetchpriority="high"></div>` : "") +
    `<div class="ux-item-body"><div class="ux-item-price">${money(m.price)}</div><p class="ux-item-title" style="font-weight:800">${e(m.title || "Untitled")}</p></div></div>`;
}
/** Show the app view (not the landing) and drop the prerendered screen into it. */
export function prerenderInto(html, title, screen) {
  return String(html)
    .replace(/<html([^>]*)>/i, (m0, a) => /class="/.test(a) ? m0.replace(/class="/, 'class="mt-app h-app ') : `<html${a} class="mt-app h-app">`)
    .replace(/(<section id="view-auth" class="hidden">)<script>[\s\S]*?<\/script>/, "$1")
    .replace('<section id="view-app" class="hidden">', '<section id="view-app">')
    .replace('<h2 id="view-title">Closet</h2>', `<h2 id="view-title">${e(title)}</h2>`)
    .replace('<div id="screen"></div>', `<div id="screen">${screen}</div>`);
}
