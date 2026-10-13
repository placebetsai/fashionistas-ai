/**
 * Defense in depth: never serve dot-paths (/.env*, /.git/*, /.dev.vars, ...).
 * The deploy script already excludes dotfiles from the upload; this catches
 * anything that slips through. /.well-known/ is allowed (ACME, app links).
 */
import { block } from "./_lib/blocked.js";

export async function onRequest(context) {
  let path = "/";
  try { path = decodeURIComponent(new URL(context.request.url).pathname); } catch (_) {}
  const segs = path.split("/").filter(Boolean);
  if (segs.some((s, i) => s.startsWith(".") && !(i === 0 && s === ".well-known"))) {
    return block(context);
  }
  // The bare production alias fashionistas-ai.pages.dev serves the whole site
  // with self-referencing canonicals (sitemap, /shop) and no noindex header:
  // a full duplicate of fashionistas.ai for Google. Send crawlers and people
  // to the real domain. Branch previews (<branch>.fashionistas-ai.pages.dev)
  // are untouched; Cloudflare already marks those noindex.
  const u = new URL(context.request.url);
  const m = context.request.method;
  if (u.hostname === "fashionistas-ai.pages.dev" && (m === "GET" || m === "HEAD") && !/^\/(w|api)\//.test(u.pathname)) {
    return Response.redirect("https://fashionistas.ai" + u.pathname + u.search, 301);
  }
  return context.next();
}
