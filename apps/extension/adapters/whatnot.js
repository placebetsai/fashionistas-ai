// adapters/whatnot.js — Whatnot adapter (sell/create listing flow).
// ZERO selectors live here: everything comes from config/selectors.js (SEL).

export async function fill(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  // Whatnot keeps the price/quantity inputs behind the photo step; formkit's
  // wizard loop handles that, then we settle the autosave.
  const res = await K.fill(payload, SEL);
  await K.sleep(K.rand(1000, 2200));
  return res;
}

export async function submit(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  const captchaSel = K.detectCaptcha(SEL);
  if (captchaSel) return { ok: false, captcha: true, matched: captchaSel };

  const first = K.q(SEL.buttons.submit);
  const res = K.submit(SEL); // <-- real submission: clicks "Publish listing"
  if (!res.ok) return res;
  await K.sleep(K.rand(2600, 4800));

  // Whatnot shows a confirmation dialog with a final publish button.
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
