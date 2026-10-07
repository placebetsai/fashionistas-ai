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
  return context.next();
}
