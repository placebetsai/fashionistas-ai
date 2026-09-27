# Agent handoff — fashionistas.ai

**Audience:** Other agents continuing product / deploy / Connect / Multilist UX work  
**Session covered:** 2026-09-26 full day → **night ET** (through ~23:42 EDT / early 2026-09-27 UTC)  
**Repo:** [placebetsai/fashionistas-ai](https://github.com/placebetsai/fashionistas-ai)  
**Handoff refreshed:** 2026-09-26 night ET — complete record through PR #7 (open) + equal-UX demand in flight  

Read this before changing live Pages, inventing marketplace credentials, merging eBay-centric UX, or assuming GitHub `main` equals production.

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
| **Fees calculator** | Indexable `/fees/` take-home for all 6 marketplaces | #1 |
| **Sitemap** | In: `/`, `/fees/`, `/contact/`, `/about/`, `/privacy/`, `/app/`. Out: thin `/blog`, `/ar-tryon` | #1 |

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
| Equal Multilist UX (not eBay-centric) | **Shipped** Multilist UX (see §6) — deploy this session |

---

## 3. Contact / fees / ads.txt / about / privacy

All live on fashionistas.ai (wrangler → `fashionistas-ai`):

| URL | Notes |
|-----|--------|
| https://fashionistas.ai/contact/ | FormSubmit → `fashionistas1979@gmail.com` |
| https://fashionistas.ai/fees/ | 6-shop take-home calculator |
| https://fashionistas.ai/ads.txt | Comment-only; no pub-id |
| https://fashionistas.ai/about/ | Honest product (not auto-poster) |
| https://fashionistas.ai/privacy/ | Privacy |

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
| **Branch `feat/multilist-all-shops-first-class`** | **Shipped locally + wrangler deploy** — Snap→kit→post; equal Copy/Open/Guide CTAs; eBay Create optional soft only. |
| **Equal-UX WIP** | **Done this session** — Multilist empty path + Connect card + coach plural marketplaces; eBay not product hero. |
| **Merged equal-UX PR** | **Pending push/PR** after deploy verify |

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
| Fee estimate / compare / `/fees/` | **YES** |
| Photo → AI analyze → listing form | **YES** (API live) |
| Contact / about / privacy / ads.txt placeholder | **YES** |
| Honesty copy + Multilist tab + sample jacket | **YES** (PR #5) |
| Shop client hide QA/no-photo | **YES** (client); API feed still dirty |
| Auto-post Depop / Poshmark / Mercari / Vinted / Grailed | **NO** (guide + paste only) |
| eBay OAuth authorize + token exchange | **YES** (BYO or CF env keys) |
| eBay Create / `POST /api/ebay/listing` | **YES path** — needs token + sell scopes + **business policies** |
| Durable refresh on fashionistas-api KV | **NOT yet** (cookie best-effort) |
| Equal Multilist UX (all shops first-class) | **SHIPPED** `c9490e3` — wrangler deploy this session; see §6 |
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

1. **Push/PR equal Multilist UX** — `feat/multilist-all-shops-first-class` deployed; open PR, merge, keep wrangler as source of truth. Close or supersede PR #7 eBay-centric walkthrough.  
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
| https://fashionistas.ai/fees/ | Fee take-home |
| https://fashionistas.ai/contact/ | FormSubmit contact |
| https://fashionistas.ai/about/ | Ownership / honesty |
| https://fashionistas.ai/privacy/ | Privacy |
| https://fashionistas.ai/ads.txt | Placeholder ads.txt |
| https://fashionistas-api.fashionistas1979.workers.dev/api/health | API health |
| https://075ef679.fashionistas-ai.pages.dev | Latest known CF prod (PR #7 source `125816d`) |

**End of handoff — 2026-09-26 night ET (equal Multilist UX shipped: all shops first-class; eBay Create optional).**
