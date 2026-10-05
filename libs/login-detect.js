/**
 * libs/login-detect.js — SINGLE SOURCE OF TRUTH for "is the seller logged in?"
 *
 * Pure logic. No React, no DOM, no fetch, no network. Every consumer (the
 * Chrome extension bridge, the phone's in-app WebView, the web app) hands it
 * *observations* and gets back a boolean plus a machine-readable reason, so the
 * verdict is the same everywhere and can be unit-tested offline.
 *
 * WHY THIS FILE EXISTS
 * The Connect screen used to say "Connected" because the user clicked a button
 * ("I've connected is local"). A badge that reflects a click proves nothing —
 * the seller can click it without ever having an account, and the queue will
 * then fail on a shop nobody is logged into. This module makes the badge mean
 * "we observed a real logged-in page".
 *
 * WHAT IT OBSERVES — and what it deliberately does NOT
 *   - the path we asked for vs the path we ended on (bounce)
 *   - whether the page is a soft-404 (structure of the body)
 *   - how many real form controls exist (structure, not wording)
 *   - whether a password field is present
 *   - whether a logged-out-only signal exists (logout link / avatar / Sell)
 *
 * It NEVER looks at password values, form values or keystrokes. There is no
 * code path here that could read a credential, and none should ever be added.
 *
 * NOTE ON /libs: Pages blocks /libs/* over HTTP on purpose (functions/libs is a
 * `block()` route), so this is NOT importable by a browser at runtime. It is
 * imported by tests and by server code; consumers get a generated copy (see
 * apps/extension/scripts/build-login-detect.mjs), exactly the way
 * selectors.bundled.json is generated from config/selectors.js.
 *
 * Reason codes — keep in sync with the mobile app's lib/loginDetect.js:
 *   bounced    we were sent to the marketplace's sign-in page
 *   soft_404   the page is a "not found" page wearing a 200
 *   no_form    zero form controls: 404 / empty shell / SPA never mounted
 *   login_form a password field is present, so the site is asking for one
 *   connected  a logged-out-impossible signal was observed (logout/avatar/sell)
 *   unknown    nothing conclusive — ALWAYS reported as connected:false
 */

export const REASONS = Object.freeze({
  BOUNCED: "bounced",
  SOFT_404: "soft_404",
  NO_FORM: "no_form",
  LOGIN_FORM: "login_form",
  CONNECTED: "connected",
  UNKNOWN: "unknown",
});

/** Paths that mean "you are not signed in", per marketplace. */
const SIGN_IN_PATH =
  /(^|\/)(login|log-?in|signin|sign-?in|sign_?in|signup|sign-?up|sign_?up|join|register)(\/|$|\?)/i;

const SIGN_IN_QUERY = /\/auth\/login(\/|$|\?)/i;
const SIGN_IN_USERS = /\/users\/sign_?up(\/|$|\?)/i;
const SIGN_IN_EBAY = /eBayISAPI\.dll/i;

/**
 * "Not found" wording. Structurally loose on purpose: marketplaces phrase this
 * a dozen different ways, and missing one lets a 404 masquerade as a form (the
 * Etsy 404 said "the page you were looking for was not found", which matched no
 * naive `page not found` pattern). Matching too eagerly is safe here, because a
 * false hit only ever produces connected:false.
 */
const NOT_FOUND_TEXT =
  /page not found|\b404\b|we can't find (this|the) page|page you were looking for was not found|uh oh|isn'?t available|wasn'?t found|could not be found|nothing found/i;

/**
 * Reduce any URL or path to `pathname + search`, ignoring scheme/host and a
 * trailing slash. Trailing-slash normalisation matters: Depop's form is
 * `/products/add/` and a redirect to `/products/add` is NOT a bounce.
 */
