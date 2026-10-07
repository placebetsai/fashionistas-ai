/* listing-wizard.js — phone-first listing flow for fashionistas.ai.
 *
 *   Step 1 Photos  ->  Step 2 What is it  ->  Step 3 Price  ->  Step 4 Where to list
 *   then the "Post it everywhere" screen.
 *
 * Replaces the old one-page listing form (renderListingForm) and the
 * extension-first posting sheet. Zero install for sellers:
 *   - the listing goes live on fashionistas.ai immediately (worker /api/listings);
 *   - eBay posts directly only when the seller's eBay connection really exists
 *     (/api/ebay/status) — otherwise it is guided like the others;
 *   - Depop / Poshmark / Mercari / Vinted / Grailed / Etsy: guided "Post to X":
 *     tap-to-copy fields, photos through the phone's share sheet
 *     (navigator.share with files) and the shop's own sell page.
 *     A shop is only ever marked posted when the seller says so.
 *
 * The draft (fields + photos) lives in localStorage, so leaving mid-way loses
 * nothing. Reuses the app bundle's globals: FCAT/taxPath/catRow (categories.js),
 * FEE_TABLE, xlKit* per-shop copy, handoffSet/handoffStateOf, api, uploadB64.
 * No intervals, no observers on subtrees, no looping animation. */
