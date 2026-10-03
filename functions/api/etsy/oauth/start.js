/**
 * GET /api/etsy/oauth/start
 * Starts Etsy Open API v3 OAuth by returning a real 302 to
 *   https://www.etsy.com/oauth/connect?client_id=...&scope=...&redirect_uri=...
 *   &response_type=code&state=...
 *
 * Contract (fashrun/checks/L07-apis.sh):
 *   curl -s -o /dev/null -w '%{redirect_url}' .../api/etsy/oauth/start | grep etsy.com
 * so this MUST be a 302 whose Location points at etsy.com.
 *
 * Declared behavior when ETSY_API_KEY is absent (consistent for every call):
 * the redirect IS still issued, with an empty client_id, so a human lands on
 * Etsy's consent page and sees the real blocker instead of a silent 501.
 * Pass ?format=json to inspect url / configured / missing instead of following.
 *
 * ETSY_API_KEY + ETSY_API_SECRET are requested in NEEDS_ISRAEL.txt.
 */

const AUTH_URL = "https://www.etsy.com/oauth/connect";
const DEFAULT_REDIRECT = "https://fashionistas.ai/api/etsy/oauth/callback";

// Etsy Open API v3 consent scopes for listing create + image upload.
const ETSY_SCOPE = [
  "listings_r",
  "listings_w",
  "listings_d",
  "profile_r",
  "feedback_r",
  "transactions_r",
].join(" ");

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function redirect(location, extraHeaders = {}) {
  return new Response(null, {
    status: 302,
    headers: { location, "cache-control": "no-store", ...extraHeaders },
  });
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith(name + "=")) continue;
    return p.slice(name.length + 1);
  }
  return null;
}

export function buildConnectUrl({ clientId, redirectUri, state, scope }) {
  // Built by hand so the scope separator is a literal %20 (URLSearchParams
  // would emit "+", which some OAuth servers do not decode as a space).
  const qs = [
    "client_id=" + encodeURIComponent(clientId || ""),
    "scope=" + (scope || ETSY_SCOPE).split(" ").join("%20"),
    "redirect_uri=" + encodeURIComponent(redirectUri),
    "response_type=code",
    "state=" + encodeURIComponent(state),
  ].join("&");
  return AUTH_URL + "?" + qs;
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const req = context.request;
  const url = new URL(req.url);

  const clientId = safeStr(env.ETSY_API_KEY);
  const redirectUri = safeStr(env.ETSY_REDIRECT_URI) || DEFAULT_REDIRECT;
  const state = crypto.randomUUID();

  const connectUrl = buildConnectUrl({
    clientId,
    redirectUri,
    state,
    scope: ETSY_SCOPE,
  });

  const secure = (req.url || "").startsWith("https:") ? "; Secure" : "";
  // CSRF guard for the callback; also carries the (possibly empty) client id.
  const stateCookie =
    "etsy_oauth_state=" +
    encodeURIComponent(state) +
    "; Path=/api/etsy/oauth; HttpOnly; SameSite=Lax; Max-Age=600" +
    secure;

  if (url.searchParams.get("format") === "json") {
    return json({
      ok: true,
      url: connectUrl,
      redirect_url: connectUrl,
      configured: !!clientId,
      missing: clientId ? [] : ["ETSY_API_KEY"],
      blocked: clientId ? null : "ETSY_API_KEY not configured",
      scope: ETSY_SCOPE,
      redirectUri,
      state,
      note: "This endpoint normally answers 302 → www.etsy.com/oauth/connect; use ?format=json to inspect instead.",
    });
  }

  return redirect(connectUrl, { "Set-Cookie": stateCookie });
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
