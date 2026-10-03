// /.github/* — CI workflow definitions (deploy.yml is currently readable
// publicly). Internal infra, never public.
import { block } from "../_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