(function () {
  "use strict";
  var KEY = "fash_wizard_v1", PKEY = "fash_wizard_photos_v1", SHOPKEY = "fash_lw_shops_v1", LASTKEY = "fash_lw_lastpost_v1";
  var MAXP = 8;
  var root = document.documentElement;

  /* ---------- shops ---------- */
  var SHOPS = [
    { id: "depop", name: "Depop", c: "#ff2300", l: "D", sell: "https://www.depop.com/products/create/", noTitle: true },
    { id: "poshmark", name: "Poshmark", c: "#7f0353", l: "P", sell: "https://poshmark.com/create-listing" },
    { id: "mercari", name: "Mercari", c: "#5356ee", l: "M", sell: "https://www.mercari.com/sell/" },
    { id: "vinted", name: "Vinted", c: "#09b1ba", l: "V", sell: "https://www.vinted.com/items/new" },
    { id: "grailed", name: "Grailed", c: "#111111", l: "G", sell: "https://www.grailed.com/sell/new" },
    { id: "ebay", name: "eBay", c: "#0064d2", l: "e", sell: "https://www.ebay.com/sl/sell" },
    { id: "etsy", name: "Etsy", c: "#f1641e", l: "E", sell: "https://www.etsy.com/your/shops/me/listing-editor/create" }
  ];
  var FEES = { depop: { pct: 10 }, poshmark: { posh: true }, mercari: { pct: 10 }, vinted: { pct: 0 }, grailed: { pct: 9 }, ebay: { pct: 13.25, flat: 0.4 }, etsy: { pct: 9.5, flat: 0.45 } };
  try { (typeof FEE_TABLE !== "undefined" ? FEE_TABLE : []).forEach(function (m) { if (FEES[m.id] && !FEES[m.id].posh) FEES[m.id].pct = Number(m.feePct) || 0; }); } catch (e) {}
  function shopById(id) { for (var i = 0; i < SHOPS.length; i++) if (SHOPS[i].id === id) return SHOPS[i]; return null; }
  function logo(s, size) { return '<i class="lw-logo" style="--c:' + s.c + (size ? ';--s:' + size + 'px' : '') + '" aria-hidden="true">' + s.l + '</i>'; }
  var FASH_LOGO = '<i class="lw-logo" style="--c:#ff4e3a" aria-hidden="true">f</i>';

  /* ---------- conditions: one universal scale, mapped to each shop's own words ---------- */
  var COND = [
    { k: "nwt", label: "New with tags", store: "New with tags", tip: "Never worn, tags still attached.",
      depop: "Brand new", poshmark: "New With Tags", mercari: "New", vinted: "New with tags", grailed: "New/Never Worn", ebay: "New with tags", etsy: "" },
    { k: "likenew", label: "Like new", store: "Excellent", tip: "Worn once or twice. No flaws.",
      depop: "Like new", poshmark: "Like New", mercari: "Like new", vinted: "Very good", grailed: "Gently Used", ebay: "Pre-owned · Excellent", etsy: "" },
    { k: "good", label: "Good", store: "Good", tip: "Worn, light signs of use.",
      depop: "Used · Good", poshmark: "Good", mercari: "Good", vinted: "Good", grailed: "Used", ebay: "Pre-owned · Good", etsy: "" },
    { k: "fair", label: "Fair", store: "Fair", tip: "Visible wear or a small flaw. Mention it in the description.",
      depop: "Used · Fair", poshmark: "Fair", mercari: "Fair", vinted: "Satisfactory", grailed: "Very Worn", ebay: "Pre-owned · Fair", etsy: "" }
  ];
  function condBy(k) { for (var i = 0; i < COND.length; i++) if (COND[i].k === k) return COND[i]; return null; }
  function condFromText(v) {
    var t = String(v || "").toLowerCase().trim();
    if (!t) return "";
    if (/new with tags|nwt|brand new|^new$/.test(t)) return "nwt";
    if (/excellent|like new|new without|nwot|very good|mint/.test(t)) return "likenew";
    if (/good|used|gently/.test(t)) return "good";
    if (/fair|poor|worn|damag|satisf/.test(t)) return "fair";
    return "";
  }

  /* ---------- colours ---------- */
  var COLORS = [
    ["Black", "#151515"], ["White", "#ffffff"], ["Grey", "#9aa0a6"], ["Beige", "#e6d8bd"], ["Brown", "#7b4a2a"],
    ["Blue", "#2f6fd6"], ["Navy", "#1f2a5a"], ["Green", "#2e7d32"], ["Red", "#d93025"], ["Pink", "#f48fb1"],
    ["Purple", "#8e44ad"], ["Yellow", "#f4c20d"], ["Orange", "#f57c00"], ["Multi", "conic-gradient(#d93025,#f4c20d,#2e7d32,#2f6fd6,#8e44ad,#d93025)"]
  ];
  function colorFromText(v) {
    var t = String(v || "").toLowerCase();
    if (!t) return "";
    var rules = [[/multi|print|pattern|floral|stripe|plaid|check/, "Multi"], [/navy|indigo|midnight/, "Navy"], [/blue|denim|teal|turquoise|aqua/, "Blue"],
      [/black|charcoal|ebony/, "Black"], [/white|ivory|off-white|cream/, "White"], [/grey|gray|silver|heather/, "Grey"],
      [/beige|tan|khaki|camel|nude|sand|taupe|oatmeal/, "Beige"], [/brown|chocolate|rust|cognac/, "Brown"], [/green|olive|sage|mint/, "Green"],
      [/red|burgundy|maroon|wine|crimson/, "Red"], [/pink|rose|blush|fuchsia|magenta/, "Pink"], [/purple|lilac|lavender|violet|plum/, "Purple"],
      [/yellow|gold|mustard/, "Yellow"], [/orange|coral|peach/, "Orange"]];
    for (var i = 0; i < rules.length; i++) if (rules[i][0].test(t)) return rules[i][1];
    return v.charAt(0).toUpperCase() + v.slice(1);
  }

  /* ---------- helpers ---------- */
  function esc(s) { return (typeof escapeHtml === "function") ? escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $id(id) { return document.getElementById(id); }
  function say(m, ms) { try { toast(m, ms); } catch (e) {} }
  function money0(n) { n = Number(n) || 0; return "$" + (Math.round(n * 100) / 100).toFixed(n % 1 === 0 ? 0 : 2); }
  function cat() { return (typeof FCAT !== "undefined" && FCAT) || window.FASH_CAT || { departments: [], categories: [], sizes: {} }; }
  function rowFor(path) { try { return catRow(path); } catch (e) { return null; } }
  function canonPath(raw) { try { var p = taxPath(raw || ""); return (p && p.indexOf("/") > 0) ? p : ""; } catch (e) { return ""; } }
  function sizesFor(path) { var r = rowFor(path); return r ? (cat().sizes[r.size] || []) : []; }
  function pathLabel(p) { return p ? p.split("/").join(" › ") : ""; }
  function shopCat(path, shop) { try { return shopCatPath(path, shop) || ""; } catch (e) { return ""; } }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function coach(step) { try { if (window.SellerCoach) SellerCoach.mark(step); } catch (e) {} }
  function svg(d, w, extra) { return '<svg viewBox="0 0 24 24" width="' + (w || 22) + '" height="' + (w || 22) + '" fill="none" stroke="currentColor" stroke-width="' + (extra || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var ICON = {
    cam: svg('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>', 22, 1.9),
    img: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>', 22, 1.9),
    back: svg('<path d="M15 5l-7 7 7 7"/>', 22, 2.2),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 16, 2.6),
    spark: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M11 3.5 12.7 9l5.3 1.7-5.3 1.7L11 18l-1.7-5.6L4 10.7 9.3 9z"/></svg>',
    copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', 16),
    share: svg('<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7"/>', 18),
    ext: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 16),
    chev: svg('<path d="m9 6 6 6-6 6"/>', 18, 2.2),
    search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>', 18)
  };

  /* ---------- state + draft ---------- */
  var W = null;           // current wizard state
  var PHOTOS = [];        // [{id, src (dataURL) | null, url (remote) | null}]
  var saveT = null;
  function fresh() {
    return { v: 1, step: 1, mode: "new", listingId: null, ai: null, aiState: "idle", aiErr: "",
      f: { title: "", path: "", brand: "", size: "", cond: "", color: "", desc: "", material: "", price: "", ship: "buyer" },
      touched: {}, shops: loadShops(), sel: 0, at: Date.now() };
  }
  function loadShops() {
    try { var o = JSON.parse(localStorage.getItem(SHOPKEY) || "null"); if (o && typeof o === "object") return o; } catch (e) {}
    return { depop: 1, poshmark: 1, mercari: 1, vinted: 0, grailed: 0, ebay: 1, etsy: 0 };
  }
  function save() {
    if (!W || W.mode !== "new") return;
    clearTimeout(saveT);
    saveT = setTimeout(flush, 250);
  }
  function flush() {
    if (!W || W.mode !== "new") return;
    try { localStorage.setItem(KEY, JSON.stringify(W)); } catch (e) {}
    try { localStorage.setItem(SHOPKEY, JSON.stringify(W.shops)); } catch (e) {}
    var list = PHOTOS.map(function (p) { return { id: p.id, src: p.src || null, url: p.url || null, hint: p.hint || "" }; });
    try { localStorage.setItem(PKEY, JSON.stringify(list)); }
    catch (e) { try { localStorage.setItem(PKEY, JSON.stringify(list.slice(0, 2))); } catch (e2) {} }
  }
  function loadDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!d || d.v !== 1 || d.mode !== "new") return null;
      var ph = JSON.parse(localStorage.getItem(PKEY) || "[]");
      return { w: d, photos: Array.isArray(ph) ? ph.filter(function (p) { return p && (p.src || p.url); }) : [] };
    } catch (e) { return null; }
  }
  function clearDraft() { clearTimeout(saveT); try { localStorage.removeItem(KEY); localStorage.removeItem(PKEY); } catch (e) {} }
  function hasContent() { return !!(W && (PHOTOS.length || W.f.title || W.f.path)); }
  window.addEventListener("pagehide", function () { try { flush(); } catch (e) {} });

  /* ---------- screen mount ---------- */
  var STEPS = ["Photos", "What is it", "Price", "Where to list"];
  function screenEl() { return $id("screen"); }
  function setHead(t, sub) {
    try { kineticTitle(t); } catch (e) {}
    var s = $id("view-sub"); if (s) s.textContent = sub || "";
  }
  function mount(el, opts) {
    opts = opts || {};
    el = el || screenEl(); if (!el) return;
    if (opts.edit) { W = opts.edit.w; PHOTOS = opts.edit.photos; }
    else if (!W || W.mode !== "new") {
      var d = loadDraft();
      if (d) { W = d.w; PHOTOS = d.photos; W.restored = hasContent(); }
      else { W = fresh(); PHOTOS = []; }
      if (W.aiState === "busy") W.aiState = PHOTOS.length ? "error" : "idle";
    }
    root.classList.add("lw-on");
    setHead(W.mode === "edit" ? "Edit listing" : "Sell an item", "");
    el.innerHTML = '<div class="lw" id="lw">' +
      '<div class="lw-top"><button type="button" class="lw-back" id="lw-back" aria-label="Back" onclick="LW.back()">' + ICON.back + '</button>' +
      '<div class="lw-prog"><div class="lw-stepline"><b id="lw-stepn"></b><span id="lw-stepname"></span></div><div class="lw-bar" role="progressbar" aria-valuemin="1" aria-valuemax="4" id="lw-bar"><i id="lw-bar-i"></i></div></div>' +
      '<button type="button" class="lw-help" onclick="LW.help()" aria-label="Help">?</button></div>' +
      '<div class="lw-body" id="lw-body"></div>' +
      '<div class="lw-foot" id="lw-foot"><button type="button" class="lw-next" id="lw-next" onclick="LW.next()"></button></div>' +
      '<input type="file" id="lw-cam" accept="image/*" capture="environment" hidden onchange="LW.files(this)">' +
      '<input type="file" id="lw-gal" accept="image/*" multiple hidden onchange="LW.files(this)">' +
      '<div id="snap-pre" hidden></div></div>';
    renderStep();
  }
  function renderStep() {
    if (!W || !$id("lw")) return;
    var n = W.step;
    $id("lw-stepn").textContent = "Step " + n + " of 4";
    $id("lw-stepname").textContent = STEPS[n - 1];
    $id("lw-bar-i").style.width = (n * 25) + "%";
    $id("lw-bar").setAttribute("aria-valuenow", String(n));
    $id("lw-back").hidden = n < 2;
    var body = $id("lw-body");
    body.innerHTML = n === 1 ? step1() : n === 2 ? step2() : n === 3 ? step3() : step4();
    if (n === 2) afterStep2();
    if (n === 3) refreshKeep();
    footer();
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  function footer() {
    var b = $id("lw-next"); if (!b) return;
    var n = W.step, label, dis = false;
    if (n === 1) { label = PHOTOS.length ? "Next: What is it" : "Add a photo to start"; dis = !PHOTOS.length; }
    else if (n === 2) label = "Next: Price";
    else if (n === 3) label = "Next: Where to list";
    else label = W.mode === "edit" ? "Save changes" : "List it";
    b.innerHTML = esc(label) + (n < 4 ? ' <span aria-hidden="true">→</span>' : "");
    b.disabled = dis;
    b.classList.toggle("lw-go", n === 4);
  }

  /* ================= STEP 1 — PHOTOS ================= */
  function step1() {
    var h = "";
    if (W.restored && W.mode === "new") h += '<div class="lw-note">Draft restored — pick up where you left off. <button type="button" class="lw-link" onclick="LW.reset()">Start over</button></div>';
    if (!PHOTOS.length) {
      h += '<div class="lw-drop">' +
        '<div class="lw-drop-ico">' + ICON.cam + '</div>' +
        '<h3>Add photos of your item</h3>' +
        '<p>Front first, then the label, the back and any flaws — up to ' + MAXP + '. AI reads the first photo and fills in the details.</p>' +
        '<div class="lw-drop-btns"><button type="button" class="lw-btn lw-btn-acc" onclick="LW.pick(\'cam\')">' + ICON.cam + ' Take photo</button>' +
        '<button type="button" class="lw-btn lw-btn-soft" onclick="LW.pick(\'gal\')">' + ICON.img + ' Choose from gallery</button></div>' +
        '<button type="button" class="lw-link lw-sample" onclick="LW.sample()">No photo handy? Try a sample</button></div>';
      return h;
    }
    h += '<div class="lw-grid" id="lw-grid">' + PHOTOS.map(function (p, i) {
      return '<button type="button" class="lw-thumb' + (i === W.sel ? " on" : "") + '" onclick="LW.sel(' + i + ')" aria-label="Photo ' + (i + 1) + (i === 0 ? ", cover" : "") + '">' +
        '<img src="' + esc(p.src || p.url) + '" alt="" decoding="async">' + (i === 0 ? '<span class="lw-cover">Cover</span>' : '<span class="lw-num">' + (i + 1) + '</span>') + '</button>';
    }).join("") + (PHOTOS.length < MAXP ? '<button type="button" class="lw-thumb lw-add" onclick="LW.pick(\'cam\')" aria-label="Take another photo">' + ICON.cam + '<small>Camera</small></button><button type="button" class="lw-thumb lw-add" onclick="LW.pick(\'gal\')" aria-label="Add from gallery">' + ICON.img + '<small>Gallery</small></button>' : "") + '</div>';
    var s = Math.min(W.sel, PHOTOS.length - 1), last = PHOTOS.length - 1;
    h += '<div class="lw-tools" id="lw-tools"><span class="lw-tools-l">' + (PHOTOS.length > 1 ? 'Photo ' + (s + 1) + ' of ' + PHOTOS.length + ' · tap a photo to pick it' : 'Add the label, back and any flaws too') + '</span>' +
      (s > 0 ? '<button type="button" class="lw-chipbtn" onclick="LW.cover()">Make cover</button>' : "") +
      (last > 0 ? '<button type="button" class="lw-chipbtn lw-sq" onclick="LW.move(-1)"' + (s === 0 ? " disabled" : "") + ' aria-label="Move left">◀</button>' +
      '<button type="button" class="lw-chipbtn lw-sq" onclick="LW.move(1)"' + (s === last ? " disabled" : "") + ' aria-label="Move right">▶</button>' : "") +
      (PHOTOS[s] && PHOTOS[s].src ? '<button type="button" class="lw-chipbtn" id="lw-clean" onclick="LW.clean()">' + ICON.spark + ' Clean background</button>' : "") +
      '<button type="button" class="lw-chipbtn lw-danger" onclick="LW.remove()">Remove</button></div>' +
      '';
    h += '<div id="lw-ai">' + aiCard() + '</div>';
    return h;
  }
  function aiCard() {
    if (W.mode === "edit" && W.aiState === "idle") return "";
    if (W.aiState === "busy") return '<div class="lw-ai busy"><span class="lw-spin" aria-hidden="true"></span><div><b>AI is looking at your item…</b><span>Name, category, brand and price fill in by themselves. You can keep going.</span></div></div>';
    if (W.aiState === "error") return '<div class="lw-ai err"><div><b>We couldn\'t read that photo</b><span>' + esc(W.aiErr || "Fill in the details yourself — it only takes a minute.") + '</span></div><button type="button" class="lw-chipbtn" onclick="LW.identify(true)">Try again</button></div>';
    if (W.aiState === "done" && W.ai) {
      var a = W.ai;
      return '<div class="lw-ai ok"><span class="lw-ok">' + ICON.check + '</span><div><b>' + esc(W.f.title || a.type || "Item identified") + '</b><span>' +
        esc([pathLabel(W.f.path), a.lo && a.hi ? ("sells for " + money0(a.lo) + "–" + money0(a.hi)) : ""].filter(Boolean).join(" · ")) +
        (a.conf ? " · " + a.conf + "% sure" : "") + '. We filled in the details — check them next.</span></div></div>';
    }
    return "";
  }
  function refreshAi() { var el = $id("lw-ai"); if (el) el.innerHTML = aiCard(); }
  function pick(which) {
    if (PHOTOS.length >= MAXP) return say("That's the maximum of " + MAXP + " photos.");
    var inp = $id(which === "cam" ? "lw-cam" : "lw-gal"); if (inp) { inp.value = ""; inp.click(); }
  }
  function files(inp) {
    var list = [].slice.call(inp.files || []).slice(0, MAXP - PHOTOS.length);
    if (!list.length) return;
    var first = !PHOTOS.length, done = 0, out = new Array(list.length);
    list.forEach(function (f, i) {
      downscale(f, function (src) {
        out[i] = src; done++;
        if (done < list.length) return;
        out.forEach(function (s) { if (s) PHOTOS.push({ id: uid(), src: s, url: null }); });
        W.restored = false;
        if (first) W.sel = 0;
        save(); if (W.step === 1) renderStep();
        if (first && PHOTOS.length && W.mode === "new") identify(false);
        coach("photo");
      });
    });
  }
  function downscale(file, cb) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var s = Math.min(1, 1024 / Math.max(img.width, img.height));
      var c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = function () { URL.revokeObjectURL(url); say("That file isn't a photo we can read."); cb(null); };
    img.src = url;
  }
  /* Photos coming from elsewhere in the app (Home "identify", the old camera modal, the sample). */
  function addPhotoB64(b64, previewUrl) {
    if (!$id("lw") || !W) mount(screenEl());
    if (PHOTOS.length >= MAXP) return;
    var first = !PHOTOS.length;
    PHOTOS.push({ id: uid(), src: "data:image/jpeg;base64," + b64, url: null, hint: /sample-jacket/i.test(String(previewUrl || "")) ? "sample" : "" });
    W.step = 1; W.restored = false; save(); renderStep();
    if (first && W.mode === "new") identify(false);
  }
  function sample() {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      addPhotoB64(c.toDataURL("image/jpeg", 0.85).split(",")[1], "sample-jacket.jpg");
    };
    img.onerror = function () { say("Couldn't load the sample — take your own photo instead."); };
    img.src = "/sample-jacket.jpg";
  }
  function sel(i) { W.sel = i; renderStep(); }
  function cover() { var p = PHOTOS.splice(W.sel, 1)[0]; PHOTOS.unshift(p); W.sel = 0; save(); renderStep(); }
  function move(d) { var i = W.sel, j = i + d; if (j < 0 || j >= PHOTOS.length) return; var t = PHOTOS[i]; PHOTOS[i] = PHOTOS[j]; PHOTOS[j] = t; W.sel = j; save(); renderStep(); }
  function remove() {
    PHOTOS.splice(W.sel, 1); W.sel = Math.max(0, Math.min(W.sel, PHOTOS.length - 1));
    if (!PHOTOS.length && W.mode === "new") { W.ai = null; W.aiState = "idle"; }
    save(); renderStep();
  }
  /* Free, on-device background cleanup: plain-backdrop flood fill first, then the
     in-browser ISNet model (lazy, ~44 MB once) for real scenes. Nothing is uploaded. */
  function clean() {
    var p = PHOTOS[W.sel]; if (!p || !p.src) return;
    var btn = $id("lw-clean"); if (btn) { btn.disabled = true; btn.textContent = "Cleaning…"; }
    import("/see-in-space/cutout.js").then(function (m) {
      return loadImg(p.src).then(function (img) {
        var cut = m.cutoutBackground(img, { maxEdge: 1024 });
        if (cut) return cut;
        say("Loading the free background tool (first time takes ~20 s)…", 5000);
        return m.aiCutout(img, { maxEdge: 1024 });
      });
    }).then(function (cut) {
      if (!cut) { say("Couldn't find the item's edges in that photo — it's unchanged."); renderStep(); return; }
      var pad = Math.round(Math.max(cut.width, cut.height) * 0.08);
      var c = document.createElement("canvas"); c.width = cut.width + pad * 2; c.height = cut.height + pad * 2;
      var x = c.getContext("2d"); x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(cut, pad, pad);
      var s = Math.min(1, 1024 / Math.max(c.width, c.height));
      var o = document.createElement("canvas"); o.width = Math.round(c.width * s); o.height = Math.round(c.height * s);
      o.getContext("2d").drawImage(c, 0, 0, o.width, o.height);
      p.src = o.toDataURL("image/jpeg", 0.86); save(); renderStep(); say("Background cleaned ✓");
    }).catch(function () { say("Background cleanup isn't available on this phone right now."); renderStep(); });
  }
  function loadImg(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }

  /* ---------- AI identify -> pre-fill everything the seller hasn't typed ---------- */
  function identify(force) {
    var p = PHOTOS[0]; if (!p || !p.src) return;
    W.aiState = "busy"; W.aiErr = ""; refreshAi(); save();
    var b64 = p.src.split(",")[1], started = W.at;
    Promise.resolve().then(function () { return identifyPhoto(b64, p.hint ? "sample-jacket.jpg" : ""); }).then(function (d) {
      if (!W || W.at !== started) return;
      if (!d || d.source === "error") throw new Error((d && d.error) || "could not read the photo");
      applyAi(d, force);
      W.aiState = "done"; save(); coach("identify");
      if (W.step === 1) refreshAi(); else if (W.step === 2) renderStep();
    }).catch(function (e) {
      if (!W || W.at !== started) return;
      W.aiState = "error"; W.aiErr = (e && e.message && e.message !== "unauthorized") ? ("" + e.message).slice(0, 120) : ""; save();
      if (W.step === 1) refreshAi();
    });
  }
  function applyAi(d, force) {
    var n = (window.IdentifyFill && IdentifyFill.normalizeIdentify) ? IdentifyFill.normalizeIdentify(d) : d;
    var path = canonPath(d.categoryPath) || canonPath(d.category) || canonPath(n.category);
    var lo = Number(n.priceMin) || 0, hi = Number(n.priceMax) || 0;
    W.ai = { type: n.type || "", conf: Number(n.confidence) || 0, lo: lo, hi: hi, note: n.note || "", material: n.material || "" };
    var brand = n.brand || "", t = W.touched, f = W.f;
    function put(k, v) { if (v && (force || !t[k] || !f[k])) f[k] = v; }
    var kind = String(n.type || "").trim();
    var col = String(d.color || n.color || "").trim();
    var title = [brand, (col && kind.toLowerCase().indexOf(col.toLowerCase()) < 0) ? titleCase0(col) : "", titleCase0(kind || (rowFor(path) || {}).sub || "Item")].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 80);
    put("title", title);
    put("path", path);
    put("brand", brand);
    var sz = n.sizeHint || "";
    if (!sz && rowFor(path) && rowFor(path).size === "one_size") sz = "One size";
    put("size", sz);
    put("cond", condFromText(d.condition) || condFromText(n.condition));
    put("color", colorFromText(col));
    put("material", n.material || "");
    if (lo && hi) put("price", String(Math.round((lo + hi) / 2)));
    if (!t.desc) f.desc = autoDesc();
  }
  function titleCase0(s) { return String(s || "").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function autoDesc() {
    var f = W.f, r = rowFor(f.path), c = condBy(f.cond);
    var kind = (W.ai && W.ai.type) || (r ? r.sub : "item");
    var first = [f.color, f.brand, String(kind).toLowerCase()].filter(Boolean).join(" ");
    first = first ? first.charAt(0).toUpperCase() + first.slice(1) + "." : "";
    return [first,
      f.size ? "Size " + f.size + "." : "",
      c ? "Condition: " + c.label.toLowerCase() + (c.k === "fair" ? " — see photos for wear." : ".") : "",
      f.material ? "Material: " + f.material + "." : "",
      (W.ai && W.ai.note && W.ai.note.length < 140 && !/graphic|not (a )?real|illustration/i.test(W.ai.note)) ? W.ai.note.replace(/\.?$/, ".") : "",
      "Smoke-free home. Ships fast. Open to reasonable offers."].filter(Boolean).join(" ");
  }

  /* ================= STEP 2 — WHAT IS IT ================= */
  function aiTag(k) { return (W.ai && !W.touched[k] && W.f[k]) ? '<span class="lw-aitag">' + ICON.spark + 'AI</span>' : ""; }
  function step2() {
    var f = W.f, h = "";
    if (W.aiState === "busy") h += '<div class="lw-ai busy slim"><span class="lw-spin" aria-hidden="true"></span><div><b>AI is still reading your photo…</b><span>Fields fill in as soon as it\'s done.</span></div></div>';
    h += '<div class="lw-field"><div class="lw-lab"><label for="lw-title">Title</label>' + aiTag("title") + '<span class="lw-count" id="lw-tcount">' + f.title.length + '/80</span></div>' +
      '<input class="lw-in" id="lw-title" maxlength="80" autocomplete="off" enterkeyhint="next" placeholder="e.g. Levi\'s blue denim trucker jacket" value="' + esc(f.title) + '" oninput="LW.set(\'title\',this.value)"><div class="lw-err" id="lw-err-title"></div></div>';
    h += '<div class="lw-field"><div class="lw-lab"><span class="lw-labt">Category</span>' + aiTag("path") + '</div>' +
      '<button type="button" class="lw-catbtn" id="lw-catbtn" onclick="LW.catOpen()" aria-expanded="false">' + catBtnInner() + '</button>' +
      '<div class="lw-catpick" id="lw-catpick" hidden></div><div class="lw-err" id="lw-err-path"></div></div>';
    h += '<div class="lw-field"><div class="lw-lab"><label for="lw-brand">Brand</label>' + aiTag("brand") + '<span class="lw-opt">optional</span></div>' +
      '<input class="lw-in" id="lw-brand" autocomplete="off" enterkeyhint="done" placeholder="Leave blank if there\'s no label" value="' + esc(f.brand) + '" oninput="LW.set(\'brand\',this.value)"></div>';
    h += '<div class="lw-field" id="lw-sizebox">' + sizeBox() + '</div>';
    h += '<div class="lw-field"><div class="lw-lab"><span class="lw-labt">Condition</span>' + aiTag("cond") + '</div><div class="lw-chips" id="lw-conds" role="radiogroup" aria-label="Condition">' + condChips() +
      '</div><p class="lw-hint" id="lw-condtip">' + esc((condBy(f.cond) || {}).tip || "Pick the closest — buyers trust honest condition.") + '</p></div>';
    h += '<div class="lw-field"><div class="lw-lab"><span class="lw-labt">Colour</span>' + aiTag("color") + '<span class="lw-opt" id="lw-colname">' + esc(W.f.color || "") + '</span></div><div class="lw-chips lw-colors" role="radiogroup" aria-label="Colour">' + colorChips() + '</div></div>';
    h += '<details class="lw-more" id="lw-more"><summary><b>More details</b><span>description · material</span>' + ICON.chev + '</summary>' +
      '<div class="lw-field"><div class="lw-lab"><label for="lw-desc">Description</label><span class="lw-opt">' + (W.touched.desc ? "edited by you" : "written for you") + '</span></div>' +
      '<textarea class="lw-in" id="lw-desc" rows="5" oninput="LW.set(\'desc\',this.value)">' + esc(f.desc || autoDesc()) + '</textarea>' +
      '<p class="lw-hint">Add measurements or flaws. Each shop gets its own version of this automatically.</p></div>' +
      '<div class="lw-field"><div class="lw-lab"><label for="lw-mat">Material</label><span class="lw-opt">optional</span></div>' +
      '<input class="lw-in" id="lw-mat" autocomplete="off" placeholder="e.g. 100% cotton" value="' + esc(f.material) + '" oninput="LW.set(\'material\',this.value)"></div></details>';
    return h;
  }
  function afterStep2() { if (!W.f.path && W.aiState !== "busy") catOpen(true); }
  function catBtnInner() {
    var p = W.f.path;
    return p ? '<span class="lw-catv"><small>' + esc(p.split("/")[0]) + '</small><b>' + esc(p.split("/").slice(1).join("/")) + '</b></span><span class="lw-catc">Change ' + ICON.chev + '</span>'
      : '<span class="lw-catv"><b class="lw-ph">Choose a category</b></span>' + ICON.chev;
  }
  var CAT_DEPT = "";
  function catOpen(force) {
    var box = $id("lw-catpick"), btn = $id("lw-catbtn"); if (!box) return;
    if (!box.hidden && force !== true) { box.hidden = true; btn.setAttribute("aria-expanded", "false"); return; }
    CAT_DEPT = (W.f.path && W.f.path.split("/")[0]) || CAT_DEPT || (cat().departments[0] || "Women");
    box.hidden = false; btn.setAttribute("aria-expanded", "true");
    box.innerHTML = '<div class="lw-search">' + ICON.search + '<input class="lw-in" id="lw-catq" type="search" autocomplete="off" enterkeyhint="search" placeholder="Search ' + cat().categories.length + ' types: sneakers, lamp…" oninput="LW.catSearch(this.value)"></div>' +
      '<div class="lw-depts" role="tablist">' + cat().departments.map(function (d) { return '<button type="button" role="tab" aria-selected="' + (d === CAT_DEPT) + '" class="lw-dept' + (d === CAT_DEPT ? " on" : "") + '" data-v="' + esc(d) + '" onclick="LW.catDept(this.getAttribute(\'data-v\'))">' + esc(d) + '</button>'; }).join("") + '</div>' +
      '<div id="lw-catlist">' + catList(CAT_DEPT, "") + '</div>';
  }
  function catList(dept, q) {
    var rows = cat().categories, cur = W.f.path;
    q = String(q || "").trim().toLowerCase();
    if (q) {
      var hit = rows.filter(function (r) { return (r.sub + " " + r.dept + " " + r.group).toLowerCase().indexOf(q) > -1; }).slice(0, 24);
      if (!hit.length) return '<p class="lw-hint">No match — try a simpler word, or pick a department above.</p>';
      return '<div class="lw-chips">' + hit.map(function (r) { return catChip(r, cur, true); }).join("") + '</div>';
    }
    var GL = { clothing: "Clothing", shoes: "Shoes", bags: "Bags & jewelry", jewelry: "Bags & jewelry", accessory: "Accessories" };
    var order = [], by = {};
    rows.filter(function (r) { return r.dept === dept; }).forEach(function (r) { var g = GL[r.group] || ""; if (!by[g]) { by[g] = []; order.push(g); } by[g].push(r); });
    return order.map(function (g) { return (g && order.length > 1 ? '<div class="lw-group">' + esc(g) + '</div>' : "") + '<div class="lw-chips">' + by[g].map(function (r) { return catChip(r, cur, false); }).join("") + '</div>'; }).join("");
  }
  function catChip(r, cur, withDept) {
    return '<button type="button" class="lw-chip' + (r.path === cur ? " on" : "") + '" data-v="' + esc(r.path) + '" onclick="LW.catSet(this.getAttribute(\'data-v\'))">' + (withDept ? '<small>' + esc(r.dept) + ' › </small>' : "") + esc(r.sub) + '</button>';
  }
  function catDept(d) {
    CAT_DEPT = d; var q = $id("lw-catq"); if (q) q.value = "";
    [].forEach.call(document.querySelectorAll(".lw-dept"), function (b) { var on = b.getAttribute("data-v") === d; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    var l = $id("lw-catlist"); if (l) l.innerHTML = catList(d, "");
  }
  function catSearch(q) { var l = $id("lw-catlist"); if (l) l.innerHTML = catList(CAT_DEPT, q); }
  function catSet(path) {
    W.f.path = path; W.touched.path = true;
    var sizes = sizesFor(path), r = rowFor(path);
    if (r && r.size === "one_size") W.f.size = "One size";
    else if (W.f.size && sizes.length && sizes.indexOf(W.f.size) < 0 && !W.touched.size) W.f.size = "";
    if (r && r.size === "dims") W.f.size = "";
    if (!W.touched.desc) W.f.desc = autoDesc();
    save();
    var b = $id("lw-catbtn"); if (b) { b.innerHTML = catBtnInner(); b.setAttribute("aria-expanded", "false"); }
    var box = $id("lw-catpick"); if (box) { box.hidden = true; box.innerHTML = ""; }
    var sb = $id("lw-sizebox"); if (sb) sb.innerHTML = sizeBox();
    var e = $id("lw-err-path"); if (e) e.textContent = "";
    syncDesc();
  }
  function sizeBox() {
    var f = W.f, r = rowFor(f.path), sizes = sizesFor(f.path);
    if (!f.path) return '<div class="lw-lab"><span class="lw-labt">Size</span></div><p class="lw-hint">Pick a category first — the size options follow it.</p>';
    if (r && r.size === "dims") return '<div class="lw-lab"><span class="lw-labt">Size</span></div><p class="lw-hint">No size for this type. Put width × height in the description (More details).</p>';
    var custom = f.size && sizes.indexOf(f.size) < 0;
    return '<div class="lw-lab"><span class="lw-labt">Size</span>' + aiTag("size") + '<span class="lw-opt">as on the label</span></div><div class="lw-chips lw-sizes" role="radiogroup" aria-label="Size">' +
      sizes.map(function (z) { return '<button type="button" role="radio" aria-checked="' + (f.size === z) + '" class="lw-chip lw-sz' + (f.size === z ? " on" : "") + '" data-v="' + esc(z) + '" onclick="LW.size(this.getAttribute(\'data-v\'))">' + esc(z) + '</button>'; }).join("") +
      '<button type="button" class="lw-chip lw-sz' + (custom ? " on" : "") + '" onclick="LW.sizeOther()">' + (custom ? esc(f.size) : "Other") + '</button></div>' +
      '<input class="lw-in lw-sizein" id="lw-sizein" ' + (custom ? "" : "hidden") + ' autocomplete="off" placeholder="Type the size on the label" value="' + esc(custom ? f.size : "") + '" oninput="LW.set(\'size\',this.value)">';
  }
  function condChips() {
    var f = W.f;
    return COND.map(function (c) { return '<button type="button" role="radio" aria-checked="' + (f.cond === c.k) + '" class="lw-chip' + (f.cond === c.k ? " on" : "") + '" onclick="LW.cond(\'' + c.k + '\')">' + esc(c.label) + '</button>'; }).join("");
  }
  function colorChips() {
    var cur = W.f.color, known = COLORS.some(function (c) { return c[0] === cur; });
    return COLORS.map(function (c) {
      return '<button type="button" role="radio" aria-checked="' + (cur === c[0]) + '" class="lw-sw' + (cur === c[0] ? " on" : "") + '" data-v="' + c[0] + '" aria-label="' + c[0] + '" title="' + c[0] + '" onclick="LW.color(this.getAttribute(\'data-v\'))"><i style="background:' + c[1] + '"></i></button>';
    }).join("") + (cur && !known ? '<button type="button" role="radio" aria-checked="true" class="lw-chip lw-col on" data-v="' + esc(cur) + '" onclick="LW.color(this.getAttribute(\'data-v\'))">' + esc(cur) + '</button>' : "");
  }
  function set(k, v) {
    W.f[k] = v; W.touched[k] = true;
    if (k === "title") { var c = $id("lw-tcount"); if (c) c.textContent = v.length + "/80"; var e = $id("lw-err-title"); if (e && v.trim()) e.textContent = ""; }
    if (k !== "desc" && !W.touched.desc) { W.f.desc = autoDesc(); syncDesc(); }
    save();
  }
  function syncDesc() { var d = $id("lw-desc"); if (d && !W.touched.desc && document.activeElement !== d) d.value = W.f.desc || autoDesc(); }
  function cond(k) {
    W.f.cond = k; W.touched.cond = true; if (!W.touched.desc) W.f.desc = autoDesc(); save();
    var box = $id("lw-conds"); if (box) box.innerHTML = condChips();
    var t = $id("lw-condtip"); if (t) t.textContent = (condBy(k) || {}).tip || ""; syncDesc();
  }
  function size(z) { W.f.size = z; W.touched.size = true; if (!W.touched.desc) W.f.desc = autoDesc(); save(); var sb = $id("lw-sizebox"); if (sb) sb.innerHTML = sizeBox(); syncDesc(); }
  function sizeOther() { var i = $id("lw-sizein"); if (!i) return; i.hidden = false; i.focus(); [].forEach.call(document.querySelectorAll(".lw-sz"), function (b) { b.classList.remove("on"); b.setAttribute("aria-checked", "false"); }); }
  function color(c) { W.f.color = (W.f.color === c) ? "" : c; W.touched.color = true; if (!W.touched.desc) W.f.desc = autoDesc(); save(); var box = document.querySelector(".lw-colors"); if (box) box.innerHTML = colorChips(); var cn = $id("lw-colname"); if (cn) cn.textContent = W.f.color || ""; syncDesc(); }

  /* ================= STEP 3 — PRICE ================= */
  var SHIP = [
    { k: "buyer", t: "Buyer pays shipping", s: "Recommended. Depop, Poshmark, Mercari and eBay give you a prepaid label." },
    { k: "free", t: "Free shipping", s: "You cover the label, about $8 for clothing. Free shipping sells faster." },
    { k: "pickup", t: "Local pickup", s: "The buyer collects from you. No label, no fee." }
  ];
  function step3() {
    var f = W.f, a = W.ai || {}, h = "";
    h += '<div class="lw-price"><label for="lw-price">Your price</label><div class="lw-pricebox">' +
      '<button type="button" class="lw-step" onclick="LW.bump(-1)" aria-label="Lower price by $1">−</button>' +
      '<span class="lw-cur">$</span><input id="lw-price" class="lw-pricein" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="0" value="' + esc(f.price) + '" oninput="LW.price(this.value)">' +
      '<button type="button" class="lw-step" onclick="LW.bump(1)" aria-label="Raise price by $1">+</button></div><div class="lw-err" id="lw-err-price"></div></div>';
    if (a.lo && a.hi) {
      var mid = Math.round((a.lo + a.hi) / 2);
      h += '<div class="lw-range"><div class="lw-range-h">' + ICON.spark + ' Similar items sell for <b>' + money0(a.lo) + '–' + money0(a.hi) + '</b></div>' +
        '<div class="lw-track"><i id="lw-mark"></i></div><div class="lw-range-l"><span>' + money0(a.lo) + '</span><span>' + money0(a.hi) + '</span></div>' +
        '<div class="lw-chips lw-quick"><button type="button" class="lw-chip" onclick="LW.price(\'' + a.lo + '\',1)"><small>Sell fast</small>' + money0(a.lo) + '</button>' +
        '<button type="button" class="lw-chip" onclick="LW.price(\'' + mid + '\',1)"><small>Suggested</small>' + money0(mid) + '</button>' +
        '<button type="button" class="lw-chip" onclick="LW.price(\'' + a.hi + '\',1)"><small>Top</small>' + money0(a.hi) + '</button></div>' +
        '<p class="lw-hint">AI estimate from your photo and typical resale prices for this category — not live sold data.</p></div>';
    } else {
      h += '<p class="lw-hint lw-range">No AI estimate for this one — pick a price you\'d be happy to get.</p>';
    }
    h += '<div class="lw-field"><div class="lw-lab"><span class="lw-labt">Shipping</span></div><div class="lw-ship" role="radiogroup" aria-label="Shipping">' +
      SHIP.map(function (s) { return '<button type="button" role="radio" aria-checked="' + (f.ship === s.k) + '" class="lw-shipopt' + (f.ship === s.k ? " on" : "") + '" onclick="LW.ship(\'' + s.k + '\')"><i></i><span><b>' + s.t + '</b><small>' + s.s + '</small></span></button>'; }).join("") + '</div></div>';
    h += '<div class="lw-field"><div class="lw-lab"><span class="lw-labt">What you keep</span><span class="lw-opt">after each shop\'s fee</span></div><div class="lw-keep" id="lw-keep"></div>' +
      '<p class="lw-hint">Fee estimates for US sellers. Shops change them now and then.</p></div>';
    return h;
  }
  function feeFor(id, p) {
    var m = FEES[id] || { pct: 0 };
    if (m.posh) return p < 15 ? 2.95 : p * 0.2;
    return p * (m.pct || 0) / 100 + (p > 0 ? (m.flat || 0) : 0);
  }
  function feeLabel(id) { var m = FEES[id] || {}; return m.posh ? "20% ($2.95 under $15)" : (m.pct || 0) + "% fee" + (m.flat ? " + " + money0(m.flat) : ""); }
  function refreshKeep() {
    var box = $id("lw-keep"); if (!box) return;
    var p = parseFloat(W.f.price) || 0, label = W.f.ship === "free" ? 8 : 0;
    var rows = [{ name: "fashionistas.ai", fee: 0, lab: "No commission", logo: FASH_LOGO }].concat(SHOPS.map(function (s) {
      return { name: s.name, fee: feeFor(s.id, p), lab: feeLabel(s.id), logo: logo(s) };
    }));
    box.innerHTML = p ? rows.map(function (r) {
      var keep = Math.max(0, Math.round((p - r.fee - label) * 100) / 100);
      return '<div class="lw-krow">' + r.logo + '<span class="lw-kn"><b>' + esc(r.name) + '</b><small>' + esc(r.lab) + (label ? " · −$8 label" : "") + '</small></span><b class="lw-kv">' + money0(keep) + '</b></div>';
    }).join("") : '<p class="lw-hint">Enter a price to see what lands in your pocket on each shop.</p>';
    var mk = $id("lw-mark"), a = W.ai || {};
    if (mk && a.lo && a.hi) { var x = Math.max(0, Math.min(1, (p - a.lo) / Math.max(1, a.hi - a.lo))); mk.style.left = (x * 100) + "%"; mk.style.opacity = p ? "1" : "0"; }
  }
  var keepT = null;
  function price(v, fromChip) {
    v = String(v).replace(/[^0-9.]/g, "");
    W.f.price = v; W.touched.price = true; save();
    if (fromChip) { var i = $id("lw-price"); if (i) i.value = v; }
    var e = $id("lw-err-price"); if (e && parseFloat(v) > 0) e.textContent = "";
    clearTimeout(keepT); keepT = setTimeout(refreshKeep, fromChip ? 0 : 120);
  }
  function bump(d) { var p = Math.max(1, Math.round((parseFloat(W.f.price) || 0) + d)); price(String(p), true); }
  function ship(k) { W.f.ship = k; save(); [].forEach.call(document.querySelectorAll(".lw-shipopt"), function (b, i) { var on = SHIP[i].k === k; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }); refreshKeep(); }

  /* ================= STEP 4 — WHERE TO LIST ================= */
  var EBAY_LIVE = null;
  function ebayCheck() {
    if (EBAY_LIVE !== null) return;
    EBAY_LIVE = false;
    fetch("/api/ebay/status", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) {
      EBAY_LIVE = !!(d && d.connected);
      if (EBAY_LIVE) { var t = $id("lw-mode-ebay"); if (t) t.innerHTML = modeTag("ebay"); }
    }).catch(function () {});
  }
  function modeTag(id) {
    if (id === "ebay" && EBAY_LIVE) return '<span class="lw-mode auto">Direct post · connected</span>';
    if (id === "ebay" || id === "etsy") return '<span class="lw-mode">Guided · direct posting coming soon</span>';
    return '<span class="lw-mode">Guided · about 1 min</span>';
  }
  function cover0() { return PHOTOS[0] ? (PHOTOS[0].src || PHOTOS[0].url) : ""; }
  function step4() {
    ebayCheck();
    var f = W.f, c = condBy(f.cond), h = "";
    h += '<div class="lw-review">' + (cover0() ? '<img src="' + esc(cover0()) + '" alt="">' : '<div class="lw-noimg">No photo</div>') +
      '<div class="lw-rv"><b class="lw-rvt">' + esc(f.title || "Untitled") + '</b><span class="lw-rvp">' + (parseFloat(f.price) ? money0(parseFloat(f.price)) : "No price") + '</span>' +
      '<span class="lw-rvm">' + esc([pathLabel(f.path), f.size ? "Size " + f.size : "", c ? c.label : ""].filter(Boolean).join(" · ")) + '</span>' +
      '<span class="lw-rve"><button type="button" class="lw-link" onclick="LW.to(1)">Photos</button><button type="button" class="lw-link" onclick="LW.to(2)">Details</button><button type="button" class="lw-link" onclick="LW.to(3)">Price</button></span></div></div>';
    if (W.mode === "edit") {
      h += '<p class="lw-hint">Saving updates the listing on fashionistas.ai. To update another shop, open the item and use <b>Post to your shops</b> again.</p>';
      return h;
    }
    h += '<div class="lw-lab lw-lab-top"><span class="lw-labt">Where to list</span><span class="lw-opt" id="lw-shopcount"></span></div>';
    h += '<div class="lw-shop lw-shop-fixed">' + FASH_LOGO + '<span class="lw-sn"><b>fashionistas.ai</b><span class="lw-mode auto">Live the moment you tap List it</span></span><span class="lw-tgl on locked" aria-hidden="true"><i></i></span></div>';
    h += SHOPS.map(function (s) {
      var ok = shopTakes(s.id, f.path), on = ok && !!W.shops[s.id];
      return '<button type="button" class="lw-shop' + (ok ? "" : " na") + '" role="switch" data-shop="' + s.id + '" aria-checked="' + on + '" onclick="LW.shop(\'' + s.id + '\')"' + (ok ? "" : " disabled") + '>' + logo(s) +
        '<span class="lw-sn"><b>' + esc(s.name) + '</b><span id="lw-mode-' + s.id + '">' + (ok ? modeTag(s.id) : '<span class="lw-mode">Doesn\'t take this category</span>') + '</span></span><span class="lw-tgl' + (on ? " on" : "") + '"><i></i></span></button>';
    }).join("");
    h += '<p class="lw-hint lw-how">After <b>List it</b>, each shop gets a ready-to-go version: words to copy, photos sent through your phone\'s share sheet, and a button to their sell page. Nothing to install. A shop only counts as posted when you tell us.</p>';
    setTimeout(shopCount, 0);
    return h;
  }
  function shopTakes(id, path) {
    if (!path) return true;
    var r = rowFor(path); if (!r) return true;
    if (id === "ebay") return !!(r.ebay && r.ebay.id);
    if (id === "etsy") return !!r.etsy;
    return !!(r.shops && r.shops[id]);
  }
  function picked() { return SHOPS.filter(function (s) { return W.shops[s.id] && shopTakes(s.id, W.f.path); }).map(function (s) { return s.id; }); }
  function shopCount() { var e = $id("lw-shopcount"); if (e && W) e.textContent = (picked().length + 1) + " selected"; }
  function shop(id) {
    W.shops[id] = W.shops[id] ? 0 : 1; save();
    var b = document.querySelector('.lw-shop[data-shop="' + id + '"]');
    if (b) { var on = !!W.shops[id]; b.setAttribute("aria-checked", String(on)); var t = b.querySelector(".lw-tgl"); if (t) t.classList.toggle("on", on); }
    shopCount();
  }

  /* ================= navigation ================= */
  function validate(n) {
    var f = W.f;
    if (n === 1 && !PHOTOS.length) { say("Add at least one photo."); return false; }
    if (n === 2) {
      if (!f.title.trim()) { var e = $id("lw-err-title"); if (e) e.textContent = "Give it a title — buyers search by it."; var i = $id("lw-title"); if (i) { i.focus(); i.scrollIntoView({ block: "center" }); } return false; }
      if (!f.path) { var e2 = $id("lw-err-path"); if (e2) e2.textContent = "Pick a category so buyers can find it."; catOpen(true); var b = $id("lw-catbtn"); if (b) b.scrollIntoView({ block: "center" }); return false; }
    }
    if (n === 3 && !(parseFloat(f.price) > 0)) { var e3 = $id("lw-err-price"); if (e3) e3.textContent = "Set a price to continue."; var p = $id("lw-price"); if (p) p.focus(); return false; }
    return true;
  }
  function validateQuiet(n) {
    var f = W.f;
    if (n === 1) return PHOTOS.length > 0;
    if (n === 2) return !!(f.title.trim() && f.path);
    if (n === 3) return parseFloat(f.price) > 0;
    return true;
  }
  function next() {
    if (!W) return;
    var n = W.step;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (!validate(n)) return;
    if (n === 2) coach("listing");
    if (n < 4) { W.step = n + 1; W.restored = false; save(); renderStep(); return; }
    submit();
  }
  function back() { if (W && W.step > 1) { W.step--; save(); renderStep(); } }
  function to(n) { if (W) { W.step = n; save(); renderStep(); } }
  function reset() { clearDraft(); W = fresh(); PHOTOS = []; renderStep(); }
  function help() {
    try { if (window.SellerCoach && SellerCoach.ask) return SellerCoach.ask(W && W.step === 4 ? "How do I post to my other shops?" : "How do I list something from a photo?"); } catch (e) {}
    try { guideToggle(true); } catch (e) {}
  }

  /* ---------- List it ---------- */
  var BUSY = false;
  function weightFor(path) { var r = rowFor(path) || {}; return { clothing: 16, shoes: 48, bags: 32, jewelry: 4, accessory: 8 }[r.group] || (r.dept === "Home" ? 80 : r.dept === "Art" ? 64 : 16); }
  function submit() {
    if (BUSY) return;
    if (!TOKEN) { flush(); say("Sign in first — your draft is saved.", 4000); try { showAuth("login"); } catch (e) {} return; }
    for (var n = 1; n <= 3; n++) if (!validateQuiet(n)) { W.step = n; renderStep(); validate(n); return; }
    BUSY = true;
    var b = $id("lw-next"); if (b) { b.disabled = true; b.innerHTML = '<span class="lw-spin sm" aria-hidden="true"></span> Uploading photo…'; }
    var f = W.f, c = condBy(f.cond), cov = PHOTOS[0];
    var up = (cov && cov.src) ? uploadB64(cov.src.split(",")[1], f.title) : Promise.resolve(cov ? cov.url : null);
    Promise.resolve(up).then(function (url) {
      if (!url) throw new Error("Couldn't upload your photo. Check your connection and tap List it again.");
      if (b) b.innerHTML = '<span class="lw-spin sm" aria-hidden="true"></span> ' + (W.mode === "edit" ? "Saving…" : "Creating your listing…");
      var body = {
        title: f.title.trim().slice(0, 80), description: (f.desc || autoDesc()).trim(), price: parseFloat(f.price), size: f.size || "",
        condition: c ? c.store : "Good", category: f.path, photo_url: url, ai_confidence: W.ai ? W.ai.conf : null,
        brand: f.brand.trim(), color: f.color || "", material: f.material.trim(), weight_oz: weightFor(f.path),
        local_pickup: f.ship === "pickup"
      };
      return api(W.mode === "edit" ? "/api/listings/" + W.listingId : "/api/listings", { method: W.mode === "edit" ? "PUT" : "POST", body: JSON.stringify(body) })
        .then(function (d) { return { d: d, body: body }; });
    }).then(function (r) {
      var l = Object.assign({ id: W.listingId }, r.body, (r.d && r.d.listing) || {});
      if (!l.id) throw new Error("The listing was not created — please try again.");
      try { S.listings = (S.listings || []).filter(function (x) { return Number(x.id) !== Number(l.id); }).concat([l]); S.market = []; } catch (e) {}
      var wasEdit = W.mode === "edit";
      var shops = wasEdit ? null : picked();
      var ph = PHOTOS.map(function (p) { return p.src || p.url; });
      BUSY = false;
      if (!wasEdit) { try { localStorage.setItem(SHOPKEY, JSON.stringify(W.shops)); } catch (e) {} clearDraft(); }
      W = null; PHOTOS = [];
      if (wasEdit) { say("Saved ✓"); try { openListing(Number(l.id)); } catch (e) { go("closet"); } return; }
      coach("list");
      rememberPost(l.id, shops, ph);
      say("Listed on fashionistas.ai ✓");
      post(l.id, { fresh: true });
    }).catch(function (e) {
      BUSY = false;
      if (b) { b.disabled = false; footer(); }
      if (e && e.message === "unauthorized") return;
      say((e && e.message) || "Something went wrong — your draft is saved, try again.", 5000);
    });
  }
  function rememberPost(id, shops, photos) {
    var o = { id: id, shops: shops, photos: photos, at: Date.now() };
    try { localStorage.setItem(LASTKEY, JSON.stringify(o)); }
    catch (e) { o.photos = photos.slice(0, 1); try { localStorage.setItem(LASTKEY, JSON.stringify(o)); } catch (e2) {} }
    try { localStorage.setItem("fash_lw_post_" + id, JSON.stringify(shops)); } catch (e) {}
  }
  function lastPost(id) { try { var o = JSON.parse(localStorage.getItem(LASTKEY) || "null"); return (o && Number(o.id) === Number(id)) ? o : null; } catch (e) { return null; } }

  /* ================= POST IT EVERYWHERE ================= */
  var P = null;   // { l, shops[], open, photos[], files: Promise<File[]>, flags{} }
  function post(id, opts) {
    opts = opts || {};
    var el = screenEl(); if (!el) return;
    root.classList.add("lw-on");
    setHead("Post it everywhere", "");
    var l = null;
    try { l = (S.listings || []).find(function (x) { return Number(x.id) === Number(id); }) || null; } catch (e) {}
    var start = function (l) {
      if (!l) { el.innerHTML = '<div class="empty">That listing could not be found.</div>'; return; }
      var lp = lastPost(id), shops = (lp && lp.shops) || null;
      try { var saved = JSON.parse(localStorage.getItem("fash_lw_post_" + id) || "null"); if (Array.isArray(saved)) shops = saved; } catch (e) {}
      if (!shops) { var ls = loadShops(); shops = SHOPS.filter(function (s) { return ls[s.id]; }).map(function (s) { return s.id; }); }
      var path = canonPath(l.category);
      shops = shops.filter(function (s) { return shopById(s) && shopTakes(s, path); });
      var photos = (lp && lp.photos && lp.photos.length) ? lp.photos : (l.photo_url ? [l.photo_url] : []);
      P = { l: l, shops: shops, open: null, photos: photos, files: buildFiles(photos, l.title), flags: {} };
      ebayCheck();
      renderPost(!!opts.fresh);
    };
    if (l) return start(l);
    el.innerHTML = '<div class="card"><div class="spinner"></div></div>';
    api("/api/listings").then(function (d) { S.listings = d.listings || []; start(S.listings.find(function (x) { return Number(x.id) === Number(id); })); })
      .catch(function (e) { el.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  }
  function buildFiles(srcs, title) {
    var base = String(title || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "item";
    return Promise.all(srcs.map(function (s, i) {
      return fetch(s, { mode: "cors" }).then(function (r) { if (!r.ok) throw new Error("photo"); return r.blob(); })
        .then(function (b) { return new File([b], base + "-" + (i + 1) + ".jpg", { type: b.type || "image/jpeg" }); })
        .catch(function () { return null; });
    })).then(function (a) { return a.filter(Boolean); });
  }
  function stateOf(shop) { try { var s = handoffStateOf(shop, P.l.id); return s && s.status; } catch (e) { return null; } }
  function doneCount() { return P.shops.filter(function (s) { return stateOf(s) === "posted"; }).length; }
  function renderPost(fresh) {
    var el = screenEl(); if (!el || !P) return;
    var l = P.l, path = canonPath(l.category);
    if (P.open === null) P.open = P.shops.filter(function (s) { return stateOf(s) !== "posted"; })[0] || "";
    var n = P.shops.length, d = doneCount();
    var h = '<div class="lw lw-post" id="lw">';
    h += '<div class="lw-live">' + (l.photo_url ? '<img src="' + esc(l.photo_url) + '" alt="">' : "") + '<div class="lw-livet"><span class="lw-livek">' + ICON.check + (fresh ? " Listed!" : " Live") + '</span><b>' + esc(l.title || "Your item") + '</b><span>' + money0(Number(l.price) || 0) + ' · on sale on fashionistas.ai</span>' +
      '<span class="lw-livea"><button type="button" class="lw-link" onclick="LW.view(' + Number(l.id) + ')">View listing</button><button type="button" class="lw-link" onclick="LW.edit(' + Number(l.id) + ')">Edit</button></span></div></div>';
    if (n) h += '<div class="lw-pp"><div class="lw-stepline"><b>' + d + ' of ' + n + ' shops posted</b><span>' + (d === n ? "All done" : "3 quick steps each") + '</span></div><div class="lw-bar"><i style="width:' + Math.round(d / n * 100) + '%"></i></div></div>';
    else h += '<p class="lw-hint">Add a shop below to post this item there too.</p>';
    h += P.shops.map(function (id) { return shopCard(id, path); }).join("");
    var rest = SHOPS.filter(function (s) { return P.shops.indexOf(s.id) < 0 && shopTakes(s.id, path); });
    if (rest.length) h += '<div class="lw-addshops"><span class="lw-labt">Add a shop</span><div class="lw-chips">' + rest.map(function (s) { return '<button type="button" class="lw-chip lw-chip-shop" data-v="' + s.id + '" onclick="LW.addShop(this.getAttribute(\'data-v\'))">' + logo(s, 22) + esc(s.name) + '<span aria-hidden="true">+</span></button>'; }).join("") + '</div></div>';
    h += '<p class="lw-hint lw-how">These shops don\'t let other apps post for you, so we do everything up to the last tap: the words are copied for you, the photos go straight into their app, and you press Post there. The status here is what you\'ve told us.</p>';
    h += '<div class="lw-foot"><button type="button" class="lw-next lw-ghost" onclick="LW.done()">' + (n && d === n ? "All done — see my items" : "Finish later — it's saved") + '</button></div>';
    h += '</div>';
    el.innerHTML = h;
  }
  function condFor(shop, l) { var c = condBy(condFromText(l.condition)); return c ? (c[shop] || "") : (l.condition || ""); }
  function shopTitle(shop, l) { try { return xlKitTitle(xlKitRules(shop), l); } catch (e) { return l.title || ""; } }
  function shopDesc(shop, l) {
    var base;
    try { base = (shop === "etsy") ? (l.description || "") : xlKitDescription(xlKitRules(shop), l); } catch (e) { base = l.description || ""; }
    if (shop === "depop" && l.title && base.indexOf(l.title) !== 0) base = l.title + "\n\n" + base;
    return base;
  }
  function fieldRow(label, value, key) {
    if (!value) return "";
    return '<button type="button" class="lw-frow" data-k="' + esc(key) + '" onclick="LW.copy(this.getAttribute(\'data-k\'),this)"><span><small>' + esc(label) + '</small><b>' + esc(value) + '</b></span><em>' + ICON.copy + '<i>Copy</i></em></button>';
  }
  function shopCard(id, path) {
    var s = shopById(id), l = P.l, st = stateOf(id), open = P.open === id, fl = P.flags[id] || {};
    var done = st === "posted";
    var head = '<button type="button" class="lw-pc-h" data-v="' + id + '" onclick="LW.openShop(this.getAttribute(\'data-v\'))" aria-expanded="' + open + '">' + logo(s) + '<span class="lw-sn"><b>' + esc(s.name) + '</b>' +
      (done ? '<span class="lw-mode auto">Posted · marked by you</span>' : (id === "ebay" && EBAY_LIVE ? '<span class="lw-mode auto">Direct post available</span>' : '<span class="lw-mode">To do · about 1 min</span>')) +
      '</span><span class="lw-pc-st' + (done ? " ok" : "") + (open ? " up" : "") + '">' + (done ? ICON.check : ICON.chev) + '</span></button>';
    if (!open) return '<div class="lw-pc' + (done ? " done" : "") + '" id="lw-pc-' + id + '">' + head + '</div>';
    var canShare = !!(navigator.canShare && navigator.share);
    var catP = shopCat(path, id), desc = shopDesc(id, l);
    var b = '<div class="lw-pc-b">';
    if (id === "ebay" && EBAY_LIVE) {
      b += '<div class="lw-pstep"><span class="lw-pn">★</span><div><b>Post directly to eBay</b><small>Your eBay account is connected, so we can create it for you.</small><button type="button" class="lw-btn lw-btn-acc lw-btn-sm" onclick="LW.ebay()">Create on eBay</button><div id="xl-ebay-create-msg" class="lw-hint"></div></div></div>';
    }
    b += '<div class="lw-pstep' + (fl.photos ? " ok" : "") + '"><span class="lw-pn">' + (fl.photos ? ICON.check : "1") + '</span><div><b>Send the photos to ' + esc(s.name) + '</b>' +
      '<small>' + (canShare ? "Opens your share sheet — pick the " + esc(s.name) + " app. The description is copied at the same time." : "This browser can't hand photos to apps. Save them, then add them on " + esc(s.name) + ".") + '</small>' +
      '<button type="button" class="lw-btn lw-btn-acc lw-btn-sm" data-v="' + id + '" onclick="LW.share(this.getAttribute(\'data-v\'))">' + ICON.share + (canShare ? " Share photos" : " Save photos") + '</button></div></div>';
    b += '<div class="lw-pstep' + (fl.opened ? " ok" : "") + '"><span class="lw-pn">' + (fl.opened ? ICON.check : "2") + '</span><div><b>Open ' + esc(s.name) + ' and paste</b><small>Tap a line to copy it, then paste it into the matching box.</small>' +
      '<a class="lw-btn lw-btn-soft lw-btn-sm" href="' + esc(s.sell) + '" target="_blank" rel="noopener" data-v="' + id + '" onclick="LW.opened(this.getAttribute(\'data-v\'))">Open ' + esc(s.name) + ' ' + ICON.ext + '</a></div></div>';
    b += '<div class="lw-fields">' +
      (s.noTitle ? "" : fieldRow("Title", shopTitle(id, l), id + ":title")) +
      fieldRow("Description", desc.length > 110 ? desc.slice(0, 108).replace(/\s+\S*$/, "") + "…" : desc, id + ":desc") +
      fieldRow("Price", String(Number(l.price) || ""), id + ":price") +
      fieldRow(id === "ebay" ? "Category (eBay id)" : "Category", catP || pathLabel(path), id + ":cat") +
      fieldRow("Brand", l.brand, id + ":brand") +
      fieldRow("Size", l.size, id + ":size") +
      fieldRow("Condition", condFor(id, l), id + ":cond") +
      fieldRow("Colour", l.color, id + ":color") + '</div>';
    b += '<div class="lw-pstep last"><span class="lw-pn">3</span><div><b>Posted it?</b><small>Tell us so your list stays honest.</small>' +
      (done ? '<button type="button" class="lw-btn lw-btn-soft lw-btn-sm" data-v="' + id + '" onclick="LW.mark(this.getAttribute(\'data-v\'),0)">Undo — not posted yet</button>'
        : '<button type="button" class="lw-btn lw-btn-dark lw-btn-sm" data-v="' + id + '" onclick="LW.mark(this.getAttribute(\'data-v\'),1)">' + ICON.check + ' Yes, it\'s live on ' + esc(s.name) + '</button>') + '</div></div>';
    b += '</div>';
    return '<div class="lw-pc open' + (done ? " done" : "") + '" id="lw-pc-' + id + '">' + head + b + '</div>';
  }
  function textFor(key) {
    var parts = String(key).split(":"), id = parts[0], k = parts[1], l = P.l, path = canonPath(l.category);
    if (k === "title") return shopTitle(id, l);
    if (k === "desc") return shopDesc(id, l);
    if (k === "price") return String(Number(l.price) || "");
    if (k === "cat") return shopCat(path, id) || pathLabel(path);
    if (k === "brand") return l.brand || "";
    if (k === "size") return l.size || "";
    if (k === "cond") return condFor(id, l);
    if (k === "color") return l.color || "";
    return "";
  }
  function clip(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return legacyCopy(t); });
    return Promise.resolve(legacyCopy(t));
  }
  function legacyCopy(t) { try { var a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.position = "fixed"; a.style.opacity = "0"; document.body.appendChild(a); a.select(); var ok = document.execCommand("copy"); a.remove(); return ok; } catch (e) { return false; } }
  function copy(key, btn) {
    var t = textFor(key), k = String(key).split(":")[1], s = shopById(String(key).split(":")[0]) || {};
    clip(t).then(function (ok) {
      if (!ok) return say("Copy was blocked — press and hold the text to copy it.");
      if (btn) { btn.classList.add("copied"); var i = btn.querySelector("em i"); if (i) i.textContent = "Copied"; setTimeout(function () { btn.classList.remove("copied"); if (i) i.textContent = "Copy"; }, 1600); }
      say({ title: "Title", desc: "Description", price: "Price", cat: "Category", brand: "Brand", size: "Size", cond: "Condition", color: "Colour" }[k] + " copied — paste it into " + s.name + ".");
    });
  }
  function share(id) {
    var s = shopById(id), l = P.l;
    var text = shopDesc(id, l);
    var flag = function () { P.flags[id] = Object.assign({}, P.flags[id], { photos: true }); rerenderCard(id); };
    clip(text);
    P.files.then(function (files) {
      if (files.length && navigator.canShare && navigator.canShare({ files: files })) {
        return navigator.share({ files: files, title: shopTitle(id, l) }).then(function () { flag(); say("Photos sent. The description is copied — paste it into " + s.name + "."); },
          function (e) { if (!e || e.name !== "AbortError") say("Sharing didn't work here — tap again, or save the photos from View listing."); });
      }
      if (!files.length && !(P.photos || []).length) return say("This listing has no photos to send.");
      (files.length ? files.map(function (f) { return URL.createObjectURL(f); }) : P.photos).forEach(function (u, i) {
        var a = document.createElement("a"); a.href = u; a.download = (files[i] && files[i].name) || ("photo-" + (i + 1) + ".jpg"); a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
      });
      flag(); say("Photos saved. The description is copied too.");
    });
  }
  function opened(id) { P.flags[id] = Object.assign({}, P.flags[id], { opened: true }); setTimeout(function () { rerenderCard(id); }, 400); }
  function rerenderCard(id) { var c = $id("lw-pc-" + id); if (!c || !P) return; var w = document.createElement("div"); w.innerHTML = shopCard(id, canonPath(P.l.category)); c.replaceWith(w.firstElementChild); }
  function mark(id, on) {
    try { handoffSet(id, P.l.id, on ? "posted" : null); } catch (e) {}
    if (on) { say((shopById(id) || {}).name + " marked as posted ✓"); coach("sell"); P.open = P.shops.filter(function (s) { return s !== id && stateOf(s) !== "posted"; })[0] || ""; }
    renderPost(false);
    var c = P.open && $id("lw-pc-" + P.open); if (c) c.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function openShop(id) { P.open = P.open === id ? "" : id; renderPost(false); var c = $id("lw-pc-" + id); if (c) c.scrollIntoView({ block: "start" }); try { window.scrollBy(0, -((parseInt(getComputedStyle(root).getPropertyValue("--mh"), 10) || 0) + 8)); } catch (e) {} }
  function addShop(id) { P.shops.push(id); try { localStorage.setItem("fash_lw_post_" + P.l.id, JSON.stringify(P.shops)); } catch (e) {} openShop(id); }
  function ebay() { try { xlEbayCreateListingFromId(Number(P.l.id)); } catch (e) { say("eBay direct posting isn't available right now."); } }
  function view(id) { root.classList.remove("lw-on"); try { S.market = []; openMarketItem(id); } catch (e) { go("shop"); } }
  function doneBtn() { root.classList.remove("lw-on"); go("closet"); }

  /* ---------- edit an existing listing in the same wizard ---------- */
  function edit(it) {
    if (typeof it === "number" || typeof it === "string") {
      var l = (S.listings || []).find(function (x) { return Number(x.id) === Number(it); });
      if (!l) return;
      it = { id: l.id, title: l.title, category: l.category, condition: l.condition, priceMin: l.price, sizeHint: l.size, description: l.description, brand: l.brand, color: l.color, material: l.material, local_pickup: l.local_pickup, _photo_url: l.photo_url };
    }
    var w = fresh();
    w.mode = it.id ? "edit" : "new"; w.listingId = it.id || null; w.step = 2;
    w.f = { title: it.title || "", path: canonPath(it.category), brand: it.brand || "", size: it.sizeHint || it.size || "", cond: condFromText(it.condition) || "good",
      color: it.color ? colorFromText(it.color) : "", desc: it.description || "", material: it.material || "", price: String(it.priceMin || it.price || ""), ship: it.local_pickup ? "pickup" : "buyer" };
    w.touched = it.id ? { title: 1, path: 1, brand: 1, size: 1, cond: 1, color: 1, desc: 1, material: 1, price: 1 } : {};
    var pu = it._photo_url || it.photo_url || "";
    if (!pu && it.id) { try { pu = ((S.listings || []).find(function (x) { return Number(x.id) === Number(it.id); }) || {}).photo_url || ""; } catch (e) {} }
    var ph = pu ? [{ id: uid(), src: null, url: pu }] : [];
    if (it._b64) ph = [{ id: uid(), src: "data:image/jpeg;base64," + it._b64, url: null }];
    mount(screenEl(), { edit: { w: w, photos: ph } });
    if (w.mode === "new") save();
  }

  /* ---------- keep html.lw-on in sync with what #screen shows ---------- */
  function watchScreen() {
    var scr = screenEl(); if (!scr || !window.MutationObserver) return;
    new MutationObserver(function () { if (!scr.querySelector(".lw")) root.classList.remove("lw-on"); }).observe(scr, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchScreen); else watchScreen();

  window.LW = {
    mount: mount, mounted: function () { var e = $id("lw"); return !!(e && W && !e.classList.contains("lw-post")); },
    addPhotoB64: addPhotoB64, files: files, pick: pick, sample: sample, sel: sel, cover: cover, move: move, remove: remove, clean: clean, identify: identify,
    set: set, catOpen: catOpen, catDept: catDept, catSearch: catSearch, catSet: catSet, cond: cond, size: size, sizeOther: sizeOther, color: color,
    price: price, bump: bump, ship: ship, shop: shop,
    next: next, back: back, to: to, reset: reset, help: help,
    post: post, copy: copy, share: share, opened: opened, mark: mark, openShop: openShop, addShop: addShop, ebay: ebay, view: view, done: doneBtn, edit: edit,
    _state: function () { return { W: W, photos: PHOTOS.length, P: P ? { id: P.l.id, shops: P.shops, open: P.open } : null }; },
    SHOPS: SHOPS, COND: COND
  };
})();
