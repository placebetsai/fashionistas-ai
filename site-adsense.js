/**
 * site-adsense.js — SINGLE SOURCE OF TRUTH for the AdSense wiring.
 *
 * The publisher id is defined ONCE here, so the head loader and every ad slot
 * can never drift apart and a second/invented id cannot be introduced. The
 * regression test (tests/adsense-wiring.test.mjs) re-renders `loaderTagHTML()`
 * and `adSlotHTML()` from these exact bytes and compares them against what the
 * pages actually ship, so hand-editing an id in HTML fails the suite.
 *
 * WHY THIS FILE IS AT THE REPO ROOT AND NOT IN libs/
 *   Cloudflare Pages never serves /libs/* to a browser: functions/libs/[[path]].js
 *   answers 404 for it (see _redirects and functions/_lib/blocked.js, and the
 *   NOTE ON /libs at the top of libs/login-detect.js). A `<script type="module"
 *   src="/libs/adsense.js">` would fetch that 404 body, fail to parse, and the
 *   page would silently ship zero ads — the same failure the loader rules below
 *   exist to prevent. Root-level files are served (site.css already is), so
 *   this path is the one that actually reaches a browser. The regression test
 *   asserts this path is not shadowed by a blocked rule.
 *
 * WHY THE LOADER IS A RAW <script async>, NOT next/script OR type="module"
 *   adsbygoogle.js is a plain classic script that both defines the library and
 *   drains `window.adsbygoogle`. If the loader is injected late — deferred,
 *   module-loaded, or behind a strategy like `afterInteractive` — then in the
 *   initial HTML the `<ins class="adsbygoogle">` elements exist while the
 *   library that fills them does not. Nothing drains the queue in that state,
 *   so no slot renders and no impression is ever reported. The loader therefore
 *   ships as a literal, `async`, blocking-free <script src> in the document
 *   head of each page, exactly once, and the test fails if it ever becomes a
 *   module, gains `defer`, or is duplicated.
 *
 * This file must stay free of top-level DOM/window access so the test can
 * import the real module in bare Node.
 */

/** The approved AdSense publisher for this network. Not a secret. */
export const ADSENSE_CLIENT = "ca-pub-7215975042937417";

export const ADSENSE_LOADER_HOST = "pagead2.googlesyndication.com";

/**
 * The loader URL, derived from the client id so the two cannot disagree.
 * `crossorigin="anonymous"` is required by AdSense for the request to be made
 * at all in some browsers; the attribute lives in loaderTagHTML().
 */
