// /apps/* — browser-extension source. Nothing on the site links to it
// (the extension fetches only /selectors.json, which stays public).
import { block } from "../_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
