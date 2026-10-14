/**
 * Speed (home): serve the landing as-is but start the app scripts once the
 * browser is idle after load (or at once for a signed-in visitor, a URL with
 * query/hash, or the first tap). Taps on buttons before then are replayed.
 * See lateScripts() in _lib/prerender.js.
 */
import { lateScripts } from "./_lib/prerender.js";
export async function onRequestGet(context) {
  const res = await context.next();
  const ct = res.headers.get("content-type") || "";
  if (res.status !== 200 || !ct.includes("text/html")) return res;
  const html = lateScripts(await res.text(), { home: true });
  const h = new Headers(res.headers); h.delete("content-length"); h.delete("etag");
  return new Response(html, { status: 200, headers: h });
}
