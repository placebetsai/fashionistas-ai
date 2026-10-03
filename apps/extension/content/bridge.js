// bridge.js — lightweight page probe injected on every shop domain.
//
// It gives the service worker a second, non-scripting way to read a shop tab:
// whether the user is logged in, whether a CAPTCHA is blocking the flow, and
// what the current URL is (used as a fallback for listing-URL capture).
// It NEVER exposes cookies, tokens or passwords — only booleans and the URL
// of the page the user is already looking at.
(function () {
  if (globalThis.__fashBridge) return;
  globalThis.__fashBridge = true;

  function captchaPresent() {
    const frames = Array.from(document.querySelectorAll("iframe"));
    for (const f of frames) {
      const src = (f.getAttribute("src") || "").toLowerCase();
      if (
        src.includes("recaptcha") ||
        src.includes("hcaptcha") ||
        src.includes("challenges.cloudflare.com") ||
        src.includes("funcaptcha") ||
        src.includes("geo.captcha-delivery.com")
      ) {
        return true;
      }
    }
    try {
      if (document.querySelector(".g-recaptcha") || document.querySelector("[data-hcaptcha-widget-id]")) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function looksLoggedOut() {
    const path = (location.pathname || "").toLowerCase();
    if (/\/(login|log-in|signin|sign-in|signup|sign-up|register|auth)\b/.test(path)) return true;
    const body = (document.body && document.body.innerText || "").slice(0, 4000).toLowerCase();
    return /please sign in to continue|you need to log in|session expired/.test(body);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "fash:probe") return false;
    let loggedIn = null;
    try {
      loggedIn = !looksLoggedOut();
    } catch (e) {
      loggedIn = null;
    }
    sendResponse({
      href: location.href,
      host: location.host,
      ready: document.readyState === "complete",
      loggedIn: loggedIn,
      captcha: captchaPresent(),
      probedAt: Date.now()
    });
    return false;
  });
})();
