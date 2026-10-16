/**
 * Same-origin stand-in for the API worker.
 *
 * The browser used to call the worker's workers.dev host, and that hostname
 * is the Cloudflare account name. Pages and the worker stay where they are;
 * this function forwards /w/* to the worker so the HTML and the app script
 * never contain that host. Auth stays on the worker. This file is not served
 * as source.
 */

const UPSTREAM = "https://fashionistas-api.fashionistas1979.workers.dev";

export async function onRequest(context) {
  const request = context.request;
  const incoming = new URL(request.url);
  let path = incoming.pathname.replace(/^\/w/, "") || "/";
  if (!path.startsWith("/")) path = "/" + path;
  const dest = new URL(path + incoming.search, UPSTREAM);

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let res;
  try {
    // /api/tryon/hd was never implemented on the API worker (it 404s there);
    // the real implementation is this project's Pages Function, which accepts
    // the same Bearer token / fash_session cookie. Route it here so every
    // client — page, extension, curl — gets one behaviour, not a stale 404.
    if (path === "/api/tryon/hd") {
      res = await fetch(new URL(path + incoming.search, incoming.origin), init);
    } else {
      res = await fetch(dest, init);
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "The service is unreachable." }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // /w/api/auth/me echoes the caller's bearer token back in its JSON body.
  // Any log, proxy or analytics capture of that response widens token
  // exposure, so strip the field before it leaves the edge.
  if (path === "/api/auth/me") {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        const body = await res.clone().json();
        if (body && typeof body === "object" && "token" in body) {
          delete body.token;
          const h = new Headers(res.headers);
          h.delete("content-length");
          return new Response(JSON.stringify(body), {
            status: res.status,
            statusText: res.statusText,
            headers: h,
          });
        }
      } catch {
        /* not JSON after all — fall through to the untouched body */
      }
    }
  }

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
