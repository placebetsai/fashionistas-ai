import { SITES } from "./sites.js";
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
  if (!accepted) { chrome.runtime.openOptionsPage(); return { ok: false, error: "Open the extension settings and accept the warning first" }; }
  const item = { ...job.item, photos: await photosAsData(job.item.photos) };
  (async () => {
    for (const id of job.sites) {
      const s = SITES[id]; if (!s) continue;
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
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.type === "token" && m.token) { chrome.storage.local.set({ token: m.token, origin: m.origin }); return; }
  if (m.type === "FA_POST") { runPost(m.job, m.origin, sender).then(reply); return true; }
  if (m.type === "FA_DELIST") { runDelist(m.job).then(reply); return true; }
});
