/* One-tap sign-in (2026-10-13): passkey (fingerprint / face / screen lock),
   Google (when GOOGLE_CLIENT_ID is set on the Worker), email link (when
   RESEND_API_KEY is set). Ends in afterAuth(d) with the same Worker token as
   password login, so nothing else in the app changes. Sessions slide for a
   year via /api/auth/me — a returning user is never asked again. */
(function () {
  var API = "/w";
  var box = document.getElementById("oneclick");
  if (!box) return;
  var hasPK = !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
  function b2u(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function u2b(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); var bin = atob(s + "===".slice((s.length + 3) % 4)); var o = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o.buffer; }
  function say(m) { if (window.toast) toast(m, 4000); else { var n = document.getElementById("oc-msg"); if (n) n.textContent = m; } }
  async function post(path, body) {
    var h = { "Content-Type": "application/json" };
    try { var t = localStorage.getItem("fash_token"); if (t) h.Authorization = "Bearer " + t; } catch (e) {}
    var r = await fetch(API + path, { method: "POST", headers: h, body: JSON.stringify(body || {}) });
    var d = null; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && d.error) || ("Request failed (" + r.status + ")"));
    return d;
  }
  function done(d) {
    try { performance.mark("fash-signed-in"); } catch (e) {}
    window.__fashSignedIn = Date.now();
    if (typeof afterAuth === "function") afterAuth(d);
  }
  function busy(btn, on, label) { if (!btn) return; btn.disabled = on; if (label) btn.querySelector("span").textContent = label; }

  var condAbort = null;
  async function passkeyLogin(conditional) {
    if (condAbort) { try { condAbort.abort(); } catch (e) {} condAbort = null; }
    var o = await post("/api/auth/passkey/login-options");
    var pk = o.publicKey;
    var opts = { publicKey: { challenge: u2b(pk.challenge), rpId: pk.rpId, userVerification: pk.userVerification, timeout: pk.timeout, allowCredentials: [] } };
    if (conditional) { opts.mediation = "conditional"; condAbort = new AbortController(); opts.signal = condAbort.signal; }
    var c = await navigator.credentials.get(opts);
    if (!c) return;
    var d = await post("/api/auth/passkey/login", {
      cid: o.cid, id: c.id, clientDataJSON: b2u(c.response.clientDataJSON),
      authenticatorData: b2u(c.response.authenticatorData), signature: b2u(c.response.signature),
      userHandle: c.response.userHandle ? b2u(c.response.userHandle) : null,
    });
    done(d);
  }
  async function passkeyCreate() {
    var name = (document.getElementById("oc-name") || {}).value || "";
    if (condAbort) { try { condAbort.abort(); } catch (e) {} condAbort = null; }
    var o = await post("/api/auth/passkey/register-options", { name: name.trim() });
    var pk = o.publicKey;
    var c = await navigator.credentials.create({ publicKey: {
      challenge: u2b(pk.challenge), rp: pk.rp,
      user: { id: u2b(pk.user.id), name: pk.user.name, displayName: pk.user.displayName },
      pubKeyCredParams: pk.pubKeyCredParams, authenticatorSelection: pk.authenticatorSelection,
      attestation: "none", timeout: pk.timeout,
      excludeCredentials: (pk.excludeCredentials || []).map(function (x) { return { type: "public-key", id: u2b(x.id) }; }),
    } });
    var r = c.response;
    if (!r.getPublicKey) throw new Error("This browser is too old for fingerprint sign-in. Use Google or a password.");
    var d = await post("/api/auth/passkey/register", {
      cid: o.cid, id: c.id, clientDataJSON: b2u(r.clientDataJSON),
      authenticatorData: b2u(r.getAuthenticatorData()), publicKey: b2u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(),
    });
    done(d);
  }
  function errMsg(e) {
    if (e && e.name === "NotAllowedError") return "Cancelled. Tap again when you're ready.";
    if (e && e.name === "InvalidStateError") return "This phone already has a fashionistas passkey. Tap Sign in.";
    return (e && e.message) || "That didn't work. Try again.";
  }

  box.innerHTML =
    '<div class="oc">' +
    (hasPK ? '<button type="button" class="btn btn-primary oc-btn" id="oc-pk-in"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 10a2 2 0 0 0-2 2c0 2.5-.5 4.5-1.5 6"/><path d="M14 12c0 3-.6 5.6-1.6 7.6"/><path d="M7.3 7.5A6 6 0 0 1 18 12c0 1.6-.1 3.1-.4 4.5"/><path d="M6 12c0 1.7-.3 3.2-.9 4.5"/><path d="M4.6 5.6A9 9 0 0 1 21 12"/></svg><span>Sign in with fingerprint</span></button>' +
      '<div class="oc-or">New here?</div>' +
      '<input class="input oc-name" id="oc-name" placeholder="Your name or shop name (optional)" autocomplete="nickname" maxlength="40">' +
      '<button type="button" class="btn btn-accent oc-btn" id="oc-pk-new"><span>Create my account with one tap</span></button>' : '') +
    '<div id="oc-google" class="oc-google" hidden></div>' +
    '<form id="oc-mail" class="oc-mail" hidden><input class="input" id="oc-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required><button class="btn btn-soft" type="submit"><span>Email me a link</span></button></form>' +
    '<p class="oc-note" id="oc-msg">No password needed. Your phone keeps you signed in.</p>' +
    '<button type="button" class="oc-more" id="oc-more" aria-expanded="false">Use a username and password instead</button>' +
    '</div>';

  // Old username/password UI stays, folded under one link.
  var tabs = document.getElementById("auth-tab-login"), legacy = [];
  if (tabs) legacy.push(tabs.parentElement);
  ["auth-login", "auth-signup"].forEach(function (id) { var n = document.getElementById(id); if (n) legacy.push(n); });
  var wrap = document.createElement("div"); wrap.id = "oc-legacy"; wrap.hidden = true;
  if (legacy.length) { legacy[0].parentNode.insertBefore(wrap, legacy[0]); legacy.forEach(function (n) { wrap.appendChild(n); }); }
  document.getElementById("oc-more").onclick = function () { wrap.hidden = !wrap.hidden; this.setAttribute("aria-expanded", String(!wrap.hidden)); if (!wrap.hidden) { var i = document.getElementById("login-u"); if (i) i.focus(); } };

  if (hasPK) {
    var bin = document.getElementById("oc-pk-in"), bnew = document.getElementById("oc-pk-new");
    bin.onclick = async function () { busy(bin, true); try { await passkeyLogin(false); } catch (e) { say(errMsg(e)); } busy(bin, false); };
    bnew.onclick = async function () { busy(bnew, true); try { await passkeyCreate(); } catch (e) { say(errMsg(e)); } busy(bnew, false); };
    // Autofill passkeys in the username box (Android shows them in the keyboard bar).
    var lu = document.getElementById("login-u");
    if (lu) lu.setAttribute("autocomplete", "username webauthn");
    if (PublicKeyCredential.isConditionalMediationAvailable) {
      PublicKeyCredential.isConditionalMediationAvailable().then(function (ok) { if (ok && !localStorage.getItem("fash_token")) passkeyLogin(true).catch(function () {}); });
    }
  }

  fetch(API + "/api/auth/config").then(function (r) { return r.ok ? r.json() : null; }).then(function (cfg) {
    if (!cfg) return;
    if (cfg.magic_link) {
      var f = document.getElementById("oc-mail"); f.hidden = false;
      f.onsubmit = async function (ev) { ev.preventDefault(); var b = f.querySelector("button"); busy(b, true);
        try { await post("/api/auth/magic/start", { email: document.getElementById("oc-email").value }); say("Check your email and tap the link. It works for 15 minutes."); }
        catch (e) { say(errMsg(e)); } busy(b, false); };
    }
    if (cfg.google_client_id) {
      var g = document.createElement("script"); g.src = "https://accounts.google.com/gsi/client"; g.async = true;
      g.onload = function () {
        google.accounts.id.initialize({ client_id: cfg.google_client_id, auto_select: true, itp_support: true, use_fedcm_for_prompt: true,
          callback: function (resp) { post("/api/auth/google/onetap", { credential: resp.credential }).then(done).catch(function (e) { say(errMsg(e)); }); } });
        var gb = document.getElementById("oc-google"); gb.hidden = false;
        google.accounts.id.renderButton(gb, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: Math.min(360, gb.clientWidth || 320) });
        if (!localStorage.getItem("fash_token")) google.accounts.id.prompt();
      };
      document.head.appendChild(g);
    }
  }).catch(function () {});

  // Magic link landing: /?signin=<token>
  var m = /[?&]signin=([A-Za-z0-9_-]{20,})/.exec(location.search);
  if (m) {
    history.replaceState(null, "", location.pathname + location.hash);
    post("/api/auth/magic/verify", { t: m[1] }).then(function (d) {
      var go = function () { done(d); };
      if (typeof afterAuth === "function") go(); else window.addEventListener("load", go);
    }).catch(function (e) { say(errMsg(e)); });
  }
})();
