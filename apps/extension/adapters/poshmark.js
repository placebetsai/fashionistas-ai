// adapters/poshmark.js — Poshmark adapter.
// ZERO selectors live here: every selector comes from config/selectors.js
// through the SEL argument, so a layout change is a one-file fix.
//
//   fill()        upload photos + fill every field of the create-listing form
//   submit()      click Poshmark's real "List" button -> the listing goes live
//   extractUrl()  read back the live /listing/ URL after the post-submit redirect
//   delist()      delete a previously published listing
//   prefillSignup() SIGNUP ASSIST: pre-fill only, never creates an account

export async function fill(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  // Poshmark spins up the draft the moment the first photo lands; give the
  // uploader a beat so the price/description inputs are mounted.
  const res = await K.fill(payload, SEL);
  await K.sleep(K.rand(700, 1600));
  return res;
}

export async function submit(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  // HARD RULE: a CAPTCHA stops the job — we never try to solve or skip it.
  const captchaSel = K.detectCaptcha(SEL);
  if (captchaSel) return { ok: false, captcha: true, matched: captchaSel };

  const first = K.q(SEL.buttons.submit);
  const res = K.submit(SEL); // <-- real submission: clicks "List"
  if (!res.ok) return res;
  await K.sleep(K.rand(2200, 3800));

  // Poshmark sometimes swaps the form for a review step with a new button.
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
  // Stops before the create-account button on purpose (see formkit).
  return K.prefillSignup(user, SEL);
}
