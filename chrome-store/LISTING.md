# Chrome Web Store — store listing content

**Extension name (manifest):** `Fashionistas Crosslister`
**Package:** `chrome-store/fashionistas-extension-v.zip`
**Source:** `apps/extension/` (read-only — nothing in the extension was modified for this package)

---

## 1. Summary (short description)

> One tap fills and posts your listing on nine marketplaces in your own logged-in browser. No password ever reaches us.

**Length: 117 / 132 characters.**

---

## 2. Detailed description

**Sell the same piece in more places — without re-typing it nine times.**

Build the listing once on fashionistas.ai: snap a photo, get the AI photo and the written copy back,
tap Post. This extension takes over from there **in your own browser, in your own signed-in session**:
it opens each marketplace where you already have an account, fills every field, uploads the photos,
presses the shop's own List button, and hands you back the live listing URL.

### What you get

- **One tap instead of nine forms.** Photos, title, description, price and the rest are filled on every
  marketplace from the single listing you already wrote.
- **Your account stays yours.** Everything runs inside your logged-in browser session. **We never
  receive your marketplace password** — there is no field for one, and nothing in this extension reads
  or sends one.
- **You always find out what happened.** A system notification per marketplace: "Posted to Poshmark"
  with the live listing URL, or the exact reason it could not be posted.
- **Sold items stop showing as available.** A read-only scan of your own closets records each sale
  exactly once, so your closet view stays accurate.
- **It protects your selling account.** Per-marketplace posting caps, randomised spacing between posts
  and capped retries keep you under the rate limits that get sellers throttled or banned.

### Where it publishes (live in this build)

Poshmark · Mercari · Depop · Vinted · Grailed · Facebook Marketplace · Kidizen · Vestiaire Collective · Whatnot

### Where it reads your session and tracks sales

Poshmark · Mercari · Depop · Grailed · eBay · Etsy

### It refuses to cheat

- It never solves, skips or retries a CAPTCHA or an identity-verification wall — the job stops and
  reports `captcha_required` instead.
- It never creates an account for you; signup assistance fills the form and stops before the
  create-account button.
- If you are signed out of a marketplace it says so (`not_logged_in`) rather than trying to log in on
  your behalf.

### Privacy in one paragraph

We never receive your marketplace password, your marketplace cookies or your session tokens. What
reaches our servers is: the listing you created on fashionistas.ai, the result of each attempt
(posted / failed + the live listing URL), one yes/no boolean per marketplace for the "Connected"
badge, and one event per sold listing. Full permission-by-permission details: [PRIVACY.md](./PRIVACY.md).
Legal: https://fashionistas.ai/legal/terms · https://fashionistas.ai/legal/privacy

### Before you start

1. Sign in to the marketplaces you sell on, in the same browser profile where you install this
   extension.
2. Connect the extension on fashionistas.ai.
3. Tap Post once — status, live URLs and failures show up on your dashboard and as notifications.

---

## 3. Category

**Primary: Shopping** (the extension's single purpose is publishing the seller's own item to
marketplaces — `PRIVACY.md`, "Single purpose").

Store forms usually allow one category only; if Shopping is unavailable in the dashboard, fall back to
**Productivity**.

---

## 4. Search tags / keywords

Chrome's store listing has no dedicated "tags" field, so these keywords must appear **inside the
summary and description** above (dashboard field availability: NOT PROVEN — confirm in the developer
dashboard).

| # | Keyword | Why it belongs |
| --- | --- | --- |
| 1 | crosslisting | the core job: one listing, many marketplaces |
| 2 | reseller | the audience |
| 3 | poshmark | publishes there (`queue.js:29`) |
| 4 | mercari | publishes there (`queue.js:30`) |
| 5 | depop | publishes there (`queue.js:31`) |
| 6 | vinted | publishes there (`queue.js:32`) |
| 7 | grailed | publishes there (`queue.js:33`) |
| 8 | whatnot | publishes there (`queue.js:37`) |
| 9 | vestiaire | publishes there (`queue.js:36`) |
| 10 | kidizen | publishes there (`queue.js:35`) |
| 11 | ebay | session + sale tracking (`sales/adapters/ebay.js`) |
| 12 | etsy | session + sale tracking (`sales/adapters/etsy.js`) |
| 13 | thrift / closet / inventory | how sellers describe their own stock |
| 14 | bulk listing | one job fans out to every marketplace |

Suggested keyword sentence already present in the description: *"Build the listing once … it opens each
marketplace where you already have an account"*.

---

## 5. Submission-form assets (already generated in this directory)

| Asset | Path | Verified |
| --- | --- | --- |
| Extension zip | `chrome-store/fashionistas-extension-v.zip` | `unzip -l` → 59 entries, `manifest.json` present, 4 `icons/icon-*.png` present, no tests/`.env`/`node_modules`/`.git` |
| Store icon 128×128 | `chrome-store/icons/icon-128.png` | IHDR 128×128, md5 identical to `apps/extension/icon.png` |
| Store icons 16/32/48 | `chrome-store/icons/icon-16.png`, `icon-32.png`, `icon-48.png` | IHDR verified after round-trip decode |
| Store icon (action default) | `chrome-store/icons/default_128.png` | IHDR 128×128 |
| Screenshot 1 — home page | `chrome-store/shots/01.png` | 1280×800 real headless-Chrome capture |
| Screenshot 2 — pricing | `chrome-store/shots/02-pricing.png` | 1280×800 real headless-Chrome capture |
| Screenshot 3 — connect panel | `chrome-store/shots/03-connect.png` | 1280×800 real headless-Chrome capture |
| Privacy supplement | `chrome-store/PRIVACY.md` | permission-by-permission, traced to source |

**Blocker to resolve before submitting:** `apps/extension/manifest.json` declares **no** `icons`,
`action` or `default_icon` block at all (`grep '"icons"' apps/extension/manifest.json` → no match), so
Chrome will fall back to a generic placeholder unless the manifest owner adds one. The icon files above
are ready; the manifest declaration has to come from the extension owner, because `apps/extension/**`
is not editable for this task.
