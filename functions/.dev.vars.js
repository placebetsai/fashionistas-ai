// /.dev.vars — wrangler dev secrets file. Never public.
import { block } from "./_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
