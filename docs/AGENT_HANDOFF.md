# Agent handoff — fashionistas.ai

## LATEST — 2026-10-14 ~11:40 ET: free-v2 SHIPPED TO PRODUCTION (Iz said "ship it")
- **Production:** commit `8211eb1` (main = merge of free-v2 `1496c2a` + handoff docs). Pages deploy `6c0d6cbf`. `version.txt` verified.
- **Rollback:** `1ecaa1e8-40eb-40bd-8d2c-ee2a553627ce` (commit `4001c02`). The older rollback is `7865a20b` (`452d7e8`).
- **Live checks:**
  - All 12 main pages (home, shop, search, item, try-on, sell, seller board, seller stats, pricing, contact, account delete, blog) return 200 with 0 JS errors and no horizontal overflow, in light and dark.
  - `ads.txt` is intact (pub-7215975042937417). `sitemap.xml` has 40 URLs. `robots.txt` returns 200.
  - E2E 12/12 against production in light and dark. Test listings 168 and 169 were deleted. The public shop still shows only the 4 original listings.
  - Live screenshots on the box: `/workspace/fash-ship-qa/live-{home,shop,item}-{light,dark}.png`.
- **New preview** https://free-v3.fashionistas-ai.pages.dev (branch `free-v3`, commit `4e729e3`), not in production:
  - The empty closet shows one "Add an item" CTA (in the hero) plus a quiet "Or add one by hand".
  - The listing flow has a Photos → Details → Post stepper and card sections, with a "ready" note.
  - E2E 12/12 light and dark; npm test 447/447.
  - Screenshots: `/workspace/fash-ship-qa/ds-v3/` and `v3-{light,dark}/`.
  - Needs Iz's "ship it".

## LATEST — 2026-10-14 ~10:20 ET: "free-v2" build in progress, scope expanded by Iz (read first)

**Production (unchanged):** commit `4001c02`, Pages deploy `1ecaa1e8`. Rollback: `7865a20b-2be6-4451-a8cc-b7aa131b2dae` (commit `452d7e8`).
**Preview:** https://free-v2.fashionistas-ai.pages.dev (branch `free-v2`, commit `2f9126d`). No UI goes to production until Iz says "ship it".

