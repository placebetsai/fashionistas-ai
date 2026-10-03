// /scripts/* — repo build scripts (gen-version.sh). Never public.
import { block } from "../_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
