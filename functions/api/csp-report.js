/**
 * CSP violation reports — the input to actually enforcing a Content-Security-Policy.
 *
 * Why this route exists at all:
 *
 * The site had NO CSP, and the obvious fix is to add one. It was skipped for a
 * long time for a good reason: this is a landing page with heavy inline script,
 * inline style, a client-side bundle, and AdSense — and a CSP written from
 * memory is the single most reliable way to blank a working page or silently
 * kill ad revenue. Guessing wrong there is worse than not having one.
 *
 * So the header ships as `Content-Security-Policy-Report-Only`, which by
 * definition cannot break rendering: the browser still loads everything, it
 * just reports what a real policy would have blocked. This route is where those
 * reports land, and the directives above it are seeded from what the page is
 * actually observed to use (three external origins: fonts.googleapis.com,
 * fonts.gstatic.com, pagead2.googlesyndication.com).
 *
 * The workflow this enables:
 *   1. report-only + this collector go live   <- here
 *   2. let real traffic populate the log
 *   3. flip `Report-Only` out of the header once the log is clean
 *
 * Step 3 is a one-word edit in `_headers`, and it is evidence-driven instead of
 * a guess. Anything still showing up here is a genuine integration that needs
 * to be allow-listed on purpose, not a directive added on a hunch.
 *
 * Deliberately stores nothing: Cloudflare's own Pages logs already capture
 * stdout, these are low-volume by nature (browsers throttle report bursts), and
 * a table for them would be a second thing to keep fresh. The value here is the
 * log line, not a database.
 */
export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed", detail: "POST only." }),
      { status: 405, headers: { allow: "POST", "content-type": "application/json; charset=utf-8" } }
    );
  }

  // Browsers send violation reports as a JSON array. Some send a single object.
  // Either way this must never throw, and must never be a place to spend work:
  // it is reachable unauthenticated and unrate-limited by design, so the whole
  // handler is bounded and allocation-light.
  let payload;
  try {
    const text = await request.text();
    if (!text || text.length > 65536) {
      return new Response(null, { status: 204 });
    }
    payload = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }

  const list = Array.isArray(payload) ? payload : [payload];
  const origin = request.headers.get("cf-connecting-ip") || "unknown-ip";

  for (const v of list.slice(0, 20)) {
    if (!v || typeof v !== "object") continue;
    // Report exactly the fields that tell you what to allow-list, plus enough
    // to spot a spoofed or malformed report. `blocked-uri` is the interesting
    // one: if it is `inline` or `eval`, the page needs 'unsafe-inline'/'unsafe-eval'
    // (already granted for script, so those should not appear); if it is a host,
    // that host is an integration nobody wrote down.
    console.log(
      JSON.stringify({
        csp: true,
        from: origin,
        directive: v.effectiveDirective || v.violatedDirective || "?",
        blocked: v.blockedURI || "?",
        source: v.sourceFile || "?",
        line: v.lineNumber ?? "?",
      })
    );
  }

  // 204 with no body: a report endpoint must never give the reporter anything
  // to react to, and never an error the browser will retry.
  return new Response(null, { status: 204 });
}
