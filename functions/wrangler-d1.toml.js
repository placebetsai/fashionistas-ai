// /wrangler-d1.toml — D1 binding config. Internal only (see _redirects notes).
import { block } from "./_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
