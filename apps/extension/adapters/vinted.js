// adapters/vinted.js — Vinted adapter (multi-step "new item" wizard).
// ZERO selectors live here: everything comes from config/selectors.js (SEL).
// The wizard walk (photos -> details -> price -> publish) is driven by
// SEL.buttons.next inside formkit.fill().

export async function fill(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  const res = await K.fill(payload, SEL);
  await K.sleep(K.rand(900, 2000));
  // Vinted re-opens the price step if the item title arrived late; one extra
  // pass over the price inputs makes sure the number stuck.
  if (payload.price) {
    const priceEl = K.q(SEL.fields.price);
    if (priceEl && String(priceEl.value || "") !== String(payload.price)) {
      K.setValue(priceEl, String(payload.price));
      await K.sleep(K.rand(500, 1100));
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
  const res = K.submit(SEL); // <-- real submission: clicks "List item"/publish
  if (!res.ok) return res;
  await K.sleep(K.rand(2500, 4500));

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
