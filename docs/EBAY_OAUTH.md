# eBay OAuth setup (fashionistas.ai)

Scaffold only. **Do not invent Client ID / Secret values.** Paste multilist keeps working without OAuth.

## What the UI does today

- Multilist → **Connect your shops** shows six shops (Depop, eBay, Poshmark, Mercari, Vinted, Grailed).
- States: **Connected** / **Needs account**.
- Honest copy: the app only *posts* when Connected; until then users copy-paste drafts or open **Guide A to Z**.
- **Connect eBay** calls `GET /api/ebay/oauth/start` on the Pages project. Until secrets exist, that route returns JSON explaining what is missing (no fake authorize URL).

## Required Cloudflare secrets / vars

Set these on the **fashionistas-ai** Pages project (and/or the API Worker `fashionistas-api` if OAuth moves there):

| Name | Where | Purpose |
|------|--------|---------|
| `EBAY_CLIENT_ID` | Secret | eBay Developer App Client ID (Production or Sandbox) |
| `EBAY_CLIENT_SECRET` | Secret | eBay Developer App Client Secret |
| `EBAY_RU_NAME` | Var or Secret | RuName (Accept / Decline / Privacy URLs registered in eBay) |
| `EBAY_ENV` | Var | `sandbox` or `production` (default behavior if unset: treat as unset / not configured) |
| `EBAY_REDIRECT_URI` | Var | Exact redirect URI registered with eBay, e.g. `https://fashionistas.ai/api/ebay/oauth/callback` |

Optional later (token storage on the API Worker):

| Name | Purpose |
|------|---------|
| `EBAY_TOKEN_KV` / D1 binding | Persist refresh/access tokens per user |
| Session / JWT secret already used by `fashionistas-api` | Bind OAuth to the signed-in seller |

### How to set (Wrangler / dashboard)

```bash
# Pages project secrets (run where you already deploy fashionistas-ai)
npx wrangler pages secret put EBAY_CLIENT_ID --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_CLIENT_SECRET --project-name=fashionistas-ai
npx wrangler pages secret put EBAY_RU_NAME --project-name=fashionistas-ai

# Non-secret vars: Cloudflare Dashboard → Workers & Pages → fashionistas-ai → Settings → Environment variables
# EBAY_ENV=sandbox
# EBAY_REDIRECT_URI=https://fashionistas.ai/api/ebay/oauth/callback
```

Never commit real Client ID/Secret. Use `.env.example` locally only as a checklist.

## eBay Developer Portal checklist

1. Create / open an app at [developer.ebay.com](https://developer.ebay.com/).
2. Enable **OAuth** for the environments you need (Sandbox first).
3. Register RuName + redirect URI matching `EBAY_REDIRECT_URI` exactly.
4. Scopes typically needed later for listing (confirm current eBay docs): sell inventory / account scopes — **do not enable until keys exist and legal use is clear**.
5. Put Client ID + Secret into Cloudflare secrets above.
6. Hit Multilist → **Connect eBay**; `/api/ebay/oauth/start` should then return `{ authorizeUrl }` and the browser redirects to eBay.

## Callback / Worker notes

Pages Functions in this repo (stubs):

- `GET /api/ebay/oauth/start` → `functions/api/ebay/oauth/start.js`
- `GET /api/ebay/oauth/callback` → `functions/api/ebay/oauth/callback.js`

Flow once secrets exist:

1. `start` builds the eBay authorize URL (`client_id`, `redirect_uri` / RuName, `response_type=code`, `scope`, `state`).
2. User approves on eBay; eBay hits `callback?code=…&state=…`.
3. `callback` exchanges `code` for tokens (server-side, using `EBAY_CLIENT_SECRET`), stores tokens on the API Worker / KV, then redirects to `https://fashionistas.ai/?ebay_oauth=ok` (front-end sets local **Connected** for eBay).
4. On failure redirect `?ebay_oauth=error&ebay_error=…`.

**API Worker** (`https://fashionistas-api.fashionistas1979.workers.dev`) remains the source of truth for listings. Prefer moving token exchange + storage there when ready so secrets never sit only on the static Pages edge. Until then these Pages stubs are the documented scaffold path.

## What is intentionally not done

- No invented eBay credentials or authorize URLs.
- No auto-post to eBay (or other shops) from this PR.
- Depop / Poshmark / Mercari / Vinted / Grailed stay guide + paste (+ optional local “Mark connected” for UI demos).
