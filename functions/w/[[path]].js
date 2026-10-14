/**
 * Same-origin stand-in for the API worker.
 *
 * The browser used to call the worker's workers.dev host, and that hostname
 * is the Cloudflare account name. Pages and the worker stay where they are;
 * this function forwards /w/* to the worker so the HTML and the app script
 * never contain that host. Auth stays on the worker. This file is not served
 * as source.
 */

import { filterMarketBody, isHidden } from "../_lib/hidden-listings.js";

const UPSTREAM = "https://fashionistas-api.fashionistas1979.workers.dev";

export async function onRequest(context) {
  const request = context.request;
  const incoming = new URL(request.url);
  let path = incoming.pathname.replace(/^\/w/, "") || "/";
  if (!path.startsWith("/")) path = "/" + path;
  // WORKER_UPSTREAM lets a preview branch talk to a Worker *version* preview
  // without touching production traffic. Production leaves it unset.
  const upstream = (context.env && context.env.WORKER_UPSTREAM) || UPSTREAM;
  const dest = new URL(path + incoming.search, upstream);

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

  // Keep junk rows off the public shop: filter the market list, 404 a hidden item.
  if (request.method === "GET" && /^\/api\/market(\/|$)/.test(path) && res.ok &&
      (res.headers.get("content-type") || "").includes("json")) {
    const body = await res.json().catch(() => null);
    const h = new Headers(res.headers); h.delete("content-length"); h.delete("content-encoding");
    const one = path.match(/^\/api\/market\/([^/]+)/);
    if (one && body && isHidden(body.item || body.listing || body)) {
      return new Response(JSON.stringify({ ok: false, error: "Not found" }), { status: 404, headers: h });
    }
    return new Response(JSON.stringify(one ? body : filterMarketBody(body)), { status: res.status, headers: h });
  }

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
