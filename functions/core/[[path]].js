// /core/* — internal AI/try-on pipeline source.
//
// Almost nothing here should ever be fetched over HTTP, so the default answer
// is the site's own 404.
//
// ONE exception: `tryon_pipeline.js` is the browser-side free tier. Layers 1
// and 2 (canvas warp+composite + MediaPipe pose) run in the user's own tab and
// never leave the device, so the page has to be able to import it — that is
// the whole point of the free tier costing $0 at any scale. It is served
// deliberately and explicitly below; it exposes no secrets, holds no keys, and
// contains no server logic. Everything else under /core/ still 404s.
//
// This is a single allow-list checked inside the catch-all rather than a
// separate `functions/core/tryon_pipeline.js` route file, because route-file
// precedence against a `[[path]]` wildcard is exactly the kind of thing that
// silently changes behaviour — one function, one place, no ambiguity.
import { block } from "../_lib/blocked.js";

const SERVED = new Set(["tryon_pipeline.js"]);

export async function onRequest(context) {
  const request = context && context.request;
  const params = (context && context.params) || {};
  const raw = params.path;
  const rel = Array.isArray(raw) ? raw.join("/") : String(raw || "");
  const name = rel.split("/").pop();

  if (!SERVED.has(name)) return block(context);

  // Serve the real static asset straight from the asset layer (same mechanism
  // `block()` uses to fetch /404). If it is ever missing we degrade to a 404
  // rather than to a 500.
  try {
    const env = context && context.env;
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const origin = new URL((request && request.url) || "https://fashionistas.ai").origin;
      const res = await env.ASSETS.fetch(new URL(`/core/${name}`, origin).href);
      if (res && res.ok) {
        const headers = new Headers(res.headers);
        headers.set("content-type", "text/javascript; charset=utf-8");
        headers.set("cache-control", "public, max-age=300");
        headers.delete("content-encoding");
        return new Response(res.body, { status: 200, headers });
      }
    }
  } catch (_) {
    // fall through to 404
  }
  return block(context);
}
