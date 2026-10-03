// /.env — local secrets file. Never public (also gitignored, so it is not
// normally deployed at all; this route closes the gap if it ever is).
import { block } from "./_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
