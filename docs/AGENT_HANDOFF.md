# Agent handoff — fashionistas.ai

**Audience:** Other agents continuing product / deploy / Connect / UX work  
**Session covered:** 2026-09-26 → 2026-09-27 early ET (America/New_York)  
**Repo:** [placebetsai/fashionistas-ai](https://github.com/placebetsai/fashionistas-ai)  
**Handoff written:** after feat/ebay-listing-per-shop-kits (eBay listing create + per-shop kits)

Read this before changing live Pages, inventing marketplace credentials, or assuming GitHub `main` equals production.

---

## 1. Product (what it is)

| Item | Truth |
|------|--------|
| **Product** | Multilist **AI listing drafts** — photo → ID / price / fee take-home → **paste-ready per-shop kits** |
| **Shops (6)** | Depop, eBay, Poshmark, Mercari, Vinted, Grailed |
| **Auto-post** | **Mostly no.** Paste kits for all six. **eBay only:** optional API create when OAuth Connected + sell scopes + business policies |
| **API** | `https://fashionistas-api.fashionistas1979.workers.dev` (health ≈ `{"ok":true,"version":"3.1.0"}`) |
| **Pages project** | `fashionistas-ai` |
| **Domain** | `https://fashionistas.ai` |
| **Deploy** | **`npx wrangler pages deploy . --project-name=fashionistas-ai`** — **not** GitHub Actions. Cloudflare Pages **Git Provider: No**. |

```bash
# From repo root (static site + functions/)
npx wrangler pages deploy . --project-name=fashionistas-ai
npx wrangler pages deployment list --project-name=fashionistas-ai
```

Package script: `"deploy": "npx wrangler pages deploy . --project-name=fashionistas-ai"`.

---

## 2. UX Research audit → P0 ship (PASS 29/29)

**Audit (box):** `/workspace/tnr/audits/FASHIONISTAS-UX-AUDIT-2026-09-26.md`  
**Re-verify:** ~19:31 ET 2026-09-26 — **PASS 29/29**

### Shipped (PR #1 → merge `a3c6832` / commit `89d1bd7`)

| P0 | Live result |
|----|-------------|
| **Contact** | Static `/contact/` — FormSubmit → `fashionistas1979@gmail.com` |
| **About / Privacy** | Static `/about/`, `/privacy/` |
| **ads.txt** | Comment-only placeholder — **no invented** AdSense pub-id |
| **Fees calculator** | Indexable `/fees/` for all 6 marketplaces |
| **Sitemap** | `/`, `/fees/`, `/contact/`, `/about/`, `/privacy/`, `/app/` |

**Follow:** FormSubmit activation on first real submit; real AdSense lines **only after** a real pub-id exists.

---

## 3. App UX + Connect + this batch

### P0 trust sprint (PR #5 → `0c4dd7b`)

| Issue | Status |
|-------|--------|
| Honesty drift / manifest | **Fixed** — paste / 6 shops / you post yourself |
| Shop QA junk | **Client filter** |
| Sample jacket | **Fixed** — `sample-jacket.jpg` |
| Multilist tab | **Fixed** — primary tabbar |
| Vinted fee drift | **Fixed** — FEE_TABLE |
| eBay token exchange | **Fixed** — Connected + HttpOnly `ebay_oauth_tok` |

### This batch (feat/ebay-listing-per-shop-kits)

| Item | Status |
|------|--------|
| **Per-shop kits** | **Shipped** — `XL_KIT_RULES` / `xlKit(l, shopId)` for Depop, eBay, Poshmark, Mercari, Vinted, Grailed (title max, tags/hashtags, tone, field hints aligned with `MKT_CARD`) |
| **eBay listing create** | **Shipped path** — `POST /api/ebay/listing` → Sell Inventory `createOrReplaceInventoryItem` → business policies → `createOffer` → optional `publishOffer` |
| **OAuth scopes** | Expanded: `sell.inventory` + `sell.account` (+ readonly). Users who connected earlier **must re-consent** |
| **Refresh token store** | **Best-effort cookie** (`ebay_oauth_tok`, Max-Age ~90d when refresh present). Optional KV put if Pages binding `EBAY_TOKENS` / `FASHIONISTAS_KV` / `TOKENS` exists. **Still need durable store on fashionistas-api KV** |
| **Status probe** | `GET /api/ebay/status` — connected / hasRefresh / env / expired (no secrets) |

---

## 4. Deploy truth (critical)

- **Source of truth for live HTML:** Cloudflare Pages deployment list, **not** GitHub alone.
- Pages **Git Provider: No** — pushes to `main` do **not** auto-deploy.
- Prefer merge + explicit `wrangler pages deploy` of a known Git SHA.
- Historical laptop-only Sources (`60f5501`, etc.) may appear in CF history — don't clobber blindly.

```bash
npx wrangler pages deployment list --project-name=fashionistas-ai
git cat-file -t <source_sha>
```

---

## 5. Connect / OAuth / listing routes

| PR | What |
|----|------|
| #1 | UX P0 static pages |
| #2 | Multilist Connect UI + eBay OAuth stubs |
| #3 | eBay BYO keys + guidance |
| #4 | Connect guidance all six shops |
| #5 | Trust prime-time (honesty, fees, token exchange, Multilist nav) |
| **this** | eBay listing create + per-shop kits + handoff |

### Routes

| Route | File |
|-------|------|
| `GET\|POST /api/ebay/oauth/start` | `functions/api/ebay/oauth/start.js` |
| `GET /api/ebay/oauth/callback` | `functions/api/ebay/oauth/callback.js` |
| `POST /api/ebay/listing` | `functions/api/ebay/listing.js` |
| `GET /api/ebay/status` | `functions/api/ebay/status.js` |

**Redirect / RuName:** `https://fashionistas.ai/api/ebay/oauth/callback`

### Cookies / storage

| Key | Where | Purpose |
|-----|--------|---------|
| `fash_ebay_keys_v1` | localStorage | BYO Client ID/Secret (base64 stub — not strong encryption) |
| `fash_connect_v1` | localStorage | Connect status per shop |
| `ebay_byo_sess` | HttpOnly cookie Path=/api/ebay/oauth | Short-lived BYO for callback (~10 min) |
| `ebay_oauth_tok` | HttpOnly cookie Path=/api/ebay | access + refresh for listing create |

Docs: [`EBAY_OAUTH.md`](./EBAY_OAUTH.md) · [`MULTILIST_CONNECT.md`](./MULTILIST_CONNECT.md)

---

## 6. What works live vs still blocked

| Capability | Status |
|------------|--------|
| Paste multilist drafts (6 shops) | **YES** — now **per-shop kits** |
| Fee estimate / `/fees/` | **YES** |
| Photo → AI analyze → listing form | **YES** (API live) |
| Auto-post Depop / Poshmark / Mercari / Vinted / Grailed | **NO** (guide + paste only) |
| eBay OAuth authorize + token exchange | **YES** (BYO or CF env keys) |
| eBay **Create on eBay** UI + `POST /api/ebay/listing` | **YES path** — succeeds only when token + **sell.inventory** (+ account) scopes + **business policies** exist |
| Sandbox vs production | Prefer **sandbox**; production app scopes or missing policies → clear JSON/UI errors |
| Durable refresh token on fashionistas-api KV | **NOT yet** — cookie best-effort + optional Pages KV binding |
| Fake accounts / invented AdSense | **Must never** |

### Typical listing-create blockers (expected, not bugs)

1. **No token cookie** → `ebay_not_connected` — Connect OAuth first  
2. **Old token without sell scopes** → `insufficient_scope_or_auth` — re-Connect OAuth  
3. **No business policies** → `missing_business_policies` (inventory SKU may still be created) — Seller Hub → enable Business Policies  
4. **Expired access + no Client Secret for refresh** → paste BYO keys again  
5. **Production scope not granted on app** → use Sandbox or enable scopes in developer portal  

---

## 7. Secrets

| Secret / var | Where | Notes |
|--------------|--------|--------|
| `EBAY_CLIENT_ID` | CF secret or BYO | Prefer BYO v1 |
| `EBAY_CLIENT_SECRET` | CF secret or BYO | Needed for exchange + refresh |
| `EBAY_RU_NAME` / `EBAY_REDIRECT_URI` | CF | Must match RuName |
| `EBAY_ENV` | CF var | `sandbox` \| `production` |
| Optional KV binding | Pages | `EBAY_TOKENS` / `FASHIONISTAS_KV` / `TOKENS` — best-effort refresh store |
| Contact | FormSubmit → `fashionistas1979@gmail.com` | |

```bash
npx wrangler pages secret put EBAY_CLIENT_ID --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_CLIENT_SECRET --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_RU_NAME --project-name=fashionistas-ai
```

---

## 8. Next recommended

1. **Durable tokens on fashionistas-api** (KV/D1) keyed by user — replace cookie-only refresh  
2. Wire Pages KV binding if API store not ready  
3. Browser extension for guided paste on non-eBay shops  
4. API-side Shop feed QA filter  
5. Hive LLM coach (today: static checklist)  
6. eBay category taxonomy lookup (replace rough leaf map) + default ingest policies helper  

---

## 9. Rules for agents

1. **No fake auto-signup accounts.** Guide + real vendor URLs only.  
2. **No invented AdSense pub-ids** or shop API keys.  
3. **Deploy with wrangler** to `fashionistas-ai`. Git push ≠ deploy.  
4. Before overwriting production: compare `deployment list` Source SHAs to git.  
5. **Paste multilist must keep working** while Connect/API is partial.  
6. **Honest copy:** never claim auto-post beyond eBay Connected+API path.  
7. Prefer PRs for non-trivial Connect/API work.  

---

## Quick start

```bash
git clone https://github.com/placebetsai/fashionistas-ai.git
cd fashionistas-ai
git pull origin main
# Read this file + docs/EBAY_OAUTH.md + docs/MULTILIST_CONNECT.md
npx wrangler pages deployment list --project-name=fashionistas-ai
npx wrangler pages deploy . --project-name=fashionistas-ai
```

**End of handoff (2026-09-27 ET batch: listing create + per-shop kits).**
