import { SITES, LOGIN_RE } from "./sites.js";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (k) => chrome.storage.local.get(k);
async function report(origin, token, listing_id, platform, status, url) {
  if (!token) return false;
  const r = await fetch(origin + "/api/crosslist/status", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ listing_id, platform, status, url: url || "" }) }).catch(() => null);
  return !!(r && r.ok);
}
async function photosAsData(urls) {
  const out = [];
  for (const u of (urls || []).slice(0, 8)) { try { const b = await (await fetch(u)).blob(); out.push({ dataUrl: await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }) }); } catch {} }
  return out;
}
function waitLoaded(tabId) { return new Promise((res) => { const f = (id, info) => { if (id === tabId && info.status === "complete") { chrome.tabs.onUpdated.removeListener(f); res(); } }; chrome.tabs.onUpdated.addListener(f); setTimeout(res, 30000); }); }
function watchListed(tabId, re, ms) { return new Promise((res) => { const f = (id, info, tab) => { const u = info.url || (tab && tab.url) || ""; if (id === tabId && re.test(u)) { chrome.tabs.onUpdated.removeListener(f); res(u.match(re)[0].replace(/^(?!https)/, "https://")); } }; chrome.tabs.onUpdated.addListener(f); setTimeout(() => { chrome.tabs.onUpdated.removeListener(f); res(null); }, ms); }); }
async function runPost(job, origin, sender) {
  const { token, autoSubmit, accepted } = await get(["token", "autoSubmit", "accepted"]);
  if (!accepted) return { ok: false, error: "needs_consent" };
  const item = { ...job.item, photos: await photosAsData(job.item.photos) };
  (async () => {
    for (const id of job.sites) {
      const s = SITES[id]; if (!s) continue;
      chrome.tabs.sendMessage(sender.tab.id, { type: "FA_PROGRESS", site: id, step: "opening" }).catch(() => {});
      const tab = await chrome.tabs.create({ url: s.sell, active: true }); await waitLoaded(tab.id); await sleep(2500 + Math.random() * 1500);
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["fill.js"] });
      const [{ result: rep } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (spec, it, o) => window.__faFill(spec, it, o), args: [{ ...s, listed: undefined }, item, { autoSubmit: !!autoSubmit }] }).catch(() => [{}]);
      chrome.tabs.sendMessage(sender.tab.id, { type: "FA_PROGRESS", site: id, step: "filled", rep }).catch(() => {});
      // seller reviews and submits (or auto-submit did); capture the listing URL when the tab lands on it
      const url = await watchListed(tab.id, s.listed, autoSubmit ? 120000 : 15 * 60000);
      if (url) await report(origin, token, job.item.id, id, "listed", url);
      chrome.tabs.sendMessage(sender.tab.id, { type: "FA_PROGRESS", site: id, step: url ? "listed" : "no-url", url }).catch(() => {});
      await sleep(1500 + Math.random() * 2500);
    }
  })();
  return { ok: true };
}
async function runDelist(job) {
  const { accepted } = await get(["accepted"]); if (!accepted) return { ok: false, error: "accept the warning first" };
  (async () => { for (const [id, url] of Object.entries(job.urls || {})) { const s = SITES[id]; if (!s || !/^https:\/\//.test(url)) continue;
    const tab = await chrome.tabs.create({ url, active: false }); await waitLoaded(tab.id); await sleep(2000);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["fill.js"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (spec) => window.__faDelist(spec), args: [{ delist: s.delist }] }).catch(() => {});
    await sleep(2000 + Math.random() * 2000); } })();
  return { ok: true };
}
// Session detection: request each sell page with the seller's own cookies (host permissions) and see
// whether the site bounces to a login page. Reads only the final URL/status — never cookies' values, never passwords.
// A sell page can render 200 for signed-out visitors (client-side apps), so a 200 alone proves nothing.
// Step 1: request with the seller's cookies — a bounce to a login URL = logged out.
// Step 2: otherwise load the page in a background, unfocused window and look at the rendered DOM:
//   a visible password field or "Log in / Sign up" control = logged out; a visible account/avatar/sign-out control = connected;
//   anything else (bot challenge, empty shell) = unknown, shown to the seller as "Log in" — never a false "Connected".
// Never reads cookie values, never reads or stores passwords.
let probeWin = null;
async function probeWindow() {
  if (probeWin) { try { await chrome.windows.get(probeWin); return probeWin; } catch (e) { probeWin = null; } }
  const w = await chrome.windows.create({ url: "about:blank", focused: false, state: "minimized" }); probeWin = w.id; return probeWin;
}
async function domProbe(s) {
  const win = await probeWindow();
  const tab = await chrome.tabs.create({ windowId: win, url: s.check || s.sell, active: false });
  try {
    await waitLoaded(tab.id); await sleep(3500);
    const t = await chrome.tabs.get(tab.id); if (LOGIN_RE.test(t.url || "")) return "logged_out";
    const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const vis = (e) => e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      if ([...document.querySelectorAll('input[type="password"]')].some(vis)) return "logged_out";
      const re = /^(log ?in|sign ?in|sign ?up|join|join now|log in or sign up|create account|register)$/i;
      if ([...document.querySelectorAll('a,button,[role="button"]')].some((x) => vis(x) && re.test((x.textContent || x.getAttribute("aria-label") || "").trim()))) return "logged_out";
      // Positive evidence only: an account/avatar/sign-out control. Challenge pages and empty shells stay "unknown".
      if (/just a moment|attention required|access denied|captcha/i.test(document.title)) return "unknown";
      const pos = /(log ?out|sign ?out|my account|my profile|your profile|your account|account menu|avatar|my closet|my shop|seller hub|my listings)/i;
      if ([...document.querySelectorAll('a,button,img,[role="button"],[aria-label]')].some((x) => vis(x) && (pos.test(x.getAttribute("aria-label") || "") || pos.test(x.getAttribute("alt") || "") || pos.test((x.textContent || "").trim().slice(0, 40)) || /logout|signout|sign_out|log_out/i.test(x.getAttribute("href") || "")))) return "connected";
      return "unknown";
    } }).catch(() => [{ result: "unknown" }]);
    return result || "unknown";
  } finally { chrome.tabs.remove(tab.id).catch(() => {}); }
}
async function checkOne(id) {
  const s = SITES[id]; if (!s) return { id, state: "unknown" };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(s.check || s.sell, { credentials: "include", redirect: "follow", signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (r.status === 401 || LOGIN_RE.test(r.url)) return { id, state: "logged_out", how: "redirect" };
  } catch (e) { /* fall through to DOM probe */ }
  try { return { id, state: await domProbe(s), how: "dom" }; } catch (e) { return { id, state: "unknown" }; }
}
async function checkAll(ids, tabId) {
  const list = (ids && ids.length ? ids : Object.keys(SITES)).filter((i) => SITES[i]); const out = {}; let i = 0;
  const worker = async () => { while (i < list.length) { const id = list[i++]; const x = await checkOne(id); out[id] = x; if (tabId) chrome.tabs.sendMessage(tabId, { type: "FA_SESSIONS", sessions: { [id]: x }, partial: true }).catch(() => {}); } };
  await Promise.all([worker(), worker(), worker()]);
  if (probeWin) { chrome.windows.remove(probeWin).catch(() => {}); probeWin = null; }
  await chrome.storage.local.set({ sessions: out, sessionsAt: Date.now() }); return out;
}
// "Log in": open the marketplace login in a new tab; re-check when the seller closes it or lands back off the login page.
function openLogin(id, sender) {
  const s = SITES[id]; if (!s) return;
  chrome.tabs.create({ url: s.login || s.sell, active: true }).then((tab) => {
    const done = async () => { chrome.tabs.onRemoved.removeListener(onRm); chrome.tabs.onUpdated.removeListener(onUp); const r = await checkOne(id); if (sender.tab) chrome.tabs.sendMessage(sender.tab.id, { type: "FA_SESSIONS", sessions: { [id]: r } }).catch(() => {}); };
    const onRm = (tid) => { if (tid === tab.id) done(); };
    const onUp = async (tid, info, t) => { if (tid !== tab.id || info.status !== "complete") return; const u = (t && t.url) || ""; if (u && !LOGIN_RE.test(u) && new URL(u).host.endsWith(new URL(s.sell).host.replace(/^www\./, ""))) { const r = await checkOne(id); if (r.state === "connected") { chrome.tabs.onRemoved.removeListener(onRm); chrome.tabs.onUpdated.removeListener(onUp); if (sender.tab) chrome.tabs.sendMessage(sender.tab.id, { type: "FA_SESSIONS", sessions: { [id]: r } }).catch(() => {}); } } };
    chrome.tabs.onRemoved.addListener(onRm); chrome.tabs.onUpdated.addListener(onUp);
  });
}
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.type === "FA_CHECK") { checkAll(m.sites, sender.tab && sender.tab.id).then((sessions) => reply({ ok: true, sessions })); return true; }
  if (m.type === "FA_ACCEPT") { chrome.storage.local.set({ accepted: true }).then(() => reply({ ok: true })); return true; }
  if (m.type === "FA_OPEN_LOGIN") { openLogin(m.site, sender); reply({ ok: true }); return; }
  if (m.type === "FA_SITES") { reply({ ok: true, sites: Object.keys(SITES) }); return; }
  if (m.type === "token" && m.token) { chrome.storage.local.set({ token: m.token, origin: m.origin }); return; }
  if (m.type === "FA_POST") { runPost(m.job, m.origin, sender).then(reply); return true; }
  if (m.type === "FA_DELIST") { runDelist(m.job).then(reply); return true; }
});
