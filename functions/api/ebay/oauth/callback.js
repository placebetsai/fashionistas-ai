/**
 * GET /api/ebay/oauth/callback
 * Uses Cloudflare env secrets OR the short-lived BYO cookie from /oauth/start.
 * Token exchange remains scaffolded until durable storage lands on fashionistas-api.
 * Never logs client secret or tokens. See docs/EBAY_OAUTH.md.
 */

const BYO_COOKIE = "ebay_byo_sess";

function redirect(location, clearByo = false) {
  const headers = { Location: location, "cache-control": "no-store" };
  if (clearByo) {
    headers["Set-Cookie"] =
      `${BYO_COOKIE}=; Path=/api/ebay/oauth; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
  return new Response(null, { status: 302, headers });
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function readByoCookie(request) {
  const raw = request.headers.get("Cookie") || "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.startsWith(BYO_COOKIE + "=")) continue;
    const val = p.slice(BYO_COOKIE.length + 1);
    try {
      const pad = val.length % 4 === 0 ? val : val + "=".repeat(4 - (val.length % 4));
      const jsonStr = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
      const o = JSON.parse(jsonStr);
      if (o && typeof o === "object") {
        return {
          clientId: safeStr(o.clientId),
          clientSecret: safeStr(o.clientSecret),
          redirectUri: safeStr(o.redirectUri),
          env: safeStr(o.env),
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const reqUrl = new URL(context.request.url);
  const code = reqUrl.searchParams.get("code");
  const err = reqUrl.searchParams.get("error");
  const origin = `${reqUrl.protocol}//${reqUrl.host}`;

  if (err) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(err)}`,
      true
    );
  }

  const byo = readByoCookie(context.request);
  const clientId = safeStr(env.EBAY_CLIENT_ID) || (byo && byo.clientId) || "";
  const clientSecret =
    safeStr(env.EBAY_CLIENT_SECRET) || (byo && byo.clientSecret) || "";

  if (!clientId || !clientSecret) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(
        "missing_keys_set_env_or_paste_BYO_in_Connect_panel_then_retry"
      )}`,
      true
    );
  }

  if (!code) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent("missing_code")}`,
      true
    );
  }

  // Token exchange intentionally not completed in this scaffold:
  // needs RuName/redirect match, correct token host, and secure per-user storage
  // on fashionistas-api (KV/D1). clientId/secret resolved from env or BYO cookie —
  // do not log them. Clear the BYO cookie either way.
  void clientId;
  void clientSecret;

  return redirect(
    `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(
      "token_exchange_not_implemented_see_docs_EBAY_OAUTH"
    )}`,
    true
  );
}
