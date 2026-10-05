# Privacy Policy

**DRAFT — not legal advice, pending counsel review.**
**Draft date: 2026-10-05. Effective date: to be set by counsel.**

> Drafted by an engineer for review by a licensed lawyer. Bracketed items
> `[LIKE THIS]` are placeholders for counsel. This policy describes what the
> software **actually does today** — it was written by reading the deployed code,
> not by writing what a privacy policy usually says.

**The operator:** `fashionistas.ai`, operated by `[LEGAL ENTITY NAME]`, a
`[ENTITY TYPE]` organised under the laws of `[JURISDICTION]`, at `[ADDRESS]`.
Contact: [fashionistas1979@gmail.com](mailto:fashionistas1979@gmail.com).

---

## 1. The short version

- We store your email, a **salted hash** of your password (never the password),
  your session tokens, your listing text, your photos, your plan status and your
  monthly usage counters.
- **We never ask for your marketplace password, and our servers never receive
  it.** Listing happens in your own logged-in browser session. There is no field
  anywhere in this product for a marketplace password, because there is no code
  path that would accept one.
- We do **not** sell your personal information.
- Email us and we will delete your account data.

## 2. What we store

### 2.1 Account and authentication

| What | Where | Notes |
| --- | --- | --- |
| Email address | Cloudflare D1 | Your login. Unique per account. |
| Password hash + salt | Cloudflare D1 | PBKDF2-HMAC-SHA256, 100,000 iterations, a fresh random 16-byte salt per user. Stored as `pbkdf2-sha256$<iterations>$<hex>`. **We never store your password itself.** |
| Session token + expiry | Cloudflare D1 | A random opaque token, checked on every authenticated request. |
| Account creation time | Cloudflare D1 | |

### 2.2 Cookies

We set two first-party cookies. Both are sent only to fashionistas.ai.

| Cookie | What it holds | Lifetime |
| --- | --- | --- |
| **`fash_session`** | An opaque session token, and nothing else — no marketplace credential, no profile data. | While signed in |
| **`ebay_byo_sess`** | **Your own eBay API `clientId` and `clientSecret`**, plus the OAuth redirect URI and which eBay environment you chose. Only ever set if you use the eBay "bring your own keys" option and paste your own eBay keys. | 10 minutes, and only sent to `/api/ebay/oauth` |

**Be aware of the second one.** The `ebay_byo_sess` value is **base64url-encoded,
not encrypted** — anyone who can read that cookie can decode it and recover your
eBay client secret. That is why it is `HttpOnly` (no JavaScript can read it),
restricted to the `/api/ebay/oauth` path, and capped at ten minutes, but if you
would rather not hand us your eBay keys at all, **do not use the bring-your-own
keys option** — the ordinary eBay OAuth path in Section 3.1 does not involve this
cookie.

`[COUNSEL: state the cookie attributes exactly (Secure, HttpOnly, SameSite,
Path, Max-Age), and whether consent is required for strictly-necessary cookies
in the jurisdictions we operate in.]`

A cookie you set yourself on a marketplace's own domain is that marketplace's
business. We never receive it.

### 2.3 Your content

| What | Where | Notes |
| --- | --- | --- |
| Listing text | Cloudflare D1 | Title, description, category, condition, brand, colour, size, price, tags, hashtags. |
| Fee "breakdown" | Cloudflare D1 | The computed fee lines for the shops you asked about. |
| Which model produced a draft | Cloudflare D1 | Provider name and model name only — never the prompt text as a stored field. |
| Uploaded photos, cutouts, and virtual try-on renders | **Cloudflare R2** (bucket `fashionistas-images`) | The image store for the product. |
| Closet items you add | Cloudflare D1 | Name, category, brand, condition, status, price ranges. |
| Sale events | Cloudflare D1 | Shop, listing reference, URL, title, price, currency, sale date, status. Reported by the browser extension while you are signed in. |
| Delist queue entries | Cloudflare D1 | Which item we are trying to pull down, on which shops. |

**Photos may contain people.** A virtual try-on render places a garment onto a
photograph of a person. That image is personal data about whoever is in it. Do
not upload a photograph of a person who has not consented, and delete anything
you should not have uploaded.

### 2.4 Billing and plan

Stripe is the processor. We store **only what we need to recognise your
subscription**: a Stripe customer id, a Stripe subscription id, a status
(`active`, `inactive`, …) and the end of the current period. **We never see,
receive or store your card number, CVC or expiry** — that happens entirely on
Stripe's hosted checkout page.

### 2.5 Usage counters

Per user, per calendar month, in Cloudflare D1: how many listings, AI photos and
stylist messages you have used. We need these to enforce the free-tier caps, and
they reset on the first of each month.

### 2.6 Technical data

