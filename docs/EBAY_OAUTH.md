# eBay OAuth setup (fashionistas.ai)

**Bring-your-own keys (v1) + optional Cloudflare env.** We never invent Client ID / Secret values. Paste multilist keeps working without OAuth.

## Honest product copy

- fashionistas.ai provides a **free guide** to connect your own eBay developer app.
- **We do not create eBay seller or developer accounts for you.**
- **Connect OAuth** opens eBay’s own login / consent page in your browser.
- After a successful token exchange, Multilist shows eBay as **Connected** (local flag + HttpOnly token cookie). **Listing create via API is not shipped yet** — you still paste drafts until that follow-up lands.

## What the UI does today

- Multilist → **Connect + paste** → **Connect eBay** opens a guidance panel:
  1. Create an eBay developer app at [developer.ebay.com](https://developer.ebay.com/)
  2. Register RuName / redirect URI exactly: `https://fashionistas.ai/api/ebay/oauth/callback`
  3. Paste **Client ID** + **Client Secret** into the form → **Save keys** (this browser only)
  4. **Connect OAuth** → `POST /api/ebay/oauth/start` with those keys → browser goes to eBay
  5. On return, callback **exchanges the code for tokens** and redirects `?ebay_oauth=ok` → UI sets Connected
- Hive coach checklist in the panel (static Replit-style steps — not a full LLM).

## Bring-your-own keys (preferred v1)

| Where | What |
|-------|------|
| Browser `localStorage` key `fash_ebay_keys_v1` | Base64 JSON stub of `{ clientId, clientSecret, redirectUri, env }` — **not strong encryption**; do not use a shared computer for production secrets |
| `POST /api/ebay/oauth/start` body | `{ "clientId", "clientSecret", "redirectUri", "env" }` |
| Or headers | `Authorization: EbayKeys <base64url(json)>` · `X-Ebay-Client-Id` · `X-Ebay-Client-Secret` · `X-Ebay-Redirect-Uri` · `X-Ebay-Env` |
| Short-lived cookie `ebay_byo_sess` | Set by `start` when BYO secret is present; `HttpOnly`, `Path=/api/ebay/oauth`, ~10 minutes — so `callback` can resolve the same keys after eBay redirects. Cleared after callback. **Never logged.** |
| Token cookie `ebay_oauth_tok` | Set by `callback` after successful exchange; `HttpOnly`, `Path=/api/ebay`, holds access/refresh for future listing-create. **Never logged.** |

Credential resolution: **request BYO first**, then Cloudflare env (start). Callback: **BYO cookie first**, then env.

There is **no** durable per-user key API on `fashionistas-api` yet. Prefer storing encrypted keys / tokens there when that lands.

## Optional Cloudflare secrets / vars

| Name | Where | Purpose |
|------|--------|---------|
| `EBAY_CLIENT_ID` | Secret | eBay Developer App Client ID (Production or Sandbox) |
| `EBAY_CLIENT_SECRET` | Secret | eBay Developer App Client Secret |
| `EBAY_RU_NAME` | Var or Secret | RuName registered in eBay |
| `EBAY_ENV` | Var | `sandbox` or `production` |
| `EBAY_REDIRECT_URI` | Var | Exact redirect URI / RuName used in authorize + token exchange |

```bash
npx wrangler pages secret put EBAY_CLIENT_ID --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_CLIENT_SECRET --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_RU_NAME --project-name=fashionistas-ai
```

Never commit real Client ID/Secret. `.env.example` is a checklist only.

## eBay Developer Portal checklist

1. Create / open an app at [developer.ebay.com](https://developer.ebay.com/).
2. Enable **OAuth** (start with **Sandbox**).
3. Create / configure a **RuName** whose Accept URL (redirect) is exactly:
   `https://fashionistas.ai/api/ebay/oauth/callback`
4. Copy **App ID (Client ID)** and **Cert ID (Client Secret)**.
5. In Multilist → Connect eBay → paste both → **Save keys** → **Connect OAuth**.
6. Complete login on eBay’s site. Callback exchanges the code; UI shows **Connected**.

## Pages Functions

- `GET|POST /api/ebay/oauth/start` → `functions/api/ebay/oauth/start.js`
- `GET /api/ebay/oauth/callback` → `functions/api/ebay/oauth/callback.js`

If Client ID or redirect is missing on start → **501** JSON with `nextStep` and `missing` (no fake authorize URL).

Flow:

1. `start` builds authorize URL (`client_id`, `redirect_uri` / RuName, `response_type=code`, `scope`, `state`).
2. User approves on eBay; eBay hits `callback?code=…&state=…`.
3. `callback` resolves secrets from BYO cookie or env → **POST** to
   `https://api.sandbox.ebay.com/identity/v1/oauth2/token` (or production host) with
   `grant_type=authorization_code`, Basic auth, and the same `redirect_uri` / RuName.
4. On success → set `ebay_oauth_tok` cookie → redirect `/?ebay_oauth=ok` (client sets Connected).
5. On failure → `/?ebay_oauth=error&ebay_error=…`.

## What is done / not done

| Done | Not yet |
|------|---------|
| Authorize URL with BYO or env keys | Inventory / Offer / listing-create Inventory API |
| Authorization-code **token exchange** | Durable per-user token store on fashionistas-api (KV/D1) |
| Connected local state + HttpOnly token cookie | Auto-post to eBay from Multilist |
| Paste multilist without OAuth | Full sell scopes beyond default `api_scope` (expand when listing-create ships) |

## Follow-up (listing create)

Wire `POST /api/ebay/listing` (or fashionistas-api) that reads `ebay_oauth_tok` (or worker storage), refreshes if needed, and creates a draft via eBay Sell Inventory. Until then: **Connected ≠ auto-post**.
