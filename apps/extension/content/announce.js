// announce.js — runs on fashionistas.ai and tells the page this extension
// exists. This is what removes the "paste the extension ID" step: the page no
// longer has to guess or ask, it learns the live ID from us directly.
//
// It only ever publishes chrome.runtime.id. No cookies, no tokens, no shop
// data — the ID is not secret (it is visible at chrome://extensions anyway).
(function () {
  if (globalThis.__fashAnnounce) return;
  globalThis.__fashAnnounce = true;

  function announce() {
    try {
      window.postMessage(
        { source: "fashionistas-ext", type: "fash-ext-ready", id: chrome.runtime.id },
        "*"
      );
    } catch (e) {
      /* page gone / denied — the site will simply keep showing Connect */
    }
  }

  announce();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announce, { once: true });
  }
})();
