// /wrangler.toml — Cloudflare Pages project config (project name, compat date,
// vars). Internal only: a `_redirects` status-404 rule is not supported by
// Cloudflare Pages, so this path is blocked by a Pages Function instead.
import { block } from "./_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
