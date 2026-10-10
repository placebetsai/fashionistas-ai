/**
 * POST /api/contact — the contact form's relay.
 *
 * The form used to post straight to `https://formsubmit.co/<our address>`,
 * which put that address in the page source of the contact page, in three
 * meta tags, and in the footer of a dozen other pages. It is now read from
 * here instead: the `functions/` directory is consumed by the Pages router
 * and is never served as a static file — verified on the live site, where
 * `/functions/api/billing/checkout.js` answers 404 — so a visitor's browser
 * only ever sees `/api/contact`.
 *
 * Everything the form submits is forwarded unchanged apart from the
 * recipient, so delivery behaviour is untouched, including FormSubmit's own
 * spam filtering and the one-time activation email it sends on first use.
 *
 * There is no session gate here on purpose: a contact form has to work for
 * someone who has never had an account. It is on the PUBLIC allowlist in
 * tests/api-auth-matrix.test.mjs with that justification, and it returns no
 * user data of any kind.
 */

const TO = "fashionistas1979@gmail.com";
const RELAY = "https://formsubmit.co/" + TO;

const LIMITS = { name: 120, email: 200, message: 5000 };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestPost(context) {
  const { request } = context;

  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/x-www-form-urlencoded")) {
    return json({ ok: false, error: "Send the form, not a file." }, 415);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "That submission was not readable." }, 400);
  }
  const get = (k) => String(form.get(k) ?? "").trim();

  // Honeypot. A filled hidden field is a bot: accept it silently so there is
  // nothing to learn from and nothing to adapt to. Real humans never see it.
  if (get("_honey")) return json({ ok: true });

  const name = get("name").slice(0, LIMITS.name);
  const email = get("email").slice(0, LIMITS.email);
  const message = get("message").slice(0, LIMITS.message);

  if (!name || !message) {
    return json({ ok: false, error: "Name and message are required." }, 400);
  }
  // Deliberately loose. This only has to reject obvious junk — the relay does
  // the real filtering, and an over-strict pattern here turns away real mail
  // from people whose addresses the pattern does not like.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "That email address does not look right." }, 400);
  }

  const outbound = new URLSearchParams();
  outbound.set("_subject", "fashionistas.ai Contact Form");
  outbound.set("_captcha", "false");
  outbound.set("_template", "table");
  outbound.set("name", name);
  outbound.set("email", email);
  outbound.set("message", message);

  try {
    const res = await fetch(RELAY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: outbound.toString(),
    });
    if (!res.ok) {
      return json({ ok: false, error: "The mail relay refused that (" + res.status + "). Try again shortly." }, 502);
    }
  } catch {
    return json({ ok: false, error: "Could not reach the mail relay. Try again in a minute." }, 502);
  }

  return json({ ok: true });
}

export async function onRequestGet() {
  return json({ ok: false, error: "Send the form." }, 405);
}
