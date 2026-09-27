# eBay OAuth setup (fashionistas.ai)

**Bring-your-own keys (v1) + optional Cloudflare env.** We never invent Client ID / Secret values. Paste multilist keeps working without OAuth.

## Honest product copy

- fashionistas.ai provides a **free guide** to connect your own eBay developer app.
- **We do not create eBay seller or developer accounts for you.**
- **Connect OAuth** opens eBay’s own login / consent page in your browser.
- Until a shop shows **Connected** with real tokens stored server-side, you still copy-paste drafts.

## What the UI does today

- Multilist → **Connect your shops** → **Connect eBay** opens a guidance panel:
  1. Create an eBay developer app at [developer.ebay.com](https://developer.ebay.com/)
  2. Register RuName / redirect URI exactly: `https://fashionistas.ai/api/ebay/oauth/callback`
  3. Paste **Client ID** + **Client Secret** into the form → **Save keys** (this browser only)
  4. **Connect OAuth** → `POST /api/ebay/oauth/start` with those keys → browser goes to eBay
- Hive coach checklist in the panel (static Replit-style steps — not a full LLM).

## Bring-your-own keys (preferred v1)

| Where | What |
|-------|------|
| Browser `localStorage` key `fash_ebay_keys_v1` | Base64 JSON stub of `{ clientId, clientSecret, redirectUri, env }` — **not strong encryption**; do not use a shared computer for production secrets |
| `POST /api/ebay/oauth/start` body | `{ "clientId", "clientSecret", "redirectUri", "env" }` |
| Or headers | `Authorization: EbayKeys <base64url(json)>` · `X-Ebay-Client-Id` · `X-Ebay-Client-Secret` · `X-Ebay-Redirect-Uri` · `X-Ebay-Env` |
| Short-lived cookie `ebay_byo_sess` | Set by `start` when BYO secret is present; `HttpOnly`, `Path=/api/ebay/oauth`, ~10 minutes — so `callback` can resolve the same keys after eBay redirects. Cleared after callback. **Never logged.** |

Credential resolution on the Pages Function: **request BYO first**, then Cloudflare env.

There is **no** durable per-user key API on `fashionistas-api` yet. When that lands, prefer storing encrypted keys / tokens there instead of `localStorage`.

## Optional Cloudflare secrets / vars

Set these on the **fashionistas-ai** Pages project when you want a shared app-level connect (no BYO paste):

| Name | Where | Purpose |
|------|--------|---------|
| `EBAY_CLIENT_ID` | Secret | eBay Developer App Client ID (Production or Sandbox) |
| `EBAY_CLIENT_SECRET` | Secret | eBay Developer App Client Secret |
| `EBAY_RU_NAME` | Var or Secret | RuName registered in eBay |
| `EBAY_ENV` | Var | `sandbox` or `production` |
| `EBAY_REDIRECT_URI` | Var | Exact redirect URI, e.g. `https://fashionistas.ai/api/ebay/oauth/callback` |

```bash
npx wrangler pages secret put EBAY_CLIENT_ID --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_CLIENT_SECRET --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_RU_NAME --project-name=fashionistas-ai
# Dashboard vars: EBAY_ENV, EBAY_REDIRECT_URI
```

Never commit real Client ID/Secret. `.env.example` is a checklist only.

## eBay Developer Portal checklist (what you must do)

1. Create / open an app at [developer.ebay.com](https://developer.ebay.com/).
2. Enable **OAuth** (start with **Sandbox**).
3. Create / configure a **RuName** whose Accept URL (redirect) is exactly:
   `https://fashionistas.ai/api/ebay/oauth/callback`
4. Copy **App ID (Client ID)** and **Cert ID (Client Secret)**.
5. In Multilist → Connect eBay → paste both → **Save keys** → **Connect OAuth**.
6. Complete login on eBay’s site. Callback token exchange + durable storage is still scaffolded (see below).

## Pages Functions

- `GET|POST /api/ebay/oauth/start` → `functions/api/ebay/oauth/start.js`
- `GET /api/ebay/oauth/callback` → `functions/api/ebay/oauth/callback.js`

If Client ID or redirect is missing → **501** JSON with `nextStep` and `missing` (no fake authorize URL).

Flow:

1. `start` builds authorize URL (`client_id`, `redirect_uri` / RuName, `response_type=code`, `scope`, `state`).
2. User approves on eBay; eBay hits `callback?code=…&state=…`.
3. `callback` resolves secrets from env or BYO cookie; **token exchange + storage still stubbed** → redirects `?ebay_oauth=error&ebay_error=token_exchange_not_implemented_see_docs_EBAY_OAUTH` until KV/D1 on `fashionistas-api` is wired.
4. On OAuth provider error → `?ebay_oauth=error&ebay_error=…`.

## What is intentionally not done

- No invented eBay credentials or authorize URLs.
- No auto-post to eBay (or other shops) from this change.
- No full LLM coach (static hive checklist only).
- Depop / Poshmark / Mercari / Vinted / Grailed stay guide + paste (+ optional local “Mark connected”).
