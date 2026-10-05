// adapters/ebay.js — eBay adapter.
// ZERO selectors live here: everything comes from config/selectors.js (SEL).
//
// eBay is driven through the seller's OWN logged-in browser session — exactly
// like Poshmark/Mercari/Depop/Grailed. No API key is used, requested or stored.
// The seller is on the form with us and taps "List" themselves; we never click
// it for them.
//
// There is a separate API path (official eBay Sell APIs, OAuth, "Connect eBay"
// button) kept in api/ebay_api.js behind the EBAY_API_ENABLED flag. It is OFF by
// default and users never see or enter a key — that flag is for us, later.

export async function fill(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  // eBay's listing form is a multi-step React flow whose category, item
  // specifics and condition controls are comboboxes that only resolve after
  // the photos step — formkit walks SEL.autocomplete and clicks the first
  // suggestion for each.
  const res = await K.fill(payload, SEL);
  await K.sleep(K.rand(800, 1700));
  return res;
}

export async function submit(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  const captchaSel = K.detectCaptcha(SEL);
  if (captchaSel) return { ok: false, captcha: true, matched: captchaSel };

  const first = K.q(SEL.buttons.submit);
  const res = K.submit(SEL); // <-- real submission: clicks "List" / "List it"
  if (!res.ok) return res;
  await K.sleep(K.rand(2500, 4000));

  const second = K.q(SEL.buttons.submit);
  if (second && second !== first && K.visible(second) && !second.disabled) second.click();
  return { ok: true, captcha: false };
}

export function extractUrl(SEL) {
  const K = globalThis.__fashForm;
  if (!K) return null;
  return K.extractUrl(SEL);
}

export function detectCaptcha(SEL) {
  const K = globalThis.__fashForm;
  if (!K) return "formkit_missing";
  return K.detectCaptcha(SEL);
}

export function delist(SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  return K.delist(SEL);
}

export async function prefillSignup(user, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  return K.prefillSignup(user, SEL);
}
