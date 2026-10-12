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
    res = await fetch(dest, init);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "The service is unreachable." }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
