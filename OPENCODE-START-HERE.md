> **DAILY ALERTS (Iz, 2026-10-15): OpenCode owns the daily alerts for every site, not Chief of Staff.** Read nexus-ai-suite [`OPENCODE-DAILY-ALERTS.md`](https://github.com/placebetsai/nexus-ai-suite/blob/master/OPENCODE-DAILY-ALERTS.md) (commands, Cloudflare alert meanings, triage, known issues, secrets paths). Fashionistas daily check: `node scripts/smoke.mjs https://fashionistas.ai`.

> **UPDATE 2026-10-15 (~6:50 AM ET) — STATUS. Work on branch `rebuild`. Awaiting Iz "ship it".**
> **Prod:** still `89bf396` / Pages `47a70a52` (rollback `d8b758aa`). **Preview:** https://rebuild.fashionistas-ai.pages.dev · tip `0ec533a`.
> Rich 2026 visual layer live on preview: hero, kinetic text, category cards, try-on card, confetti, edit listing, client-side junk feed filter, gallery endpoint.
> Pinned try-on demos (shared prod D1 — do not delete): `/shop/209` denim trucker jacket · `/shop/148` blue Versace polo.
> **Open:** SSR SEO junk titles; photo column unverified; final polish; real-account extension test; EPN blocked on Iz eBay login; affiliates plan in nexus `AFFILIATES-PLAN-2026-10-14.md`.
> Rules unchanged: preview only (`DEPLOY_BRANCH=rebuild ALLOW_BRANCH=rebuild scripts/deploy-local.sh`), prod only after Iz says "ship it", no secrets, no invented data, never change CHANNEL_KEY.
> Next: (1) final polish / self-critique; (2) SSR junk filter in functions/shop; (3) confirm D1 photos column; (4) real-account extension QA; (5) keep e2e 32/32 light+dark + sweep 19/19.

# OpenCode START HERE — Fashionistas.ai takeover

## 🚨 HARD RULE — deploy only via the smoke gate (added 2026-10-15, approved by Iz)
**All bots and OpenCode must ship production ONLY with `bash scripts/deploy-safe.sh`.**
Raw `wrangler deploy` / `wrangler pages deploy … --branch=main` (or any other script that uploads straight to production) is **forbidden**.

What the gate does (deterministic, free, zero AI/LLM calls in the checks):
1. builds, deploys a **preview** (`gate-candidate`),
2. runs `scripts/smoke.mjs` against the preview — key pages 200 with expected markers and no `undefined`/`NaN`/error text, key APIs valid JSON with sane counts + freshness, bot answers grounded against the site's own live data, response-time budgets,
3. only if green, deploys **production**,
4. smokes production again and prints the exact rollback command if anything is red (`AUTO_ROLLBACK=1` runs it).

Manual check of any URL: `npm run smoke -- <url>` (or `node scripts/smoke.mjs <url>`). `PREVIEW_ONLY=1` stops after a green preview.
`ALLOW_KNOWN_FAILS=1` lets a deploy through only when every failing check also fails on current production (a pre-existing bug, not a regression) — never to skip something this deploy broke.
If a check is wrong, fix the check in `scripts/smoke.mjs` in its own commit with the reason; do not bypass the gate.


**Date:** 2026-10-14 ~5:00 PM ET  
**Owner:** OpenCode (MiMo) takes the grind. Chief of Staff owns ship-it / Iz blockers.  
**Read order:** this file → `docs/agile/*` on branch `docs/agile` → `docs/AGENT_HANDOFF.md` on branch `seller-ux` → nexus `OPENCODE-COORDINATION.md`.

---

## Current state (do not invent)

| What | Where |
|---|---|
| **Production** | fashionistas.ai = git `89bf396` = Pages deploy `47a70a52-041e-4e46-b7c4-7c620c1ccfb6`. Includes revenue + extension 0.1.0 + easy OAuth board. |
| **Rollback** | Pages deploy `d8b758aa-0ed8-430d-a4e4-c780c7b90be9` (pre-revenue). |
| **seller-ux PREVIEW (awaiting Iz "ship it")** | https://seller-ux.fashionistas-ai.pages.dev — branch `seller-ux`, tip `2200a8f` (handoff commit `6fe715d` on top). Four Sprint-1 UX fixes: honest dashboard, Vendoo-style connect (no keys), clean-bg off, honest AI category. **Do not merge to main until Iz says ship it.** |
| **Agile docs** | Branch `docs/agile` tip `6e60f5b`: `docs/agile/BACKLOG.md`, `SPRINTS.md`, `UX-RESEARCH.md`. **Reference only — do not merge that branch's code into main.** |
| **MarketPicks side note** | Same CF account. Crawler CPU guard live at deploy `280dc36b` (rollback `0cb3f854`). Not Fashionistas work. |
| **Test seller** | `iz_test_seller` (user 130). Creds in gitignored `~/fashionistas-ai/.env.test-seller`. Never print. |

Local `main` is production. Ignore every other copy on this laptop: `fa-*`, `fashionistas-wt-*`, worktrees, lane folders. Only work in `~/fashionistas-ai`.

---

## Hard rules

1. **Only** `~/fashionistas-ai`. Never the stale copies.
2. Deploy only via `scripts/deploy-local.sh` (Wrangler). Never GitHub Actions, never Telegram.
3. Preview: check out the feature branch, then  
   `DEPLOY_BRANCH=<name> ALLOW_BRANCH=<name> scripts/deploy-local.sh`  
   Production = `main` + Iz said **"ship it"** in Chief-of-Staff chat. Never ship UI straight to prod.
4. UI changes need **412×915** phone screenshots (light + dark) on the preview before asking for ship-it.
5. **Never print secrets.** Never change `CHANNEL_KEY`. Never invent listings, sales, charts, or counts.
6. Free for users forever. Money = AdSense + affiliates only. No Stripe / paid tiers unless Iz orders it.
7. Keep D1 lean (tiny durable rows; caches/logs → KV/R2).
8. After every milestone: update `docs/AGENT_HANDOFF.md` **and** nexus-ai-suite `HANDOFF-fashionistas-2026-10-14.md`, then push nexus (doc-only commits).

---

## Branches (leave them alone until ship-it)

- `main` — production tip (handoffs may be ahead of origin; local main wins).
- `seller-ux` — Sprint 1 UX fixes on preview. **Continue Sprint 1 remaining work on this branch** (or rebase your new commits onto it). Do not merge until Iz says ship it.
- `docs/agile` — backlog / sprints / research only. Cherry-pick or copy the markdown if you need it; do not merge the branch as a code merge.

---

## Ordered task list (from docs/agile)

### Sprint 1 — finish on `seller-ux` (code mostly done; tests + real-account QA left)

Preview already has BUG-1..7 / S-CL1 / S-PH2 / S-AI* / S-DASH1 / S-AN1 fixes. Still open:

1. **Write the agile e2e specs** (they do not exist yet):  
   `e2e/agile/s1-connect.spec.js`, `s1-photo.spec.js`, `s1-ai.spec.js`, `s1-dash.spec.js`, `s1-post.spec.js`  
   Acceptance criteria are in `docs/agile/SPRINTS.md` + `BACKLOG.md` (read from branch `docs/agile`).
2. **Real-account extension test** (Iz or you on his Chrome with his seller logins): eBay, Poshmark, Depop, Mercari — Connected chip + Post everywhere fills title/price/desc/photos. Fix selectors per site that fail. Report which of the 14 sites work.
3. **Real marketplace logos** on the connect grid (no placeholder letters if logos are available under license / public brand assets already in repo).
4. **Multi-item Post everywhere:** today each item waits for listing confirmation before the next; can take up to ~15 min per site. Make the queue honest (progress UI) and don't block the whole board on one slow site.
5. **E2E must not inflate test-seller sales.** Crosslist "sold" writes must not leave fake orders/stats on `iz_test_seller`. Clean up after every run.
6. Screenshots 412×915 → ask Chief of Staff / Iz for **"ship it"** → only then merge `seller-ux` → `main` + `scripts/deploy-local.sh`.

### Sprint 2 — Inventory sync (Oct 19–21) — highest product priority after S1 ships

- **S-INV1** delist-everywhere when sold on any site + per-site log + red retry on failure (`e2e/agile/s2-delist.spec.js`).
- S-CL3 missing-fields checklist, S-CL4 session reconnect chip.
- T-1 fake-data audit, T-2 sold items off `/shop` within 1 min.

### Sprint 3 — Buyer find + item page (Oct 22–24)

- B-FL1 filter drawer, B-SO1 sort, B-SR1 typo-tolerant search, B-IT1 item page, B-BY1 no dead Buy, B-OUT1 Buy-on links.

### Sprint 4 — Messages / offers / onboarding (Oct 27–29)

- S-MSG1 inbox + offers, S-PAY1 honest payout copy, S-ON1/S-ON2 free-forever onboarding.

### Sprint 5 — SEO / AdSense / Chrome Web Store (Oct 30–Nov 3)

- T-3..T-6 schema/sitemap/CLS/disclosure/privacy.
- Package extension for Chrome Web Store (Iz pays $5). Play/Apple later.

### Later

S-INV2 bulk, B-TO1 try-on polish, B-SV1 saves, Capacitor/TWA apps.

**Definition of done (every story):** test green on preview + 412×915 screenshots + Iz "ship it" + Wrangler deploy + handoff updated.

---

## Iz-only blockers (do not fake these)

| Blocker | Status |
|---|---|
| eBay Partner Network | In progress — Iz signing into his eBay account for EPN |
| Amazon Associates | Needs tax / phone / 3 sales in 180 days |
| Secrets `EPN_CAMPID`, `AMAZON_TAG` | Not set — affiliate tags stay off until Iz provides |
| Impact / CJ / Awin / Rakuten | Tax + bank; Impact account already exists |
| OAuth app registrations | Shopify, BigCommerce, Square, Wix, Squarespace, Google, Pinterest, Meta, eBay, Etsy — see handoff |
| Chrome Web Store $5 | Needed to publish extension |
| Play / Apple developer accounts | Apps later |

Affiliate plan (all sites): nexus-ai-suite `AFFILIATES-PLAN-2026-10-14.md` (copied from box `/workspace/affiliates/PLAN.md`).

---

## How to work day-to-day

```bash
cd ~/fashionistas-ai
git checkout seller-ux          # Sprint 1 remaining
# ... code + tests ...
npm test
DEPLOY_BRANCH=seller-ux ALLOW_BRANCH=seller-ux scripts/deploy-local.sh
# screenshots → update docs/AGENT_HANDOFF.md → update nexus handoff → push nexus
```

When Iz says **ship it** for seller-ux:

```bash
git checkout main
git merge seller-ux             # only after explicit ship-it
scripts/deploy-local.sh         # production
# verify version.txt == HEAD; update handoffs
```

For Sprint 2+: new branch from post-ship main, same preview discipline.

---

## Where screenshots / QA live

Box (shared): `/workspace/fash-ship-qa/seller-ux/` (PROGRESS.md, fix1–4, e2e).  
Extension unzip / load: `~/fashionistas-ai/extension` or `dist/fashionistas-crosslister-0.2.0.zip` (preview) / `0.1.0.zip` (prod).

---

## Coordination

- Chief of Staff = shipping decisions, Iz accounts, cross-site priority, affiliate signups that need tax/SSN.
- OpenCode = code, tests, previews, selector fixes, delist, buyer UX, SEO grind.
- After every step: update handoffs and push nexus. Short blunt status.

## 2026-10-14 · rebuild v2.1 editorial layer (preview only — NOT on prod)
Preview: https://rebuild.fashionistas-ai.pages.dev (branch `rebuild`). Prod untouched; ships only on Iz's "ship it".
- Brand header: gradient F-mark SVG + "fashionistas.ai" wordmark (app.js `LOGO`/`BRAND`, boot skeleton in index.html).
- Home (`/` with no search/filter): full-bleed hero (CC0 StockSnap image, self-hosted AVIF/WebP in `assets/ed/`, credited at `/credits/`), kinetic headline (mask reveal + rotating gradient word), category image cards (Women, Men, Shoes, Bags, Vintage, Streetwear, Designer), Fresh drops grid, Try-on feature card (scan + sparkle), Shop-by-brand rail (real feed brands link `/shop/b/…`, others `/?q=`), Sell-in-30s card, marketplace logo marquee.
- Cards: rounded image-first, like heart (localStorage `fa_likes`, pulse animation), shimmer skeletons, staggered rise, scroll reveal (`.rv` → `.shown`; NOTE `.in` is the input class — don't reuse it).
- Feed-quality filter `feedOK()` in app.js: hides e2e/test, junk/non-clothing (coffee, Keurig, cup lid…), Home/Art, no-photo, no-category. Nothing deleted; direct item links still work. Sweep mirrors the same regex.
- Gallery: new Pages function `GET /api/listing-photos/:id` (public, allowlisted in tests/api-auth-matrix with reason) returns stored photo URLs; item page adds them + counter. Public `/api/market` only has `photo_url`.
- Edit listing: `/you/item/:id/edit` (PUT /api/listings/:id) + "Edit listing" button on manage screen.
- Sell intro (animated camera + steps), Posted celebration (confetti + drawn checkmark, staggered marketplace tiles), You dashboard gradient stat cards with count-up (real numbers only), bottom-nav gradient indicator, glass header, page transitions. All CSS; `prefers-reduced-motion` disables motion.
- Pinned demo items for Iz's try-on testing — never delete: **209** "Light Wash Denim Trucker Jacket" (iz_test_seller, no brand claimed — no label visible) and **148** "Blue Versace Polo Shirt" (demo). e2e `PINNED` guards cleanup + asserts both survive.
- Tests (412x915): e2e/rebuild.spec.js 32/32 light + 32/32 dark (adds S12 edit, B14 junk hidden, B15 like, P1–P3 pinned/try-on); e2e/sweep.spec.js 19/19. LCP 2.1s (1.6 Mbps, 150ms RTT, 4x CPU).
- QA artifacts on the box: /workspace/fash-ship-qa/rebuild-v2/ (screens, run-light/, run-dark/, sweep/, home-animation.mp4).
- Open: SSR SEO lists in functions/shop still include junk titles (feed filter is client-side); listings table extra-photo column unknown (D1 token lacks D1 read) — gallery endpoint tolerates any of photos/images/image_urls/…; Home/Art departments hidden from the public feed.
- Demo try-on items (preview): https://rebuild.fashionistas-ai.pages.dev/shop/209 (denim jacket) · https://rebuild.fashionistas-ai.pages.dev/shop/148 (Versace polo). Both are in the shared D1 so they also show on prod's feed.
- State 20:06 ET: DONE = everything above, all deployed to the rebuild preview, tests 32/32 light, 32/32 dark, sweep 19/19. IN PROGRESS = final self-critique polish pass. NEXT = Iz reviews the preview and says "ship it" -> merge rebuild to main and deploy prod; SSR junk filter in functions/shop; confirm the D1 photos column.
