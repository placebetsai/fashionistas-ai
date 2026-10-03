// /core/* — internal AI/try-on pipeline source. Nothing fetches it over HTTP.
import { block } from "../_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
