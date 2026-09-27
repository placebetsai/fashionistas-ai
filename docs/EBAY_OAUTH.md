# eBay OAuth + listing create (fashionistas.ai)

**Bring-your-own keys (v1) + optional Cloudflare env.** We never invent Client ID / Secret values. Paste multilist keeps working without OAuth.

## Honest product copy

- fashionistas.ai provides a **free guide** to connect your own eBay developer app.
- **We do not create eBay seller or developer accounts for you.**
- **Connect OAuth** opens eBay’s own login / consent page (requests **sell.inventory** + **sell.account** scopes).
- After Connected: Multilist can call **Create on eBay** → `POST /api/ebay/listing` (Inventory + Offer). Prefer **Sandbox** until production scopes/policies work.
- **Connected ≠ guaranteed publish.** Missing scopes or business policies return clear errors; paste kit always works.

## Flow

1. Multilist → **Connect eBay** → create app at [developer.ebay.com](https://developer.ebay.com/)
2. RuName / redirect exactly: `https://fashionistas.ai/api/ebay/oauth/callback`
3. Paste **Client ID** + **Secret** → **Save keys** (browser `localStorage` `fash_ebay_keys_v1`)
4. **Connect OAuth** → `POST /api/ebay/oauth/start` → eBay consent (inventory + account scopes)
5. Callback exchanges code → HttpOnly `ebay_oauth_tok` → `?ebay_oauth=ok` → UI Connected
6. Multilist kit sheet → **Create on eBay** → `POST /api/ebay/listing` (credentials: same-origin cookie)

## Scopes requested

```
https://api.ebay.com/oauth/api_scope
https://api.ebay.com/oauth/api_scope/sell.inventory
https://api.ebay.com/oauth/api_scope/sell.inventory.readonly
https://api.ebay.com/oauth/api_scope/sell.account
https://api.ebay.com/oauth/api_scope/sell.account.readonly
```

If you connected **before** these scopes were added, **re-run Connect OAuth** (tokens cannot gain scopes).

## Routes

| Method | Path | File |
|--------|------|------|
| GET\|POST | `/api/ebay/oauth/start` | `functions/api/ebay/oauth/start.js` |
| GET | `/api/ebay/oauth/callback` | `functions/api/ebay/oauth/callback.js` |
| POST | `/api/ebay/listing` | `functions/api/ebay/listing.js` |
| GET | `/api/ebay/status` | `functions/api/ebay/status.js` |

### Listing body (JSON)

`title`, `description`, `price` (required > 0), optional `brand`, `size`, `condition`, `category`, `color`, `sku`, `imageUrls[]`, `marketplaceId` (default `EBAY_US`), `publish` (default false), `env`, optional BYO `clientId`/`clientSecret` for refresh.

### Listing steps (server)

1. Read `ebay_oauth_tok`; refresh if expired (needs Client Secret)
2. Best-effort KV put if Pages binding exists
3. `PUT /sell/inventory/v1/inventory_item/{sku}`
4. Load fulfillment / payment / return policies (`sell/account`)
5. `POST /sell/inventory/v1/offer`
6. Optional `POST .../offer/{id}/publish` when `publish: true`

## Token storage (honest)

| Store | Status |
|-------|--------|
| HttpOnly cookie `ebay_oauth_tok` Path=/api/ebay | **Primary** — access + refresh; Max-Age ~90d when refresh present |
| Pages KV binding `EBAY_TOKENS` / `FASHIONISTAS_KV` / `TOKENS` | **Best-effort** if bound |
| **fashionistas-api KV/D1** | **Still needed** for durable per-user refresh across devices |

Never log Client Secret or tokens.

## Cloudflare secrets / vars

| Name | Purpose |
|------|---------|
| `EBAY_CLIENT_ID` | App ID |
| `EBAY_CLIENT_SECRET` | Cert ID (exchange + refresh) |
| `EBAY_RU_NAME` / `EBAY_REDIRECT_URI` | Must match RuName |
| `EBAY_ENV` | `sandbox` \| `production` |

## Errors you will see (by design)

| error | Meaning |
|-------|---------|
| `ebay_not_connected` | No token cookie — Connect OAuth |
| `insufficient_scope_or_auth` | Re-consent with sell scopes / check sandbox vs prod |
| `missing_business_policies` | Inventory may exist; create Fulfillment/Payment/Return policies in Seller Hub |
| `insufficient_account_scope` | Need sell.account to read policies |
| `token_refresh_failed` / `token_expired_missing_secret` | Paste BYO secret or set env; reconnect |
| `offer_create_failed` / `publish_failed` | Category/policy issues — fix in Hub or paste kit |

## Done / not done

| Done | Not yet |
|------|---------|
| BYO OAuth + token exchange | Durable fashionistas-api token store |
| Listing create path (Inventory → Offer) | Perfect category taxonomy |
| Clear sandbox/production UI errors | Auto business-policy bootstrap |
| Per-shop paste kits (all six) | Auto-post for non-eBay shops |
