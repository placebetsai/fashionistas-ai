/**
 * GET /api/ebay/oauth/start
 * Stub: returns authorizeUrl only when EBAY_CLIENT_ID (+ redirect) are configured.
 * Never invents credentials. See docs/EBAY_OAUTH.md.
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const clientId = env.EBAY_CLIENT_ID;
  const redirectUri = env.EBAY_REDIRECT_URI || env.EBAY_RU_NAME;
  const ebayEnv = (env.EBAY_ENV || "").toLowerCase();

  if (!clientId || !redirectUri) {
    return json(
      {
        ok: false,
        error: "ebay_oauth_not_configured",
        message:
          "eBay OAuth not configured. Set Cloudflare secrets EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RU_NAME / EBAY_REDIRECT_URI (see docs/EBAY_OAUTH.md). Paste multilist still works.",
        missing: [
          !clientId ? "EBAY_CLIENT_ID" : null,
          !env.EBAY_CLIENT_SECRET ? "EBAY_CLIENT_SECRET" : null,
          !redirectUri ? "EBAY_REDIRECT_URI or EBAY_RU_NAME" : null,
        ].filter(Boolean),
      },
      501
    );
  }

  const authHost =
    ebayEnv === "production"
      ? "https://auth.ebay.com/oauth2/authorize"
      : "https://auth.sandbox.ebay.com/oauth2/authorize";

  // Minimal authorize URL scaffold — scopes must be confirmed against current eBay docs before go-live.
  const state = crypto.randomUUID();
  const url = new URL(authHost);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "https://api.ebay.com/oauth/api_scope");

  return json({
    ok: true,
    authorizeUrl: url.toString(),
    env: ebayEnv || "sandbox-default",
    note: "Token exchange happens on /api/ebay/oauth/callback — still a stub until secrets + storage are wired.",
  });
}