Cloudflare logs request metadata — IP address, timestamp, user agent, requested
path, response status — needed to operate and secure the service, and to
investigate abuse.

## 3. What we never store

- **Marketplace passwords. We never ask for them, and there is nowhere to put
  them.** Listing for most shops runs through a browser extension inside your
  own signed-in session; the extension uses the session you already have.
- **Your marketplace session cookies or tokens** for Poshmark, Mercari, Depop,
  Grailed, Facebook Marketplace or Whatnot. Those stay in your browser. We never
  receive them.
- **Your card number** — see 2.4.
- Your bank details. Your government ID. Your home address, unless you type it
  into a listing you choose to publish.
- Sell contact details of buyers, unless you yourself write them into a listing.

### 3.1 Two narrow exceptions, stated plainly

Two marketplace integrations do require us to hold a marketplace credential,
because they use a marketplace's own developer API and there is no way to run an
official API without one:

1. **eBay** — two optional mechanisms, both initiated by you:
   1. **OAuth grant.** After you complete eBay's own OAuth consent screen we
      store a **refresh token** for your eBay account. The access token derived
      from it is short-lived. It can pull a listing down (`Sell Inventory`
      withdraw) when an item sells, and it is used against eBay's
      **development/sandbox** host.
   2. **Bring-your-own-keys.** If you paste your own eBay API `clientId` and
      `clientSecret` instead, they pass through the short-lived
      `ebay_byo_sess` cookie described in 2.2 and are used for the OAuth
      exchange. **They are encoded, not encrypted**, so avoid this route unless
      you are comfortable with that.

   Either way, **you** grant access on eBay's own authorization screen, and
   **you** can revoke it at any time from eBay's settings. Revoking disconnects
   us; it does not cancel anything else. Our servers do hold these credentials,
   so if your eBay account is compromised, treat us as part of your account's
   trust boundary.
2. **Etsy** — an Etsy OAuth token granted on Etsy's own authorization screen, so
   we can set a listing to `INACTIVE` when an item sells, or create a **draft**
   listing. This is the only Etsy credential path.

In both cases **you** grant access, on eBay's or Etsy's own authorization screen,
and **you** can revoke it at any time from that marketplace's settings. Revoking
disconnects us; it does not cancel anything else. Our servers do hold these
tokens, so if your eBay or Etsy account is compromised, treat us as part of your
account's trust boundary.

Everything else — Poshmark, Mercari, Depop, Grailed, Vinted, Facebook
Marketplace, Kidizen, Vestiaire, Whatnot — runs **session-only** and involves no
credential leaving your browser.

## 4. Who else sees your data (sub-processors)

We share the minimum necessary with these providers, all of whom process data on
our instructions:

| Provider | What | What they get |
| --- | --- | --- |
| **Cloudflare** (Workers, Pages, D1, R2, KV) | Hosting and storage | Everything we store: accounts, listings, photos, counters, logs. Bound in `wrangler.toml`. |
| **Stripe** | Subscription billing | Your email, plan, and card details on their own checkout pages. We get only the ids listed in 2.4. |
| **RunPod** (Serverless GPU, FASHN VTON v1.5) | Rendering the virtual try-on image | **The image bytes and the prompt for that single render**, in order to return the finished picture. Renders are paid for by us per run. |

**Text and listing AI — deployment-dependent.** The writing model is chosen by
configuration, not hard-coded, so which provider sees your text depends on how
this deployment is set up. It can be a local model, or any OpenAI-compatible
host (OpenAI, a Cloudflare AI Gateway, or another compatible host). Which one is
live is visible in each listing draft: we store the provider name and model name
alongside every listing. **If the deployment is unconfigured, the feature refuses
to run rather than sending your text anywhere.** `[COUNSEL / PRODUCT: identify the
specific production text-model provider and name it here, then set the DPA and
transfer mechanism before launch.]`

**We do not send your content to any marketplace.** Posting happens from your
own browser session.

We do not share your personal information with data brokers, and we do not
cross-context behavioural advertising.

## 5. Fee estimates

Fee and take-home figures are computed by arithmetic inside our own code from a
static catalogue. **No third party is contacted, and nothing about your sales is
sent anywhere, to produce them.** The figures are an approximate model, not a
live quote — see [risk.html](/legal/risk.html).

## 6. International transfers

Cloudflare and Stripe process data on infrastructure in multiple countries. If
you are outside the United States, your data may be processed outside it.
`[COUNSEL: add the correct transfer mechanism — Standard Contractual Clauses, an
adequacy decision, or equivalent — for each jurisdiction, and name the regions
actually used.]`

## 7. How long we keep things

| Data | Kept for |
| --- | --- |
| Account (email, password hash) | Until you delete your account |
| Session tokens | Until the session expires or you sign out |
| Listings, closet items, sale records | Until you delete them or your account |
| Photos and renders in R2 | Until you delete them or your account |
| Usage counters | Reset monthly; deleted with the account |
| Billing records | As long as the subscription is live, then as long as tax law requires |
| Security and access logs | `[COUNSEL: set the actual retention period — do not ship an unset promise.]` |

