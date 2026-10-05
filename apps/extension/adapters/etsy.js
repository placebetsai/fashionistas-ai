// adapters/etsy.js — Etsy adapter.
// ZERO selectors live here: everything comes from config/selectors.js (SEL).
//
// Etsy is driven through the seller's OWN logged-in browser session — exactly
// like Poshmark/Mercari/Depop/Grailed. No API key is used, requested or stored.
// The seller is on the form with us and taps "Publish" themselves; we never
// click it for them.
//
// There is a separate API path (Etsy Open API v3, OAuth, "Connect Etsy" button)
// kept in api/etsy_api.js behind the ETSY_API_ENABLED flag. It is OFF by default
// and users never see or enter a key — that flag is for us, later.

export async function fill(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  // Etsy's listing editor renders photo slots first and only mounts the title/
  // materials/price fields once a photo exists, so photos must land before the
  // rest of the walk — formkit already does photos first.
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
  const res = K.submit(SEL); // <-- real submission: clicks "Publish"
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
