# Multilist one-click — zero → accounts ready → Sell everywhere

**Audience:** sellers and agents QA’ing fashionistas.ai multilist  
**Path that works without Stripe / without eBay·Etsy server secrets:** Chrome extension  
**Last updated:** 2026-10-06

---

## Promise

**UI gate:** Multilist shows a **one-click readiness strip** (`xlOneClickGate` / `xlReadyStripHtml`):
1. Install Crosslister (Load unpacked) → extension ping live
2. Log in + **Verify session** per shop
3. Tick shops → **Sell everywhere**

Until step 1, Sell everywhere is honest about clipboard / optional API fallback and **never** toasts Posted on a no-op.


1. Guidance to create / open each shop account  
2. One **Sell everywhere** click once accounts are ready  
3. Live per-shop status: `queued` → `posting` → `posted` (with listing **View** URL when captured) or `failed` / `capped`

Server API posts for eBay/Etsy stay blocked when Stripe or marketplace secrets are empty. **Do not invent keys. Do not set fake Stripe.** Multilist for QA uses the extension path instead.

---

## Seller path (functional)

### A. Install the Crosslister (once)

`FASH_EXT_IDS` in `index.html` is **empty** until a real Chrome Web Store ID exists. That is intentional.

**Supported today — Load unpacked**

1. On Multilist → **Connect extension** / **Set up extension**, or download  
   `/chrome-store/fashionistas-extension-v1.0.1.zip` (version follows `apps/extension/manifest.json`).
2. Unzip. Open `chrome://extensions` → **Developer mode** → **Load unpacked** → select the folder that contains `manifest.json` (the unzipped root, or repo `apps/extension/`).
3. Keep browsing **https://fashionistas.ai** in **that same Chrome profile**.  
   `content/announce.js` posts `chrome.runtime.id` into the page; it is stored as `localStorage.fash_ext_id` (`extSetId`).
4. Tap **Re-check**. The Connect extension button hides when the ping succeeds (`EXT_LIVE`).

**If auto-detect fails:** Connect extension → Advanced → paste the 32-character ID from Chrome → Extensions → Details → **Save & connect**.

**Chrome Web Store (later):** publish the zip from `scripts/zip-extension.sh`, then put the store ID into `FASH_EXT_IDS` in `index.html`. Until then, sellers finish setup alone with Load unpacked + announce / paste.

### B. Ready each shop account

For every marketplace you sell on:

1. Multilist → **Connect** on that row (or Signup / Open create listing in the guide).  
2. Create the seller account on the marketplace if needed (real signup URL).  
3. Stay **logged in** in this Chrome profile.  
4. Tap **Verify session** (extension probes a boolean only — no cookies, no passwords leave the browser).  
5. Status becomes **Connected** only after the extension observes a live session. Manual **I've connected** shows **Unverified**.

Shops covered by extension adapters: Poshmark, Mercari, Depop, Vinted, Grailed, Facebook, Kidizen, Vestiaire, Whatnot, **eBay**, **Etsy**.

### C. One click

1. Closet / Multilist → pick an item → tick shops.  
2. **Sell everywhere**.  
3. With the extension live, **every** ticked shop (including eBay/Etsy) is queued client-side — **no Stripe gate**, no server API secrets.  
4. Watch chips: queued → posting → posted (+ **View**) or failed / rate limited.

Without the extension: eBay/Etsy hit `/api/list/*` (402 subscribe / 503 env_missing when Stripe or secrets are empty); other shops get clipboard + open-form handoff.

---

## Proven in code vs needs a human

| Step | Proven in repo / tests | Needs human Chrome |
|------|------------------------|--------------------|
| Connect guides + signup / create-listing URLs | Yes (`XL_CONNECT_SHOPS`, guides) | Open signup and finish KYC / payouts on each shop |
| Extension install UX + ID persist (`announce` / `extSetId`) | Yes | Load unpacked (or install from Store when published) |
| `extPublish` → `queue.enqueue` → adapter fill/submit | Yes (unit / wiring tests; adapters in `ADAPTERS` incl. eBay/Etsy) | Logged-in session; CAPTCHA / 2FA walls stop the job (`captcha_required`) |
| Status poll `results` → posted + `listing_url` | Yes (`getResults` + `extPollStart`) | Real post must succeed in that profile |
| Server eBay/Etsy API create | Code exists; **blocked** without Stripe + secrets | Ops: real Stripe + real keys — never fakes |
| `FASH_EXT_IDS = []` | Deliberate | Web Store publish **or** Load unpacked |

---

## What still needs Stripe / eBay keys / human Chrome

- **Stripe subscription:** required for **server** routes that return 402 — **not** required for extension multilist.  
- **eBay / Etsy API secrets + OAuth:** required only for server `/api/list/ebay|etsy` and optional **Create on eBay**. Extension posts without them.  
- **Human Chrome:** install/load the extension; log into each shop; pass any CAPTCHA the marketplace shows; confirm payouts/identity on the marketplace itself.

---

## Related docs

- `docs/MULTILIST_CONNECT.md` — Connect status model (`needs` / `ready` / `unverified` / `connected`)  
- `docs/EBAY_OAUTH.md` — optional BYO OAuth API path  
- `chrome-store/LISTING.md` — Store listing draft when publishing  
