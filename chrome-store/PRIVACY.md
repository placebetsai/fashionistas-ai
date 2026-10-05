# Fashionistas Crosslister — Chrome Web Store privacy supplement

**Extension name:** Fashionistas Crosslister
**Package:** `fashionistas-extension-v.zip` (from `apps/extension/`, read-only)
**manifest_version:** 3 · **version:** 1.0.0 · **minimum_chrome_version:** 116

Every row in this document was read from `apps/extension/manifest.json` and traced to the file that
actually uses it. Line numbers refer to that source tree.

---

## Single purpose

**This extension has one purpose: it publishes a seller's own listing, which the seller built on
fashionistas.ai, to the marketplaces that seller already sells on — inside the seller's own signed-in
browser session.**

It does one job (cross-list that one listing) and nothing else: no ad injection, no coupon layer, no
search substitution, no cryptomining, no data brokerage, no second unrelated feature.

---

## Data usage

### We never receive marketplace passwords

The extension never asks for, reads, stores, transmits or stores-in-storage a password for any
marketplace. There is no password field anywhere in the extension, and no code path that reads an
`<input type="password">` **value** — the only password-field references are *presence* checks used to
decide "is the seller signed in here" (`content/login-detect.js:162`, `content/bridge.js:77`,
`sales/saleskit.js:191`), which read the boolean `!!element`, never `.value`.

Marketplace accounts stay signed in on the seller's own machine. Our servers are never in the path of
a marketplace login: the marketplace sees the seller's own browser session, not us.

### What does reach our servers

All network calls made by the extension go to two destinations declared in `config/api.js:6` and
`config/selector-source.js:23` — our own product hosts.

| Data sent | Direction | Code | Why it is needed |
| --- | --- | --- | --- |
| Queued job (listing title, description, price, photos, target shop) | GET from us | `queue.js:457` (`GET /api/jobs?status=queued`) | The seller created this listing on fashionistas.ai; the extension fetches it in order to publish it |
| Job result `{status, listing_url, error?, attempts}` | POST to us | `queue.js:245`, `queue.js:348` (`POST /api/jobs/{id}/status`) | So the seller's dashboard shows "posted / failed" and the live listing URL |
| Session-presence booleans `{poshmark: true, mercari: false, …}` | POST to us | `background.js:185-189` (`POST /api/sessions`) | Drives the "Connected" badge. One boolean per shop — the payload contains nothing else |
| Sale/delist event `{shop, listingRef, listingUrl, title, price, currency, soldAt, soldAtText, detectedAt, source}` | POST to us | `sales/registry.js:55-67`, `sales/driver.js:246` (`POST /api/sales`) | Exactly one event per sold listing, so the seller's closet view stops showing sold items as available |
| Selector document `https://fashionistas.ai/selectors.json` | GET from us | `config/selector-source.js:23` | Versioned form-field map, so a marketplace layout change is a one-file fix instead of a store release |

Requests to our own API use `credentials: "include"` (`config/api.js:39`, `config/api.js:50`), which can
only carry **our site's own** session cookie to **our own** origin. A cookie for `poshmark.com` is
never eligible to be attached to a request to `fashionistas-api.fashionistas1979.workers.dev`.

### What never leaves the browser

| Never sent to us | Where it is guaranteed |
| --- | --- |
| Marketplace passwords | No code reads a password value; the only `type=password` uses are presence booleans |
| Marketplace cookies / session tokens | Cookie access is name-and-expiry only (`background.js:131-138`); the heartbeat posts booleans only (`background.js:185-189`) |
| Page content read from a marketplace tab | Page text is read **inside the tab** to classify the page (`content/bridge.js:87`); the probe response returns presence booleans and a reason code only (`content/bridge.js:136-141`), and the background worker forwards only `connected`/`reason` (`background.js:116-119`) |
| Keystrokes, form values, or anything typed on a marketplace | The adapter writes into the form; nothing reads input values back out to the network |
| Screenshot/image of the seller's screen | No `chrome.tabCapture`, no `desktopCapture`, no `<all_urls>` host access |
| Browsing history | `tabs` is used to open/wait/close the seller's own marketplace tabs (`queue.js:542`, `queue.js:122`); no history API is called |

