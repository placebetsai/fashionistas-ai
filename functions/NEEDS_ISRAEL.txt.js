// /NEEDS_ISRAEL.txt — internal planning note. Never public.
import { block } from "./_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