export const ADSENSE_LOADER_SRC =
  `https://${ADSENSE_LOADER_HOST}/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

/** The same publisher in ads.txt form (`ca-pub-` -> `pub-`). */
export const ADSENSE_PUBLISHER_ID = ADSENSE_CLIENT.replace(/^ca-/, "");

/** The one line ads.txt must contain, or no ad is ever authorized to serve. */
export const ADSENSE_ADS_TXT_LINE =
  `google.com, ${ADSENSE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0`;

/**
 * Named placements. Never invent a slot id — these are the real ones issued for
 * this publisher. `slotFor()` is the only supported way to turn a name into an
 * id, and the regression test rejects any data-ad-slot on a page that does not
 * resolve through here.
 */
export const AD_SLOTS = Object.freeze({
  default: "6600722153",
  hero: "5079047997",
  inContent: "2843751862",
  sidebar: "9124683051",
  bottom: "3357291048",
});

/**
 * Height reserved before the creative arrives, so filling an ad does not push
 * the surrounding content down (CLS). Sized to the largest common creative per
 * placement.
 */
export const AD_RESERVED_HEIGHT = Object.freeze({
  hero: 250,
  inContent: 250,
  sidebar: 600,
  bottom: 250,
  default: 250,
});

export const AD_DEFAULT_RESERVED_HEIGHT = 250;

/** Element attribute a page uses to declare a slot. */
export const AD_MOUNT_ATTR = "data-ad-slot";

/** Marks an <ins> whose queue push already happened, so it never doubles. */
const AD_PUSHED_ATTR = "data-adsbygoogle-pushed";

/**
 * Resolve a placement name to a real slot id. An unknown name is passed
 * through (so a raw numeric slot id still works) and an empty one falls back
 * to the default placement.
 */
export function slotFor(slot) {
  if (slot == null) return AD_SLOTS.default;
  const key = String(slot);
  return AD_SLOTS[key] || key || AD_SLOTS.default;
}

/** Reserved height for a placement, so an ad filling in never shifts layout. */
export function reservedHeightFor(slot) {
  if (slot == null) return AD_DEFAULT_RESERVED_HEIGHT;
  return AD_RESERVED_HEIGHT[String(slot)] || AD_DEFAULT_RESERVED_HEIGHT;
}

/**
 * The loader <script> exactly as it must appear in a page head — emitted once
 * per document. The regression test compares this string byte-for-byte against
 * every instrumented page.
 */
export function loaderTagHTML() {
  return `<script async src="${ADSENSE_LOADER_SRC}" crossorigin="anonymous" data-ad-client="${ADSENSE_CLIENT}"></script>`;
}

/**
 * Escape a value for use inside a double-quoted HTML attribute.
 *
 * `format` and `label` are caller-supplied, and this function returns a markup
 * string that is assigned to innerHTML. Interpolated raw, a single `"` in a
 * label closes the attribute and lets the caller append arbitrary attributes
 * (`x" onload="alert(1)` becomes a real event handler on the <ins>), so every
 * interpolated value goes through here.
 */
function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Markup for one ad slot: a block-level wrapper that owns the reserved height,
 * plus the <ins> AdSense actually fills.
 *
 * The styles are inline and self-contained on purpose. index.html carries its
 * own design tokens in a <style> block and never loads site.css, while the
 * marketing pages load site.css — a shared stylesheet would style one set of
 * pages and silently leave the other set unreserved.
 */
export function adSlotHTML(slot, options = {}) {
  const id = slotFor(slot);
  const height = reservedHeightFor(slot);
  const format = escapeAttr(options.format || "auto");
  const label = escapeAttr(options.label || "Sponsored");
  const placement = escapeAttr(slot == null ? "default" : String(slot));
  return `<div class="fash-ad" data-ad-placement="${placement}" `
    + `style="margin:24px 0;width:100%;overflow:hidden;min-height:${height}px;display:flex;justify-content:center">`
    + `<ins class="adsbygoogle" `
    + `style="display:block;width:100%;min-height:${height}px" `
    + `data-ad-client="${ADSENSE_CLIENT}" `
    + `data-ad-slot="${escapeAttr(id)}" `
    + `data-ad-format="${format}" `
    + `data-full-width-responsive="true" `
    + `aria-label="${label}" `
    + `role="complementary"></ins></div>`;
}

/**
 * Push this <ins> onto the AdSense queue exactly once.
 *
 * Pushing twice for the same element asks Google for two creatives into one
 * slot and reports a bogus impression, so the guard is on the element itself
 * rather than in a module-level Set: it survives the slot being re-rendered
 * and stays correct when this module is loaded more than once.
 */
export function pushAd(ins) {
  if (!ins || ins.getAttribute(AD_PUSHED_ATTR) === "1") return false;
  ins.setAttribute(AD_PUSHED_ATTR, "1");
  try {
    const w = ins.ownerDocument && ins.ownerDocument.defaultView;
    if (!w) return false;
    (w.adsbygoogle = w.adsbygoogle || []).push({});
    return true;
  } catch {
    // A blocked or failed loader must never take the page down with it.
    return false;
  }
}

/**
 * Fill one mount point with a slot and queue it.
 *
 * `mount` is an element carrying data-ad-slot="<placement>"; it is filled in
 * place so the page controls where the ad sits.
 */
export function mountAdSlot(mount, options = {}) {
  if (!mount) return null;
  const slot = mount.getAttribute(AD_MOUNT_ATTR);
  mount.innerHTML = adSlotHTML(slot, options);
  const ins = mount.querySelector("ins.adsbygoogle");
  pushAd(ins);
  return ins;
}

/**
 * Fill every mount point in `root` (the document by default).
 *
 * Safe to call again on a re-render: an <ins> that was already queued is left
 * alone by pushAd, so a single slot can never double-report an impression.
 */
export function mountAllAdSlots(root, options = {}) {
  const doc = root || (typeof document !== "undefined" ? document : null);
  if (!doc) return [];
  const mounts = doc.querySelectorAll(`[${AD_MOUNT_ATTR}]`);
  const filled = [];
  mounts.forEach((m) => {
    if (m.getAttribute(AD_PUSHED_ATTR) === "1") return;
    m.setAttribute(AD_PUSHED_ATTR, "1");
    filled.push(mountAdSlot(m, options));
  });
  return filled;
}