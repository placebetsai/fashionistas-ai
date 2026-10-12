// /legal/* — draft counsel documents. Never public.
//
// These are not finished policies, and they say so in their own text:
//   legal/terms.html:197  "Do not publish this page as binding terms until
//                          counsel signs off."
//   legal/terms.html:285  "[COUNSEL: GOVERNING LAW PLACEHOLDER]"
//                          "[COUNSEL: FORUM / VENUE PLACEHOLDER]"
//   legal/privacy.html:299  "[PLACEHOLDER] ... blocks launch" and
//                          "Do not ship this page while the decision is open."
//
// Until 2026-10-12 none of that stopped them from being served: they only
// showed `Disallow: /legal/` in robots.txt, which is a request, not a control,
// and each URL answered 200 (verified live: /legal/terms, /legal/privacy and
// /legal/risk all 200 after the .html -> extensionless 308). So the site was
// publishing documents its own authors had marked unpublishable, at stable
// indexed-adjacent URLs, with a placeholder governing-law clause in them.
//
// The public policy is /privacy/ and it stays live. These drafts do not.
// Pages Functions are matched before the static asset layer, and Pages
// `_redirects` cannot express a 404 (see _lib/blocked.js), so this route is
// what actually makes the block real rather than a rule that parses and is
// silently dropped.
import { block } from "../_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
