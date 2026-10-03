// adapters/mercari.js — Mercari adapter (US + JP hosts).
// ZERO selectors live here: everything comes from config/selectors.js (SEL).

export async function fill(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  // Mercari renders the photo grid async; fill() in formkit already waits
  // between steps, then we give the price field time to validate.
  const res = await K.fill(payload, SEL);
  await K.sleep(K.rand(900, 2000));
  if (payload.price !== undefined && payload.price !== null) {
    const priceEl = K.q(SEL.fields.price);
    if (priceEl) {
      K.setValue(priceEl, String(payload.price));
      await K.sleep(K.rand(400, 900));
    }
  }
  return res;
}

export async function submit(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  const captchaSel = K.detectCaptcha(SEL);
  if (captchaSel) return { ok: false, captcha: true, matched: captchaSel };

  const first = K.q(SEL.buttons.submit);
  const res = K.submit(SEL); // <-- real submission: clicks Mercari's listing button
  if (!res.ok) return res;
  await K.sleep(K.rand(2400, 4200));

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
