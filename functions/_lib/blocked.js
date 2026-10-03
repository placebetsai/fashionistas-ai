/**
 * Shared responder for URLs that must never be served.
 *
 * Why this exists: Cloudflare Pages does NOT support status-404 rules in
 * `_redirects`. Its redirects doc lists "Rewrites (other status codes)" as
 * unsupported and gives exactly `/blog/* /blog/404.html 404` as the example of
 * what is ignored, so the old rules were parsed and silently dropped and never
 * shadowed an asset that ships in the build output. Pages Functions, on the
 * other hand, are matched before the static asset layer, so a route that
 * answers 404 here really does answer 404 even though the file is deployed.
 *
 * The body is the site's own 404 page (fetched from the asset layer) so a
 * blocked URL is indistinguishable from any other 404 on the site. If that
 * fetch fails for any reason we fall back to a plain-text body — the status
 * code is 404 either way, and the status code is the part that matters.
 */
export async function block(context) {
  const request = context && context.request;
  const env = context && context.env;
  try {
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const base = (request && request.url) || "https://fashionistas.ai";
      const page = await env.ASSETS.fetch(new URL("/404", base).href);
      if (page && page.ok) {
        return new Response(await page.text(), {
          status: 404,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "x-robots-tag": "noindex, follow",
          },
        });
      }
    }
  } catch (_) {
    // Never let a broken asset fetch turn a 404 into a 500.
  }
  return new Response("404 Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
