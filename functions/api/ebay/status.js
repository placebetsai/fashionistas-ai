/**
 * GET /api/ebay/status
 * Reports whether ebay_oauth_tok cookie is present (no secrets leaked).
 */

const TOK_COOKIE = "ebay_oauth_tok";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function b64urlDecode(val) {
  try {
    const pad = val.length % 4 === 0 ? val : val + "=".repeat(4 - (val.length % 4));
    return atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const raw = context.request.headers.get("Cookie") || "";
  let tok = null;
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith(TOK_COOKIE + "=")) continue;
    const jsonStr = b64urlDecode(p.slice(TOK_COOKIE.length + 1));
    if (!jsonStr) break;
    try {
      tok = JSON.parse(jsonStr);
    } catch {
      tok = null;
    }
    break;
  }

  if (!tok || !tok.access_token) {
    return json({
      ok: true,
      connected: false,
      hasAccessToken: false,
      hasRefreshToken: false,
      message: "No eBay OAuth token cookie. Connect via Multilist → Connect eBay.",
    });
  }

  const obtained = Number(tok.obtained_at) || 0;
  const expiresIn = Number(tok.expires_in) || 7200;
  const expiresAt = obtained ? obtained + expiresIn * 1000 : null;
  const expired = expiresAt ? Date.now() > expiresAt - 60000 : false;

  return json({
    ok: true,
    connected: true,
    hasAccessToken: true,
    hasRefreshToken: !!tok.refresh_token,
    env: tok.env || "sandbox",
    expired,
    expiresAt,
    note: "Refresh token is cookie-best-effort; durable store needs fashionistas-api KV.",
  });
}
