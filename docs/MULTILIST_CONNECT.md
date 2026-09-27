# Multilist Connect (all shops)

fashionistas.ai Multilist → **Connect your shops** opens a **guidance panel per marketplace**. We never invent API credentials, never steal passwords, and never fake auto account creation.

## Status (local)

| Status | Meaning |
|--------|---------|
| **Needs account** | No local progress yet |
| **Ready to guide** | Connect guide opened (or eBay BYO keys saved) |
| **Connected** | Local flag; eBay after successful OAuth token exchange (HttpOnly cookie). Paste still works. Listing create is a follow-up. |

Stored in `localStorage` key `fash_connect_v1`.

## Shops

| Shop | Connect mode | Signup | Create listing |
|------|----------------|--------|----------------|
| **Depop** | Guide + paste only | https://www.depop.com/signup/ | https://www.depop.com/sell/ |
| **eBay** | BYO Client ID/Secret + OAuth | https://signup.ebay.com/ | https://www.ebay.com/sl/sell |
| **Poshmark** | Guide + paste only | https://poshmark.com/signup | https://poshmark.com/create-listing |
| **Mercari** | Guide + paste only | https://www.mercari.com/signup/ | https://www.mercari.com/sell/ |
| **Vinted** | Guide + paste only | https://www.vinted.com/member/register/select_type | https://www.vinted.com/items/new |
| **Grailed** | Guide + paste only | https://www.grailed.com/signup | https://www.grailed.com/sell |

Extra marketplaces returned by `/api/marketplaces` (except Fashionistas) get the same guide-only pattern when present.

## Hive checklist (every panel)

1. Create account  
2. Verify  
3. Open new listing (deep link)  
4. Paste kit / post (eBay may use OAuth instead of paste-only)

## eBay OAuth

See [EBAY_OAUTH.md](./EBAY_OAUTH.md). Only eBay has a real public developer OAuth path in this app.

## What we refuse

- Fake “auto create account” flows  
- Collecting marketplace passwords  
- Invented Client ID / Secret / API keys for Depop, Poshmark, Mercari, Vinted, Grailed  