Backups age out on their own cycle: `[COUNSEL: state the backup retention
window so deletion is described honestly, including the fact that a backup copy
can persist until it is overwritten.]`

## 8. Deletion on request

**Email [fashionistas1979@gmail.com](mailto:fashionistas1979@gmail.com) from the
address on your account and ask for deletion.** We will verify that you are the
account holder, then delete:

- your account row, password hash and sessions;
- your listings, closet items and sale records;
- **your photos and renders from Cloudflare R2**, including the bucket objects
  themselves — not just the database row that points at them;
- your usage counters.

Cancelling a subscription is not deletion; ask for both if you want both. A
marketplace account is not ours, so we cannot delete that — do it with the
marketplace. Revoke any eBay or Etsy OAuth grant you gave us at the same time.

`[COUNSEL: state the statutory response window (e.g. 30 days), whether we can
place an exception for records we must keep for tax or fraud purposes, and who
in the company is the privacy contact.]`

## 9. Security

- Passwords are salted and stretched with PBKDF2-HMAC-SHA256 at 100,000
  iterations; the plaintext password is never stored or logged.
- Session tokens are compared server-side against an expiry, and authenticated
  routes have no anonymous path.
- Access to stored photos requires a valid session.
- Secrets — the Stripe key, the marketplace API keys, the model API key — are
  read from environment configuration and are never written into source, logs or
  listings.

`[COUNSEL: this section describes the code, not a security programme. If the
product ever needs a compliance attestation (SOC 2, a penetration test), state it
here only once it exists — do not promise one.]`

## 10. Your rights

Depending on where you live you may have rights to access, correct, delete,
port, or object to the processing of your personal data, and to complain to a
regulator. In practice: our databases are keyed to your account, so you can see
and change most of your own data from inside the app, and you can ask for the
rest. To exercise any right, email
[fashionistas1979@gmail.com](mailto:fashionistas1979@gmail.com).

`[COUNSEL: this section needs the actual jurisdiction-specific rights and
supervisory authority for each market you operate in. Do not ship it as-is.]`

## 11. Children

The service is for people who can enter a binding contract and sell on a
marketplace. It is not directed at children under 13 (or the equivalent minimum
age where you operate), and we do not knowingly collect their data. If you
believe a child has given us data, email us and we will delete it.

## 12. Changes

We will update this page when the data we hold changes, and we will post the new
version with a new date. Material changes will be announced
`[COUNSEL: in-app and/or by email to the account address]`. Where a change is
required by law we will tell you what it is.

---

### Drafting notes for counsel — not part of the Policy

1. **Section 3.1 is the honest version of a commonly-mis-stated claim.** Most
   boilerplate says "we never hold your marketplace credentials." That is not
   quite true here: the eBay OAuth refresh token, the optional eBay
   bring-your-own-keys `clientId`/`clientSecret`, and the Etsy OAuth token in
   Section 3.1 are real and should be disclosed and accepted by counsel, not
   buried.
2. **Section 2.2's second cookie is the sharpest issue on this page.** The
   `ebay_byo_sess` cookie carries the user's own eBay client secret **base64url
   encoded rather than encrypted**, so it is recoverable by anyone who can read
   it. It is `HttpOnly`, scoped to `/api/ebay/oauth`, and capped at 600 seconds,
   which is why Section 2.2 tells users to prefer the ordinary OAuth path. Two
   options for counsel: (a) keep the bring-your-own-keys feature and accept the
   disclosure, or (b) drop the feature and remove the cookie from both this page
   and the code. Do not ship this page while the decision is open — the current
   wording describes a real weakness without resolving it.
3. **Section 4's text-model provider is a `[PLACEHOLDER]` and blocks launch.**
   The provider is configuration-driven (`MODEL_PROVIDER`), so the correct
   answer changes with the deployment. Name it, sign a DPA, and pick a transfer
   basis before this goes live.
4. **Retention is largely unset** (logs, backups). Shipping a policy that
   promises "until we delete it" with no actual schedule is the likeliest
   inaccuracy on this page.
5. **Section 7 promises R2 object deletion.** That must be true of the deletion
   job before launch, not just true of the database.
6. **"We never see or store your card number"** is accurate: payment happens on
   Stripe's hosted Checkout page and only the customer and subscription ids come
   back to us.
7. The existing short policy at `/privacy/` still says "we do not post to Depop,
   eBay, Poshmark, Mercari, Vinted or Grailed on your behalf." That sentence is
   inconsistent with the current code and with Section 6 of the Terms. It should
   be reconciled with this document when counsel approves it.