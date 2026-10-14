// Runs on the fashionistas.ai seller board. Announces the extension and relays jobs. Never reads passwords.
document.documentElement.dataset.faExt = chrome.runtime.getManifest().version;
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || typeof e.data.type !== "string" || !e.data.type.startsWith("FA_")) return;
  if (e.data.type === "FA_TOKEN") { chrome.runtime.sendMessage({ type: "token", token: e.data.token, origin: location.origin }); return; }
  if (e.data.type === "FA_POST" || e.data.type === "FA_DELIST") chrome.runtime.sendMessage({ type: e.data.type, job: e.data.job, origin: location.origin }, (r) => window.postMessage({ type: "FA_ACK", ok: !!(r && r.ok), error: r && r.error }, "*"));
});
chrome.runtime.onMessage.addListener((m) => { if (m && m.type === "FA_PROGRESS") window.postMessage(m, "*"); });
