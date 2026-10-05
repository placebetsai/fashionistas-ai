// sales/saleskit.js — the READ half of the crosslister: has one of the
// seller's OWN listings just sold?
//
// WHY THIS FILE IS A CLASSIC SCRIPT (no import/export)
//   Exactly like content/formkit.js. It is injected into the marketplace tab
//   with chrome.scripting.executeScript({ files: ["sales/saleskit.js"] }), and
//   then driven by the per-shop adapter function, which is handed to
//   executeScript({ func }) and SERIALIZED. A serialized function cannot close
//   over module imports, so every shared helper has to sit behind one global:
//   globalThis.__fashSales. That is the same contract formkit already uses.
//
// HARD RULES (this file is the compliance-critical half of Phase 2)
//   * READ ONLY. It never clicks, never types, never submits, never navigates,
//     never posts. Detection only — deleting copies elsewhere always goes
//     through the seller's own one-tap confirm (sales/prompt.js), which
//     enqueues the EXISTING delist path. No share/relist/follow/offer bot
//     code exists here or anywhere in sales/.
//   * ZERO SELECTORS. Everything it touches arrives on the SEL argument;
//     SEL.sold.* comes from sales/sold-selectors.js (the selector source for
//     this feature). Not one class name or id is hard-coded here.
//   * NEVER THROWS. Login wall, CAPTCHA, empty page, a marketplace that
//     redesigned overnight — all come back as {status:"skipped", reason:"…"}
//     so one bad shop cannot kill the scan of the others.
//   * CREDENTIALS. It never reads a password value, a cookie, a form value or
//     a keystroke. It reads rendered text of the seller's own listings and
//     presence booleans, and nothing else.
//
// DOM scope: the seller's logged-in session, on the seller's machine (desktop
// extension) or inside the phone's in-app WebView. NEVER a server.
(function () {
  if (globalThis.__fashSales) return;

  var MAX_ITEMS = 60;              // pathological-DOM guard, not a page size
  var MAX_TEXT = 4000;             // body text handed to the login detector
  var SOLD_WORD = /\bsold(\s+out)?\b/i;
  var ACTIVE_WORD = /\b(active|available|for\s+sale|listed|in\s+stock)\b/i;
  var MONEY = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/;

  var REASONS = {
    NO_CONFIG: "no_sold_config",
    NO_DOCUMENT: "no_document",
    CAPTCHA: "captcha",
    LOGIN_WALL: "login_wall",
    NO_LISTINGS: "no_listings",
    ITEMS_UNREADABLE: "items_unreadable",
    NEEDS_INPUT: "needs_input",
    INTERNAL: "internal_error"
  };

  /* ------------------------------------------------------------ primitives */

  function textOf(el) {
    if (!el) return "";
    var raw = el.innerText != null ? el.innerText : el.textContent;
    return String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
  }

  /**
   * CSS-state visibility, deliberately NOT layout geometry: getBoundingClientRect
   * reports 0x0 for anything not yet laid out (and for every element under
   * jsdom), so geometry would reject controls that are plainly on screen.
   * Same rule as adapters/engine.js isVisible().
   */
  function visible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    if (el.disabled) return false;
    if (el.getAttribute && el.getAttribute("type") === "hidden") return false;
    try {
      var st = globalThis.getComputedStyle(el);
      if (st) {
        if (st.display === "none") return false;
        if (st.visibility === "hidden" || st.visibility === "collapse") return false;
        if (st.opacity === "0") return false;
      }
    } catch (e) { /* computed style unavailable -> keep the element */ }
    return true;
  }

  /** First candidate that resolves in `root`; bad selectors are skipped. */
  function q(cands, root) {
    var scope = root || document;
    if (!scope || !scope.querySelector) return null;
    var list = Array.isArray(cands) ? cands : cands ? [cands] : [];
    for (var i = 0; i < list.length; i++) {
      var sel = list[i];
      if (!sel) continue;
      try {
        var el = scope.querySelector(sel);
        if (el) return el;
      } catch (e) { /* invalid selector in config -> try the next candidate */ }
    }
    return null;
  }

  function qAll(cands, root) {
    var scope = root || document;
    var out = [];
    if (!scope || !scope.querySelectorAll) return out;
    var list = Array.isArray(cands) ? cands : cands ? [cands] : [];
    for (var i = 0; i < list.length; i++) {
      try {
        var hits = scope.querySelectorAll(list[i]);
        for (var j = 0; j < hits.length; j++) out.push(hits[j]);
      } catch (e) { /* bad selector in config */ }
    }
    return out;
  }

  /** "$45.00" -> 45. Best effort: first number in the price node's text. */
  function money(text) {
    var m = MONEY.exec(String(text == null ? "" : text));
    if (!m) return null;
    var n = Number(String(m[1]).replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }

  /** Stable key for an item we could NOT identify (no link): text fingerprint. */
  function fingerprint(text) {
    var s = String(text || "").slice(0, 120);
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  function listingPattern(SEL) {
    try {
      var p = SEL && SEL.listingPattern;
      return p ? new RegExp(p) : null;
    } catch (e) { return null; }
  }

  function hrefOf(node) {
    if (!node || !node.getAttribute) return "";
    var h = node.getAttribute("href") || "";
    if (!h) return "";
    try { return new URL(h, location.href).toString(); }
    catch (e) { return h; }
  }

  /* --------------------------------------------------------------- walls */

  /**
   * CAPTCHA / human-verification widget on screen?
   * Reuses formkit's detector when it is loaded (ONE implementation per tab),
   * then falls back to the SEL.captcha candidate list + known challenge
   * iframes. Returns the matched selector string, or null.
   */
  function detectCaptcha(SEL, doc) {
    try {
      var K = globalThis.__fashForm;
      if (K && typeof K.detectCaptcha === "function") {
        var hit = K.detectCaptcha(SEL);
        if (hit) return hit;
      }
    } catch (e) { /* formkit absent or throwing -> our own pass below */ }
    var d = doc || document;
    var cands = (SEL && SEL.captcha) || [];
    for (var i = 0; i < cands.length; i++) {
      try {
        var el = d.querySelector(cands[i]);
        if (el && visible(el)) return cands[i];
      } catch (e) { /* bad selector in config */ }
      }
    var frames = [];
    try { frames = d.querySelectorAll("iframe"); } catch (e) { frames = []; }
    for (var f = 0; f < frames.length; f++) {
      var src = String(frames[f].getAttribute("src") || "").toLowerCase();
      if (/recaptcha|hcaptcha|challenges\.cloudflare|funcaptcha|geo\.captcha-delivery/.test(src)) {
        return "iframe:" + src.slice(0, 60);
      }
    }
    return null;
  }

  /** The page is asking for a credential -> we are not signed in. */
  function detectLoginWall(SEL, doc) {
    var S = (SEL && SEL.sold) || {};
    var el = q(S.login, doc);
    return el && visible(el) ? (el.tagName ? el.tagName.toLowerCase() : "login") : null;
  }

  /** Signals handed to libs/login-detect.js (presence booleans + body text). */
  function signalsFor(doc) {
    var pw = null;
    try { pw = doc.querySelector("input[type='password']"); } catch (e) { pw = null; }
    var controls = 0;
    try { controls = doc.querySelectorAll("input,textarea,select,button").length; } catch (e) { controls = 0; }
    var body = "";
    try { body = textOf(doc.body).slice(0, MAX_TEXT); } catch (e) { body = ""; }
    return { hasPasswordField: !!pw, controlCount: controls, bodyText: body };
  }

  /* --------------------------------------------------------------- items */

  /** The listing anchor inside a card (must match the shop's listingPattern). */
  function findLink(node, S, pattern) {
    if (node && String(node.tagName || "").toLowerCase() === "a") {
      var own = hrefOf(node);
      if (own && (!pattern || pattern.test(own))) return node;
    }
    var cands = S.link || [];
    for (var i = 0; i < cands.length; i++) {
      var found = null;
      try { found = node.querySelector ? node.querySelector(cands[i]) : null; } catch (e) { found = null; }
      if (!found) continue;
      var href = hrefOf(found);
      if (!pattern || (href && pattern.test(href))) return found;
    }
    return null;
  }

  /**
   * Sale state of one card.
   *   1. a positive "sold" marker  -> sold (the signal we act on)
   *   2. a status node whose text says sold/live -> that word
   *   3. a status node with UNRECOGNISED text     -> "unknown" (DOM changed)
   *   4. a positive "live" marker  -> active
   *   5. no state markup at all    -> active (a live card in the closet)
   */
  function saleState(node, S) {
    var m = q(S.sold, node);
    if (m && visible(m)) return "sold";
    var st = q(S.status, node);
    if (st && visible(st)) {
      var t = textOf(st);
      if (t) {
        if (SOLD_WORD.test(t)) return "sold";
        if (ACTIVE_WORD.test(t)) return "active";
        return "unknown"; // the site states a status we do not understand
      }
    }
    var a = q(S.active, node);
    if (a && visible(a)) return "active";
    return "active";
  }

  /**
   * Read one card. Returns
   *   { ok:true,  item:{key,listingRef,listingUrl,title,price,currency,soldAt,soldAtText,status} }
   *   { ok:false, why:"no_link", partialKey }   (identity could not be resolved)
   */
  function readItem(node, SEL, S, pattern, fallbackKey) {
    var link = findLink(node, S, pattern);
    if (!link) return { ok: false, why: "no_link", partialKey: fallbackKey };
    var abs = hrefOf(link);
    if (!abs) return { ok: false, why: "no_link", partialKey: fallbackKey };
    var ref = abs;
    try { ref = new URL(abs, location.href).pathname; } catch (e) { ref = abs.split("#")[0].split("?")[0]; }

    var priceNode = q(S.price, node);
    var dateNode = q(S.date, node);
    var titleNode = q(S.title, node);
    var soldAt = null;
    var soldAtText = "";
    if (dateNode) {
      soldAtText = textOf(dateNode).slice(0, 40);
      var dt = dateNode.getAttribute ? (dateNode.getAttribute("datetime") || dateNode.getAttribute("content") || null) : null;
      if (dt) {
        var parsed = Date.parse(dt);
        if (isFinite(parsed)) soldAt = new Date(parsed).toISOString();
      }
    }
    var title = textOf(titleNode).slice(0, 200) || null;

    return {
      ok: true,
      item: {
        key: null, // assigned by the caller: shop + ":" + listingRef
        listingRef: ref,
        listingUrl: abs,
        title: title,
        price: priceNode ? money(textOf(priceNode)) : null,
        currency: S.currency || null,
        soldAt: soldAt,
        soldAtText: soldAtText || null,
        status: saleState(node, S)
      }
    };
  }

  /* ----------------------------------------------------------- the scan */

  /**
   * Scan one marketplace page for sold listings. Runs in the seller's own
   * session. NEVER throws.
   *
   * @param {string} shop   normalized shop key ("poshmark", …)
   * @param {object} SEL    selectors (SEL.sold = sales/sold-selectors.js)
   * @param {object} [opts] { state:{failures,gaveUp}, doc }  — `state` is
   *        plain JSON so it survives executeScript serialization; ALWAYS read
   *        it back from the result (`result.state`), never from the argument.
   * @returns {object} { shop, status, reason, items, needsInput, report,
   *                     counts, state, signals, href }
   *         status: "sold" | "clean" | "skipped"
   *         reason: null | "login_wall" | "captcha" | "no_listings" |
   *                 "items_unreadable" | "needs_input" | "no_sold_config" | …
   */
  function scanSold(shop, SEL, opts) {
    var out = {
      shop: String(shop || ""),
      status: "skipped",
      reason: null,
      items: [],
      needsInput: [],
      report: [],
      counts: { found: 0, readable: 0, unreadable: 0, sold: 0 },
      state: { failures: {}, gaveUp: [] },
      signals: null,
      href: ""
    };
    try {
      var doc = (opts && opts.doc) || (typeof document !== "undefined" ? document : null);
      var prev = (opts && opts.state) || {};
      out.state = {
        failures: Object.assign({}, prev.failures || {}),
        gaveUp: (prev.gaveUp || []).slice()
      };
      if (!doc) { out.reason = REASONS.NO_DOCUMENT; return out; }
      try { out.href = String(location && location.href ? location.href : ""); } catch (e) { out.href = ""; }

      var S = SEL && SEL.sold;
      if (!S || !Array.isArray(S.item) || !S.item.length) {
        out.reason = REASONS.NO_CONFIG;
        return out;
      }

      // 0) walls first: never poke at a page that is not the seller's closet.
      var cap = detectCaptcha(SEL, doc);
      if (cap) { out.reason = REASONS.CAPTCHA; out.matched = cap; return out; }
      var wall = detectLoginWall(SEL, doc);
      if (wall) { out.reason = REASONS.LOGIN_WALL; out.matched = wall; return out; }

      // 1) the listing cards
      var nodes = qAll(S.item, doc).slice(0, MAX_ITEMS);
      out.counts.found = nodes.length;
      if (!nodes.length) {
        out.reason = REASONS.NO_LISTINGS;
        out.signals = signalsFor(doc);
        return out;
      }

      var pattern = listingPattern(SEL);
      var gaveUp = {};
      for (var g = 0; g < out.state.gaveUp.length; g++) gaveUp[out.state.gaveUp[g]] = true;
      var gaveUpHit = false; // one of THIS page's items was parked earlier

      for (var i = 0; i < nodes.length; i++) {
        var key = out.shop + ":?:" + i; // provisional, for unidentifiable cards
        var res;
        try {
          res = readItem(nodes[i], SEL, S, pattern, key);
        } catch (e) {
          res = { ok: false, why: "read_threw", partialKey: key };
        }

        if (!res.ok) {
          out.counts.unreadable++;
          if (gaveUp[res.partialKey]) { gaveUpHit = true; continue; }
          strike(out, res.partialKey, gaveUp, "unreadable card (" + res.why + ")");
          continue;
        }

        var item = res.item;
        item.key = out.shop + ":" + item.listingRef;

        if (item.status === "unknown") {
          out.counts.unreadable++;
          if (gaveUp[item.key]) { gaveUpHit = true; continue; } // already reported once
          strike(out, item.key, gaveUp, "unrecognised listing status");
          continue;
        }

        if (gaveUp[item.key]) { gaveUpHit = true; continue; } // parked earlier: no re-report
        out.counts.readable++;
        out.items.push(item);
        if (item.status === "sold") out.counts.sold++;
      }

      out.signals = signalsFor(doc);

      // 2) verdict
      if (out.counts.sold > 0) {
        out.status = "sold";
      } else if (out.counts.readable > 0) {
        out.status = "clean";
      } else {
        out.status = "skipped";
        out.reason = out.needsInput.length || gaveUpHit
          ? REASONS.NEEDS_INPUT
          : REASONS.ITEMS_UNREADABLE;
      }
      return out;
    } catch (e) {
      // Defensive close: a changed DOM must never throw into the scanner.
      out.status = "skipped";
      out.reason = REASONS.INTERNAL;
      out.error = String((e && e.message) || e).slice(0, 200);
      return out;
    }
  }

  /**
   * One item failed to yield a readable sale state.
   * 3 consecutive failures on the SAME item => ONE report line + needs_input,
   * then the item is parked (gaveUp) so it never blocks the rest of the scan.
   */
  function strike(out, key, gaveUpMap, why) {
    if (!key || gaveUpMap[key]) return;
    var n = (out.state.failures[key] || 0) + 1;
    out.state.failures[key] = n;
    if (n >= 3) {
      out.state.gaveUp.push(key);
      gaveUpMap[key] = true;
      delete out.state.failures[key];
      out.needsInput.push(key);
      out.report.push(
        "NEEDS_INPUT " + key + " — sale state unreadable after " + n +
        " attempts (" + why + "); parked until the selector source is fixed."
      );
    }
  }

  globalThis.__fashSales = {
    REASONS: REASONS,
    scanSold: scanSold,
    detectCaptcha: detectCaptcha,
    detectLoginWall: detectLoginWall,
    readItem: readItem,
    saleState: saleState,
    visible: visible,
    q: q,
    qAll: qAll,
    textOf: textOf
  };
})();
