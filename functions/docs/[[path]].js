// /docs/* — internal markdown (agent handoff, OAuth notes, etc.).
// Catch-all: matches /docs and /docs/<anything>.
import { block } from "../_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
