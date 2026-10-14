# Crosslisting — what's real vs fallback (researched 2026-10-14)

| Marketplace | Programmatic listing? | Status in fashionistas.ai | Iz must create |
|---|---|---|---|
| eBay | Yes. Public Sell **Inventory API** (inventory_item → offer → publish_offer), OAuth per seller | **Built** (functions/api/ebay, list/ebay.js). Off until keys exist | eBay developer account → Production keyset: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`; business policies (payment/return/fulfillment IDs) |
| Etsy | Yes. **Open API v3** createDraftListing + images, OAuth2 PKCE. Commercial access needs app approval; Etsy only allows handmade/vintage (20+ yrs)/supplies | **Built** (functions/api/etsy, list/etsy.js). Off until keys exist | Etsy app: `ETSY_API_KEY` (keystring), `ETSY_API_SECRET`; request commercial access |
| Shopify | Yes. **Admin API** (productCreate) via a public app (OAuth) or per-store custom app token | **Not built yet.** Next to build (fully allowed) | Shopify Partner account + app (client id/secret) |
| Depop | Yes but **private/partner-gated** Selling API (OAuth2 PKCE for crosslisting tools; apply at business@depop.com) | Fallback: prefilled copy + open Depop sell page | Apply for partner access |
| Vinted | Only **Vinted Pro Integrations**, allowlisted EU Pro businesses | Fallback: copy + open | Vinted Pro + allowlist (business) |
| Poshmark | **No public API** | Fallback: copy + open (labelled "you post it") | — |
| Mercari (US) | **No public listing API** | Fallback: copy + open | — |
| Grailed | **No public API** | Fallback: copy + open | — |
| Facebook Marketplace | No API for individual sellers (Commerce catalog is for businesses/shops) | Fallback: copy + open | — |

Rules kept: a listing shows "Posted" only when the shop's API returned a listing id; fallbacks are labelled "Ready to paste — you post it" and never marked listed (tests: sell-one-click, multilist).
Note: the browser-extension path (auto-fill in the seller's own browser) exists for no-API shops; it fills forms the seller submits — it is not an API and may conflict with some shops' terms (Poshmark/Mercari prohibit automation). Keep it user-initiated.
