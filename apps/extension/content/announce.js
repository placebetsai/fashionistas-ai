// announce.js — runs on fashionistas.ai and tells the page this extension
// exists. This is what removes the "paste the extension ID" step: the page no
// longer has to guess or ask, it learns the live ID from us directly.
//
// It publishes only chrome.runtime.id and the self-minted install id (the
// same one already shown on the Shops screen as "this browser"). No cookies,
// no tokens, no shop data — neither value is secret; the extension ID is
// visible at chrome://extensions anyway.
//
// The install id rides ALONG in the same postMessage so the "Connect this
// browser" button does not depend on the page having any extension API of its
// own (externally_connectable chrome.runtime is documented, but this relay
// works even where it does not).
(function () {
  if (globalThis.__fashAnnounce) return;
  globalThis.__fashAnnounce = true;

  function post(extra) {
    try {
      window.postMessage(
        Object.assign(
          { source: "fashionistas-ext", type: "fash-ext-ready", id: chrome.runtime.id },
          extra || {}
        ),
        "*"
      );
    } catch (e) {
      /* page gone / denied — the site will simply keep showing Connect */
    }
  }

  function announce() {
    post(); // id-only first: the page never has to wait on the service worker
    try {
      chrome.runtime.sendMessage({ type: "fash:install-id" }, (r) => {
        if (chrome.runtime.lastError) return; // SW asleep: id-only already went
        if (r && r.ok && r.install_id) post({ install_id: String(r.install_id) });
      });
    } catch (e) { /* no runtime in this context — id-only announce is enough */ }
  }

  announce();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announce, { once: true });
  }
})();
