/**
 * GET /shop/<id> — the marketplace's first crawlable address.
 *
 * Before this route existed, /shop/147 answered 404: an item could be reached
 * only by clicking inside a running SPA, so nothing could be linked, shared,
 * indexed or opened cold. This function serves the app shell with the real
 * listing head injected (title, description, Open Graph, Product JSON-LD), so
 * crawlers and link previews see the item while the SPA takes over rendering
 * on load.
 *
 * Status codes are honest: a live item is 200, a missing/delisted one is 404
 * (still shell, so the SPA can say "no longer for sale"), and if the Worker is
 * unreachable we fall back to a plain 200 shell rather than lying either way.
 */
import { itemHead, injectHead } from "../_lib/item-meta.js";

const API = "https://fashionistas-api.fashionistas1979.workers.dev";

async function shell(context) {
  const url = new URL(context.request.url);
  const res = await context.env.ASSETS.fetch(new Request(new URL("/index.html", url.origin).toString()));
  return res.text();
}

export async function onRequestGet(context) {
  const { request, params } = context;
  const raw = params && params.id;
  const idStr = Array.isArray(raw) ? raw.join("/") : raw || "";
  const url = new URL(request.url);
  const origin = url.origin;

  let body;
  try { body = await shell(context); } catch (_) { return context.next(); }

  if (!idStr) {
    return new Response(
      injectHead(body, `<title>Shop — fashionistas.ai</title><meta name="description" content="Everything for sale on fashionistas.ai — clothing, decor and objects listed by real sellers. One photo in, every shop updated.">`),
      { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } }
    );
  }

  if (!/^\d+$/.test(idStr)) {
    return new Response(injectHead(body, `<title>Page not found — fashionistas.ai</title>`, { noindex: true }), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
    });
  }

  let listing = null;
  let missing = false;
  try {
    const r = await fetch(`${API}/api/market/${encodeURIComponent(idStr)}`, { headers: { Accept: "application/json" } });
    if (r.ok) {
      const b = await r.json().catch(() => null);
      listing = (b && b.listing) || null;
      if (!listing) missing = true;
    } else if (r.status === 404) {
      missing = true;
    }
    // 429 / 5xx → neither listing nor missing: serve the plain shell.
  } catch (_) {
    listing = null;
  }

  if (!listing) {
    const head = missing
      ? `<title>Item no longer for sale — fashionistas.ai</title><meta name="robots" content="noindex">`
      : "";
    return new Response(injectHead(body, head || `<title>fashionistas.ai — Photograph Your Closet, Sell It Everywhere</title>`, { noindex: missing }), {
      status: missing ? 404 : 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": missing ? "public, max-age=60" : "no-store" },
    });
  }

  return new Response(injectHead(body, itemHead(listing, origin)), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}
