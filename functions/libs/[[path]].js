// /libs/* — repo JavaScript that Pages Functions bundle at build time
// (auth-db.js, aipixels.js, …). Nothing fetches these over HTTP.
import { block } from "../_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
