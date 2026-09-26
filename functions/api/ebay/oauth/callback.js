/**
 * GET /api/ebay/oauth/callback
 * Stub: exchanges code only when secrets exist; otherwise redirects with ebay_oauth=error.
 * See docs/EBAY_OAUTH.md.
 */
function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "cache-control": "no-store" },
  });
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const reqUrl = new URL(context.request.url);
  const code = reqUrl.searchParams.get("code");
  const err = reqUrl.searchParams.get("error");
  const origin = `${reqUrl.protocol}//${reqUrl.host}`;

  if (err) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(err)}`
    );
  }

  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(
        "missing_EBAY_CLIENT_ID_or_EBAY_CLIENT_SECRET"
      )}`
    );
  }

  if (!code) {
    return redirect(
      `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent("missing_code")}`
    );
  }

  // Token exchange intentionally not completed in this scaffold:
  // needs RuName/redirect match, correct token host, and secure per-user storage
  // on fashionistas-api (KV/D1). Do not log client secret or tokens.
  return redirect(
    `${origin}/?ebay_oauth=error&ebay_error=${encodeURIComponent(
      "token_exchange_not_implemented_see_docs_EBAY_OAUTH"
    )}`
  );
}
