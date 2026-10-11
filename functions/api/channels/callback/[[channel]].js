/**
 * GET /api/channels/callback — marketplace OAuth landing, proxied to the API.
 *
 * WHY THIS IS A FUNCTION AND NOT A _redirects LINE
 *
 * It used to be two `_redirects` rules with a `202` status, on the theory that
 * a 202 means "forward it". Cloudflare Pages only parses redirect statuses
 * (200/301/302/303/307/308); anything else — including 202 — is a rule the
 * docs list as unsupported and use as the literal example of a line that is
 * "parsed and silently ignored". So the rule never existed as far as the edge
 * was concerned, and every seller who came back from the eBay, Etsy or Whatnot
 * consent screen landed on the static 404 page instead. The flow dead-ended
 * there with the `state` still in the query string and nothing to read it.
 *
 * The same file already documents this trap once for the /404 asset rules; the
 * callback rule had been added anyway. Functions are matched before both the
 * asset layer and `_redirects`, so this is the one place a proxy can be
 * written that actually runs.
 *
 * WHAT IT PASSES THROUGH
 * The whole query string (`code`, `state`, `error`…), the method, any body,
 * and the Accept / Content-Type / Origin / User-Agent headers. The session
 * cookie is deliberately NOT forwarded: this handshake was never authenticated
 * by it. What authenticates it is the signed `state` built when the seller
 * started the flow, because the marketplace sends a request with no header of
 * ours attached at all.
 *
 * CORS: the Worker only replies to known origins. This proxy runs on the site
 * the flow was started from, so it re-states the site origin rather than
 * borrowing the marketplace's — otherwise a successful handshake comes back
 * with no ACAO header and the browser drops it.
 */

const WORKER = "https://fashionistas-api.fashionistas1979.workers.dev";
// Bounded rather than inherited: an OAuth redirect carries a code worth about
// one use, and a hung Worker must not hold the seller's browser open.
const TIMEOUT_MS = 12000;

/** Headers worth forwarding. Everything else (Cookie, CF-*, CDN-*) is ours to
    drop — forwarding a cookie to a different origin is how a session leaks. */
const PASS = new Set(["accept", "accept-language", "content-type", "origin", "referer", "user-agent"]);

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // The Worker routes on its own path, so the path is rebuilt rather than
  // copied — a request to /api/channels/callback becomes exactly that, never
  // a prefixed variant the Worker would not recognise.
  const target = WORKER + "/api/channels/callback" +
    (url.search ? url.search : "");

  const headers = new Headers();
  for (const [k, v] of request.headers) {
    if (PASS.has(k.toLowerCase())) headers.set(k, v);
  }
  headers.set("Origin", url.origin);

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

  let res;
  try {
    res = await fetch(target, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    // Never surface the fetch error verbatim — it names the Worker URL. A
    // seller landing here has just come from a consent screen and needs to
    // know the connection failed, not what a URL is.
    return new Response(
      "<!doctype html><meta charset=\"utf-8\"><title>Connection problem</title>" +
      "<body style=\"font:16px/1.5 system-ui;padding:40px;max-width:34em\">" +
      "<h1>We couldn't finish connecting</h1>" +
      "<p>The shop is unreachable right now. Go back to your closet and press " +
      "<b>Connect shop</b> again in a moment — nothing was lost.</p>" +
      "<p><a href=\"/closet\">Back to my closet</a></p>",
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const out = new Headers(res.headers);
  out.set("Access-Control-Allow-Origin", url.origin);
  // The handshake lands on a real page; letting a shared cache hold a `code`
  // for an hour is both wrong and, for a one-time code, unsafe.
  out.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}
