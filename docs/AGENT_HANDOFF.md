# Agent handoff — fashionistas.ai

**Audience:** Other agents continuing product / deploy / Connect / UX work  
**Session covered:** 2026-09-26 (America/New_York)  
**Repo:** [placebetsai/fashionistas-ai](https://github.com/placebetsai/fashionistas-ai)  
**Handoff written:** 2026-09-26 late ET (pushed after PR #4 merge)

Read this before changing live Pages, inventing marketplace credentials, or assuming GitHub `main` equals production.

---

## 1. Product (what it is)

| Item | Truth |
|------|--------|
| **Product** | Multilist **AI listing drafts** — photo → ID / price / fee take-home → **paste-ready** text kits |
| **Shops (6)** | Depop, eBay, Poshmark, Mercari, Vinted, Grailed |
| **Auto-post** | **No.** Users copy drafts and paste into each shop themselves (until real Connect/OAuth/extension lands) |
| **API** | `https://fashionistas-api.fashionistas1979.workers.dev` (health ≈ `{"ok":true,"version":"3.1.0"}`) |
| **Pages project** | `fashionistas-ai` |
| **Domain** | `https://fashionistas.ai` |
| **Deploy** | **`npx wrangler pages deploy . --project-name=fashionistas-ai`** — **not** GitHub Actions. Cloudflare Pages **Git Provider: No**. |

```bash
# From repo root (static site + functions/)
npx wrangler pages deploy . --project-name=fashionistas-ai
# Track what is actually live:
npx wrangler pages deployment list --project-name=fashionistas-ai
```

Package script: `"deploy": "npx wrangler pages deploy . --project-name=fashionistas-ai"`.

---

## 2. UX Research audit → P0 ship (PASS 29/29)

**Audit (box):** `/workspace/tnr/audits/FASHIONISTAS-UX-AUDIT-2026-09-26.md`  
**Date:** 2026-09-26 ET · Auditor: UX Research  
**Re-verify:** ~19:31 ET — **PASS 29/29** against main `a3c6832` / Pages `fashionistas-ai`

### Shipped (PR #1 → merge `a3c6832` / commit `89d1bd7`)

| P0 | Live result |
|----|-------------|
| **Contact** | Static `/contact/` — FormSubmit → `fashionistas1979@gmail.com`, honeypot `_honey`, unique title (not SPA). Delivery address is the FormSubmit action target; do not invent other backends. |
| **About / Privacy** | Static `/about/`, `/privacy/` ownership pages + footer links |
| **ads.txt** | Plain-text **comment-only** placeholder — **no invented** AdSense `pub-id`, no `adsbygoogle` on content pages. `_headers` forces correct Content-Type. |
| **Fees calculator** | Indexable `/fees/` take-home for all 6 marketplaces |
| **Sitemap cleanup** | In: `/`, `/fees/`, `/contact/`, `/about/`, `/privacy/`, `/app/`. Out: thin `/blog`, `/ar-tryon` |

**Follow (not fail):** FormSubmit activation email on **first real submit**; replace ads.txt with real `google.com, pub-…` lines **only after** a real AdSense pub-id exists.

---

## 3. App UX audit — Mixed

**Audit (box):** `/workspace/tnr/audits/FASHIONISTAS-APP-UX-AUDIT-2026-09-26.md`  
**Verdict:** **Mixed** — fee take-home + paste-honest multilist sheets are strong; trust/path issues remain.

### Critical findings (still open unless later fixed)

| Issue | Detail |
|-------|--------|
| **Honesty drift** | Landing still sounds like “Publish everywhere / Send it everywhere” while product is paste-only |
| **Manifest** | Claims **24 marketplaces** + “AI sells” — product is **6** draft targets + you post yourself |
| **Shop QA junk** | Public `/api/market` ~74 items, many QA/test titles, most without photos, platform id bloat |
| **Generic `xlKit`** | One shared title/bits/price/description block; not truly per-shop tuned |
| **Sample jacket broken** | `sample-jacket.jpg` returns SPA HTML, not an image |
| **Multilist not a tab** | Tabbar: Home · Shop · My clothes · Photo · Sell · Map · More — Multilist (`xl`) only via Home CTA / listing flow |

Top recs from that audit: fix honesty/manifest; put Multilist on primary nav; real per-shop kits; clean Shop; own `/fees/` as acquisition wedge + fix sample image.

---

## 4. Deploy truth (critical for agents)

### Model

- **Source of truth for live HTML:** Cloudflare Pages deployment list, **not** GitHub alone.
- Laptop (and agents) often **`wrangler pages deploy`** builds whose **Source** commit is **not on GitHub**.
- Pages project has **Git Provider: No** — pushes to `main` do **not** auto-deploy.

### Example MISSING-from-GitHub sources (seen 2026-09-26)

| CF deployment id (prefix) | Source SHA (as reported by wrangler) | In GitHub? |
|---------------------------|--------------------------------------|------------|
| `6e701489-…` | `60f5501` | **MISSING** |
| several older | `0584633`, `0b186a6`, `f2c02fa`, … | **MISSING** |

Always run:

```bash
npx wrangler pages deployment list --project-name=fashionistas-ai
git cat-file -t <source_sha>   # fatal = laptop-only / not in this clone
```

### Latest known CF Production deploys (session end / shortly after PR #4)

| Deployment | Source | Notes |
|------------|--------|--------|
| **`e70a332e-4629-45b1-bb3d-0210a00018d3`** | `ddbec4a` (PR #4 merge) | Preview: https://e70a332e.fashionistas-ai.pages.dev — **latest known GitHub-aligned prod** at handoff time |
| `8eba35ea-…` | `01a11be` (PR #3 merge) | eBay BYO + guidance |
| `9206ee76-…` | `9ff0a63` (PR #2 merge) | Connect stubs |
| `c257ca32-…` / `afd70bd2-…` | `89d1bd7` | UX P0 static pages |

**Rule:** Do **not** clobber unknown laptop-only CF builds without comparing `deployment list` Source SHAs to `git`. Prefer merge + explicit wrangler deploy of a known Git SHA.

---

## 5. Connect work (PRs #2–#4)

| PR | Title | Merge SHA | What landed |
|----|-------|-----------|-------------|
| [#1](https://github.com/placebetsai/fashionistas-ai/pull/1) | UX P0 contact/ads/fees | `a3c6832` ← `89d1bd7` | Static trust + SEO pages |
| [#2](https://github.com/placebetsai/fashionistas-ai/pull/2) | Multilist Connect UI + eBay OAuth stubs | `9ff0a63` ← `c8f84da` | Connect card; Pages Functions stubs |
| [#3](https://github.com/placebetsai/fashionistas-ai/pull/3) | eBay guidance + BYO OAuth keys | `01a11be` ← `9db613d` | Guidance panel; BYO keys; start accepts body/headers |
| [#4](https://github.com/placebetsai/fashionistas-ai/pull/4) | Connect guidance for all six shops | `ddbec4a` ← `a79d7f0` | Depop/Poshmark/Mercari/Vinted/Grailed panels |

**GitHub `main` HEAD at handoff write:** `ddbec4afe0193e4ad04c6657743bc0e2c20d2234`

### OAuth / storage details

| Piece | Detail |
|-------|--------|
| **Routes** | `functions/api/ebay/oauth/start.js`, `functions/api/ebay/oauth/callback.js` |
| **Redirect / RuName** | `https://fashionistas.ai/api/ebay/oauth/callback` |
| **BYO storage** | Browser `localStorage` key **`fash_ebay_keys_v1`** (base64 JSON stub — not strong encryption) |
| **Connect status (local)** | `localStorage` key **`fash_connect_v1`** |
| **Callback stub** | Redirects with `ebay_error=token_exchange_not_implemented_see_docs_EBAY_OAUTH` until token exchange + durable storage on API/KV/D1 |
| **Depop / Poshmark / Mercari / Vinted / Grailed** | **Guide-only** panels (signup + create-listing deep links + optional “I've connected”). No invented API keys/passwords. |

Docs in-repo:

- [`docs/EBAY_OAUTH.md`](./EBAY_OAUTH.md)
- [`docs/MULTILIST_CONNECT.md`](./MULTILIST_CONNECT.md)

---

## 6. What works / what doesn’t

| Capability | Status |
|------------|--------|
| Paste multilist drafts (6 shops) | **YES** |
| Fee estimate / compare / `/fees/` | **YES** |
| Photo → AI analyze → listing form | **YES** (API live) |
| Auto-post to marketplaces | **NO** |
| eBay OAuth authorize URL with BYO (or CF) keys | **Opens** (when keys present) |
| eBay **token exchange** + stored tokens + listing create | **Incomplete** (`token_exchange_not_implemented…`) |
| Fake auto-signup / invented pub-ids / invented shop API keys | **Must never** |

---

## 7. Secrets

| Secret / var | Where | Notes |
|--------------|--------|--------|
| `EBAY_CLIENT_ID` | Cloudflare Pages secret **or** BYO in UI | Prefer BYO v1 |
| `EBAY_CLIENT_SECRET` | CF secret **or** BYO | Never commit |
| `EBAY_RU_NAME` | CF var/secret | Must match eBay RuName |
| `EBAY_ENV` | CF var | `sandbox` \| `production` |
| `EBAY_REDIRECT_URI` | CF var | Exact callback URL above |
| Contact delivery | FormSubmit → `fashionistas1979@gmail.com` | Confirm activation on first real submit |

Checklist only: [`.env.example`](../.env.example) — do not put real secrets in git.

```bash
npx wrangler pages secret put EBAY_CLIENT_ID --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_CLIENT_SECRET --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_RU_NAME --project-name=fashionistas-ai
```

---

## 8. Next recommended (priority order)

1. **Finish eBay token exchange** in `callback` + durable token storage (prefer `fashionistas-api` / KV/D1) + **listing create** API path.
2. **Browser extension** (or equivalent) for guided post on Depop / Poshmark / Mercari / Vinted / Grailed — still no password harvesting or fake auto-accounts.
3. **Hive LLM coach** (today: static checklist only in Connect panels).
4. **Clean Shop** feed (hide QA/bulk/no-photo; normalize platforms to the six).
5. **Honesty copy** — landing / step 03 / manifest: paste / 6 shops / you post yourself.
6. **Per-shop kits** beyond generic `xlKit` (tags, item-specifics hints, sizing, etc.).
7. Fix **`sample-jacket.jpg`**; consider Multilist as a primary tab; demote Map/Shop vs photo→draft job.

---

## 9. Key URLs & SHAs

### Live

| URL | Purpose |
|-----|---------|
| https://fashionistas.ai/ | Marketing + SPA shell |
| https://fashionistas.ai/app/ | Same SPA family (no real pathname router) |
| https://fashionistas.ai/fees/ | Fee take-home calculator |
| https://fashionistas.ai/contact/ | FormSubmit contact |
| https://fashionistas.ai/about/ | Ownership / honest product |
| https://fashionistas.ai/privacy/ | Privacy |
| https://fashionistas.ai/ads.txt | Comment-only ads.txt |
| https://fashionistas.ai/manifest.webmanifest | PWA manifest (still overclaims — see audit) |
| https://fashionistas-api.fashionistas1979.workers.dev/api/health | API health |
| https://fashionistas-api.fashionistas1979.workers.dev/api/market | Public shop feed |

### Git (known)

| Ref | SHA |
|-----|-----|
| main @ handoff (PR #4 merge) | `ddbec4afe0193e4ad04c6657743bc0e2c20d2234` |
| PR #3 merge | `01a11be54f0887e79f8734c8721ed3ca02ee3c52` |
| PR #2 merge | `9ff0a638eb376292a2eb1dde3d6096a9e9ad5c6f` |
| PR #1 merge | `a3c683215b7632e352d13bf2551faab26d0a0b10` |
| UX P0 content | `89d1bd7df5b60e6c93945d472b41678c10a3acbe` |

### CF (known)

| Id | Source |
|----|--------|
| `e70a332e-4629-45b1-bb3d-0210a00018d3` | `ddbec4a` |
| (historical laptop-only example) `6e701489-…` | `60f5501` **not in GitHub** |

### Audits (local box paths — not necessarily in this git repo)

- `/workspace/tnr/audits/FASHIONISTAS-UX-AUDIT-2026-09-26.md`
- `/workspace/tnr/audits/FASHIONISTAS-APP-UX-AUDIT-2026-09-26.md`

---

## 10. Rules for agents

1. **No fake auto-signup accounts** for any marketplace. Guide + real vendor signup URLs only.
2. **No invented AdSense pub-ids**, Client IDs, Secrets, or shop API keys. 501 + `nextStep` is correct when missing.
3. **Deploy with wrangler** to project `fashionistas-ai`. Do not assume GitHub push deploys (Git Provider: No). Do not introduce Vercel.
4. **Before overwriting production:** run `wrangler pages deployment list --project-name=fashionistas-ai` and compare Source SHAs to git. Laptop-only SHAs (`60f5501`, etc.) may still be in CF history — don’t clobber blindly.
5. **Paste multilist must keep working** while Connect/OAuth is incomplete.
6. **Honest copy:** never claim auto-post / “sells on N marketplaces” beyond what is shipped.
7. Prefer PRs for non-trivial Connect/API work; doc-only changes may go straight to `main` then optional wrangler deploy.
8. Contact delivery stays FormSubmit → `fashionistas1979@gmail.com` until an explicit migration (e.g. Web3Forms) is requested and verified.

---

## Quick start for the next agent

```bash
git clone https://github.com/placebetsai/fashionistas-ai.git
cd fashionistas-ai
git pull origin main
# Read this file + docs/EBAY_OAUTH.md + docs/MULTILIST_CONNECT.md
npx wrangler pages deployment list --project-name=fashionistas-ai
# Implement eBay token exchange + storage; or honesty/manifest/Shop cleanup
# Deploy only when intentional:
# npx wrangler pages deploy . --project-name=fashionistas-ai
```

**End of handoff (2026-09-26 ET session).**
