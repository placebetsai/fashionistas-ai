# Multilist Connect (all shops)

fashionistas.ai Multilist → **Connect your shops** opens a **guidance panel per marketplace**. We never invent API credentials, never steal passwords, and never fake auto account creation.

## Status (local)

| Status | Meaning |
|--------|---------|
| **Needs account** | No local progress yet |
| **Ready to guide** | Connect guide opened (or eBay BYO keys saved) |
| **Connected** | Local flag; eBay after successful OAuth token exchange (HttpOnly cookie). Paste always works. eBay may additionally **Create on eBay** via API. |

Stored in `localStorage` key `fash_connect_v1`.

## Shops

| Shop | Connect mode | Signup | Create listing |
|------|----------------|--------|----------------|
| **Depop** | Guide + paste kit | https://www.depop.com/signup/ | https://www.depop.com/sell/ |
| **eBay** | BYO + OAuth + optional API create | https://signup.ebay.com/ | https://www.ebay.com/sl/sell |
| **Poshmark** | Guide + paste kit | https://poshmark.com/signup | https://poshmark.com/create-listing |
| **Mercari** | Guide + paste kit | https://www.mercari.com/signup/ | https://www.mercari.com/sell/ |
| **Vinted** | Guide + paste kit | https://www.vinted.com/member/register/select_type | https://www.vinted.com/items/new |
| **Grailed** | Guide + paste kit | https://www.grailed.com/signup | https://www.grailed.com/sell |

## Per-shop kits

`xlKit(listing, shopId)` / `XL_KIT_RULES` produce shop-specific:

- Title rules / max length  
- Tags or hashtags (Depop #tags; eBay comma keywords in description)  
- Description tone  
- Field hints aligned with `MKT_CARD`  

Multilist sheet shows **one kit block per picked shop** (Copy / Open / eBay Create).

## eBay OAuth + listing

See [EBAY_OAUTH.md](./EBAY_OAUTH.md). Only eBay has a real public developer OAuth + Sell Inventory path in this app.

## What we refuse

- Fake “auto create account” flows  
- Collecting marketplace passwords  
- Invented Client ID / Secret / API keys for Depop, Poshmark, Mercari, Vinted, Grailed  
- Invented AdSense pub-ids  
