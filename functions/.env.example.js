// /.env.example — env checklist. No secrets, but still internal config.
// NOTE: .gitignore's `.env.*` pattern also matches this filename, so it must
// be staged with `git add -f` or it will not ship with the deploy.
import { block } from "./_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