export function normalizePath(input) {
  if (typeof input !== "string") return "/";
  let s = input.trim();
  if (!s) return "/";
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = (u.pathname || "/") + (u.search || "");
    } catch {
      /* fall through and treat it as a path */
    }
  }
  if (s[0] !== "/") s = "/" + s;
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s || "/";
}

/** Does this path land on a sign-in screen? */
export function isSignInPath(input) {
  const p = normalizePath(input);
  // eBay's sign-in is a DLL endpoint with SignIn in the query string, so the
  // pathname alone would never match it.
  if (SIGN_IN_EBAY.test(p)) return true;
  return SIGN_IN_PATH.test(p) || SIGN_IN_QUERY.test(p) || SIGN_IN_USERS.test(p);
}

/** Does this page text look like a "not found" page? */
export function hasNotFoundText(text) {
  if (typeof text !== "string" || !text) return false;
  return NOT_FOUND_TEXT.test(text.slice(0, 4000));
}

/**
 * Decide whether the seller is logged in.
 *
 * @param {object} input
 * @param {string} input.requestedPath path we deliberately navigated to
 * @param {string} input.finalPath     path we actually ended on
 * @param {object} [input.signals]     { hasPasswordField, logout, avatar,
 *                                      sellBtn, controlCount, bodyText }
 * @returns {{connected: boolean, reason: string, trace: string[]}}
 *
 * Every branch resolves to connected:false except the one with positive proof.
 * Ambiguity is never treated as success — a false "connected" sends the queue
 * at a shop nobody can post to, which is strictly worse than asking again.
 */
export function detectLogin({ requestedPath, finalPath, signals = {} } = {}) {
  const req = normalizePath(requestedPath);
  const fin = normalizePath(finalPath);
  const s = signals || {};
  const trace = [];
  const pathChanged = fin !== req;

  trace.push(`requested=${req}`);
  trace.push(`final=${fin}`);

  // 1. We were handed a sign-in page. Checked before everything else: if the
  //    marketplace bounced us, no amount of header markup makes us logged in.
  if (pathChanged && isSignInPath(fin)) {
    trace.push("bounced: sent to sign-in");
    return { connected: false, reason: REASONS.BOUNCED, trace };
  }

  // 2. A "not found" page. Winning over the positive signals on purpose: a
  //    logged-in user who 404s still has no working form, and the header on a
  //    404 often still shows their avatar.
  if (hasNotFoundText(s.bodyText)) {
    trace.push("soft_404: body is a not-found page");
    return { connected: false, reason: REASONS.SOFT_404, trace };
  }

  // 3. Structure, not wording. A create-listing page must expose at least one
  //    real control; 404s, empty shells and unmounted SPAs expose none. This is
  //    the check that catches a soft-404 no text pattern recognises.
  //    `undefined <= 0` is false, so an unreported count is skipped rather than
  //    silently treated as "no form".
  if (Number.isFinite(s.controlCount) && s.controlCount <= 0) {
    trace.push("no_form: zero form controls");
    return { connected: false, reason: REASONS.NO_FORM, trace };
  }

  // 4. The site is asking for a password, therefore we do not have one.
  if (s.hasPasswordField === true) {
    trace.push("login_form: password field present");
    return { connected: false, reason: REASONS.LOGIN_FORM, trace };
  }

  // 5. Positive proof. These three only render for a signed-in user, and we
  //    never read the values behind them.
  if (s.logout === true || s.avatar === true || s.sellBtn === true) {
    const via = [s.logout && "logout", s.avatar && "avatar", s.sellBtn && "sellBtn"].filter(Boolean).join("+");
    trace.push(`connected: ${via}`);
    return { connected: true, reason: REASONS.CONNECTED, trace };
  }

  trace.push(pathChanged ? "unknown: redirected with no login proof" : "unknown: nothing conclusive");
  return { connected: false, reason: REASONS.UNKNOWN, trace };
}

export default { REASONS, normalizePath, isSignInPath, hasNotFoundText, detectLogin };
