/**
 * Seller coach — lightweight, no paid APIs.
 *
 * Guides: Photo → Identify → Fill listing → Multilist → Connect extension → Sell everywhere.
 * Mounts a "What's next" checklist, empty-state coaching, help chips / tips on key
 * controls, and one-tap open of the stylist chat with a suggested question.
 *
 * Included from index.html.
 * Public URL is /seller-coach.js (Pages Functions block /libs/* HTTP).
 * Keep this file and /seller-coach.js identical.
 Keep consumer copy plain English — no developer jargon in tips.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "fash_seller_coach_v1";
  var STYLE_ID = "seller-coach-css";
  var PANEL_ID = "seller-coach-panel";
  var BANNER_ID = "seller-coach-banner";

  var STEPS = [
    {
      id: "photo",
      label: "Take a photo",
      tip: "Open Photo and snap (or pick) one item.",
      go: "snap",
      ask: "How do I list something from a photo?"
    },
    {
      id: "identify",
      label: "Let AI name it",
      tip: "Wait for the name, brand, size hint and price range.",
      go: "snap",
      ask: "How does photo identify work?"
    },
    {
      id: "listing",
      label: "Fill the listing",
      tip: "Check price, size and brand, then save to My clothes.",
      go: "snap",
      ask: "What should I put in the listing form?"
    },
    {
      id: "multilist",
      label: "Open Multilist",
      tip: "One draft for every shop you sell on.",
      go: "xl",
      ask: "How does Multilist work?"
    },
    {
      id: "extension",
      label: "Connect the extension",
      tip: "Install Fashionistas Crosslister, then Verify session on each shop.",
      go: "xl",
      ask: "How do I install the Chrome extension?"
    },
    {
      id: "sell",
      label: "Sell everywhere",
      tip: "Tick the shops and press Sell everywhere. Watch queued → posted.",
      go: "xl",
      ask: "How does Sell everywhere work?"
    }
  ];

  var FIELD_TIPS = [
    { sel: "#f-price", tip: "What the buyer pays. Use a number in the AI's range, then check what you keep after fees on Sell." },
    { sel: "#f-size", tip: "Size buyers filter by. Copy the label in the garment (M, 10, 32×30) so the right people find it." },
    { sel: "#f-brand", tip: "Brand helps search. Leave blank if you are not sure — never guess a designer name." },
    { sel: "#f-title", tip: "Short and searchable — brand + item + colour works best." },
    { sel: "#f-cond", tip: "Be honest. Buyers trust clear condition more than a perfect story." },
    { sel: 'button[onclick*="handoffSellAll"]', tip: "Posts the finished listing to every shop you ticked, using the Chrome extension." },
    { sel: 'button[onclick*="extConnectPrompt"]', tip: "Install or reconnect the Crosslister so posts can run in your Chrome." },
    { sel: 'a[href="/try-on/"]', tip: "Add a photo of a person and a garment to see it on them." },
    { sel: 'button[onclick*="xlConnect"]', tip: "Open Connect for this shop — create an account if needed, stay logged in, then Verify session." }
  ];

  var HELP_CHIPS = [
    { sel: "#f-price", label: "Price help", ask: "How should I price this item?" },
    { sel: "#f-size", label: "Size help", ask: "What size should I put on my listing?" },
    { sel: "#f-brand", label: "Brand help", ask: "What if I do not know the brand?" },
    { sel: 'button[onclick*="handoffSellAll"]', label: "How this works", ask: "How does Sell everywhere work?" },
    { sel: 'button[onclick*="extConnectPrompt"]', label: "Setup help", ask: "How do I install the Chrome extension?" },
    { sel: 'a[href="/try-on/"]', label: "Try-on help", ask: "How does virtual try-on work?" }
  ];

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveState(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  function mark(stepId) {
    var s = loadState();
    if (s[stepId]) return;
    s[stepId] = true;
    s.updatedAt = Date.now();
    saveState(s);
    refresh();
  }

  function hasToken() {
    try {
      return !!(window.TOKEN || localStorage.getItem("fash_token"));
    } catch (e) {
      return false;
    }
  }

  function listingCount() {
    try {
      if (window.S && Array.isArray(S.listings)) return S.listings.length;
    } catch (e) {}
    return 0;
  }

  function hasAiResult() {
    try {
      return !!(window.CURRENT && CURRENT.ai);
    } catch (e) {
      return false;
    }
  }

  function hasExt() {
    try {
      if (window.EXT_LIVE) return true;
      var id = (localStorage.getItem("fash_ext_id") || "").trim();
      return id.length >= 16;
    } catch (e) {
      return false;
    }
  }

  function connectedShopCount() {
    try {
      var raw = localStorage.getItem("fash_connect_v1");
      if (!raw) return 0;
      var obj = JSON.parse(raw) || {};
      var n = 0;
      Object.keys(obj).forEach(function (k) {
        var st = obj[k] && obj[k].status;
        if (st === "connected" || st === "unverified") n++;
      });
      return n;
    } catch (e) {
      return 0;
    }
  }

  function onListingForm() {
    return !!document.getElementById("f-price");
  }

  function onSnapWork() {
    return !!document.getElementById("snap-work") && !document.getElementById("snap-work").classList.contains("hidden");
  }

  function onXl() {
    return !!(document.getElementById("xl-hub-items") || document.querySelector(".xl-connect-note") || document.getElementById("xl-pick"));
  }

  function progress() {
    var s = loadState();
    var done = {
      photo: !!(s.photo || hasAiResult() || listingCount() > 0 || onSnapWork()),
      identify: !!(s.identify || hasAiResult() || listingCount() > 0),
      listing: !!(s.listing || listingCount() > 0 || onListingForm()),
      multilist: !!(s.multilist || onXl() || connectedShopCount() > 0),
      extension: !!(s.extension || hasExt()),
      sell: !!(s.sell)
    };
    // Visiting Multilist counts even before extension
    if (onXl()) done.multilist = true;
    return done;
  }

  function nextStep(done) {
    for (var i = 0; i < STEPS.length; i++) {
      if (!done[STEPS[i].id]) return STEPS[i];
    }
    return null;
  }

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var css = document.createElement("style");
    css.id = STYLE_ID;
    css.textContent = [
      "#seller-coach-panel{position:fixed;left:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:75;width:min(320px,calc(100vw - 24px));background:var(--card,#fff);color:var(--ink,#1a1410);border:1px solid var(--line,#e5dcd3);border-radius:16px;box-shadow:0 10px 28px rgba(0,0,0,.18);overflow:hidden;font-size:13px}",
      "#seller-coach-panel.hidden{display:none!important}",
      "#seller-coach-panel .sc-head{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;user-select:none;background:linear-gradient(135deg,rgba(255,78,58,.12),rgba(192,92,255,.08))}",
      "#seller-coach-panel .sc-head b{flex:1;font-size:14px;letter-spacing:-.01em}",
      "#seller-coach-panel .sc-toggle{border:0;background:transparent;font-size:16px;cursor:pointer;color:var(--mut,#6b5e55);padding:2px 6px}",
      "#seller-coach-panel .sc-body{padding:8px 12px 12px;max-height:42vh;overflow:auto}",
      "#seller-coach-panel.collapsed .sc-body{display:none}",
      "#seller-coach-panel .sc-next{margin:0 0 10px;padding:10px 12px;border-radius:12px;background:rgba(255,78,58,.08);border:1px solid rgba(255,78,58,.22)}",
      "#seller-coach-panel .sc-next .kicker{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--accent,#b3471f);margin:0 0 4px}",
      "#seller-coach-panel .sc-list{list-style:none;margin:0;padding:0}",
      "#seller-coach-panel .sc-list li{display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-top:1px solid var(--line,#e5dcd3)}",
      "#seller-coach-panel .sc-list li:first-child{border-top:0}",
      "#seller-coach-panel .sc-check{flex:none;width:18px;height:18px;border-radius:99px;border:2px solid var(--line-2,#d2c6ba);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;margin-top:1px}",
      "#seller-coach-panel .sc-list li.done .sc-check{background:var(--good,#1f7a45);border-color:var(--good,#1f7a45);color:#fff}",
      "#seller-coach-panel .sc-list li.current .sc-check{border-color:var(--accent,#b3471f);color:var(--accent,#b3471f)}",
      "#seller-coach-panel .sc-meta{flex:1;min-width:0}",
      "#seller-coach-panel .sc-meta b{display:block;font-size:13px}",
      "#seller-coach-panel .sc-meta span{display:block;color:var(--mut,#6b5e55);font-size:12px;margin-top:2px}",
      "#seller-coach-panel .sc-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}",
      "#seller-coach-panel .sc-acts button,#seller-coach-banner .sc-acts button{border:0;border-radius:999px;padding:7px 11px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}",
      "#seller-coach-panel .sc-go,#seller-coach-banner .sc-go{background:var(--accent,#b3471f);color:#fff}",
      "#seller-coach-panel .sc-ask,#seller-coach-banner .sc-ask{background:var(--soft,#f1ece4);color:var(--ink,#1a1410)}",
      "#seller-coach-panel .sc-foot{margin-top:8px;font-size:11.5px;color:var(--mut,#6b5e55)}",
      "#seller-coach-banner{margin:0 0 12px;padding:14px 14px 12px;border-radius:16px;border:1px solid rgba(255,78,58,.28);background:linear-gradient(160deg,rgba(255,78,58,.1),rgba(255,255,255,.7));box-shadow:0 6px 18px rgba(0,0,0,.06)}",
      "#seller-coach-banner .sc-tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--accent,#b3471f);margin-bottom:6px}",
      "#seller-coach-banner h3{margin:0 0 6px;font-size:17px;letter-spacing:-.01em}",
      "#seller-coach-banner p{margin:0 0 10px;color:var(--mut,#6b5e55);font-size:13.5px}",
      "#seller-coach-banner .sc-steps{margin:0 0 10px;padding-left:18px;font-size:13px}",
      "#seller-coach-banner .sc-steps li{margin:.28em 0}",
      ".sc-help-chip{display:inline-flex;align-items:center;gap:4px;margin-left:6px;border:0;border-radius:999px;padding:2px 8px;font:inherit;font-size:11px;font-weight:700;cursor:pointer;background:rgba(255,78,58,.1);color:var(--accent,#b3471f);vertical-align:middle}",
      ".sc-help-chip:hover{background:rgba(255,78,58,.18)}",
      ".sc-label-wrap{display:flex;align-items:center;flex-wrap:wrap;gap:2px}",
      "@media (max-width:420px){#seller-coach-panel{left:8px;right:8px;width:auto}}"
    ].join("\n");
    document.head.appendChild(css);
  }

  function askChat(question) {
    try {
      if (typeof window.botMode === "function") window.botMode("guide");
      if (typeof window.guideToggle === "function") window.guideToggle(true);
      var input = document.getElementById("guide-input");
      if (input) {
        input.value = question;
        input.focus();
      }
      // Auto-send so the stylist answers immediately
      setTimeout(function () {
        try {
          if (typeof window.guideSend === "function") window.guideSend();
        } catch (e) {}
      }, 60);
    } catch (e) {}
  }

  function goView(v) {
    try {
      if (typeof window.go === "function") window.go(v);
    } catch (e) {}
  }

  function ensurePanel() {
    var existing = document.getElementById(PANEL_ID);
    if (existing) return existing;
    var panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "hidden collapsed";
    panel.setAttribute("role", "complementary");
    panel.setAttribute("aria-label", "What's next seller checklist");
    panel.innerHTML =
      '<div class="sc-head" data-sc-toggle="1">' +
      '<b>What\'s next</b>' +
      '<button type="button" class="sc-toggle" data-sc-toggle="1" aria-label="Expand or collapse checklist">▾</button>' +
      "</div>" +
      '<div class="sc-body" id="seller-coach-body"></div>';
    document.body.appendChild(panel);
    panel.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.closest && t.closest("[data-sc-toggle]")) {
        panel.classList.toggle("collapsed");
        var btn = panel.querySelector(".sc-toggle");
        if (btn) btn.textContent = panel.classList.contains("collapsed") ? "▸" : "▾";
        return;
      }
      var goBtn = t.closest && t.closest("[data-sc-go]");
      if (goBtn) {
        var view = goBtn.getAttribute("data-sc-go");
        if (view === "xl") mark("multilist");
        if (view === "snap") mark("photo");
        goView(view);
        return;
      }
      var askBtn = t.closest && t.closest("[data-sc-ask]");
      if (askBtn) {
        askChat(askBtn.getAttribute("data-sc-ask") || "How do I sell with fashionistas.ai?");
      }
    });
    return panel;
  }

  function renderPanel() {
    if (!hasToken()) {
      var hide = document.getElementById(PANEL_ID);
      if (hide) hide.classList.add("hidden");
      return;
    }
    // Only show in the signed-in app shell
    var app = document.getElementById("view-app");
    if (app && app.classList.contains("hidden")) {
      var h2 = document.getElementById(PANEL_ID);
      if (h2) h2.classList.add("hidden");
      return;
    }

    injectCss();
    var panel = ensurePanel();
    var done = progress();
    var nxt = nextStep(done);
    var doneCount = STEPS.filter(function (s) { return done[s.id]; }).length;
    var body = document.getElementById("seller-coach-body");
    if (!body) return;

    var nextHtml = nxt
      ? '<div class="sc-next"><div class="kicker">Up next</div><b>' +
        escapeHtml(nxt.label) +
        "</b><div style=\"margin-top:4px;color:var(--mut,#6b5e55)\">" +
        escapeHtml(nxt.tip) +
        '</div><div class="sc-acts">' +
        '<button type="button" class="sc-go" data-sc-go="' +
        escapeAttr(nxt.go) +
        '">Do this →</button>' +
        '<button type="button" class="sc-ask" data-sc-ask="' +
        escapeAttr(nxt.ask) +
        '">Ask the guide</button>' +
        "</div></div>"
      : '<div class="sc-next"><div class="kicker">You\'re set</div><b>All seller steps done</b><div style="margin-top:4px;color:var(--mut,#6b5e55)">Snap more items anytime. Sell everywhere keeps posting to your connected shops.</div></div>';

    var list = STEPS.map(function (s) {
      var isDone = !!done[s.id];
      var isCurrent = nxt && nxt.id === s.id;
      var cls = isDone ? "done" : isCurrent ? "current" : "";
      return (
        '<li class="' +
        cls +
        '"><span class="sc-check" aria-hidden="true">' +
        (isDone ? "✓" : isCurrent ? "→" : "") +
        '</span><div class="sc-meta"><b>' +
        escapeHtml(s.label) +
        "</b><span>" +
        escapeHtml(s.tip) +
        "</span></div></li>"
      );
    }).join("");

    body.innerHTML =
      nextHtml +
      '<ul class="sc-list">' +
      list +
      "</ul>" +
      '<p class="sc-foot">' +
      doneCount +
      " of " +
      STEPS.length +
      " done · tips stay local on this device</p>";

    panel.classList.remove("hidden");
    // Expand when there is still work, or first open
    var st = loadState();
    if (!st.panelOpened) {
      panel.classList.remove("collapsed");
      st.panelOpened = true;
      saveState(st);
      var tg = panel.querySelector(".sc-toggle");
      if (tg) tg.textContent = "▾";
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function renderBanner() {
    var screen = document.getElementById("screen");
    if (!screen || !hasToken()) return;

    var old = document.getElementById(BANNER_ID);
    var done = progress();
    var st = loadState();
    var showEmpty =
      listingCount() === 0 &&
      !done.listing &&
      !st.bannerDismissed &&
      (document.getElementById("snap-pre") ||
        (screen.querySelector && screen.querySelector(".xl-cta")));

    if (!showEmpty) {
      if (old) old.remove();
      return;
    }

    injectCss();
    var nxt = nextStep(done) || STEPS[0];
    var html =
      '<div id="' +
      BANNER_ID +
      '" role="region" aria-label="Seller getting started">' +
      '<div class="sc-tag">First sale path</div>' +
      "<h3>Photo → Identify → Fill → Sell everywhere</h3>" +
      "<p>One photo drafts the listing. Connect the Chrome extension once, then Sell everywhere posts to your shops.</p>" +
      "<ol class=\"sc-steps\">" +
      "<li>Photo — snap the item</li>" +
      "<li>Identify — AI names it and suggests a price</li>" +
      "<li>Fill listing — check price, size, brand</li>" +
      "<li>Multilist — open Connect for each shop</li>" +
      "<li>Connect extension — Crosslister in Chrome</li>" +
      "<li>Sell everywhere — tick shops and post</li>" +
      "</ol>" +
      '<div class="sc-acts">' +
      '<button type="button" class="sc-go" data-sc-go="' +
      escapeAttr(nxt.go) +
      '">' +
      escapeHtml(nxt.label) +
      " →</button>" +
      '<button type="button" class="sc-ask" data-sc-ask="How do I list something from a photo?">Ask the guide</button>' +
      '<button type="button" class="sc-ask" data-sc-dismiss="1">Hide for now</button>' +
      "</div></div>";

    if (old) {
      old.outerHTML = html;
    } else {
      var snapPre = document.getElementById("snap-pre");
      if (snapPre) {
        snapPre.insertAdjacentHTML("afterbegin", html);
      } else {
        screen.insertAdjacentHTML("afterbegin", html);
      }
    }

    var banner = document.getElementById(BANNER_ID);
    if (!banner || banner._scBound) return;
    banner._scBound = true;
    banner.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest("[data-sc-dismiss]")) {
        var s = loadState();
        s.bannerDismissed = true;
        saveState(s);
        banner.remove();
        return;
      }
      var goBtn = t.closest("[data-sc-go]");
      if (goBtn) {
        goView(goBtn.getAttribute("data-sc-go"));
        return;
      }
      var askBtn = t.closest("[data-sc-ask]");
      if (askBtn) askChat(askBtn.getAttribute("data-sc-ask"));
    });
  }

  function applyFieldTips() {
    FIELD_TIPS.forEach(function (row) {
      document.querySelectorAll(row.sel).forEach(function (el) {
        if (!el.getAttribute("data-tip")) el.setAttribute("data-tip", row.tip);
        if (!el.getAttribute("title") && !window.matchMedia("(hover: hover)").matches) {
          el.setAttribute("title", row.tip);
        }
      });
    });
    // See-in-space / try-on wording if present later
    document.querySelectorAll('a,button').forEach(function (el) {
      var text = (el.textContent || "").trim().toLowerCase();
      if (text.indexOf("see in space") !== -1 || text.indexOf("see it in space") !== -1) {
        if (!el.getAttribute("data-tip")) {
          el.setAttribute("data-tip", "Preview the item in a room photo — helpful for buyers imagining the piece at home.");
        }
      }
      if (text === "try it on" || text.indexOf("try on") === 0) {
        if (!el.getAttribute("data-tip")) {
          el.setAttribute("data-tip", "Add a photo of a person and this garment to see it on them.");
        }
      }
      if (text === "sell everywhere" && !el.getAttribute("data-tip")) {
        el.setAttribute("data-tip", "Posts the finished listing to every shop you ticked.");
      }
      if (text === "connect" || text.indexOf("connect extension") !== -1) {
        if (!el.getAttribute("data-tip")) {
          el.setAttribute("data-tip", "Link your shops or install the Crosslister so posts can run in Chrome.");
        }
      }
    });
    try {
      if (window.syncTips) window.syncTips(document);
    } catch (e) {}
  }

  function applyHelpChips() {
    HELP_CHIPS.forEach(function (row) {
      document.querySelectorAll(row.sel).forEach(function (el) {
        if (el.dataset.scChip === "1") return;
        el.dataset.scChip = "1";
        // Prefer placing chip beside the field's label
        var label = null;
        if (el.id) {
          var prev = el.previousElementSibling;
          if (prev && prev.tagName === "LABEL") label = prev;
          else if (el.parentElement) {
            var lab = el.parentElement.querySelector("label");
            if (lab) label = lab;
          }
        }
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sc-help-chip";
        chip.textContent = "? " + row.label;
        chip.setAttribute("data-tip", "Opens the guide chat with: " + row.ask);
        chip.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          askChat(row.ask);
        });
        if (label) {
          label.classList.add("sc-label-wrap");
          label.appendChild(chip);
        } else if (el.parentElement) {
          el.insertAdjacentElement("afterend", chip);
        }
      });
    });
  }

  function observeProgressSignals() {
    // Mark steps from DOM / actions without rewriting big SPA hunks
    if (onSnapWork() || hasAiResult()) {
      mark("photo");
      mark("identify");
    }
    if (onListingForm()) {
      mark("photo");
      mark("identify");
      mark("listing");
    }
    if (listingCount() > 0) {
      mark("photo");
      mark("identify");
      mark("listing");
    }
    if (onXl()) mark("multilist");
    if (hasExt()) mark("extension");
    if (connectedShopCount() > 0) mark("multilist");
  }

  function bindActionHooks() {
    if (document.documentElement.dataset.scHooks === "1") return;
    document.documentElement.dataset.scHooks = "1";
    document.addEventListener(
      "click",
      function (e) {
        var t = e.target && e.target.closest && e.target.closest("button,a");
        if (!t) return;
        var oc = t.getAttribute("onclick") || "";
        var text = (t.textContent || "").trim().toLowerCase();
        if (oc.indexOf("handoffSellAll") !== -1 || text === "sell everywhere") {
          mark("sell");
          mark("multilist");
        }
        if (oc.indexOf("extConnectPrompt") !== -1 || text.indexOf("connect extension") !== -1) {
          mark("extension");
          mark("multilist");
        }
        if (oc.indexOf("toListingForm") !== -1 || text.indexOf("fill in the listing") !== -1) {
          mark("identify");
          mark("listing");
        }
        if (oc.indexOf("saveListing") !== -1 || text.indexOf("save to my clothes") !== -1) {
          mark("listing");
        }
        if (oc.indexOf("analyzeImage") !== -1 || oc.indexOf("openCamera") !== -1 || oc.indexOf("useSample") !== -1) {
          mark("photo");
        }
        if ((t.getAttribute("href") || "") === "/try-on/" || text.indexOf("try it on") !== -1) {
          /* tip only — do not mark sell path */
        }
      },
      true
    );
  }

  var _refreshing = false;
  function refresh() {
    if (_refreshing) return;
    _refreshing = true;
    try {
      observeProgressSignals();
      renderPanel();
      renderBanner();
      applyFieldTips();
      applyHelpChips();
    } catch (e) {
      try {
        console.warn("seller-coach", e);
      } catch (e2) {}
    } finally {
      _refreshing = false;
    }
  }

  function boot() {
    injectCss();
    bindActionHooks();
    refresh();
    // Re-run after SPA screen swaps
    if (window.MutationObserver) {
      var timer = null;
      new MutationObserver(function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(refresh, 120);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  window.SellerCoach = {
    refresh: refresh,
    mark: mark,
    ask: askChat,
    steps: STEPS,
    progress: progress
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
