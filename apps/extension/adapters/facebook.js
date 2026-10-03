// adapters/facebook.js — Facebook Marketplace adapter.
// ZERO selectors live here: everything comes from config/selectors.js (SEL).
// Marketplace uses div[contenteditable] for the description and
// div[role=button] for Publish — formkit handles both.

export async function fill(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  // Marketplace mounts its fields inside a client-routed dialog; wait for the
  // first field before walking the form.
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline && !K.q(SEL.fields.title)) {
    await K.sleep(500);
  }
  const res = await K.fill(payload, SEL);
  await K.sleep(K.rand(900, 2100));
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
  await K.sleep(K.rand(3000, 5000));

  // Marketplace shows a confirmation sheet with one more "Publish" node.
  const second = K.q(SEL.buttons.submit);
  if (second && second !== first && K.visible(second)) {
    if (second.getAttribute("aria-disabled") !== "true") second.click();
  }
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
  // NOTE: we only ever pre-fill the registration form. Account creation,
  // phone/e-mail codes and any CAPTCHA stay with the human.
  return K.prefillSignup(user, SEL);
}
