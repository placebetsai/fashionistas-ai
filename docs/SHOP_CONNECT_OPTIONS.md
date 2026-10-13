# Shop connect options — 2026-10-13

Question: can a seller be "signed in for one click" to Poshmark, Depop, Mercari, Vinted, Grailed, eBay and Etsy from a phone, with nothing to install?

## How the others do it (sources checked 2026-10-13)

| Tool | eBay / Etsy | Poshmark, Depop, Mercari, Vinted, Grailed | Source |
|---|---|---|---|
| FLIPSAIL | Official sign-in (OAuth) | Chrome extension **once on a computer** captures your logged-in browser session; stored encrypted and replayed from their servers ("cloud mode"). Vinted listing creation still runs in the browser. | flipsail.io, flipsail.io/cloud-crosslisting |
| Secnd | eBay, Etsy, Shopify connect from anywhere | Poshmark, Depop, Vinted, Grailed, FB, Whatnot "connect once through the Secnd Chrome extension on a computer" | trysecnd.com/cross-listing-app |
| Vendoo | Official | Cloud crosslister with native iOS/Android app; sellers log in to each marketplace inside Vendoo, which then acts with that session | blog.vendoo.co/primelister-vs-list-perfectly |
| List Perfectly | Extension | Extension opens tabs and types into each form; mobile web is view/edit only | closo.co guide; vendoo.co comparison |
| PrimeLister | Extension | Extension-driven, tabs must stay open | vendoo.co comparison |
| Crosslist / Closo | Mostly extension-based for the closed shops (same pattern) | — | closo.co |

**Verdict:** Only eBay and Etsy have public listing APIs with OAuth. Nobody connects Poshmark, Depop, Mercari, Vinted or Grailed without either (a) a browser extension that lifts the session cookie, or (b) a native app / webview that logs in as the user and keeps that session on the vendor's servers. Both are automation of a logged-in account that those shops' terms prohibit (Poshmark, Depop, Mercari and Vinted all bar bots/automated access), and holding users' session cookies on our servers makes us a breach target worth all of their shop accounts. That is a legal and security liability, not a feature, for a free product.

## What fashionistas does (legit, zero-install, free)

1. **eBay and Etsy: real one-tap Connect** (OAuth, official APIs). Code is already in the Worker (`workers/fashionistas-api/src/channels.js`: `startAuth`/`finishAuth`/`postListing`, callback `CALLBACK_PATH`). It is dark only because keys are missing: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`, `EBAY_ENV`, plus three business policies; `ETSY_API_KEY`, `ETSY_API_SECRET`. None are set on the Worker or Pages (checked by name 2026-10-13). After keys: one tap → shop's own consent screen → back, then every listing posts directly.
2. **Other five shops: copy-and-open, already in `listing-wizard.js`.** One tap copies the title+description+price kit to the clipboard, Android share sheet sends the photos (`navigator.share({files})`) straight into the shop's app, the button opens the shop's sell page (an https App Link, so Android opens the Depop/Poshmark/Mercari/Vinted app when installed), and a one-tap "Done" marks it. We never see or store a shop password or cookie.
3. **Not doing:** session-cookie capture, headless posting, password storage.

## Steps only Iz can do
- eBay: developer.ebay.com → Create app (Production) → copy App ID / Cert ID / RuName, accepted URL `https://fashionistas.ai/api/ebay/callback` (see `docs/EBAY_OAUTH.md`); in eBay seller account opt into Business Policies and create payment/return/fulfillment policies. Then `wrangler secret put` each name on `fashionistas-api`.
- Etsy: etsy.com/developers → Create app → callback `https://fashionistas.ai/api/etsy/callback` → Keystring + Shared secret → `ETSY_API_KEY`, `ETSY_API_SECRET`. Etsy only allows handmade/vintage (20+ yrs) resale.
