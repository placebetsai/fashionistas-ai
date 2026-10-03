// adapters/vestiaire.js — Vestiaire Collective adapter (publish flow).
// ZERO selectors live here: everything comes from config/selectors.js (SEL).

export async function fill(payload, SEL) {
  const K = globalThis.__fashForm;
  if (!K) return { ok: false, error: "formkit_missing" };
  // The publish flow is a long wizard (photos -> brand -> category -> details
  // -> price -> review); formkit walks SEL.buttons.next until every field in
  // the payload has landed.
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
  const res = K.submit(SEL); // <-- real submission: clicks "Publish"/"Save"
  if (!res.ok) return res;
  await K.sleep(K.rand(2800, 5000));

  const second = K.q(SEL.buttons.submit);
  if (second && second !== first && K.visible(second) && !second.disabled) second.click();
  return { ok: true, captcha: false };
}

export function extractUrl(SEL) {
  const K = globalThis.__fashForm;
  if (!K) return null;
  const url = K.extractUrl(SEL);
  if (url) return url;
  // Vestiaire redirects through /home/<slug>-<id>; the pathname alone is
  // enough to hand back a working listing link.
  if (location.host === "www.vestiairecollective.com" && /^\/(home\/)?[a-z0-9-]+-\d+/.test(location.pathname)) {
    return location.origin + location.pathname;
  }
  return null;
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