### Scope from Iz, with where each item stands
1. **Permanently free pricing copy** ("free for good, supported by ads & affiliate links"). DONE on preview: pricing, home FAQ/JSON-LD, terms, chat grounding, auth copy, app bundle and tests.
2. **Cheapest try-on.** DONE on preview:
   - Tier 1: instant, free in-browser overlay ("Quick look", $0).
   - Tier 2: Modal FASHN VTON v1.5 (Apache-2.0, so it's the cheapest *commercially legal* option).
   - Identical renders are cached in R2 (`tryon-cache/<sha256>`) and cost $0. A cache hit doesn't count toward the daily cap.
   - Real cost: L4 $0.000222/s × 22.9 s warm ≈ **$0.0055/render**. Cold start costs $0.013–0.033. Modal Starter includes $30/mo free.
   - Monthly: 10k ≈ $35–65; 100k ≈ $520–600; 1M ≈ $5.5k (needs about 20 containers).
   - Alternatives: fal CatVTON ≈ $0.017, Replicate IDM-VTON ≈ $0.024, fal FASHN $0.04–0.075. IDM/Cat/OOTD are non-commercial (NC licences).
3. **Crosslist to every marketplace + one tracking board.** In progress, live on preview at `/seller/board/`.
   - New functions: `functions/_lib/shops.js` (17 shops); `/api/crosslist/board` (GET, signed in); `/api/crosslist/status` (POST, owner-checked; "sold" writes orders); `/api/crosslist/links` (public; powers "Buy on <shop> ↗" on item pages).
   - API when keys exist: eBay, Etsy, Shopify.
   - Guided copy-and-open: Poshmark, Mercari, Depop, Vinted, Grailed, FB Marketplace, Vestiaire (which absorbed Tradesy), Kidizen, Curtsy (app only), Whatnot, Amazon, Walmart.
   - Consign links: ThredUp, The RealReal.
   - Statuses are only what the seller (or an API) confirmed. Nothing is guessed.
4. **Buyer flow:** browse/search → try on → Message / Reserve (no charge) / Buy on <shop>. Exists; the Buy-on links are new. Stripe is not approved, so there's no card checkout.
5. **User stories + Playwright E2E.** In progress.
   - Spec: box `/workspace/fash-ship-qa/e2e/stories.spec.js`. The doc goes to `docs/USER-STORIES.md`.
   - Passing: S1 sign-in, S2 AI fills a listing from a photo.
   - Debugging: S3, where the "List on fashionistas" click doesn't submit under Playwright.
6. **Design pass** (premium, mobile-first). Not started.
7. **Android/iOS:** TWA prep is in `docs/twa/`. Capacitor config not started.
8. **Test seller account.** DONE.
   - Account: `iz_test_seller` (user 130). The password is in the laptop's gitignored `~/fashionistas-ai/.env.test-seller` (never committed or printed).
   - E2E listings it creates are deleted at the end of each run. No invented public listings.
   - (User 129 is an unused account from the Pages register path. Ignore it.)

### Update ~11:15 ET: design pass on preview `1496c2a` (https://free-v2.fashionistas-ai.pages.dev)
- **New `ds2.css`**, loaded last in the app:
  - Editorial serif screen titles (Instrument Serif).
  - Pill controls and compact shop sort/filter pills.
  - Rounder photo tiles with a staggered entry.
  - Framed 4:5 item photo with a serif title; Try-on is a dark pill so Buy is the only primary button; frosted buy bar.
  - Compact "You" menu cards, calm centred empty states, and the listing wizard in the same pill language.
- **The app sets `html[data-view]` on every screen**, so CSS can target individual screens.
- **Static pages** (site.css):
  - Follow the phone's light/dark setting.
  - One-row scrollable sticky header on mobile; serif h1.
- **Crosslist board redesigned:**
  - Item cards with a photo and summary chips ("Live here", "Listed on N others").
  - A collapsible "Shops (18)" list.
  - Each shop row: initial badge, name and status pill; at most 3 equal pill buttons on their own row. No more cramped wrapping.
  - Designed empty state.
- **Try-on:** polished CTA, zones and quick-look card (skin.css v3).
- **Checks:**
  - E2E 12/12 in light and dark, 0 page errors (the board check now counts `.bl-shop`).
  - npm test green.
  - Screenshots on the box: `/workspace/fash-ship-qa/ds-final/` (9 screens × light/dark), `shots3-light/` and `shots3-dark/` (E2E flow); "before" shots are in `ds-before/`.
- **Still open:**
  - Listing-wizard internals beyond CSS.
  - The closet hero still shows two "add" CTAs.
  - Production stays at `4001c02` until Iz says "ship it".

### Update ~10:35 ET: preview `16fbea8` (https://free-v2.fashionistas-ai.pages.dev)
- **E2E: 12/12 stories pass in light AND dark.** Spec: `e2e/stories.spec.js`; doc: `docs/USER-STORIES.md`. 0 page errors. Each run deletes its own test listing (ids 156–161 are all gone).
- **Fixed a real bug:** "List on fashionistas" did nothing when tapped while the keyboard was open. The tap blurred the input first and the click was lost. Fixed with pointerdown preventDefault in `listing-wizard.js`, bumped to v=5.
- **Crosslist board:** `/seller/board/` covers 18 rows (ours + 17 shops). Buyers now see "Buy on <shop> ↗" on item pages.
- **Capacitor configs:** `mobile/capacitor/` (appId `ai.fashionistas.app`, remote `server.url`). TWA remains in `docs/twa/`. `e2e/` and `mobile/` are excluded from deploys.
- **Design:** static pages now follow the phone's light/dark setting (they were always dark). Also serif h1, rounded cards, tap and entry motion. A deeper app-wide design pass is still open.
- **Not done:**
  - Deeper visual redesign.
  - Native camera plugin wiring.
  - Store accounts (Iz).
  - Marketplace API keys (Iz).
- Production is still `4001c02` and needs "ship it".

### Rules
- Wrangler only (`scripts/deploy-local.sh`). Never GitHub Actions.
- Never print secrets. Never invent data. Keep the demo listings. Keep everything free for users.
- Preview + 412×915 light/dark screenshots before any ship. Production only on Iz's "ship it".
- Local `main` is 76 commits ahead of `origin/main`. Production deploys from local main, so don't push main blindly.

### Keys / decisions needed from Iz
- eBay: `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` (+ RuName).
- Etsy: `ETSY_API_KEY`.
- Shopify: `SHOPIFY_STORE` + `SHOPIFY_ADMIN_TOKEN`.
- Stripe Connect approval (optional).
- OK to raise `MODAL_MONTHLY_CAP_USD` from $6 to $30 (stays inside Modal's free credit).
- Apple developer account + Play Console for the app builds.

## LATEST — 2026-10-14 ~09:45 ET: SHIPPED p0-preview TO PRODUCTION (read first)

**Owner: Chief of Staff.** The Fashionistas bot was retired by Iz; Chief of Staff now owns fashionistas.ai.

## Live in production (verified)
- `https://fashionistas.ai/version.txt` = `4001c0203211d82dbe81b1eb721bee5aa0b6e39e` (main, merge of p0-preview `4bd61d4`). Pages deployment `1ecaa1e8` (https://1ecaa1e8.fashionistas-ai.pages.dev).
- **Rollback:** Pages deployment `7865a20b-2be6-4451-a8cc-b7aa131b2dae` (commit `452d7e8`, contact fix only). Before that: commit `c3070c5`.
- Contents: contact form → fashionistas1979@gmail.com (FormSubmit from the browser, test delivered 8:21 AM ET); speed branch (SSR shop/item, WebP thumbs, nav Shop/Sell/You); try-on queue (D1 `tryon_slots`, max 2 at once, honest place in line); /account/delete/ + POST /api/account/delete; junk listing 155 hidden; PNG/maskable icons + manifest; search filters (size/colour/condition/price/saved), sorts (newest/popular/A–Z/Z–A/price), 24-per-page "Show more", URL state; Save button; category pages /shop/c/…, brand pages /shop/b/…; /price-guide/ (real data only, ≥3 non-demo listings); Breadcrumb/CollectionPage/ItemList JSON-LD; sitemap function live; events → D1 `listing_stats` (daily aggregates) + /api/stats/popular + /api/seller/stats + /seller/stats/ page; AdSense slots on blog (21 pages), shop in-feed (9+ items), item (≥120-char description), reserved space.
- Verified live on 412×915: home, shop, search, sort, category, brand, item, blog, seller stats, contact, account delete all 200; no JS errors (only AdSense report-only CSP frame warnings, ad 400s because AdSense isn't approved, and expected 401s when signed out). ads.txt intact (pub-7215975042937417).
- Sitemap has 40 static URLs and **no listing/category/brand URLs**, because all 4 public listings belong to the `demo` account and are excluded on purpose. Iz chose to keep the demo listings as they are.

## Repo / deploy
- Repo: laptop `b7d4ca89` (billionaremaker-Latitude-5420), `~/fashionistas-ai`, branch `main` (origin/main is stale; do not push main to origin per older handoff). Preview branch `p0-preview`.
- API Worker source: `~/Documents/Default Project/nexus-ai-suite/workers/fashionistas-api` (shared D1 `fashionistas-db` 0c1b88be…).
- Deploy production: `bash scripts/deploy-local.sh` (runs tests, uploads with Wrangler, checks version.txt). Preview: `ALLOW_BRANCH=<b> DEPLOY_BRANCH=<b> bash scripts/deploy-local.sh`. Credentials are in `.env.deploy` (never print). That token can't run D1 queries.
- Preview branches share the production D1.

## Rules
- Wrangler only, never GitHub Actions.
- UI changes go to a preview first, with self-reviewed 412×915 Android screenshots (light + dark). Production only after Iz says "ship it". Record the rollback deployment ID first.
- Never invent data (listings, prices, stats, "listed" states). Keep it free for users.
- When renaming the hashed bundle, read each file before writing it (a truncation bug emptied a test file once).

## Pending
- Shopify integration (allowed, not built). eBay/Etsy integrations exist but are off until keys exist.
- Stripe Connect checkout: researched in docs/marketplace/CHECKOUT-STRIPE-CONNECT.md, not built.
- AdSense approval (console only). Add `ep2.adtrafficquality.google` and `www.google.com` to the CSP frame-src (report-only warnings).
- Android TWA: set `/.well-known/assetlinks.json` once the signing SHA-256 exists (docs/twa/).
- One test view on listing 148 is in `listing_stats` from preview testing.
- Real (non-demo) inventory is needed before category, brand and price pages enter the sitemap.

## Keys and decisions needed from Iz
eBay production keys + business policies; Etsy app keys + commercial access; Shopify Partner app; Depop partner application (business@depop.com); Stripe account (decide on checkout); Modal try-on spend cap raise (currently $6/mo); Workers Paid ($5/mo); Play Console ($25) + signing fingerprint; Apple developer account ($99/yr) for iOS; GOOGLE_CLIENT_ID, RESEND_API_KEY.

## LATEST — 2026-10-14 ~10:30 ET: marketplace + AdSense/SEO on PREVIEW (not production)
Production unchanged since contact fix: `452d7e8` (contact → fashionistas1979@gmail.com, live + verified).
Preview `p0-preview` @ `4bd61d4` → https://p0-preview.fashionistas-ai.pages.dev (alias is edge-cached; newest unique deploy URL is in the deploy log). Awaiting Iz "ship it". Ship = `git checkout main && git merge p0-preview && bash scripts/deploy-local.sh`; record rollback first.
Shipped on preview:
- P0s: try-on queue (D1 `tryon_slots`), /account/delete/ + API, junk listing 155 hidden, TWA icons/manifest, docs/twa/.
- Search/browse: Size/Colour/Condition/Price/Saved filters, sorts Newest/Popular/A–Z/Z–A/Price, 24-per-page "Show more", URL state (?q&sort&cat), Save button (localStorage), try-on links carry ?id=.
- SEO: /shop/c/<dept>[/<sub>] category + /shop/b/<brand> pages (only when listings exist; CollectionPage+ItemList+Breadcrumb JSON-LD, OG, canonical; noindex when only demo listings), Breadcrumb JSON-LD on item pages, /price-guide/ (only categories with ≥3 real non-demo priced listings; currently none → noindex index page). sitemap.xml function now actually runs (static file renamed sitemap-static.xml) and adds items/categories/brands/guides (demo excluded).
- Analytics: POST /api/events (view/save/tryon/click/share → D1 `listing_stats` daily aggregates, no raw log), GET /api/stats/popular, GET /api/seller/stats, page /seller/stats/ (drawer link when signed in). Orders table feeds sales.
- AdSense: slots on 21 blog pages (in-content + bottom), in-feed shop/category slot only with 9+ items, item slot only with ≥120-char descriptions; space reserved via CSS, collapses when unfilled. Slot IDs reused from site-adsense.js.
- Docs: docs/marketplace/CROSSLISTING.md, docs/marketplace/CHECKOUT-STRIPE-CONNECT.md.
Bugs found/fixed: a rehash script had truncated tests/security-gates.test.mjs in f2d0a57 (restored).
Pending / needs Iz: ship it; all 4 public listings are the "demo" account (shop is effectively demo inventory); eBay/Etsy keys; Shopify app (integration not built yet); Depop partner application; Stripe decision; Modal spend cap; Workers Paid; AdSense approval; Play account + signing SHA-256. One test view event on listing 148 was written to the shared D1 by preview testing (deploy token can't run D1 queries to remove it).

## LATEST — 2026-10-14 ~08:45 ET (chief of staff took over)
- PRODUCTION = `452d7e8` (Pages deploy 7865a20b): contact form posts from the browser to FormSubmit AJAX → fashionistas1979@gmail.com (server /api/contact fallback). Live test "TEST from site setup" delivered to the Gmail inbox 12:21Z. Rollback = previous prod `c3070c5`.
- PREVIEW `p0-preview` (https://p0-preview.fashionistas-ai.pages.dev, `f2d0a57`, = speed branch + main + P0s): try-on queue (D1 `tryon_slots`, max 2 in flight, 429 tryon_busy with place-in-line + auto-retry), /account/delete/ + POST /api/account/delete, junk listing 155 hidden (functions/_lib/hidden-listings.js), PNG + maskable icons, manifest id, docs/twa/. NOT in production until Iz says ship it.
- Not done: Modal spend cap still $6/mo (needs Iz OK), Workers Paid, Stripe, live assetlinks.json (needs Play signing SHA-256).

## LATEST — 2026-10-13/14 night ET: KV write cap fixes, try-on test app, speed preview

**KV fixes (production).** Cloudflare's free tier allows 1k KV writes a day across the whole account, and the cap was hit on 2026-10-13 around 8:45 PM ET.
- Worker `fashionistas-api`: sign-in temp state (passkey challenges, magic links) now lives in D1 `fashionistas-db` table `auth_tmp`, with a KV fallback. It is live as version `9fba7be4-147d-4f51-934c-e5b313dc1ba4` (deployed 2026-10-13 8:54 PM ET); the `auth_tmp` table was confirmed in D1. Rollback: `863dbacc-5ebd-4d9f-a95b-71a53de9e229`. Committed locally in nexus-ai-suite as `f6bf210` (not pushed).
- Pages main: the try-on daily tally is in D1 `kv_counters` (`functions/api/tryon/hd.js`). The warm throttle is in memory (`functions/api/tryon/warm.js`). The analyze rate limiter uses D1 `kv_counters` when bound and still refuses requests if no limiter storage works (`functions/api/ai/analyze.js`; security tests kept, 447/447). Commits `f31542b` and `c3070c5`. Deployed with `scripts/deploy-local.sh`, which excludes dotfiles, not a raw `wrangler pages deploy .`. Deployment `efeb7258`, version.txt `c3070c5`. Rollback: `acd567c9`.
- Production check: the passkey sign-in page loaded 5× on Pixel 7 with no JS errors, and `/w/api/auth/passkey/login-options` returned 200 each time.
- KV writes since 02:31Z (10:31 PM ET) up to 10:38Z on 10-14: 91 account-wide. 64 were on namespace `2c710998`, which is shared by the Worker (`CACHE`) and Pages (`CACHE`/`FASHIONISTAS_KV`). Some fashionistas path still writes KV. Next: find it (the Worker `src/index.js` put and the Pages functions that still call `.put`).

**Try-on test app (Modal).** The `fashn-vton-fast` test app crash-looped on startup with `AttributeError: module 'app' has no attribute 'Fast'`. The snapshot class is only defined when `FASHN_FAST=1`, and that variable was set on the laptop at deploy time but not inside the container. It was stopped at 2026-10-13 9:04 PM ET. Production app `fashn-vton` was not touched. To retry snapshots, set `FASHN_FAST`/`FASHN_APP_NAME` in the image `.env(...)` too.
- Production try-on check, 2026-10-13 10:21 PM ET, called the Modal app directly (no KV): HTTP 200 with a real 576×864 webp. 43.5 s total (22.9 s rendering, the rest upload and network from the laptop).

**Speed preview** `https://speed.fashionistas-ai.pages.dev` at `b680f7b` (branch `speed` in `~/fa-speed`, NOT on production). It includes main's KV fixes and contains:
- Server-rendered shop/item pages. The app keeps them (`hydrateShop`) instead of redrawing.
- App scripts load late, after first paint and idle; on home they wait for idle. Taps made before the app is ready are replayed.
- WebP thumbnails from R2 (`/img/<w>/`, `scripts/backfill-thumbs.py`).
- Self-hosted Inter.
- Try-on:
  - Shop photos load through the same-origin `/w/api/images` proxy. This fixes Iz's "Couldn't load that photo"; the root cause was not reproduced.
  - The picked item shows immediately. A plain link step with a "How?" tip. "Take a selfie" (live camera with a full-body outline, a Now/3 s/10 s timer and a flip button; falls back to `capture="user"`) next to "Choose photo".
  - Uploads are shrunk to 896 px (the model works at 576×864).
  - A clear "Try-on is temporarily down…" message on 5xx, no answer, or a dropped connection.
- Nav: Shop / Sell / You. "Try it on" is on wearable shop tiles (not bags/shoes/jewellery), the item page, a card in You, and the landing menu.
- Lighthouse mobile, last full run: home ~66, shop 73–75, item 92–96, try-on 99. Regression 72/72 on `fe95f8bc`. Screenshots on the box: `/workspace/speed-qa/r4/`.
- Home vs prod screenshot diff: the preview renders Inter where prod falls back to Liberation Sans, and it shows the real "F" logo on /shop where prod's is a 404. Both are bug fixes, but visible. Iz decides.

**Remaining build work (not started):**
- Seller dashboard in D1 (per-shop status posted/copied/opened/sold, mark sold → prompt to delist elsewhere, views/saves, edit, relist).
- Stripe Checkout behind `STRIPE_SECRET_KEY`, with "Checkout coming soon" when it is unset.
- Buyer search and filters (size, brand, price, category), sort, and empty states.
- Premium visual pass benchmarked against Depop/Vinted.
- UX prime-time scorecard (`/workspace/audits/fashionistas-ux-primetime-2026-10-13.md`).
- Junk shop item: "Clear Plastic Cup with special straw" (id 155, Home/Home Accents) is live in the shop and should be hidden or removed.
- Try-on speed: no reliable before/after seconds yet (the laptop network spoiled the timings). Resize-on-upload for thumbnails needs a Worker deploy; until then re-run the backfill script.
- Home Lighthouse is still below 85.

**User-only blockers:** Stripe account and a business entity; eBay keys (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`, policies); Etsy keys (`ETSY_API_KEY`, `ETSY_API_SECRET`); a Chrome Web Store developer account ($5); Google Search Console verification; `GOOGLE_CLIENT_ID` (Google One Tap); `RESEND_API_KEY` (magic-link email).


## LATEST — 2026-10-13 ~15:10 ET: SHIPPED TO PRODUCTION (read this first)

Production `fashionistas.ai` = git `main` @ `41a9b34` (local only, never pushed). Branches: `oneclick` (c375bea), `blog-preview` (= main), `seo-index` (~/fa-seo-index), `blog-batch` (~/fa-blog). The sections below this one are older and some say "preview only". They are superseded.

**Shipped today (in order)**
| What | Pages deploy | Rollback to |
|---|---|---|
| oneclick site (fa032f2: passkey sign-in, try-on redesign + flat-lay fix, /setup/ helper, List everywhere). Deployed by another agent ~14:32 ET | `1cd79547` | `9bfc53bf` (551fa31) |
| Worker `fashionistas-api` version `e32faf7d` at 100% (passkeys, one-tap account, warm, from-link) | wrangler versions deploy | Worker version `7d5480ce` (`wrangler versions deploy 7d5480ce-8471-483d-8b55-63ba62d22fe8@100% --name fashionistas-api`) |
| + seo-index merge (c375bea: SSR item/shop HTML, real footer links, sitemap without demo/noindex items, robots `Disallow: /w/`, 301 bare fashionistas-ai.pages.dev → fashionistas.ai, SSR block hidden once the app is up) | `7517d8b9` | `1cd79547` |
| + blog (41a9b34: 20 posts in /blog/ + index, 21 sitemap lines, Blog in main nav and footer, blog header = site logo/wordmark, sticky, follows system light/dark) | `b150f833` | `7517d8b9` |
Roll back Pages with `wrangler pages deployment rollback`, or in the dashboard: Deployments → the ID → Rollback.

Prod Pages secrets: GPU_PROVIDER, GROQ_API_KEY, MAX_MONTHLY_TRYON_SPEND (cap $6 kept), MODAL_ENDPOINT, MODAL_PROXY_KEY/SECRET, MODAL_TOKEN, REPLICATE_API_TOKEN, SESSION_SECRET, TRYON_TEST_EMAILS. `WORKER_UPSTREAM` is preview-only on purpose.

**Verified on production** (Playwright): passkey sign-up and paste-a-Poshmark-link try-on produce a real result on Pixel 7 and Galaxy 360, light and dark (4/4, 41–98 s incl. cold GPU); remembered photo works. /setup/ flow 6/6. 72-check regression on c375bea: all PASS. Blog: 21/21 URLs 200, nav and footer link present, header sticky, light/dark, no JS errors. 200 on /, /shop/, /setup/, /try-on/, /guide/, /blog/, robots, sitemap; bare pages.dev 301. Screenshots: `/workspace/oneclick-qa/final/`, `/workspace/oneclick-qa/blog-*.png`, `/workspace/fash-bench/reg-final*/`.

**Audit:** `/workspace/audits/fashionistas-indexing-2026-10-13.md` (box).

**Still broken / not true**
- No auto-post to any shop. eBay/Etsy need keys. Poshmark/Depop/Mercari/Vinted/Grailed are copy-and-open only. The extension is not on the Chrome Web Store.
- Try-on from links: eBay and Vinted return 403 to Cloudflare egress, and a stale Depop URL gave 410. Only Poshmark is proven.
- Home/shop/item pages are slow on phones (Lighthouse 35–63, LCP 6–9 s): 1,400-line inline index.html, 325 KB bundle, AdSense.
- Shop: only 1 real seller item. 4 demo items are noindex. 24 stale /shop/<id> items still return 200. 141 id probes are 404.
- Main menu links are still `javascript:` (enterBrowse/go), so crawlers rely on the footer and SSR links.
- Try-on spend cap is $6/mo, so it stops when that's hit. The GPU scales to zero, so cold starts take 60–150 s. Always-warm ≈ $580/mo, evening window ≈ $120/mo, not enabled.
- Previews share the production D1 database (QA users exist: seller7512, qabuyer…, qa10135148).
- Google One Tap and magic link are built but dark.

**Next scalability plan**
1. Speed: split the app bundle per route, move inline head CSS/JS out, server-render the shop grid, defer AdSense (update the pinned test). Target LCP < 2.5 s.
2. Separate preview D1 (binding per environment) so tests stop writing prod rows.
3. Try-on capacity: queue + per-user rate limit in KV, evening warm window when traffic justifies it, raise the cap with the user's OK.
4. Real inventory: seller onboarding via /setup/, retire the 24 stale items (410), real listings.
5. eBay/Etsy direct post the day keys arrive (code already in the Worker channels.js), then publish the extension.
6. Crawlable `<a href>` main nav; image CDN resizing.

**USER-ONLY (Iz)**
- eBay: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`, `EBAY_ENV` + payment/return/fulfillment policy IDs (developer.ebay.com, then Business Policies).
- Etsy: `ETSY_API_KEY`, `ETSY_API_SECRET`.
- $5 Chrome Web Store developer account (publish the extension).
- `GOOGLE_CLIENT_ID` (One Tap), `RESEND_API_KEY` (magic link).
- Search Console: resubmit sitemap.xml and "Validate fix" on the Page indexing issues, using the Google account that owns the property.
- Stripe + a legal entity (only when charging; site is free now).
- Real listings.
- An analytics token.

## LATEST — 2026-10-13 ET (read this first)

**Setup assistant + List everywhere, 2026-10-13 ~13:30 ET (preview, commits dbc51ec, 3721416, + this).** New `/setup/` page: chat-style one-step-per-screen stepper, sticky header with progress, detects Android/iPhone/desktop Chrome. Per shop: Open <shop> (login page; App Link opens the app on phones) → I'm signed in / I don't sell there. State in localStorage `fash_setup_v1` and it writes `fash_lw_shops_v1`, so the wizard's step 4 pre-selects exactly the shops set up; reopening `/setup/` shows "You're set". No passwords or cookies touched. eBay/Etsy steps show "Coming soon" because `GET /api/ebay/status` now returns `configured` (false: no `EBAY_CLIENT_ID`/`EBAY_SANDBOX_CLIENT_ID`); Worker secrets are only GROQ_API_KEY, HIVE_TOKEN, HIVE_URL, MOD_TOKEN, SESSION_SECRET. Missing for direct post: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`, `EBAY_ENV` (+ payment/return/fulfillment policy IDs), `ETSY_API_KEY`, `ETSY_API_SECRET`. Chrome extension is NOT on the Chrome Web Store (searched 2026-10-13); desktop step says "Coming soon" — publishing needs Iz's $5 developer account and Google review. Wizard (`listing-wizard.js?v=4`): "Set up your shops once" button on step 4 and the post screen; post button renamed "List everywhere · N shops" (walks each shop: copies its kit + opens its sell page; extension path if installed). QA: `/workspace/oneclick-qa/list-setup-{pixel7,g360,desktop}-{light,dark}-{top,poshmark,ebay,done-scrolled}.png`, 6/6 flows pass, no overflow, no JS errors; regression `/workspace/fash-bench/reg.js` all PASS. Deploys went from a temporary clean worktree because another agent had uncommitted try-on edits in the main tree (left untouched, not committed by me).

**Try-on was painting the photo.** A product shot of the garment was sent to FASHN as photo type `model`, which is only for a photo where someone is already wearing it. The redraw then invented a body and came back as a smeared painting. `try-on/index.html` now sends `flat-lay` unless the garment photo itself contains a person. `POST /api/tryon/hd` uses that field, and it no longer falls through to `prunaai/p-image-try-on` (that model paints a new picture from a prompt). A failed FASHN call stays a failure.

Everything below is on the **preview only**: `https://oneclick.fashionistas-ai.pages.dev` (Pages branch `oneclick`, git branch `oneclick`, off `d795beb`). Production `fashionistas.ai` is still `d795beb`. Nothing pushed to GitHub. User has not said ship it.

**How the preview is wired (do not copy to prod blindly).**
- Worker `fashionistas-api`: new code uploaded as a *version*, NOT deployed: `wrangler@4 versions upload --preview-alias oneclick` → `https://oneclick-fashionistas-api.fashionistas1979.workers.dev` (version `e32faf7d`). Prod Worker traffic is still version `7d5480ce`. Source: nexus `workers/fashionistas-api/src/oneclick.js` + hook in `src/index.js` (uncommitted in nexus). Shipping = `wrangler versions deploy` of that version (or `wrangler deploy`) **together with** the Pages deploy.
- Pages preview env secrets added: `WORKER_UPSTREAM` (points `/w/*` at the Worker version above; `functions/w/[[path]].js` reads it, prod leaves it unset), `MODAL_PROXY_KEY`, `MODAL_PROXY_SECRET` (piped from `.env.modal`), `MAX_MONTHLY_TRYON_SPEND=6`. Preview has no `SESSION_SECRET`, so `functions/api/_lib/auth.js` asks the Worker `/api/auth/me` when `WORKER_UPSTREAM` is set and `SESSION_SECRET` is not. Prod never hits that branch.
- D1 is shared with prod: passkey sign-up on the preview created real `users` rows (QA: `seller7512`, `qabuyer…`, `qa10135148`) and a new `passkeys` table (created by the Worker, additive).

**Polish pass, 2026-10-13 ~11:30 ET (same preview).**
- Sign-in is one centered sheet: logo, "Try clothes on before you buy. Sell yours in a snap.", Sign in with fingerprint, New here? Create an account, Other ways to sign in (Google/email/password folded inside). Name field dropped. The 32 px spacer under the phone header (`#land-nav::after`, left over from the removed countdown) is 0; `.rd-start-copy` checklist hidden on phones.
- Try-on restyled as a shopping screen (`try-on/skin.css?v=2`, loaded after the inline HUD style): sans type, no HUD/console, result hero at top with one primary (Buy on <shop> from a link, else Save) and icon Share/Download/Retry, shimmer skeleton with the live seconds, type chips under "Not the right kind of item? Change it", kind guessed from the link title, shop strip shows wearables only and pre-picks nothing (it used to load a plastic cup as the garment).
- Body check: the "lying down" guard now judges the torso (shoulders→hips) instead of the whole-skeleton box. A standing woman with a bag held out (box 1.45) was refused; now passes and renders.
- Item page "See it on you" is full width (was a squeezed column). See-in-space uses sans type.
- Perf: `mobile-nav.js?v=4` writes `--mh/--tb` only when they change, batched to rAF. Tried deferring AdSense: reverted, `tests` pin the loader tag byte-for-byte (verification). Phone LCP image (`rd/flatlay.webp`) preloaded, not lazy.
- Lighthouse mobile (prod before → preview after; runs swing ±15): landing 39 → 43–63, LCP 6.7 s → 6.3–7.1 s; shop 44 → 35–52; item 42 → 41–51, LCP ~8.7 s; try-on 93 → 95–98, LCP 1.7 s. Goal ≥90 / LCP <2.5 s met only on try-on. Landing/shop/item are held back by the 1,400-line index.html (inline CSS+JS in head), the 325 KB app bundle, and AdSense (~650 ms main thread). Next: split app bundle, move inline head CSS out, server-render shop grid.
- Regression: `/workspace/fash-bench/reg/results.json` — 9 pages × Pixel 7, Galaxy 360, iPhone 13 (WebKit), desktop × light/dark = 72/72 pass (200, no horizontal overflow, key element visible, no app JS errors). Flows checked on Pixel 7: passkey sign-up/sign-in, try-on from upload, try-on from Poshmark link, remembered photo. Not automated: listing wizard submit, eBay/Etsy connect, Buy.
- Benchmark sheets: `/workspace/fash-bench/side-by-side-{phone,desktop}.jpg` (Depop, Vinted, Whatnot, Doji, Alta; Google Doppl URL 404s on the web). Try-on cost/speed: ours ≈ 20 s warm, ≈ $0.004–0.005 GPU per render (L4 ~$0.80/h); FASHN API v1.6 $0.075/image, 5–17 s (docs.fashn.ai); Google Doppl ≈ 30 s per look (free app, YouTube walkthrough).

**1. One-tap sign-in (works on preview).** `auth-oneclick.js?v=3` + `#oneclick` block in the landing auth card. Fingerprint/face passkey (WebAuthn, ES256/RS256, `getPublicKey()` SPKI, rpId = page host, origins allowlisted to fashionistas.ai and *.fashionistas-ai.pages.dev). "Create my account with one tap" makes an account with no password (`password_hash='!'`). Passkey autofill (conditional mediation) signs a returning user in with no tap. Username/password folded under "Use a username and password instead". Same Worker HMAC token, 365-day sliding session (already existed). Measured on Pixel 7 emulation with a virtual authenticator: before (create-account form) 6 taps + 42 keystrokes, 9.1 s at robot typing speed (realistically 30 s+); after new user 3 taps (incl. fingerprint), 1.9 s; returning after sign-out 0 taps via autofill, or 2 taps 1.1 s.
- **Google One Tap**: built (`POST /api/auth/google/onetap`, tokeninfo-verified, aud/iss/email_verified checked) but dark: `GOOGLE_CLIENT_ID` is unset everywhere (`.env` empty; not a Pages or Worker secret). The older redirect route `functions/api/auth/google.js` also needs `GOOGLE_CLIENT_SECRET`.
- **Email magic link**: built (`/api/auth/magic/start|verify`, 15-min one-use KV token, link `/?signin=`) but dark: needs `RESEND_API_KEY` (+ optional `MAGIC_FROM`) on the Worker. No mail provider exists today.

**2. Shop connect.** See `docs/SHOP_CONNECT_OPTIONS.md`. Verdict: only eBay/Etsy have OAuth APIs (code already in Worker `channels.js`, dark: no `EBAY_*`/`ETSY_*` keys). Every competitor connects Poshmark/Depop/Mercari/Vinted/Grailed via a desktop Chrome extension or an in-app login that keeps the user's session cookie on their servers — ToS-violating automation plus a breach target. Not doing it. Copy-and-open (clipboard kit + share photos + App Link sell page + Done) stays.

**3. Try-on.** 8 cases (half/full body; tee, shop polo, shop jean jacket, dress, skirt, jeans, leather jacket, model-shot tee) against the live Modal FASHN VTON 1.5. Before (prod params): 7/8 rendered; the cold one timed out at 150 s, the next took 69 s, then ~20 s each. Quality is good on all 7 (box `/workspace/tryon-1013/sheet_before_after.jpg`). Tried `photo_type=flat-lay` + 30 steps: worse on cluttered shop photos (polo came out as a pasted couch photo, jeans smeared), +8 s; NOT adopted — keep `model`/20 steps. Shipped on preview: `POST /api/tryon/warm` (signed-in, 1 ping/user/2 min) pings Modal `/healthz` when the try-on page opens or a photo is picked, so the GPU boots while the buyer chooses photos (~$0.03–0.05 per cold wake); honest countdown; up to 3 attempts. Result on preview from a cold GPU: render 32 s after tap, 60 s from page open, 1/1 then 2/2 succeeded. Known: the page's body gate rejected one valid full-length mall photo (P2) as "head to knees" — false negative, not fixed.
- Always-warm option NOT enabled: `min_containers=1` on L4 ≈ $0.80/h ≈ $580/mo; a 6–11 pm ET window ≈ $120/mo; raising `scaledown_window` 60→300 s costs ~$0.05 more per session. Needs Iz's OK and a `modal deploy`.

**4. Paste or share a link → try it on (preview).** `functions/api/tryon/from-link.js` (signed-in): Depop/Poshmark/Vinted/eBay/Etsy/Grailed/Mercari URL → checks robots.txt → reads og:image/og:title/price → proxies the photo from allowlisted CDNs, 6 h cache, `Buy on <shop>` link (`AFF_<SHOP>` env appends affiliate params later). PWA `share_target` → `/try-on/?shared_url=`. "Remember my photo on this phone" keeps the buyer photo in localStorage only, with Forget it. Tested: Poshmark works end to end (real listing, render 33 s). eBay and Vinted answer 403 to Cloudflare egress, Depop 410 on a stale URL — those show a "save the photo and add it" message.

**Not done (from the scope expansion):** competitor visual benchmark + Lighthouse before/after, full multi-device regression table, iPhone/desktop passes, billion-dollar visual polish. Commits on `oneclick`: 32b78d1, 7a668af, 802db0d, 0320beb, 81931a1, a93745e, 63af887, 39dfcef, plus this handoff.

## LATEST — 2026-10-12 ET (read this first)

The app loop that was broken is the shop, the session, and a paywall the site does not sell. Do not put the women's-only chip row back. Do not default a blank category to `Women/Tops`. Do not send a 402 to `/pricing/` as a $14.99 plan.

**Shop.** `marketNavHtml` in `/assets/app.6fc355b2689c.js` builds chips from the category table (`Women`, `Men`, `Kids`, `Home`, `Art`), then that department's subcategories. Listings with no resolvable category get an **Other** chip (`__other__`). The old chips were only Women's tops, jeans, dresses, jackets, and bags, so the men's polo, the men's jean jacket, the cup, and the Keurig disappeared as soon as a shopper left All. `index.html` points at `app.6fc355b2689c.js`. Leave `app.ba3f42b8d601.js`, `app.da08c2d586e1.js`, and `app.151b586e54d8.js` in place; hashed files stay immutable. `app.da08c2d586e1.js` still contains the $14.99 confirm. Do not point `index.html` back at it.

**Direct post.** `guideSubscribe` no longer says eBay or Etsy needs the $14.99/mo plan, and it no longer opens `/pricing/`. A 402 now says that shop has no direct post yet and the site is free — copy the listing and open their sell page. Server list routes can still return 402 when there is no subscription row; that is not a plan to buy. Stripe stays unset.

**Chat.** `functions/api/chat/_lib/grounding.js` pricing facts say the site is free during launch and that $14.99 is not being charged. Try-on facts stay one FASHN redraw; Instant and Photoreal are not modes. `npm test`: 413 pass, 0 fail (2026-10-12).

**Listing.** `listing-wizard.js?v=3` no longer writes `Women/Tops` when identify or List it has no category. List it opens the category picker and stops. A seller still has to pick Women, Men, Home, or another department.

**Sign-in.** `functions/api/auth/me.js` uses `requireAuth`, so a Worker HMAC token and the `fash_session` cookie are the same credential. It used to read only the D1 `sessions` table and answer 401 to a person who was signed in.

**Still not true.** eBay, Etsy, and Whatnot are not connected. After List it, other shops are copy-and-open. Reserve writes an order and moves no money. Stripe stays unset. Three live rows still have no category (vintage denim jacket, blue henley, Keurig) because the title does not say a department; they show under Other. Do not invent photos or a gender for them.

Not committed. Newest deploy `https://a748f398.fashionistas-ai.pages.dev` (project `fashionistas-ai`, branch `main`). The shop and session code first went out on `https://47d80f69.fashionistas-ai.pages.dev`. Checked on `https://fashionistas.ai/` 2026-10-12: the page loads `app.6fc355b2689c.js` and `listing-wizard.js?v=3`. That bundle tells a 402 to copy the listing and open the shop's sell page. `GET /w/api/market?category=Men` returns the polo and the jean jacket. `?category=Home` returns the cup. `GET /api/auth/me` with no credential is still `401`.

## LATEST — 2026-10-11 late ET (read this first)

Personal Gmail addresses are off the public contact forms. The forms stay. Do not put a personal Gmail back in a page, a footer, or a `form action`. Full federation writeup is nexus `handoff.md` §20. The fashionistas night section below still stands.

Live checks, 2026-10-11 ~21:00 ET, no `gmail` in the HTML:

- `https://scooter.exchange/contact` posts to `https://api.scooter.exchange/api/contact`. Pages `https://fef83535.scooters-exchange.pages.dev` (project `scooters-exchange`, branch `main`). Worker `scooters-exchange-api` version `2e94858d-8083-4790-9f9a-a4bfed526962`. Forwards only when `RESEND_API_KEY` and `CONTACT_DEST` are both set. Bad POST returns `400 {"error":"valid email required"}`.
- `https://marketpicks.ai/contact` posts to `/api/contact`. Pages `https://d0aec8e2.marketpicks-ai.pages.dev` (project `marketpicks-ai`, branch `main`). Rows go in D1 `marketpicks-db` table `site_contacts` (created, not a wipe). Inbox forward only if the Pages secret `CONTACT_EMAIL` is set. It is not set. Bad POST returns `400`.
- `https://fashionistas.ai/` was already clean (night section below).
- `https://placebets.ai/contact` has no personal Gmail. The form still posts to `info@placebets.ai`. The subscribe handler in `Placebetsai-src/app/api/subscribe/route.js` no longer hardcodes a Gmail; that edit is not deployed.

Not committed.

## LATEST — 2026-10-11 night ET (read this first)

Three production changes on `fashionistas-ai`, wrangler Pages only, not git. Newest deploy `https://94967eab.fashionistas-ai.pages.dev`. Do not restore any of the three things below.

### 1. Try-on is a redraw

`https://fashionistas.ai/try-on/` only `POST`s `/api/tryon/hd` (Modal FASHN VTON 1.5). No `TryOnPipeline`, no `runDevice`, no sticker fallback. `try-on/tryon_pipeline.js` and `core/tryon_pipeline.js` `run()` return `{ ok:false, source:"removed" }` before any canvas work. Cold-GPU timeout retries the model once. Signed in, 6/day, no Pro.

Proven 2026-10-11 ~19:35 ET: signed-in POST of the FASHN sample pair (white tee person + black FASHN tee) → `200` in 26.2s, `provider:"modal"`, `ms:22876`, image `https://fashionistas.ai/api/tryon/image/bf739e5a2c464390803e28f5bdc032f6.webp` (576×864 webp, 46668 bytes). Same person, hat, pants, boots, tattoo, now in the black shirt. Detail in the next section. Pipeline-refusal deploy was `https://10ee83e5.fashionistas-ai.pages.dev`.

### 2. The Gmail address is off the public site

User: get `fashionistas1979@gmail.com` off the sites, replace it with nothing, the contact form is enough, and do not print `info@fashionistas.ai` either.

Checked live before the change: sitemap pages, `/contact/`, `/about/`, `/privacy/` did not print the Gmail. It was still the FormSubmit recipient inside `functions/api/contact.js`, and the browser called `https://fashionistas-api.fashionistas1979.workers.dev` (the Cloudflare account name) from the app script, try-on, and `/connect/`.

What shipped (`https://7c68edd1.fashionistas-ai.pages.dev`):

- Contact form still posts to `/api/contact`. The recipient is server-only: `env.CONTACT_TO`, otherwise `info@fashionistas.ai`. The address is not in the HTML. Do not put either address back in a page, a footer, or a `form action`.
- The app, try-on, and connect call `API = "/w"`. `functions/w/[[path]].js` forwards `/w/*` to the worker. Proven: `GET https://fashionistas.ai/w/api/health` → `200 {"ok":true,"version":"3.1.0"}`.
- Live after that deploy: `/`, `/contact/`, `/about/`, `/privacy/`, `/try-on/`, `/connect/`, `/pricing/`, and the app bundle contained no `gmail` and no `fashionistas1979`. `/functions/api/contact.js` is 404 (functions are not served as files).
- Server-side fetches (shop SSR, sitemap, channel callback, feed, try-on Modal URL, the extension) still name the worker host. That host is not in the HTML. Do not copy it back into a page or the app bundle.

### 3. Gemini's audit was not a reason to tear the site down

Gemini said the landing page was a mock: fake countdown, Levi's card as a broken shop, no OAuth, no session, `$14.99` with no Stripe, footer Gmail. User said do that prompt if it was accurate.

It was not. Not done: no Stripe checkout, no "3 free listings" gate, no deletion of Sell / try-on / shop. Sign-in is a real Worker account (a throwaway register returned `201` and a token; that token ran the try-on above). Landing card already said Free. Checkout stays closed because `STRIPE_SECRET_KEY` is unset — do not invent a checkout URL. The Gmail line was already gone.

What was true, and what shipped (`https://94967eab.fashionistas-ai.pages.dev`):

- `countdown.js` no longer paints "Public launch" (deadline had been `2026-10-14T09:45:00-04:00`). The file stays as a no-op that removes `#lc-bar`, because an old cached page may still request it. Script tags removed from `index.html`, `try-on/index.html`, `see-in-space/index.html`. Live `/` does not reference `countdown.js`. Older notes below that say the countdown is live are stale.
- Hero phone card is labeled `Example · Vintage Levi's Denim Jacket`. It is a picture, not a listing.
- Homepage FAQ no longer says eBay, Etsy, or Whatnot post through their API, and no longer says a sale pulls eBay/Etsy down automatically. About page says the same: you take a sold item down yourself. Pricing no longer says "on-device try-on".
- In-app guide first step no longer says `$14.99/mo` or that Sell everywhere posts to eleven marketplaces. It says the site is free during launch, the listing goes on fashionistas.ai, and other shops are copy-then-Post.
- App bundle is `/assets/app.151b586e54d8.js`. Hashed assets are immutable for a year. Edit by renaming the file and changing the `index.html` script src. Do not edit `app.151b586e54d8.js` in place.

**Still not true, do not write it back:** eBay, Etsy, and Whatnot are not connected. Stripe is off. There is no legal entity name. Try-on is not a sticker.

## LATEST — 2026-10-11 evening ET (try-on detail)

**The try-on is a redraw, not a sticker.** The button on `https://fashionistas.ai/try-on/` only `POST`s `/api/tryon/hd`. It does not import `TryOnPipeline` and it has no `runDevice`. Confirmed on the live HTML after deploy: those names are absent.

**What was wrong.** `try-on/tryon_pipeline.js` warped the garment and drew it on top of the person photo. That is the result the user rejected ("superimposes the images"). The real model (FASHN VTON 1.5 on Modal) was already deployed and had worked, but the page could still paint the sticker — including when the GPU call failed. There is no fallback to that paste.

**What changed.**
- `try-on/index.html`: only the model. A cold-GPU timeout (Cloudflare cuts a long request) retries `/api/tryon/hd` once. It never composites. When the picture comes back, the two uploads hide so the screen is the worn photo.
- `try-on/tryon_pipeline.js` and `core/tryon_pipeline.js`: `run()` returns `{ ok:false, source:"removed" }` before any canvas work, so a stale tab that still imports the file cannot paste.
- Chat grounding no longer describes an "Instant" overlay or a Pro credit.

**Proven on production, 2026-10-11 ~19:35 ET**, signed-in `POST https://fashionistas.ai/api/tryon/hd` (FASHN sample person in a white tee + the black FASHN tee as the garment):

- HTTP 200 in 26.2s, `provider: "modal"`, `model: "modal/fashn-vton-1.5"`, `ms: 22876`
- Image `https://fashionistas.ai/api/tryon/image/bf739e5a2c464390803e28f5bdc032f6.webp` — 200, `image/webp`, 46,668 bytes, 576×864
- Same person, hat, pants, boots, tattoo. The shirt is the black logo shirt from the garment photo. The second model's face and body are not in the frame.

Signed-in accounts get 6 renders a UTC day (`tryon_daily_cap` / 429). No Pro purchase. First call after the GPU has slept can take about a minute; warm is ~20–30s. Do not put the canvas composite back.

Page + pipeline refusal shipped in Pages deployment `https://10ee83e5.fashionistas-ai.pages.dev` (project `fashionistas-ai`). The 200 above was against `https://fashionistas.ai/api/tryon/hd` before that deploy; `hd.js` was not changed in it. After it, live `/try-on/` has no `TryOnPipeline` / `runDevice`, and live `/try-on/tryon_pipeline.js` `run()` returns `source:"removed"`.

## LATEST — 2026-10-10 (older)

**Production HAS changed.** `https://fashionistas.ai/version.txt` = `496ef1d2cdc70d395deddde8631e42af7686bff4`, identical to local HEAD. Branch `tryon-open`. `origin/main` is still `a841924` and must never be pushed. Shipped with `bash scripts/deploy-local.sh` (no `DEPLOY_BRANCH`); the script verified against the live domain and every check below was re-run on prod by hand, not taken from the deploy log. The last prod SHA before this chain was `4aae2ae`.

**Four commits, all today:**

**`49f7509` — an item page had two `<h1>`.** `/shop/<id>` serves `index.html` as its shell, so it shipped the homepage hero's `<h1 class="rd-h1">`, and the SPA then rendered `<h1 class="ux-item-title">`. Proven on prod before the fix (browser, JS executed, `/shop/98`): 2 `<h1>`s, the hero's one `visible:false`. The hero hides inside `<section class="hidden">` (display:none), which is why demoting its tag moves nothing on screen. The shop route now demotes the shell heading to a `<div>` **on the live-item response only** — the 404 path returns early with no heading of its own, so demoting there would leave a document with zero `<h1>`s. The homepage is served from `index.html` directly and never through that function, so `.rd-hero h1.rd-h1` CSS still matches where it is meant to. Behavioural test added to `tests/item-urls.test.mjs`. Proven live: `/shop/98` = 1 `<h1>` (`ux-item-title`), `/` = 1 `<h1>` (`rd-h1`, still a real H1, hero renders identically).

**`6d06127` — the free on-device path now runs the no-person guard.** `run()` gated on `personInPhoto()` in the `hd` branch only; `runDevice()` had no gate at all. I first recommended leaving that alone on the grounds that the free path costs nothing, and the user overruled it — correctly. The guard is not only about protecting GPU spend; it is about not handing someone a garment composited onto a default layout because their photo had no body anchors. Both branches now gate identically. When MediaPipe cannot load, `personInPhoto` still returns `true` on purpose: the paid path falls through to the server detector, and the free path proceeds, because refusing a free render over a CDN hiccup is worse than the picture it was avoiding.

**`7530792` — a pose that is lying down is refused.** Accuracy run of the real guard against 10 labelled images, ground truth fixed by eye before the run: one person photo cropped to the framings a visitor actually submits, plus dog, flat-lay, vest illustration and an OG text card. Result 8/9, and **the one false positive was the dog photo the entire guard was written for**. Not a near miss — the landmarker answers 33/33 landmarks at visibility 1.0, nose 1.0, both hips 1.0, the same confidence it gives a real person, because MediaPipe Pose localises a human skeleton and does not judge whether the subject is human. No visibility threshold separates them; proportion does. Measured aspect height/width of the landmark extents: dog `0.98`, full body `2.51`, head-to-knees `2.86`, head-to-hips `5.02`. The guard now rejects under `1.5`. This mattered most after `6d06127`: the paid path was never at risk, because the server's YOLOX catches the dog (`test_real_detector_rejects_dog`), but the free path has no server to fall through to, so MediaPipe was its only gate. **Fixture honesty:** `fullPose()` in `tests/tryon-person-guard.test.mjs` stacked all 33 landmarks on `x:0.5 y:0.5` — a degenerate point that passes any proportion check, so the suite was structurally incapable of catching this. It now arranges the landmarks as a standing person, and two tests were added: a supine pose must be refused, and full body / head-to-knees / head-to-hips must still be allowed, so the fix cannot trade the dog for three refused real customers. **Residual, NOT proven safe:** proportion was validated on ONE person photo in three framings. A visitor photographed lying down, or seated very low, would be refused with "Upload a photo of yourself, head to knees" — defensible input advice for a garment try-on, but only a wider set of real photos would prove it safe for every pose.

**`496ef1d` — the try-on headline sold the seller on a buyer's feature.** `<h1>` read "See it on you before you list it", on the page reached from the "Try it on" button sitting next to "Buy now" on every item. One word: `list` → `buy`, in the animated word spans and the aria-label. The lede compounded it — it opened by telling a visitor "when you're signed in we pull the clothing straight from your own listing", so the first thing a shopper with no listings was offered was a feature they cannot use. Rewritten buyer-first, with the listings strip kept as the convenience it actually is. Every fact was checked against the code rather than written to sound right: the garment really does preload (`garmentPrefilled` + "Item loaded: …"), Quick preview really is on-device and free (`runDevice` does no upload, no request, no key), and the HD caveat "needs Pro or a try-on credit · about a minute" was carried over verbatim rather than dropped. No test pinned this text, which is the more interesting half of the bug.

**Accuracy re-run after the fix, PROVEN LIVE on `https://fashionistas.ai`: 9/9** — dog refused; full body / head-to-knees / head-to-hips allowed; head-only, legs-only, flat-lay, vest and text card all refused.

**CORRECTION to an earlier note here: `functions/api/auth/*` is NOT dead code and must not be deleted.** It had been flagged as a legacy path to delete. Wrong, and it was checked before deleting. It is a second, independent auth system (HttpOnly `fash_session` cookie, D1 `sessions` table, PBKDF2 over a per-user salt) that 30+ routes gate on, and `tests/api-auth-matrix.test.mjs` carries an explicit PUBLIC allowlist asserting `auth/login.js`, `register.js`, `google.js` and `logout.js` exist. Deleting it breaks the suite.

**But it IS incompatible with the SPA, and that is a live bug — NOT FIXED.** Proven: `demo`'s real credential passes the Worker (`200`) and is rejected by Pages (`401`); the Worker returns `{user, token}` with no `Set-Cookie`; the SPA never writes `fash_session` (0 occurrences). So `pricing/index.html`'s same-origin `fetch("/api/auth/me")` answers 401 for a user who IS signed in and the page renders "Not signed in yet", and `/api/billing/checkout` — which reads ONLY the `sessions` table — cannot pass either. Currently masked by Stripe being unset. Three ways out, user's call, deliberately not done unilaterally: **A.** point pricing at the Worker for the auth check (fixes the false "not signed in"; checkout still needs a session); **B.** make the Pages helpers also verify the Worker's HMAC (needs that secret available to Pages env); **C.** consolidate onto one system.

**THE GAP THAT LET THE HEADLINE THROUGH — read this before calling anything "audited" again.** All 369 tests measure mechanics: source regexes, h1 counts, stubbed landmark geometry, JSON-LD consistency. Not one of them can read. That page was screenshotted to "verify" it, the headline was on screen, and it was checked for pixels rather than for meaning. A page can pass every check in this repo and still argue against its own product. The rest of the site is seller-framed by design ("Snap it. List it.", "Photograph it once. Sell it everywhere.") because it is a seller tool; the try-on page was the one buyer-facing surface wearing that framing. **When reporting "tested", state what the tests can actually see.**

**Tests: 369 pass / 0 fail** (was 366 — +1 for the one-`<h1>` behaviour, +2 for the proportion gate).

**Still open:** payments blocked on `STRIPE_* EBAY_* ETSY_* GOOGLE_ADS_KEY FASHN_*` (see `NEEDS_ISRAEL.txt` #8); Gmail app password still needed for verification/reset email; test accounts (`buyer2026` id 105, `' OR 1=1--` id 51) and a test DM have no delete route and need a direct `d1 execute` on prod, not yet approved; Search Console sitemap submission; the pricing auth split above; the proportion-gate residual above.

## 2026-10-08 ~2:10 PM ET (SUPERSEDED — its "production is unchanged" is now false; prod is `496ef1d`)

**Production is unchanged.** `https://fashionistas.ai/version.txt` = `2eb3f164627780d6c86a408ab2e283f406689ff5`. Pages deployment `0d44887b-acd7-46e4-ac74-77c7896251d8`. Rollback `f408459d-5d27-4523-acbd-0d7711c8f6d3`. `listing-wizard.js` and `ux-pass.css` 404 on that deployment. Do not describe the public site as the layout below.

**Laptop:** `/home/billionaremaker/fashionistas-ai`, branch `tryon-open`, HEAD `1e05068` (chat smalltalk). Not committed, not previewed, not shipped. User has not said commit or "ship it". `scripts/deploy-local.sh` refuses a dirty tree. Also dirty, and not part of this UX: `chrome-store/fashionistas-extension-v.zip` and `chrome-store/fashionistas-extension-v1.0.1.zip` — do not add those to a listing commit.

**Uncommitted product files:** `listing-wizard.js`, `ux-pass.css`, `index.html`, `assets/app.959c6582.js`.

**What a signed-out person gets locally (proven 2026-10-08 with headless Chrome on a local static server, phone 390×844 and desktop 1440×900):**
- Landing: "Snap it. List it. Try it on." Shop / Sell / Try it on. Shop and Sell call `enterBrowse`, which opens the app without an account. `#shop` and `#sell` do the same after the wizard script loads. Under 767px the fake phone in the hero is hidden so the first screen is the headline and the three buttons, then the photo steps. The old "Posted · Poshmark" floats and the hero stat row are hidden.
- Shop: search, Newest / price sort, one chip row (All, Tops, Jeans, Dresses, Jackets, Bags). Cards are photo, price, title. "Try it on" is a pill on the photo. Desktop is 4 columns from 900px and 5 from 1280px inside a 1280px page. Phone is 2 columns. No Selling/Shopping switch on the shop. Guest header does not show Sign out.
- Item: photo, price, size, condition, Try it on, Message, Buy now. Desktop is photo left, buy column right. Phone buy bar sits above the tab bar. Buy copy is still a demo reserve, no Stripe charge.
- Sell and Photo both mount the one-screen wizard (`LW.mount`). One card: photo, then title, price, kind, condition; size/brand/description collapsed. Button "List on fashionistas", disabled until photo + title + price. Submit sends `status:"active"` and `platforms:["fashionistas"]` and will not save a listing whose photo upload returned null. Desktop top nav hides the duplicate Photo tab. The old "Multilist" label reads "Shops". After list, other shops are copy-and-open, except eBay/Etsy which call the existing OAuth start. Those keys are still missing, so Connect is not a working post. Depop, Poshmark, Mercari, Vinted, Grailed have no seller post API. Do not claim one-click or "posted".
- Help bubble and the wizard "?" are hidden on the app screens.

**Live shop feed (worker, 2026-10-08):** `GET /api/market` returned 8 active rows with photos. The grid will show them, including a polo listed at $10,000, duplicate Keurig rows, and plain shirt drawings. Layout does not fix bad inventory.

**Landing, local only, cut down 2026-10-08 ~5:40 PM ET.** The visible page is Shop, Sell, Try it on. Three steps: photo, price, in the shop. Account card says `$14.99/mo`. Removed from the page: the A-to-Z grid, the eleven-shop logo wall, “Sell everywhere / queued → posted”, the demo-seller button, and “nothing is charged, ever.” Phone bar is Shop, Sell, Try on, Sign in. Desktop app bar is Shop, Sell, Account. FAQ JSON-LD in the head still claims an eleven-shop post. Do not treat that script as the product.

**Still open, same as before:** preview this branch only after a commit the user asked for; prove one real listing in the shop with an account; try-on cold start (~109s vs 150s web limit) still needs finish-or-poll; eBay/Etsy keys; no Stripe; 44 old deployments not deleted; do not spend a paid Modal render to look around.

**Rules:** deploy only from this laptop with wrangler. Preview first (`DEPLOY_BRANCH=`). Production only after "ship it". Clear wrangler cache and stray `CF_ACCOUNT_ID`. Never print Cloudflare, Modal, or VAPID secrets. Zero-install. Try-on is for buyers. See in my space is for art and furniture. Never show a fake posted status.

## PREVIOUS — 2026-10-07 4:45 PM ET

**Production:** Pages deployment `0d44887b-acd7-46e4-ac74-77c7896251d8` = commit `2eb3f16` (phone nav: sticky header + bottom tab bar, "What's next" bar Home-only, compact chat button, blinking fix). **Rollback:** `f408459d-5d27-4523-acbd-0d7711c8f6d3` (`1c174ff`), older `45b2aecb-3cf5-4659-9a88-b3090771bbec`. Verified live on Pixel 7 + Galaxy 360, light/dark, no JS errors.

**Rules (user, non-negotiable):**
- Deploy only from this laptop tree with wrangler (`scripts/deploy-local.sh`). No GitHub pushes.
- ALL UI/mobile changes go to a preview first (`DEPLOY_BRANCH=<name> scripts/deploy-local.sh`), with self-reviewed Android screenshots (top + scrolled, light + dark). Production only after the user says "ship it". Record the current prod deployment ID as rollback before every prod deploy.
- Clear `node_modules/.cache/wrangler` and any stray `CF_ACCOUNT_ID` before deploying (wrong-account pitfall). Revert regenerated chrome-store zips after deploy.
- Zero-install for end users. Try-on is for BUYERS (wearables on their own photo); "See in my space" is for art/furniture/decor.
- Launch target: Wed 2026-10-14 9:45 AM ET.

**User verdict 2026-10-07 4 PM:** mobile UX as a whole is not acceptable. Specifically: the download-zip extension route is "terrible", the listing fields are bad and the form is far too long on a phone.

**In progress (preview branch `listing-wizard`, NOT prod):**
1. Stepped listing wizard, one screen per step with progress bar: 1 Photos (AI identifies + prefills) → 2 What is it (title, department/type chips from `functions/_lib/categories.js`, brand, size, condition, color; extras collapsed) → 3 Price (AI price, comps, take-home per shop) → 4 Where to list (shop toggles, preview, one "List it" button). Drafts autosave.
2. Zero-install posting replacing the zip as the main route: list on fashionistas.ai immediately; direct API post for eBay/Etsy only when keys/OAuth exist; guided "Post to X" (copy fields + Web Share with photos / open the shop's sell page, per-shop done checklist) for Depop, Poshmark, Mercari, Vinted, Grailed. Extension kept only as an optional desktop link in settings. Never show fake "posted" statuses.
3. Whole-app mobile UX pass vs Depop/Vinted/Poshmark/Whatnot: buyer path (Shop, product, Try it on, See in my space, buy) and seller path. Remove instruction walls and jargon (e.g. Home "First sale path" 6-step card with "Load unpacked").
QA shots: box `/workspace/fash-wizard-qa/`.

**Still open:** real test post on each shop to verify category paths; Etsy who-made/when-made defaults wrong for resale; Modal cold-start timeout risk (move to submit-then-poll); pants try-on quality; rotate Cloudflare + Modal keys; 44 old deployments awaiting OK to delete; Browser Cache TTL in dashboard; Stripe later; remove `TRYON_TEST_EMAILS` when done; eBay/Etsy API keys missing.

## TRY-ON / SEE-IN-SPACE — 2026-10-07 ~12:45 PM ET (photoreal live since `791febf`; latest try-on fix live `5b84c2d`)

**Photoreal `/api/tryon/hd` now renders.** Provider order (cheapest first), all in `functions/api/tryon/hd.js` + `functions/api/_tryon/vton-paid.js`:
1. **Modal self-hosted FASHN VTON 1.5** (Apache-2.0) — app `fashn-vton`, URL `https://fashionistas1979--fashn-vton-api.modal.run` (override `FASHN_MODAL_URL`), L4, `min_containers=0`, `scaledown_window=60`. Auth = Modal proxy headers from Pages secrets **`MODAL_PROXY_KEY` / `MODAL_PROXY_SECRET`** (copied from `.env.modal`; rotate both in Modal + `wrangler pages secret put` when the leaked keys are rotated). Cost ≈ $0.000301/s → ~$0.006 warm render (~20 s), ~$0.05 isolated cold (~110 s boot+render + 60 s idle). Covered by Modal Starter $30/mo; `MODAL_MONTHLY_CAP_USD` (default 30, ledger estimate $0.01/render) stops Modal use past that.
2. **HF FASHN Space** (free, anonymous ZeroGPU) — fallback; usually quota-exhausted for server-side calls.
3. **Replicate `prunaai/p-image-try-on` ($0.015/img) / FASHN API (`FASHN_API_KEY`)** — last resort, only if the secret exists. `REPLICATE_API_TOKEN` exists in laptop `.env` but the Replicate account has **no credit (402)**, so it is NOT set in Pages. Async: POST may return 202 `{job}`; client polls `GET /api/tryon/hd?job=`; `tryon_jobs` table prevents double charge.
- **Cold-start risk:** a cold Modal render took 109 s server-side vs Modal's 150 s web limit. If cold starts creep up, raise `min_containers` to 1 at busy hours (~$1.08/h) or move to a spawn+poll Modal function.
- **QA hook:** Pages secret `TRYON_TEST_EMAILS` = `tryon-proof-20261007@fashionistas.ai` (user 83) is entitled without Stripe. Remove it (`wrangler pages secret delete TRYON_TEST_EMAILS`) before/after launch if not wanted.
- **Deploy token cannot touch D1** (code 7403) — grant credits some other way.

**Instant (free) try-on:** shoulder-angle fix (no more upside-down), backdrop cutout, Top/Bottom/Dress/Outerwear picker (overrides auto), "Photo too cropped" warning, bottoms refused on half-body photos (joints must be inside the frame). **In-browser AI background removal** (`see-in-space/cutout.js` → Transformers.js 4.3.1 + `xrds/isnet-general-onnx-int8`, MIT, 44 MB, lazy) when the photo isn't a plain backdrop — used by try-on garments and see-in-space items (~15–20 s first run on CPU). See-in-space: GLB UVs flipped (AR was upside down), plane keeps item aspect, alpha MASK.

Proof set: box `/workspace/tryon-proof/` (`contact.png`, `index.html`, `out/after2_*`).

## CURRENT STATE — 2026-10-07 late night ET (read this first — product source of truth)

**Laptop repo (preferred):** `/home/billionaremaker/fashionistas-ai`  
**GitHub:** [placebetsai/fashionistas-ai](https://github.com/placebetsai/fashionistas-ai)  
**Live tip:** `version.txt` = **`4a0c395`** (`4a0c395256ae46b53e92b0856f2ba8981379fc91`) — must match `https://fashionistas.ai/version.txt`

### Deploy (mandatory — do not get this wrong)

| Wrong | Right |
|---|---|
| GitHub Actions / push to `main` ships the site | **No.** Fashionistas has **no** Actions deploy path for production. |
| Trust `git ls-remote` as "what's live" | Trust **`https://fashionistas.ai/version.txt`** |
| — | **Production =** `bash scripts/deploy-local.sh` → `npx wrangler pages deploy . --project-name=fashionistas-ai --branch=main` |

**A git push does not ship the site. Only wrangler does.**

### Tonight's ships (live SHAs)

| SHA | What | Proof |
|---|---|---|
| `73f81b3` | **Photo→AI identify→listing fill quality** — Pages `/api/ai/analyze` (stronger vision prompt + material/sizeHint rules), shared `libs/identify-fill.js` normalize (Outerwear vs Tops, strip Unknown/not visible, material + price anchors), client prefers same-origin analyze then workers.dev fallback; form fills title/desc/brand/size/category/condition/color/material/price | tests `identify-fill` + `ai/__tests__/vision` |
| prior (`593418e`…) | Chatbot expand / multilist / try-on pipeline | see git log |
| `a5da396` | Seller coach layer (Photo → Sell everywhere checklist / help chips) | `libs/seller-coach.js` + tests |
| `496b09a` | **Free See in my space** — room photo placer (4-corner wall + floor drag/scale/rotate) + optional `<model-viewer>` wall/floor AR from client GLB; CTAs on Shop/Closet detail; `placement_mode` inferred (`clothing`\|`wall`\|`floor`\|`none`); honest Instant/not-photoreal labels | `/see-in-space/` · tests `placement-mode` + `placer-homography` **12/12** · brief `docs/FREE-SEAMLESS-ANYOBJECT.md` |
| `f66079e` | **Multilist one-click polish** — readiness strip (Load unpacked → Verify → Sell everywhere); equal shop treatment (Depop/Poshmark/Mercari/Vinted/Grailed/eBay); honest no-op toasts (never false Posted); Connect + seller-coach Load unpacked hooks | Multilist Connect · `xlOneClickGate` · tests multilist/connect/coach **25/25** · `docs/MULTILIST-ONE-CLICK.md` |

### See in my space — how to demo on phone

1. Open `https://fashionistas.ai/see-in-space/` (or Shop item → **See on my wall** / **See in my room**).
2. Upload room photo → upload listing image → Wall: drag 4 corner handles; Floor: drag + scale/rotate.
3. Optional AR: rebuild plane → use model-viewer AR (Android Scene Viewer / iOS Quick Look when supported). If AR unsupported, photo placer remains — never a dead end.
4. Labels: **Instant preview · free forever** / **Not photoreal**. No Stripe / no paid VTON on this path.

### Seller coach — how to see it

1. Sign in (or **Log in as demo seller**).
2. Lower-left floating **What's next** checklist (Photo → Identify → Fill listing → Multilist → Connect extension → Sell everywhere).
3. Open **Photo** with no listings for the **First sale path** empty-state banner.
4. After AI fill, listing form help chips open the stylist with a suggested question.
5. Progress stored locally as `fash_seller_coach_v1`. Source: `libs/seller-coach.js` → public `/seller-coach.js` (HTTP `/libs/*` is blocked).

**Fill quality (this ship):** after identify, `toListingForm()` fills material + sanitized fields and marks coach `listing`. Sample jacket path sends hint `denim jacket product photo` to Pages analyze only.
6. When **Connect the extension** is next, **Do this →** opens Multilist and the Load unpacked install sheet (`extConnectPrompt`) if the extension is not live.

### Multilist one-click — UX path

1. **Multilist → Connect + post** — readiness strip: (1) Load unpacked Crosslister (2) Verify session per shop (3) Sell everywhere.
2. **Set up extension** → download `/chrome-store/fashionistas-extension-v1.0.1.zip` → `chrome://extensions` → Developer mode → **Load unpacked** → Re-check.
3. Log into Depop / Poshmark / Mercari / Vinted / Grailed / eBay (equal) in the same Chrome → **Verify session**.
4. Pick item → tick shops → **Get ready to post** → **Sell everywhere** queues via extension (no Stripe / no marketplace API keys). Chips: queued → posting → posted (+ View) or failed.
5. Without extension: paste kits + optional eBay/Etsy server API (402/503 when Stripe/secrets empty). **Never** toasts Posted on a no-op.

### Mobile multilist plan (docs only, 2026-10-07)
Native iOS/Android with zero downloads/extensions: see [MOBILE-MULTILIST-PLAN.md](MOBILE-MULTILIST-PLAN.md) (Tier 1 APIs, Tier 2 in-app session, Tier 3 paste kit). Tech: React Native (likely Expo) is the leading possible route, pending research — not final.

### Still blocked

| Blocker | Notes |
|---|---|
| Stripe **test** key | billing / server list path |
| 8 env vars (eBay / Etsy / …) | OAuth + server post |
| Real Chrome marketplace post | never executed (Load unpacked + shop logins) |
| Own marketplace | deferred |
| Photoreal clothing (P1) | metered — not this ship |


### Federation cross-links (secondary)

`nexus-ai-suite` on the same laptop mirrors product nights in federation logs. **This file is the product handoff source of truth.**

> Header lines below claiming older tips / try-on dead backend may be **stale historical copy** —
> ignore them. Use **CURRENT STATE** + live `version.txt` instead.

---

## MISSION — what this app is for (read before touching anything)

**One sentence:** let a single person photograph a garment and sell it in **eleven
marketplaces** without doing eleven jobs.

That is the whole product. Everything else is in service of it.

### The promise the site makes

> **"Photograph Your Closet, Sell It Everywhere."**

| Half | What it does |
|---|---|
| **Listing engine** ← the business | Photo → AI draft (title, identifier, price, **fee take-home**) → **one "Sell everywhere" button** → auto-post to **11 shops** with live per-shop status `queued → posting → posted` / `failed` (retry) / `needs_connection` |
| **Try-on** ← the thing people can *see* | Photo of you + a garment → see it on you → that drives the sale |

**Price: `$14.99/mo`.** That number is claimed site-wide and must stay consistent.

### What this app is NOT — these were removed deliberately

Do not reintroduce any of them. Each was shipped once and explicitly rejected:

| Rejected | Why |
|---|---|
| **"Copy and paste the kit yourself"** / paste-kit framing | Was the old pitch. The About page sold it and was rewritten. It is the *antithesis* of the promise above. |
| **"Free forever" / "$0" / "no subscription"** | Banned copy — was 94 hits on the homepage, now 0. |
| **Bonanza** | Has **zero code anywhere**. Never claim it. |
| **Sticker / overlay "try-on"** (superimpose the garment on the photo) | User: *"this is the most pathetic app in history… it simply superimposed the jeans onto my picture."* Rejected outright. |
| **Developer-speak on consumer pages** | User: *"why the fuck are you telling people what happens when you press try it on."* No implementation copy where a user reads. |
| **Chrome extension as a v1 deliverable, AR** | Out of scope for v1. |

### Definition of "the app works"

Not: *the code runs.* Not: *the tests pass.* Those were both claimed wrongly before
and the user caught it. It means:

1. A person opens `fashionistas.ai/try-on/`
2. Picks a photo and a garment
3. **Gets a real photoreal try-on back in seconds**
4. Presses **Sell everywhere** and it actually posts

Right now step 3 is a dead backend and step 4 has **never once succeeded for any
user.** Everything below the ✅ column is real; everything else is not done.

### Proof standard (user-mandated)

- **No mocks. No fake proofs. No unverified claims.** Every assertion carries
  terminal / curl output.
- **Never say "IT WORKS" when you only proved code ran.** Say explicitly which
  part is *proven* and which is *unproven.* The user rewards that framing and
  punishes the alternative.
- **Three failures on one item → one line in `NEEDS_ISRAEL.txt`, then move on.**
- **Do not ask for budget or new accounts.** Fix it on this box for free, or
  change the product shape.

---

## TRY-ON ENGINE — 2026-10-04 (CURRENT PRIORITY — supersedes every prior try-on note)

### DECISION: Leffa is DEAD. Do not revive it.

Four independent reasons, all measured:

| # | Reason | Proof |
|---|---|---|
| 1 | **Legally unsellable.** Leffa *code* is MIT, but both training datasets are non-commercial — VITON-HD = `CC BY-NC 4.0`, DressCode = YNAP "non-commercial academic research only" | `/tmp/opencode/leffa/{vh_license.txt,dc_lic.txt}` |
| 2 | **Ungodly slow.** 10 steps = **1049.6 s (17.5 min)** → and that output was **visually smeared garbage** | `/tmp/opencode/leffa/svc/bench3.log` |
| 3 | **No fast setting exists.** Linear fit from two measured points: **95.4 s/step + 95.8 s overhead**. Leffa's own default is 50 steps (`inference.py:37`) → **81 min** | 2 steps = 286.6 s, 10 steps = 1049.6 s |
| 4 | **Six models stacked** — UNet + ReferenceUNet + VAE + DensePose + OpenPose + parsing | `leffa/model.py` |

**Lever tests on Leffa — every one measured, none save it:**

| change | measured | verdict |
|---|---|---|
| threads 4 → 8 | 251.0 → 244.9 s/step | 2.4% — useless |
| bf16 autocast | 100.3 vs 58.7 s | **1.7× SLOWER** on this CPU |
| CFG off (`guidance_scale=0`) | 118.1 → 119.6 s/step | no change |
| res 768×1024 → 512×768 | 209 → 118 s/step | ~1.8× — real |
| `power-saver` → `performance` | pinned **1200 MHz** → 2400–4000 MHz | biggest win; the box had been in power-saver the whole time |

The `power-saver` finding matters for **any** future benchmark on this machine: run
`powerprofilesctl set performance` first or your numbers are self-inflicted garbage.

### REPLACEMENT: FASHN VTON v1.5

| | FASHN VTON v1.5 | Leffa |
|---|---|---|
| License | **Apache-2.0, commercial allowed** | MIT code, **non-commercial data** |
| Models | **1** (972M MMDiT, pixel-space) | 6 |
| Masks / DensePose / OpenPose | **none** | all required |
| Output | 576×864 | 768×1024 |
| Weights | **1.94 GB**, public | 8.2 GB |
| Steps | 30 default (20 = fast) | 50 |

Repo cloned to `/tmp/opencode/fashn`, installed editable into `/tmp/opencode/.venv`
(`import fashn_vton` OK). Weights at `/tmp/opencode/fashn/weights/model.safetensors`.

### THREE ROUTES — status

**A. Free HF Space — ✅ WORKS, but quota-limited.**

Endpoint is `fashn-ai/fashn-vton-1-5.hf.space` on **ZeroGPU A10G**. Working client at
`/tmp/opencode/fashn/free_tryon.py`. Protocol is Gradio 6.3.0 and it is *not* obvious:

```
POST /gradio_api/upload          -> ["/tmp/gradio/<hash>/<name>"]
POST /gradio_api/call/try_on     -> {"event_id": ...}
GET  /gradio_api/call/try_on/<id>-> SSE: "event: complete" + "data: [...]"
```

Three gotchas that cost time — do not rediscover them:
1. Images must be full `FileData`: `{"path","url","orig_name","meta":{"_type":"gradio.FileData"}}`.
   A bare `{"path": ...}` is silently rejected.
2. The completion event is **`event: complete`**, *not* `process_completed`, and `data:`
   is a **JSON array**, not an object. Code that does `isinstance(msg, dict)` will
   reject every successful result.
3. `event: error` arrives **immediately, before any GPU work** — that is a quota signal,
   not a payload bug.

### The code that ships, tested for real (2026-10-04)

`functions/api/tryon/hd.js` exports its transport helpers **specifically so the shipped
code can be tested rather than a copy of it.** Test harness:
`/tmp/opencode/fashn/test_shipped_hd.mjs` imports the real file and runs it.

```
inputs: person=180388B garment=289011B
RESULT bytes=30004 type=image/webp ms=25308
PROVEN: shipped runFashn() -> real image over HTTP, free
```

Failure path forced with a bad space URL — this is the behaviour the user demanded
(no silent degradation):

```
code=upload_failed  -> Worker 502   msg=upload HTTP 405
```

### Generation results

| run | result | time |
|---|---|---|
| user photo + sample jacket | **OK** (user: *"its good"*) | 25.9 s |
| **shipped `runFashn()`** | **OK 30,004 B webp** | **25.3 s** |
| one-pieces / model | OK 19,182 B | 10.1–27.2 s |
| tops / model | OK 33,966 B | 10.2–12.7 s |
| tops / flat-lay | OK 44,438 B (1st batch) | 12.0 s |
| **7 of 9** (both runs) | `ERROR` | quota |

**Only 2 of 9 passed on the 2026-10-04 rerun** (A0, A1), then quota died again.
One case failed differently: `A4 URLError: SSL handshake operation timed out` —
a transient network blip, *not* quota. Do not conflate the two when triaging.

Outputs in `/tmp/opencode/fashn/results/`. Test matrix (all 3 categories × both photo
types) in `/tmp/opencode/fashn/testset/index.json`.

> ⚠️ **`/tmp/opencode/fashn/` holds 2.2 GB — code, the 1.94 GB weights and every
> generated image — and it is NOT in git.** systemd purges `/tmp` after 10 days and a
> reinstall wipes it. **Back it up or it disappears.**

**Quota diagnosis — proven, not guessed:** non-GPU endpoints (`load_example`,
`load_example_1`) still return **OK** while `try_on` errors instantly. So the Space is
alive and the payload is valid; only the GPU quota is exhausted (anonymous). It also
*resets* — the same calls that failed at 16:22 succeeded at 18:32 — so treat a failure
as **temporary capacity, never a bug**, and retest before debugging.
An authenticated `HF_TOKEN` would raise it — **but creating/verifying an HF account
needs Israel, and is blocked on him.**

**B. Local CPU — ❌ DEAD, same trap as Leffa.**

```
[load] 5.7s          <- fast, fine
Sampling: 110.0s/it  -> 30 steps ≈ 55 minutes
```
Every Euler step does **2 forwards** (CFG cond + uncond, `forward_for_cfg`), so CPU cost
is doubled before anything else. FASHN is not a "runs on CPU" model despite being far
lighter than Leffa.

**C. Iris Xe iGPU via OpenVINO — 🔶 hardware proven, model export NOT proven.**

This is the only unlimited-free path. Hardware and driver are fully working:

| check | result |
|---|---|
| GPU present | `Intel Iris Xe (TigerLake-LP GT2)` |
| `/dev/dri/renderD128` | `user:billionaremaker:rw-` (ACL, no root needed) |
| kernel driver | `i915` owns `card1` + `renderD128`, device enabled, TGL GuC/HuC/DMC firmware present |
| OpenVINO devices | **`['CPU', 'GPU']`** → `GPU = Intel(R) Iris(R) Xe Graphics (iGPU)` |

**The env recipe — BOTH are required. Missing either gives silent CPU-only with no error:**

```bash
source /tmp/opencode/gpu-env.sh
# LD_LIBRARY_PATH  -> resolves libze_loader / libze_intel_gpu / libigc
# OCL_ICD_VENDORS  -> OpenVINO uses OpenCL for *device discovery*
```

Verified matrix: `LD only → ['CPU']`, `LD + OCL_ICD_VENDORS → ['CPU','GPU']`,
`+ fresh HOME → ['CPU','GPU']` (so it is not a cache effect).

The GPU stack was assembled **without root**: Ubuntu 24.04 debs fetched with a per-user
`apt` lists dir and extracted via `dpkg -x` into `/tmp/opencode/gpu-libs`. Level Zero
additionally needs symlinks in `~/.local/share/uv/python/cpython-3.11.17-*/lib/`
because the loader searches `<python>/bin/../lib` first and that path is user-writable.

**Export status — DO NOT CLAIM THIS WORKS.** First `ov.convert_model` attempt failed:

```
No conversion rule found for operations: aten::chunk, aten::einsum, aten::unbind
Inputs to Einsum operation must have the same type (f32 vs f64)
```

Root cause found in `rope()` (`tryon_mmdit.py:35`): `torch.arange(..., dtype=torch.float64)`
made `omega` float64, which poisons an einsum against float32 positions — and that
aborted OpenVINO's normalize pass, cascading everything else into unconvertible
`PtFrameworkNode`s. Patched to `float32` (the fn already casts to `.float()` at line 40,
so numerics are unchanged).

**The rerun was killed by a server restart and never completed. There is no GPU timing
number.** Next agent: rerun `/tmp/opencode/fashn/gpu_gate.py` with `gpu-env.sh` sourced.

### Files (all `/tmp/opencode/fashn/`)

| file | what |
|---|---|
| `free_tryon.py` | working free-Space client (see protocol above) |
| `batch_test.py` | 9-case matrix runner |
| `gpu_gate.py` | OpenVINO export + CPU-vs-GPU timing gate |
| `run_local.py` | local CPU timing |
| `testset/` | 6 person/garment pairs with category + photo_type |
| `results/`, `free_out.png` | generated images |
| `local.log`, `dl.log`, `batch` logs | raw timings |

### BLOCKED ON ISRAEL — try-on

Everything below is **his**, and nothing else is waiting on him:

1. **Review the generated images.** 5 exist, **1 approved** (*"its good"*).
   Unreviewed: `/tmp/opencode/fashn/results/{A0_onepieces_model,A1_tops_model,
   A2_tops_flatlay}.png` and `shipped_hd_test.webp`.
   **This is the gate** — if the output is bad, the whole FASHN path dies and the
   next agent must be told so, not quietly proceed.
2. **An HF account/token** would lift the Space quota. Needs his email verification.
3. **`TEST.md` §1–6** (~10 min, no keys needed) → first *real* marketplace post.
   There has never been one.
4. **8 env vars** — `EBAY_SANDBOX_*`, `EBAY_*_POLICY`, `ETSY_*`, `GOOGLE_*`, `STRIPE_*`.
   Checked in 5 places, all missing.

### SHIP STATUS — `main` = `5ffba1e`, pushed and verified

```
git ls-remote origin main  ->  5ffba1ebe1c2c8dbc289e8adffafa6736bf52e6c
git rev-parse HEAD         ->  5ffba1ebe1c2c8dbc289e8adffafa6736bf52e6c   (identical)
git status --porcelain     ->  0 remaining                                 (tree clean)
```

Commit `5ffba1e` = 33 files, 717 KB: the FASHN `hd.js` rewrite, the fees/guide work
(`/fees/` removed, 5 new guide pages), `services/leffa/` kept as history under
`RETIRED.md`, and this file. Secret-scanned before push (`.env`, `node_modules/`,
`__pycache__/` all excluded — `__pycache__`/`*.pyc` added to `.gitignore`).

**Pushed ≠ deployed.** The commit is on GitHub; **Cloudflare Pages has not been
re-deployed**, so `fashionistas.ai` still serves the pre-`5ffba1e` output.

### NOT DONE — do not mark any of this complete

- **No GPU speed number.** The export is still running/converting. `rope()` float32
  patch is in; there is **no Iris Xe timing** yet. Do not invent one.
- **Not deployed.** `5ffba1e` is on GitHub, not on Pages.
- **Try-on is not reachable by a user.** `hd.js` exists and its transport is proven,
  but nothing on `/try-on/` calls it. The page still runs the rejected overlay.
- **Free tier still has no replacement.** The on-device warp+composite is the
  rejected "sticker overlay". Nothing else has shipped.
- **7 of 9 item/category tests still unproven** — blocked on quota.
- **Zero marketplace posts, ever.** Blocked on Israel running `TEST.md` §1–6.
- **8 env vars missing** (eBay / Etsy / Google / Stripe).
- **placebets Phase 2 sidecar failed** (rate-limited); its output was never verified.

---

## 0. CURRENT STATE — 2026-10-03 (read this first)

> ## ⚠️ READ THIS BEFORE YOU WRITE ANYTHING INTO THIS FILE
>
> **This document is served publicly at `https://fashionistas.ai/docs/AGENT_HANDOFF.md` → HTTP 200.**
> `_redirects` does **not** block files that exist as deployed static assets — see
> "SECURITY FINDING" below. **Never put a secret in `docs/`.** Secrets go in `.env`
> (gitignored, untracked, returns 404 live, zero traces in git history).

### SECURITY FINDING — `_redirects` blocking NEVER WORKED (2026-10-03)

The file `_redirects` contains rules claiming to 404 internal files. **They are inert
for anything that ships as a static asset.** Proven live:

| Path | `_redirects` rule | Actual live response |
|---|---|---|
| `/docs/AGENT_HANDOFF.md` | line 14 → 404 | **200** (26,885 bytes served) |
| `/wrangler.toml` | line 4 → 404 | **200** |
| `/NEEDS_ISRAEL.txt` | line 6 → 404 | **200** |
| `/package.json` | line 7 → 404 | **200** |
| `/.env` | line 9 → 404 | 404 ✅ |
| `/functions/api/_lib/auth.js` | line 22 → 404 | 404 ✅ |

**Why the two "working" ones pass:** they are *not deployed as assets* — `.env` is
gitignored, and Cloudflare Pages excludes `functions/` from static output. So the
redirect is never reached. **Every real file is served first; the redirect never runs.**

**Consequence:** any file committed to the repo root or a subdirectory is public.
`git grep` found no secrets in committed files as of `d0592fc`, but this must be
re-checked whenever a file is added.

**Fix not yet implemented.** Viable options: (a) `_routes.json` with an `include`
list forcing those paths into the Functions runtime (then return 404), or (b) move
internal files out of the deploy root. (b) is simpler but breaks in-repo history
for other agents. **Do not assume the leak is fixed until a live curl proves 404.**

### Shipped 2026-10-03 (commits `afe61d0`, `d0592fc`)

| Item | Proof |
|---|---|
| `apps/extension/adapters/engine.js` (22,277 B) | 26 jsdom tests, all pass |
| `core/ai_inference.js`, `core/tryon_pipeline.js` | parse clean, honest failure paths |
| `TEST.md` manual script | claims `# tests 57` → reality `57 / pass 57 / fail 0` |
| **`/pricing/`** (was 404 — a v1 spec item) | live **HTTP 200**, renders `$14.99` |
| `sitemap.xml` repaired | 6 → **12** URLs, dead `/app/` removed, **0 dead entries** |

**Full suite: `# tests 57  # pass 57  # fail 0`.** Head at time of writing: `d0592fc`, CI `success`.

**`engine.js` is deliberately `chrome.*`-free** (only hit is its own header comment) —
so the same module serves the extension *and* a mobile WebView. Its dry-run lock:
`submit()` under `dryRun` throws `DRY_RUN_BLOCKED` **without even querying
the publish selector**. Verified by sabotaging the guard → 2 tests go red → restore →
26 pass. That is what proves the tests are not rubber stamps.

### `/pricing/` Subscribe button — exact server contract

Do not guess these; they were read out of `functions/api/billing/checkout.js`:

| HTTP | Body | Meaning |
|---|---|---|
| `401` | `{error:"Not signed in."}` | not authenticated |
| `503` | `{error:"STRIPE_SECRET_KEY not configured", detail:"Set the ... Pages environment variable…"}` | key missing — page **names it verbatim** |
| `502` | `{error:"stripe_unreachable"\|"stripe_error"\|"stripe_no_checkout_url"}` | Stripe call failed |
| `200` | `{url, id, uid}` | redirect to hosted checkout |

**`checkout` never returns 402.** It has no subscription check. The page keeps a 402
branch as defensive future-proofing and says so in a comment.
**`/api/auth/me` returns `{id, email, authenticated}` only — no subscription field.**
An earlier version of the page read `d.subscribed` and would have claimed "Pro is
active" with no way to know. Removed; the page now shows only the sign-in address.

### ENV VAR NAME CORRECTIONS (my earlier list was wrong)

Re-verified by grepping `env.X` across `functions/`:

| I said | Reality |
|---|---|
| `STRIPE_PRICE_ID` | **never read** — checkout builds the price inline via `price_data`. Do not chase it. |
| `ETSY_SHARED_SECRET` | real name **`ETSY_API_SECRET`** |
| `GOOGLE_OAUTH_CLIENT_ID/_SECRET` | real names **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** |

**What the code actually reads** (bindings excluded): `EBAY_CLIENT_ID`,
`EBAY_CLIENT_SECRET`, `EBAY_ENV`, `EBAY_REDIRECT_URI`, `EBAY_RU_NAME`,
`EBAY_SANDBOX_CLIENT_ID`, `EBAY_SANDBOX_CLIENT_SECRET`, `EBAY_SANDBOX_REDIRECT_URI`,
`EBAY_FULFILLMENT_POLICY`, `EBAY_PAYMENT_POLICY`, `EBAY_RETURN_POLICY`,
`ETSY_API_KEY`, `ETSY_API_SECRET`, `ETSY_REDIRECT_URI`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `REPLICATE_API_TOKEN`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

**Two distinct eBay key sets are needed:** `EBAY_SANDBOX_*` is read only by
`/api/list/*` (v1 path); `EBAY_CLIENT_ID` + `EBAY_REDIRECT_URI` + `EBAY_RU_NAME` +
`EBAY_ENV` are read by the OAuth flow (`/api/ebay/oauth/*`). Filling both with the
same sandbox values is the starting point.

A template with links lives at **`.env`** in the repo root (gitignored, safe).

### AI: use the free model for text — image still costs (2026-10-03)

Decision (supersedes any suggestion to bill for an LLM):

- `opencode/mimo-v2.6-flash-free` → **input $0.00 / output $0.00**. Use it for
  titles, descriptions, category and price copy.
- The model catalog returns **0 image-generation models** — mimo is text-only.
  **Virtual try-on still needs a diffusion model**, i.e. Replicate (token now stored
  in `.env`) or an equivalent. `core/tryon_pipeline.js` refuses honestly with
  `generative_endpoint_unconfigured` rather than returning a fake try-on.
- **No callable free-AI HTTP endpoint exists in this environment** — only OpenCode
  session vars, no API key. So server-side mimo cannot be wired from a Worker
  without an endpoint being provided first. Do not claim otherwise.

`core/ai_inference.js` returns `engine_unavailable` (not invented text) because
`@huggingface/transformers` is not bundled. Its `source` field is `"vlm"` only when
a model genuinely ran, otherwise `"pixel_heuristics"`.

### STILL TRUE / STILL OPEN (do not mark these done)

- **Zero marketplace posts have ever occurred.** The extension has never been loaded
  into a real Chrome profile. `TEST.md` §1–6 requires a human in Chrome.
- Adapter list (9): poshmark, mercari, depop, grailed, vinted, facebook, kidizen,
  vestiaire, whatnot. **`craigslist.js` does not exist** — zero code, do not claim it.
- `/api/marketplaces` → 404 (L07). Other audit gaps remain: OG cards on `/ar-tryon/`,
  twitter:card on `/about/`+`/privacy/`, 262-byte `icon.svg`, 3 `<h1>`, contrast
  3.07:1 on `--accent`.
- Replicate token is stored but **never used** — try-on still unrun.
- **The `docs/` leak above is unfixed.**

### Product truth (supersedes §1)

| Item | Truth |
|------|--------|
| **Shops** | **11** — Poshmark, Mercari, Depop, Vinted, Grailed, eBay, Etsy, Facebook, Kidizen, Vestiaire, Whatnot |
| **Auto-post** | **Yes.** One **Sell everywhere** button; live per-shop status `queued → posting → posted` / `failed` (retry) / `needs_connection` |
| **Pricing** | **$14.99/mo** — every claim site-wide. "Free forever" / "$0" / "no subscription" copy is **banned** (was 94 hits on the homepage, now 0) |
| **Rejected UX** | **Paste-kit / "copy and post yourself" framing is REMOVED.** Do not reintroduce it — the About page previously sold it and was rewritten |
| **Bonanza** | Has **zero code anywhere** — never claim it (9 adapters + eBay/Etsy server-side) |

### Security: auth gate (shipped 2026-10-03)

Shared guard: `functions/api/_lib/auth.js` (`_`-prefixed dirs are not routes).

- `requireAuth(request, env)` → **401** unless a valid session token resolves in D1
- `requireActiveSubscriber(...)` → **402** when the user has no active `$14.99/mo` plan
- Credential order: **`Authorization: Bearer <token>`** first, then the `fash_session` cookie (the web app). Both hit the same `sessions` row — a browser session and a Bearer token are one credential carried two ways. **Nothing anonymous gets through.**
- `missingEnv(env, names)` → names the exact absent var; never stubs around it

Applied to **all 8** mutating paths: `/api/list/ebay`, `/api/list/etsy`, `/api/list/all`, `/api/closet/clear`, `/api/delist`, `/api/wear`, `/api/tryon`, `/api/color`.
CORS `OPTIONS` is the only method allowed without a credential (preflight carries none and returns no data).

Also fixed: `resolveIdentity()` in `closet/clear.js` and `GET /api/auth/me` were **cookie-only**, so a Bearer caller authenticated at the gate and then 401'd downstream. Both now read the `Authorization` header.

**Proof (raw, live):**

```
$ curl -s -o /dev/null -w "%{http_code}\n" -X POST https://fashionistas.ai/api/list/ebay
401

# no credentials, all 8
  POST /api/list/ebay       -> 401      POST /api/closet/clear    -> 401
  POST /api/list/etsy       -> 401      POST /api/delist          -> 401
  POST /api/list/all        -> 401      POST /api/wear            -> 401
  POST /api/tryon           -> 401      POST /api/color           -> 401

# authed, not subscribed
$ curl ... -X POST .../api/list/ebay -H "Authorization: Bearer $TOKEN"
402 {"ok":false,"error":"subscription_required","status":"inactive",
     "detail":"An active $14.99/mo subscription is required to list. POST /api/billing/checkout to subscribe."}

# Bearer identity resolves
{"id":76,"email":"gateproof…@fashionistas.ai","authenticated":true}  -> 200

# checkout does NOT fake a URL without Stripe keys
503 {"error":"STRIPE_SECRET_KEY not configured","detail":"Set the STRIPE_SECRET_KEY Pages environment variable …"}
```

### v1 BLOCKED — 8 env vars missing (checked in 5 places)

Verified **unset** in: process env, repo `.env*`, GitHub secrets, **Cloudflare Pages secrets (project has zero)**, shell profiles.

```
EBAY_SANDBOX_CLIENT_ID     EBAY_SANDBOX_CLIENT_SECRET   EBAY_SANDBOX_REDIRECT_URI
ETSY_API_KEY               ETSY_SHARED_SECRET
STRIPE_SECRET_KEY          STRIPE_WEBHOOK_SECRET        STRIPE_PRICE_ID
```

> **Naming:** `.env.example` uses `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET`. The v1 task specifies **`EBAY_SANDBOX_*`**. The code reads the **`EBAY_SANDBOX_*`** names. Reconcile before setting secrets.

Set with:
```bash
npx wrangler pages secret put EBAY_SANDBOX_CLIENT_ID --project-name=fashionistas-ai   # …and the rest
```

**Pending, cannot be faked past:** sandbox eBay developer app + sandbox seller account; Etsy Open API app review; Stripe **test-mode** key + `$14.99` Price + webhook endpoint. Until they exist there are **no `viewUrl`s to report** — `POST /api/list/*` returns `503 env_missing` naming the var.

### Scaling without API keys — the extension is the answer (2026-10-03)

**The per-shop-API model does not scale** and should not be presented as if it does:
11 shops × developer app × review × OAuth × rate limit = 2 of 11 actually achievable.

The repo already contains the scalable mechanism at `apps/extension/` — **~1,700 lines,
9 adapters, a real job queue** — and it needs **zero keys**:

| | Server API (eBay/Etsy) | Extension (9 others) |
|---|---|---|
| Keys per shop | 3–4 secrets + app review | **none** |
| Rate limit | negotiable, per shop | **none** — `waitForGap()` paces like a person |
| Requires shop agreement | yes | no — runs in the **user's own session** |
| Scales to a new shop | weeks | one adapter file + selectors |

Adapters keep **zero selectors** (`config/selectors.js`), so a shop layout change is a
one-file fix. `runPublish()` does a **full submit** (no draft), then polls for the real
`/listing/` URL. Hard rules already encoded: never solve/bypass a CAPTCHA, never upload a
password or shop cookie (heartbeat sends booleans only).

**Gap found and closed today:** the site→extension half worked
(`onMessageExternal` accepts `publish|delist|signup|status` from fashionistas.ai), but
results were only POSTed to the `fashionistas-api` worker — so a locally queued job showed
`queued` forever on our side.

- `queue.js` now persists every outcome as `result:{job_id}` and exports `getResults()`
- `background.js` exposes `{type:"results"}` on `onMessageExternal`
- `index.html` bridge: `extAvailable / extPublish / extResults / extPollStart`
  → status `queued` → **`posted` + real listing URL** (or `failed` + reason), polled every 3s

`Sell everywhere` is now **extension-first**: every shop queues through it when present
(no keys, no manual taps); otherwise eBay/Etsy post server-side and the rest fall back to
the one-tap clipboard handoff. Extension ID is set once via the sheet's
**Connect extension** button (`extSetId`, stored in `fash_ext_id`) — Chrome shows the ID at
`chrome://extensions` → Details.

**Removed:** `https://*/*` from `host_permissions` (audit BLOCKER). 25 explicit hosts remain.

> **Still unverified end-to-end:** a real auto-post needs the extension loaded in a real
> Chrome profile with a logged-in shop account. This environment cannot install one, so
> no "posted" claim has been made from the extension. Verified here: the site renders,
> all 8 bridge functions exist, extension files parse as ESM, manifest is valid JSON.

### One-tap handoff for the shops with no API (built 2026-10-03)

The nine non-API shops **cannot** be auto-posted from a web page — verified, not assumed:

| Host probed from `Origin: https://fashionistas.ai` | HTTP | `Access-Control-Allow-Origin` |
|---|---|---|
| poshmark.com · www.mercari.com · depop.com · www.vinted.com · www.grailed.com · www.facebook.com · web.whatnot.com · us.vestiairecollective.com · kidizen.com | 200/403/301/400/000 | **none on any of them** |

Two independent walls: no CORS headers (browser refuses the request) and their session cookies are `SameSite`/domain-scoped (we cannot attach them). A Chrome extension works precisely because it runs inside the user's own session — that is the only mechanism that clears both.

**What ships instead** (`handoffOpen` / `handoffConfirm` / `handoffSellAll` in `index.html`):
- **one tap** = copy that shop's formatted payload **and** open their create-listing form (no separate Copy step — the old `xlSheet` had `Copy X` + `Open X`, which was the rejected paste-kit shape)
- status per shop per listing in `localStorage` `fash_handoff_v1`: `awaiting_publish` → `posted`
- **`posted` is only ever set by `handoffConfirm()`** (you tapped Published) **or** by a real API id from `/api/list/*`. Opening a page never marks it posted.
- `Sell everywhere` = real API post for eBay/Etsy, mark the rest `awaiting_publish`, open the first one; the rest open one tap at a time (stacked popups get blocked)
- `/api/list/*` statuses mapped to plain words: **401** sign in · **402** subscribe · **503 env_missing** names the key

> **Copy constraint:** do not describe this as "the form opens already filled" — cross-origin makes that impossible. It opens with the payload on your clipboard, and you press Publish.

**Deploy gotcha fixed here:** `String.rfind("</style>")` put the new chip CSS inside a `<noscript><style>` block, which browsers **ignore when JS is enabled**. Symptom was `borderRadius: 0px` despite the rule being in `innerHTML`. Always confirm styling with `getComputedStyle`, not a string search.

### Listing endpoints (built, gated, credential-blocked)

`functions/api/list/{ebay,etsy,all}.js`

Layer order: **401 auth → 402 subscription → 503 `env_missing` (names vars) → real sandbox call.**
`/api/list/all` returns **per-marketplace** results so one failure never hides the other:
`{ ok, ebay:{…}, etsy:{…} }` — `ok` is true only when both publish.

eBay path: `PUT inventory_item/{sku}` (idempotent by SKU) → `POST offer` → `publish_offer`; returns `listingId` + sandbox `viewUrl`, or **eBay's own error text**.
Etsy path: `POST application/listings` (draft) → image upload; handles **429 rate limits** (surfaces `retry-after`) and missing-attribute errors verbatim.

> **Still TODO before these can succeed:** business-policy IDs (`EBAY_FULFILLMENT_POLICY` / `EBAY_PAYMENT_POLICY` / `EBAY_RETURN_POLICY`) are read but unset; the sandbox token + publish path has **never run against a real sandbox account**.

### Deploy

**GitHub push DOES auto-deploy** (workflow `deploy`, CI `CLOUDFLARE_API_TOKEN` — broader than the local token). This contradicts §7; §7's "Git Provider: No" is **stale**. Verify with `gh run list -R placebetsai/fashionistas-ai --workflow=deploy`.

SSH push only (HTTPS token lacks `workflow` scope):
```bash
GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes" \
  git push ssh://git@github.com/placebetsai/fashionistas-ai.git main
```

### Gotchas learned the hard way

1. **`node --check file.js` is a NO-OP for ESM** — returns `exit 0` on broken files. Use:
   `node --input-type=module --check < file.js`
2. A raw-string regex replacement (`re.subn(r'…', r'…\"…')`) writes a **literal backslash-quote** → unterminates a JS string → **entire page renders blank**. Always verify a rendered page in a real browser (`document.documentElement.scrollHeight`), not just `curl`.
3. Security: Pages serves the repo root, so checked-in files are public URLs. `_redirects` + `404.html` block `/functions/*`, `/docs/*`, `/wrangler.toml`, `/NEEDS_ISRAEL.txt`, `/.env*`.

---

## 1. Product (what it is)

| Item | Truth |
|------|--------|
| **Product** | Multilist **AI listing drafts** — photo → ID / price / fee take-home → **paste-ready per-shop kits** |
| **Shops (6)** | Depop, eBay, Poshmark, Mercari, Vinted, Grailed |
| **Auto-post** | **Mostly no.** Paste kits for **all six**. **eBay only:** optional API create when OAuth Connected + sell scopes + business policies |
| **API host** | `https://fashionistas-api.fashionistas1979.workers.dev` (health ≈ `{"ok":true,"version":"3.1.0"}`) |
| **Pages project** | `fashionistas-ai` |
| **Domain** | `https://fashionistas.ai` |
| **Deploy** | **`npx wrangler pages deploy . --project-name=fashionistas-ai` only** — **not** GitHub Actions. Cloudflare Pages **Git Provider: No**. Push to `main` ≠ deploy. |

```bash
# From repo root (static site + functions/)
npx wrangler pages deploy . --project-name=fashionistas-ai
npx wrangler pages deployment list --project-name=fashionistas-ai
```

Package script: `"deploy": "npx wrangler pages deploy . --project-name=fashionistas-ai"`.

---

## 2. UX Research P0 + PASS; app audit Mixed

### Marketing / trust / AdSense plumbing — **PASS 29/29**

**Audit (box):** `/workspace/tnr/audits/FASHIONISTAS-UX-AUDIT-2026-09-26.md`  
**Re-verify:** ~19:31 ET 2026-09-26 — **PASS 29/29** against main `a3c6832` / Pages `fashionistas-ai`

| P0 | Live result | PR |
|----|-------------|-----|
| **Contact** | Static `/contact/` — FormSubmit → `fashionistas1979@gmail.com`, honeypot `_honey`, unique title (not SPA) | #1 |
| **About / Privacy** | Static `/about/`, `/privacy/` + footer links | #1 |
| **ads.txt** | Plain-text **comment-only** placeholder — **no invented** AdSense pub-id; `_headers` forces text/plain | #1 |
| **Fees calculator** | Shipped in #1 as an indexable static fee page (`fees/index.html`); **deliberately removed later** — take-home now comes from `POST /api/fees/estimate` and `POST /api/fees/compare` inside the app, and no standalone fee page is served | #1 |
| **Sitemap** | In: `/`, `/contact/`, `/about/`, `/privacy/`, `/app/`. Out: thin `/blog`, `/ar-tryon`, and the removed fee page | #1 |

**Follow (not fail):** FormSubmit activation on first real submit; real AdSense `google.com, pub-…` lines **only after** a real pub-id exists. **Do not** invent a pub-id or ship `adsbygoogle` without it.

### App product UX audit — **Mixed** (then many P0s fixed night-of)

**Audit (box):** `/workspace/tnr/audits/FASHIONISTAS-APP-UX-AUDIT-2026-09-26.md`  
**Verdict at audit time:** **Mixed** — fee take-home + paste-honest multilist strong; honesty/manifest/Shop junk/generic kits/sample JPG/Multilist-not-a-tab weak.

| App-audit P0 | Status after night ET ship |
|--------------|----------------------------|
| Honesty drift (“Publish everywhere”) | **Fixed** PR #5 — paste / 6 shops / you post yourself |
| Manifest “24 marketplaces” / “AI sells” | **Fixed** PR #5 |
| Shop QA junk / platform bloat | **Client filter** PR #5 — **API-side Shop cleanup still TODO** |
| Generic `xlKit` | **Fixed** PR #6 — `xlKit(l, shopId)` / `XL_KIT_RULES` per shop |
| `sample-jacket.jpg` → SPA HTML | **Fixed** PR #5 — real image asset |
| Multilist not in tabbar | **Fixed** PR #5 — Multilist primary; Map under More |
| Deep routes `/guide/` `/pricing/` `/marketplaces/` | **Still SPA shell** (no pathname router) |
| Demo credentials in client JS | **Still present** (abuse risk) |
| Equal Multilist UX (not eBay-centric) | **User demand night ET — in flight** (see §6) |

---

## 3. Contact / ads.txt / about / privacy

All live on fashionistas.ai (wrangler → `fashionistas-ai`):

| URL | Notes |
|-----|--------|
| https://fashionistas.ai/contact/ | FormSubmit → `fashionistas1979@gmail.com` |
| https://fashionistas.ai/ads.txt | Comment-only; no pub-id |
| https://fashionistas.ai/about/ | Honest product (not auto-poster) |
| https://fashionistas.ai/privacy/ | Privacy |

> **Removed on purpose:** the 6-shop take-home calculator page that used to sit in the `fees/` directory no longer exists. Fee take-home is now `POST /api/fees/estimate` and `POST /api/fees/compare`, computed from the same catalogue `GET /api/marketplaces` serves.

---

## 4. Connect all 6 shops; eBay BYO + OAuth + token + listing API; guide-only others

| Shop | Mode | Status |
|------|------|--------|
| **Depop** | Guide + paste kit | Needs account / Ready to guide / Connected (local) |
| **eBay** | **BYO Client ID/Secret + OAuth + token exchange + optional listing API** | Full path shipped |
| **Poshmark** | Guide + paste kit | Guide-only (no public seller OAuth in app) |
| **Mercari** | Guide + paste kit | Guide-only |
| **Vinted** | Guide + paste kit | Guide-only |
| **Grailed** | Guide + paste kit | Guide-only |

### eBay path (honest)

1. Paste **your** Client ID + Secret (BYO) → `localStorage` `fash_ebay_keys_v1` (base64 stub — not strong encryption), **or** CF Pages secrets  
2. **Connect OAuth** → `GET|POST /api/ebay/oauth/start` → eBay authorize  
3. Callback → **real token exchange** when keys present → HttpOnly `ebay_oauth_tok` (+ Connected in `fash_connect_v1`)  
4. Multilist → **Create on eBay** → `POST /api/ebay/listing` → Sell Inventory `createOrReplaceInventoryItem` → business policies → `createOffer` → optional `publishOffer`  
5. Scopes: `sell.inventory` + `sell.account` (+ readonly). Earlier connects **must re-consent**.  
6. Refresh: cookie Max-Age ~90d best-effort; optional Pages KV if `EBAY_TOKENS` / `FASHIONISTAS_KV` / `TOKENS` bound. **Durable store on fashionistas-api KV/D1 still needed.**

**Redirect / RuName:** `https://fashionistas.ai/api/ebay/oauth/callback`

### Routes

| Route | File |
|-------|------|
| `GET\|POST /api/ebay/oauth/start` | `functions/api/ebay/oauth/start.js` |
| `GET /api/ebay/oauth/callback` | `functions/api/ebay/oauth/callback.js` |
| `POST /api/ebay/listing` | `functions/api/ebay/listing.js` |
| `GET /api/ebay/status` | `functions/api/ebay/status.js` |

Docs: [`EBAY_OAUTH.md`](./EBAY_OAUTH.md) · [`MULTILIST_CONNECT.md`](./MULTILIST_CONNECT.md)

**Never:** fake auto-signup, password collection, invented shop API keys, invented AdSense pub-id.

---

## 5. PR timeline (night ET)

| PR | Title | State | Merge / tip | What |
|----|-------|-------|-------------|------|
| [#1](https://github.com/placebetsai/fashionistas-ai/pull/1) | UX P0 contact/ads/fees | **MERGED** | `a3c6832` ← `89d1bd7` | Static trust + SEO pages |
| [#2](https://github.com/placebetsai/fashionistas-ai/pull/2) | Multilist Connect UI + eBay OAuth stubs | **MERGED** | `9ff0a63` ← `c8f84da` | Connect card; Pages Function stubs |
| [#3](https://github.com/placebetsai/fashionistas-ai/pull/3) | eBay guidance + BYO OAuth keys | **MERGED** | `01a11be` ← `9db613d` | Guidance panel; BYO; start accepts body/headers |
| [#4](https://github.com/placebetsai/fashionistas-ai/pull/4) | Connect guidance all six shops | **MERGED** | `ddbec4a` ← `a79d7f0` | Depop/Poshmark/Mercari/Vinted/Grailed panels |
| [#5](https://github.com/placebetsai/fashionistas-ai/pull/5) | P0 honesty / Shop filter / Multilist nav / fees / eBay token | **MERGED** | `0c4dd7b` ← `d783384` | Trust prime-time |
| [#6](https://github.com/placebetsai/fashionistas-ai/pull/6) | eBay listing create + per-shop Multilist kits | **MERGED** | `54a6d28` ← `37bb5b3` | Inventory/Offer API + `xlKit` per shop |
| [#7](https://github.com/placebetsai/fashionistas-ai/pull/7) | Multilist eBay UX walkthrough | **OPEN** (clean) | tip `1eb12ea` / feat `125816d` | Connect stepper, Create CTA, first-run Snap→kit→Create — **eBay-centric polish** |

GitHub `main` after this handoff refresh is the commit that updated this file (see raw URL / SHA returned to parent).

---

## 6. User demand: equal UX all marketplaces (not eBay-centric) — STATUS

**Demand (2026-09-26 night ET):** Multilist / Connect / kit CTAs must feel **equal across all six shops**. eBay API create is an **optional extra**, not the product spine. Paste kits + guide-open are first-class for Depop, Poshmark, Mercari, Vinted, Grailed **and** eBay.

| Artifact | Status |
|----------|--------|
| **PR #7** `feat/ebay-multilist-ux-walkthrough` | **OPEN, not merged** — eBay walkthrough (stepper, Create on eBay CTA, first-path card). Tip `1eb12ea`. |
| **Live CF Production** | **Already deployed** PR #7 code: deployment `075ef679-…`, Source **`125816d`**, preview https://075ef679.fashionistas-ai.pages.dev — **ahead of GitHub `main`** |
| **Branch `feat/multilist-all-shops-first-class`** | **Local only** (not on `origin`). Tip currently same as PR #7 tip. |
| **Equal-UX WIP** | **In flight, uncommitted** — agent stash `equal-ux WIP index.html` de-centers eBay (neutral Create chrome, “paste kit · optional API”, coach copy aligned to all shops). **No remote branch / no PR yet.** |
| **Merged equal-UX PR** | **None** |

**Agent action:** Prefer finishing equal Multilist UX (neutral first-path, per-shop kit CTAs Copy/Open for all six, eBay Create secondary) → PR → merge → wrangler deploy. Do **not** deepen eBay-only coach copy without matching non-eBay paths. If merging #7 first, immediately follow with equal-UX so live doesn’t stay eBay-centric.

---

## 7. Deploy truth + laptop CF SHAs vs git (critical)

### Model

- **Source of truth for live HTML:** Cloudflare Pages **deployment list**, not GitHub alone.  
- Pages **Git Provider: No** — `git push` does **not** auto-deploy.  
- Prefer merge + explicit `wrangler pages deploy` of a **known Git SHA**.  
- Laptop (and agents) sometimes deploy Sources **missing from GitHub**.

### Latest CF Production (night ET, wrangler list)

| Deployment | Source | In GitHub? | Notes |
|------------|--------|------------|--------|
| **`075ef679-…`** (latest) | `125816d` | Yes on **feat branch** (PR #7); **not on `main`** | eBay Multilist UX walkthrough **live** |
| `5c4311cb-…` | `36f2979` | Yes (`main` lineage) | Handoff stamp deploy |
| `421a5d5a-…` | `d2d606d` | Yes | Prior handoff stamp |
| `3d00b6ca-…` | `54a6d28` | Yes | PR #6 merge |
| `16dc126f-…` | `0c4dd7b` | Yes | PR #5 merge |
| `e70a332e-…` | `ddbec4a` | Yes | PR #4 merge |
| `6e701489-…` | **`60f5501`** | **MISSING** | Laptop-only historical |
| older | **`0584633`**, `0b186a6`, `f2c02fa`, … | **MISSING** | Laptop-only historical |

```bash
npx wrangler pages deployment list --project-name=fashionistas-ai
git cat-file -t <source_sha>   # fatal = not in this clone / laptop-only
```

**Warning:** Live site can be **newer than `main`** (as with `125816d` / PR #7). Before redeploying from `main`, compare live Source SHA. Do not clobber unknown laptop-only builds blindly.

---

## 8. What works / what doesn’t

| Capability | Status |
|------------|--------|
| Paste multilist drafts (6 shops) | **YES** — **per-shop kits** |
| Fee estimate / compare (`POST /api/fees/estimate`, `POST /api/fees/compare`) | **YES** — the old standalone fee page was removed on purpose |
| Photo → AI analyze → listing form | **YES** (API live) |
| Contact / about / privacy / ads.txt placeholder | **YES** |
| Honesty copy + Multilist tab + sample jacket | **YES** (PR #5) |
| Shop client hide QA/no-photo | **YES** (client); API feed still dirty |
| Auto-post Depop / Poshmark / Mercari / Vinted / Grailed | **NO** (guide + paste only) |
| eBay OAuth authorize + token exchange | **YES** (BYO or CF env keys) |
| eBay Create / `POST /api/ebay/listing` | **YES path** — needs token + sell scopes + **business policies** |
| Durable refresh on fashionistas-api KV | **NOT yet** (cookie best-effort) |
| Equal Multilist UX (all shops first-class) | **IN FLIGHT** — see §6 |
| Browser extension guided paste | **NOT yet** |
| Real AdSense | **NO** until real pub-id |
| Fake accounts / invented pub-ids / invented shop keys | **Must never** |

### Typical eBay listing blockers (expected, not bugs)

1. No token cookie → `ebay_not_connected`  
2. Old token without sell scopes → `insufficient_scope_or_auth` — Reconnect OAuth  
3. No business policies → `missing_business_policies` — Seller Hub  
4. Expired access + no Client Secret for refresh → paste BYO keys again  
5. Production scopes not granted → Sandbox or enable in developer portal  

---

## 9. Secrets

| Secret / var | Where | Notes |
|--------------|--------|--------|
| `EBAY_CLIENT_ID` | CF Pages secret **or** BYO UI | Prefer BYO v1 |
| `EBAY_CLIENT_SECRET` | CF secret **or** BYO | Needed for exchange + refresh; never commit |
| `EBAY_RU_NAME` / `EBAY_REDIRECT_URI` | CF | Must match RuName / callback |
| `EBAY_ENV` | CF var | `sandbox` \| `production` |
| Optional KV binding | Pages | `EBAY_TOKENS` / `FASHIONISTAS_KV` / `TOKENS` |
| Contact | FormSubmit → `fashionistas1979@gmail.com` | Activate on first real submit |

Checklist only: [`.env.example`](../.env.example).

```bash
npx wrangler pages secret put EBAY_CLIENT_ID --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_CLIENT_SECRET --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_RU_NAME --project-name=fashionistas-ai
```

---

## 10. Next recommended (priority)

1. **Equal Multilist UX** — finish/push `feat/multilist-all-shops-first-class` (or successor): first-path + kit CTAs equal for all six; eBay Create secondary; merge + wrangler deploy. Resolve PR #7 (merge then equalize, or fold equal UX into one PR).  
2. **Browser extension** (or equivalent) for guided paste on non-eBay shops — no password harvesting / fake auto-accounts.  
3. **API Shop cleanup** — hide QA/bulk/no-photo server-side; normalize platforms to the six (client filter is only a bandage).  
4. **Durable tokens on fashionistas-api** (KV/D1) keyed by user — replace cookie-only refresh.  
5. **AdSense only with real pub-id** — then update `ads.txt`; never invent.  
6. Hive LLM coach (today: static checklist); eBay category taxonomy + default policies helper.  

---

## 11. Rules for agents

1. **No fake auto-signup accounts.** Guide + real vendor URLs only.  
2. **No invented AdSense pub-ids** or shop API keys / passwords.  
3. **Deploy with wrangler** to project **`fashionistas-ai`**. Git push ≠ deploy.  
4. Before overwriting production: compare `deployment list` Source SHAs to `git cat-file`. Live may be ahead of `main`.  
5. **Paste multilist must keep working** while Connect/API is partial.  
6. **Honest copy:** never claim auto-post beyond eBay Connected+API path; prefer **equal UX** language for all six shops.  
7. Prefer PRs for non-trivial Connect/API/UX work.  
8. User demand night ET: **do not leave the product eBay-centric.**  

---

## 12. Quick start

```bash
git clone https://github.com/placebetsai/fashionistas-ai.git
cd fashionistas-ai
git pull origin main
# Read this file + docs/EBAY_OAUTH.md + docs/MULTILIST_CONNECT.md
npx wrangler pages deployment list --project-name=fashionistas-ai
# Equal-UX WIP may exist as local stash/branch on shared box — check before starting fresh
# Deploy only when intentional:
# npx wrangler pages deploy . --project-name=fashionistas-ai
```

### Key live URLs

| URL | Purpose |
|-----|---------|
| https://fashionistas.ai/ | Marketing + SPA |
| https://fashionistas.ai/contact/ | FormSubmit contact |
| https://fashionistas.ai/about/ | Ownership / honesty |
| https://fashionistas.ai/privacy/ | Privacy |
| https://fashionistas.ai/ads.txt | Placeholder ads.txt |
| https://fashionistas-api.fashionistas1979.workers.dev/api/health | API health |
| https://075ef679.fashionistas-ai.pages.dev | Latest known CF prod (PR #7 source `125816d`) |

> **Not a live URL any more:** the fee take-home page that used to sit in the `fees/` directory was deleted on purpose (removed from `sitemap.xml` and from every nav/footer). Fee take-home now lives in the app via `POST /api/fees/estimate` and `POST /api/fees/compare`.

**End of handoff — 2026-09-26 night ET (complete through Connect #1–#4, P0 #5, kits+listing #6, eBay walkthrough #7 open+live, equal-UX in flight).**

## 2026-10-07 09:45 ET — landing redesign shipped
- Live tip: 54b4e84 (merge of redesign-preview + nav alignment), deployment b0d247b3 via scripts/deploy-local.sh, version.txt verified.
- Rollback: previous production deployment e26c7045-e4f5-4cbe-a18d-f7f77af28e96 (c047b8a).
- New files: redesign.css, redesign.js, assets/rd/*.webp (Unsplash, see assets/rd/CREDITS.txt). Landing hamburger <=1100px, compact links 1101-1320px.

## 2026-10-07 09:50 ET — launch countdown bar live
- Live tip: 4e34b0b (deploy-local verified). countdown.js counts to 2026-10-14T09:45:00-04:00, then shows "We're live".
- Home: appended inside sticky #land-nav (under nav row). /see-in-space/, /try-on/: inserted after header.topnav in normal flow.
- Remove: delete the countdown.js <script> tags in index.html, see-in-space/index.html, try-on/index.html.
- Rollback for this change: previous prod = b0d247b3 (54b4e84).

## 2026-10-07 09:53 ET — ROLLED BACK: production = e26c7045 (c047b8a, pre-redesign)
- User reported mobile broken after redesign+countdown. Rolled back via Pages API rollback (wrangler 4.148 has no rollback cmd).
- WARNING: local main still contains 54b4e84 (redesign) + 4e34b0b (countdown). Running scripts/deploy-local.sh from main WILL re-ship them. Do not deploy main until the user approves redesign v2.
- v2 fix lives in worktree ../fashionistas-ai-redesign, branch redesign-fix (c645933), preview https://redesign-preview.fashionistas-ai.pages.dev

## 2026-10-07 ~10:35 ET — redesign v2 SHIPPED to prod
- Merged `redesign-fix` (c645933) into main → ba08a59; deployed via scripts/deploy-local.sh → Pages deployment a3447cbb (version.txt verified).
- Main IS now deployable again (supersedes 8fbdd42 warning). Rollback target: previous prod e26c7045 (Pages API rollback).
- Playwright QA on live (desktop 1440, iPad, iPhone SE/13 WebKit, Pixel 7): rotator pill visible, nav one row desktop / hamburger small, countdown under nav to 2026-10-14T09:45-04:00, 0px overflow, /, /try-on/, /see-in-space/, /about/ 200. Only errors: AdSense 400s + 404 /assets/fashionistas-app-icon-512.svg (pre-existing).
- No GitHub push. chrome-store zips reverted after deploy.

## 2026-10-07 10:55 ET — mobile anti-flicker + layout pass 2/3 LIVE
- Production: c48bc4b8 (e17ee64; countdown seconds fix on top of 99b5b7d9/7f9e906 + countdown-seconds color fix). Rollback target: 6d7a162f (cc7bf2e, flicker fix only); older: 809fc97a (bd2978a).
- Flicker: countdown updates text nodes only; rotator pill fixed width; ? fab debounced; no infinite/backdrop anims on phones; reduced-motion honored.
- Layout: unfilled AdSense mounts collapse (were ~390px blank gaps); sticky bottom "Start selling free" CTA on phones; shop pills = snap carousel; fluid 16px+ type; 44px sections; countdown height reserved + Inter display=optional → CLS 0.207→0; hero image preloaded.
- Lighthouse mobile perf 35→49; remaining bottleneck = 447KB index.html + AdSense.
- Verified live on iPhone SE/13/15PM, Pixel 7, iPad, 1440: no overflow, no JS errors, 8 nav links.

## 2026-10-07 ~11:40 ET — perf + pill + contrast LIVE
- Production: ed5a83c2 (181d819). Rollback: c48bc4b8 (e17ee64).
- 308KB inline app script → /assets/app.<hash>.js (defer, immutable cache; tests read it via tests/helpers/index-source.mjs). Rename hash when editing app code (re-run the split or edit the file + update the <script src>).
- Early inline boot in #view-auth unhides landing for signed-out visitors (otherwise blank first paint until bundle runs).
- Font CSS non-blocking; mobile static bg layers (meshDrift/aurora/gridPan/rdScan off ≤767px); 3 below-fold imgs lazy.
- Rotating pill never blank (instant swap + soft settle, min opacity .55); AA contrast fixes (kickers, muted text, shop pills, footer).
- AdSense loader left as raw <script async> in head (repo test + comment forbid deferring it). Ads verified loading (adsbygoogle.loaded, slots done/unfilled).
- Lighthouse mobile: perf 51→72–76, a11y 97→100, FCP 5.1→1.1s, LCP 6.5→2.0s, CLS 0. TBT still ~1.1–1.7s (app bundle boot ~1.3s long task).

## 2026-10-07 12:30 ET — categories launch (prod)
- Shared table functions/_lib/categories.js: 5 depts (Women/Men/Kids/Home/Art), 69 types, per-shop paths (Depop/Poshmark/Mercari/Vinted/Grailed), eBay leaf ids (verified flag; unverified -> eBay Taxonomy suggestion first), Etsy path -> live taxonomy id (functions/_lib/etsy-taxonomy.js). Regenerate copies: node scripts/gen-categories.mjs
- Form: dept -> grouped type chips -> per-type size picker. Old flat/old-tree categories resolve via LEGACY.
- AI vision returns categoryPath from the table. eBay/Etsy/list routes + extension read the table; extension never auto-submits an unconfirmed category (needs_review, tab left open).
- Try it on / See it in my room: buyer-only (search cards + product page); try-on preloads ?item=.
- deploy-local.sh: DEPLOY_BRANCH=<name> for previews.
- Rollback: Pages deployment 39595d7c-c23d-4a9f-a5fe-742d7c97dffe (5b84c2d).
- Open: verify shop paths with real posts; Etsy who_made/when_made defaults wrong for resale (vintage-only rule).

## 2026-10-07 — Android "blinking" fix (prod, 1c174ff)
- Causes: countUp re-ran on its own writes, seller-coach banner/panel rewrote identical DOM, #screen observer reacted to coach/count-up mutations, edge cache served stale app.js. ~9k–35k mutations/3s -> ~480.
- Fixes: idempotent writes (el.__counted, __scSig), filtered observers, bundle renamed to assets/app.<hash>.js + ?v= on css/js. Keep seller-coach.js == libs/seller-coach.js (test enforces).
- Rollback: 45b2aecb-3cf5-4659-9a88-b3090771bbec (58af13b); older 58175efe-fdbf-475e-a307-c677b5c40dbe (5693f4e).

## 2026-10-07 — Phone header + bottom tab bar (PREVIEW ONLY: https://mobile-nav-preview.fashionistas-ai.pages.dev)
- NOT on production. Commits 7f667d9, 98b7600, ee1ddb5, 1bc6af3 are local main only; prod is still 1c174ff. Ship only with Iz's explicit OK.
- Why sticky failed on Android: #topbar was static; #land-nav sticky sat under a clipping/transformed ancestor. Now position:fixed + measured spacer (mobile-nav.js sets --mh header height, --tb tab bar height via ResizeObserver).
- mobile-nav.js builds #mtabbar (app: Home/Shop/Sell camera/Try on/Account; landing: Home/Try on/Sell/Room/Sign in). Old nav.tabbar stays in DOM (navBuild clones it into drawer/#topnav) but is hidden <900px.
- redesign.css v16–v19 (<900px): fixed header, no backdrop blur, safe-area insets, 44px targets, one brand lockup (F tile + Instrument Serif wordmark, red italic .ai) in app/landing/drawer, drawer z 99 above header, no help chips in menus, theme toggle moves into the drawer at <375px, light-mode .hero-sub contrast fix.
- QA (box): /workspace/qa5.py TAG URL devices -> /workspace/fash-mobile-qa5/<TAG>/. Pixel 7 / 360 / 320 / iPhone 13, light+dark, y0/1000/2000/menu: header at top, tab bar at bottom, nothing overlapping it, no JS errors.
- Known: Playwright WebKit (iPhone) crashes intermittently while scrolling the Shop list — same on prod, pre-existing, not caused by this work; check on a real iPhone.
- v20/v21 (preview, 717f279 + 0310eee): "What's next" coach bar shows on Home only on phones (mobile-nav.js sets html[data-mtv]=current view); menu has a "What's next · Checklist" row (mtShowNext → Home + expands it). Chat button 44px, tab bar +16px (Home: +70px above the coach bar), hidden while the checklist is expanded; .wrap bottom padding tb+76px so content scrolls clear; snackbar sits left of the chat button above the tab bar. QA: /tmp/qa6.py-style scan found 0 chat-button/"Try it on" overlaps over the whole Shop page (Pixel 7, 360px).

## 2026-10-07 15:00 ET — SHIPPED: phone header + bottom tab bar + coach bar Home-only (Iz said "Goooo")
- Production: 0d44887b-acd7-46e4-ac74-77c7896251d8 (2eb3f16 = 0310eee mobile-nav polish + handoff-only commit). Same code as https://mobile-nav-preview.fashionistas-ai.pages.dev (0e293477, 0310eee).
- Rollback: f408459d-5d27-4523-acbd-0d7711c8f6d3 (1c174ff, flicker fix only). Older: 45b2aecb-3cf5-4659-9a88-b3090771bbec (58af13b).
- Deployed via scripts/deploy-local.sh (no DEPLOY_BRANCH) after rm -rf node_modules/.cache/wrangler and unsetting CF_ACCOUNT_ID; version.txt verified == 2eb3f16; /.env* /.git/config 404.
- Live QA (Pixel 7 + Galaxy 360, light+dark, landing + demo app): header pinned (top 0) and tab bar visible at y=0 and y=2000; 0 JS errors; Shop "Try it on" vs chat button overlap 0/26 and 0/27 positions; "What's next" menu row opens the checklist; DOM mutations 13 per 3s (hero word rotators), identical to the rollback deploy; layout shift 0.