All queue, retry, rate-cap and sale-detection state is stored **on-device** in `chrome.storage.local`
(`queue.js:62,65`, `sales/driver.js:61,69`).

---

## Permissions requested — `manifest.json` → `permissions` (7)

| Permission | Why it is requested | Code that uses it |
| --- | --- | --- |
| `activeTab` | Reserved for "the seller clicked our toolbar icon" temporary access. **Flagged:** the manifest defines no `action`/popup and no file outside `manifest.json` references `activeTab`, so today it grants nothing at runtime. Kept because it is the standard, narrow (per-click, per-tab) form of access for this kind of tool; harmless if removed by the manifest owner. | Declared at `manifest.json:12` only (no other reference in the tree) |
| `scripting` | Injects the marketplace adapter into the seller's own tab so it can fill the create-listing form, upload photos and press the shop's real List button — and runs the read-only sale scan. | `queue.js:71`, `queue.js:83`, `sales/driver.js:299` |
| `storage` | Keeps the local job queue, retry/backoff state, per-shop posting caps (survives a browser restart) and the cached selector document on-device. | `queue.js:62`, `queue.js:65`, `config/api.js:14`, `sales/driver.js:61`, `sales/driver.js:69` |
| `tabs` | Opens exactly one background tab per marketplace, waits for it to load, detects a bounced-to-sign-in redirect, reads the resulting listing URL, then closes the tab. | `queue.js:542`, `queue.js:615`, `background.js:109`, `queue.js:122`, `sales/driver.js:321`, `sales/driver.js:334` |
| `alarms` | The service worker is event-driven: 1-minute job poll, 30-minute session heartbeat, 6-hour sale scan, plus per-job retry timers. | `background.js:34`, `background.js:35`, `background.js:36`, `queue.js:382`, `queue.js:388` |
| `notifications` | Tells the seller the outcome without them watching: "Posted to Poshmark" plus the live listing URL, or the exact failure reason (e.g. `captcha_required`, `not_logged_in`). Cosmetic only — a notification failure never fails a job. | `queue.js:277-281` (icon: the extension's own `icon.png`) |
| `cookies` | Answers one question — "does a live session for this shop exist on this machine?" — by checking whether a **known cookie name** exists and has not expired. Only the boolean leaves this check. | `background.js:131-138`; consumed by `background.js:185-189` (booleans only) |

---

## Host access — `manifest.json` → `host_permissions` (25)

Marketplace hosts share one justification; `fashionistas.ai` hosts have their own.

**Shared justification for every marketplace host below:** *the seller is signed in to this marketplace
in their own browser; we need to open their create-listing page in that same session, inject our
adapter, fill the fields and upload the photos, press the shop's own List button, and read back the
live listing URL after the redirect. This access also lets us detect whether the seller is signed in
(needed for the "Connected" badge and for stopping cleanly on a sign-in wall) and run the read-only
sale scan of the seller's own closet. No page content read on these hosts is transmitted to our
servers.*

| # | host_permissions entry | Justification |
| --- | --- | --- |
| 1 | `https://www.poshmark.com/*` | Poshmark — shared marketplace justification above |
| 2 | `https://poshmark.com/*` | Poshmark (apex) — redirects from the bare domain land here |
| 3 | `https://www.mercari.com/*` | Mercari — shared marketplace justification above |
| 4 | `https://jp.mercari.com/*` | Mercari Japan — separate host, same seller account flow |
| 5 | `https://www.depop.com/*` | Depop — shared marketplace justification above |
| 6 | `https://depop.com/*` | Depop (apex) — bare-domain redirect target |
| 7 | `https://www.vinted.com/*` | Vinted — shared marketplace justification above |
| 8 | `https://www.vinted.co.uk/*` | Vinted UK — regional host, same product |
| 9 | `https://www.vinted.fr/*` | Vinted France — regional host, same product |
| 10 | `https://www.vinted.it/*` | Vinted Italy — regional host, same product |
| 11 | `https://www.vinted.es/*` | Vinted Spain — regional host, same product |
| 12 | `https://www.grailed.com/*` | Grailed — shared marketplace justification above |
| 13 | `https://grailed.com/*` | Grailed (apex) — bare-domain redirect target |
| 14 | `https://www.facebook.com/*` | Facebook Marketplace listings — shared marketplace justification above |
| 15 | `https://m.facebook.com/*` | Facebook mobile host — sellers are redirected here on narrow viewports |
| 16 | `https://www.kidizen.com/*` | Kidizen — shared marketplace justification above |
| 17 | `https://www.vestiairecollective.com/*` | Vestiaire Collective — shared marketplace justification above |
| 18 | `https://vestiairecollective.com/*` | Vestiaire Collective (apex) — bare-domain redirect target |
| 19 | `https://whatnot.com/*` | Whatnot (apex) — bare-domain redirect target |
| 20 | `https://www.whatnot.com/*` | Whatnot — shared marketplace justification above |
| 21 | `https://www.ebay.com/*` | eBay — session detection (`content/login-detect.js`) and read-only sale detection (`sales/adapters/ebay.js`); publish adapter exists at `adapters/ebay.js` |
| 22 | `https://www.etsy.com/*` | Etsy — session detection and read-only sale detection (`sales/adapters/etsy.js`); publish adapter exists at `adapters/etsy.js` |
| 23 | `https://fashionistas.ai/*` | Our own product site: announce that the extension is installed (`content/announce.js`), and accept the seller's one-button `publish` / `delist` / `status` message from the page (`background.js:241-258`, gated by `externally_connectable`) |
| 24 | `https://www.fashionistas.ai/*` | Our own product site (www host) — same as above |
| 25 | `https://fashionistas-api.fashionistas1979.workers.dev/*` | Our own API: pull queued jobs, post job results, post the one-way session-presence heartbeat, post sale events (`config/api.js:6-9`, `queue.js:457`, `queue.js:245`, `background.js:185`) |

**`externally_connectable`** is limited to `https://fashionistas.ai/*` and `https://www.fashionistas.ai/*`
(`manifest.json:47-52`) — no third-party site can send this extension a message.

**Content scripts** run on the same marketplace hosts plus `fashionistas.ai` (`manifest.json:53-122`)
and are limited to `content/login-detect.js` (signed-in detection), `content/bridge.js` (returns
presence booleans), `content/formkit.js` (the form engine) and `content/announce.js` (publishes only
`chrome.runtime.id` — `content/announce.js:5-6`).

---

## Guardrails this extension imposes on itself

| Guardrail | Code |
| --- | --- |
| Never solves, skips or retries a CAPTCHA or ID/verification wall — the job stops and reports `captcha_required` | `content/formkit.js:11-13`, `content/formkit.js:255-260`, `queue.js:566`, `queue.js:572` |
| Never creates an account — signup assistance pre-fills fields and stops before the create button | `content/formkit.js:12`, `queue.js:641`, `adapters/poshmark.js:57-61` |
| Per-shop posting caps with randomised spacing, so the seller's account is not rate-limited into a ban | `queue.js:10-11`, `ratecap.js:1-7` |
| Retries are capped (max 3 attempts, exponential backoff) and every outcome is surfaced to the seller | `config/api.js:86-87`, `queue.js:277-281` |
| The sale scan is read-only: it opens the seller's own closet pages and records sold items, it never edits a listing during a scan | `background.js:62`, `sales/driver.js:299` |

---

## Legal

- Terms of service: **https://fashionistas.ai/legal/terms**
- Privacy policy: **https://fashionistas.ai/legal/privacy**

Those two documents are the authoritative legal text; this file is only the extension-specific
permission and data-use supplement that Chrome Web Store review asks for, and it does not replace or
restate them.

**Contact:** https://fashionistas.ai/contact/
