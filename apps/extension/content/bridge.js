// bridge.js — page probe injected on every shop domain.
//
// It gives the service worker a way to read a shop tab the extension could not
// otherwise inspect: whether the seller is actually logged in, whether a CAPTCHA
// blocks the flow, and the current URL (a fallback for listing-URL capture).
//
// The logged-in verdict comes from libs/login-detect.js (shipped as the
// generated content/login-detect.js) rather than a home-grown heuristic, so the
// extension, the app and the tests all decide "logged in?" the same way.
//
// PRIVACY: this NEVER exposes cookies, tokens, form values or passwords — only
// booleans, a reason code and the URL the user is already looking at. The
// signals below are presence checks; nothing here reads what the user typed.
(function () {
  if (globalThis.__fashBridge) return;
  globalThis.__fashBridge = true;

  var DETECT = globalThis.__fashLoginDetect || null;

  function captchaPresent() {
    var frames = Array.prototype.slice.call(document.querySelectorAll("iframe"));
    for (var i = 0; i < frames.length; i++) {
      var src = (frames[i].getAttribute("src") || "").toLowerCase();
      if (
        src.indexOf("recaptcha") !== -1 ||
        src.indexOf("hcaptcha") !== -1 ||
        src.indexOf("challenges.cloudflare.com") !== -1 ||
        src.indexOf("funcaptcha") !== -1 ||
        src.indexOf("geo.captcha-delivery.com") !== -1
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

  /**
   * Presence of a short menu label that only a signed-in seller sees.
   * Deliberately strict: we scan link/button labels only (not body prose), and
   * only accept a SHORT label, so a marketing paragraph mentioning "log out"
   * cannot be mistaken for the control itself. A false positive here would put
   * a green badge on a shop nobody can post to.
   */
  function hasShortLabel(textRe) {
    var nodes = document.querySelectorAll("a, button, [role='menuitem'], [role='button']");
    for (var i = 0; i < nodes.length; i++) {
      var label = ((nodes[i].innerText || nodes[i].textContent || "") + "").trim();
      if (!label || label.length > 32) continue;
      if (textRe.test(label)) return true;
    }
    return false;
  }

  function hasLogoutHref() {
    var nodes = document.querySelectorAll("a[href]");
    for (var i = 0; i < nodes.length; i++) {
      var href = (nodes[i].getAttribute("href") || "").toLowerCase();
      if (href.indexOf("logout") !== -1 || href.indexOf("signout") !== -1 || href.indexOf("sign_out") !== -1 || href.indexOf("sign-out") !== -1) {
        return true;
      }
    }
    return false;
  }

  function collectSignals() {
    var body = document.body;
    var text = ((body && body.innerText) || "").slice(0, 4000);
    // Structure, not wording: a create-listing page must expose a real control.
    var controls = document.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]), textarea, select, [contenteditable='true']"
    ).length;
    var hasPasswordField = !!document.querySelector("input[type='password']");
    var logout = hasLogoutHref() || hasShortLabel(/^\s*(log\s*out|sign\s*out)\s*$/i);
    var sellBtn = hasShortLabel(/^\s*sell(\s+it)?\s*$/i) || hasShortLabel(/^\s*sell\s+on\s+/i);
    var avatar =
      !!document.querySelector(
        "[data-testid='avatar'], .user-avatar, img.avatar, [aria-label*='avatar' i]"
      );
    return {
      controlCount: controls,
      hasPasswordField: hasPasswordField,
      bodyText: text,
      logout: logout,
      avatar: avatar,
      sellBtn: sellBtn
    };
  }

  function evaluate(requestedPath) {
    var here = location.pathname + location.search;
    if (DETECT) {
      try {
        return DETECT.detectLogin({
          requestedPath: requestedPath || here,
          finalPath: here,
          signals: collectSignals()
        });
      } catch (e) {
        return { connected: false, reason: "unknown", trace: ["probe_error: " + (e && e.message)] };
      }
    }
    // login-detect.js did not load (a load-order or install problem). Refuse to
    // guess: a wrong "connected" is worse than admitting we could not tell.
    return { connected: false, reason: "unknown", trace: ["detector_unavailable"] };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "fash:probe") return false;
    var verdict;
    try {
      verdict = evaluate(msg.requestedPath);
    } catch (e) {
      verdict = { connected: false, reason: "unknown", trace: ["probe_error"] };
    }
    var signals;
    try {
      signals = collectSignals();
    } catch (e) {
      signals = { controlCount: -1 };
    }
    sendResponse({
      href: location.href,
      host: location.host,
      ready: document.readyState === "complete",
      // `loggedIn` kept for older callers; it is exactly verdict.connected.
      loggedIn: verdict.connected,
      connected: verdict.connected,
      reason: verdict.reason,
      captcha: captchaPresent(),
      // Presence booleans only — never a value.
      signals: {
        controlCount: signals.controlCount,
        hasPasswordField: signals.hasPasswordField === true,
        logout: signals.logout === true,
        avatar: signals.avatar === true,
        sellBtn: signals.sellBtn === true
      },
      probedAt: Date.now()
    });
    return false;
  });
})();
