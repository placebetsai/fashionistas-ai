# Marketplace & channel matrix (researched 2026-10-14)

Honest status for every channel. **Built** means this repo creates the listing via the real API or feed once keys exist. Nothing uses bots, password scraping or ToS-breaking automation.

| Channel | How | Built | API | Approval | Cost | Keys / who creates them |
|---|---|---|---|---|---|---|
| WooCommerce | Seller key (works today) | yes | REST v3 (/wp-json/wc/v3/products) | None — the store owner creates a REST key | Free (plugin); hosting is the seller's | Seller: store_url, consumer_key, consumer_secret |
| BigCommerce | Seller key (works today) | yes | REST Catalog v3 | None — store owner creates a store-level API account | BigCommerce plan (from $29/mo, seller's) | Seller: store_hash, access_token |
| Shopify | Seller key (works today) | yes | Admin GraphQL productCreate | None for a custom app in the seller's own store (public OAuth app needs Shopify review) | Shopify plan (seller's); API free | Seller: shop_domain, admin_token; Iz: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET |
| Square Online | Seller key (works today) | yes | Catalog API (UpsertCatalogObject) | None for the seller's own production access token; OAuth app is free | Free API; Square processing fees on sales | Seller: access_token; Iz: SQUARE_APP_ID, SQUARE_APP_SECRET |
| Wix Stores | Seller key (works today) | yes | Wix Stores Catalog API (products) | None — site owner creates an API key | Wix business plan (seller's) | Seller: api_key, site_id |
| Squarespace | Seller key (works today) | yes | Commerce Products API (v1/commerce/products) | None — site owner creates an API key (Commerce Advanced plan) | Squarespace Commerce Advanced (seller's) | Seller: api_key |
| Reverb (music gear only) | Seller key (works today) | no (needs make/model/category/condition mapping for gear; not useful for clothing) | REST /api/listings | None — personal access token | Free API; Reverb selling fees | Seller: token |
| Mercari Shops (Japan only) | Seller key (works today) | no (Japan-only, needs category IDs and a JP fixed IP; build on request) | GraphQL createProduct | Mercari Shops API contract; JP shops; may need a registered fixed IP | Free API; Mercari Shops fees | Seller: token |
| eBay | OAuth (needs our app keys) | yes | Sell Inventory API | eBay developer account (free) + production keyset | Free API; eBay fees | Iz: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RU_NAME |
| Etsy | OAuth (needs our app keys) | yes | Open API v3 createDraftListing | Etsy developer app (free); commercial access review | Free API; $0.20 listing fee + Etsy fees (seller's) | Iz: ETSY_API_KEY |
| Google (free listings / Merchant Center) | Product feed (works today) | yes | Our feed URL (works now). Merchant API productInputs.insert later | Google Cloud OAuth client (free); seller has a Merchant Center account | Free | Iz: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET |
| Facebook & Instagram Shops | Product feed (works today) | yes | Our feed URL as a scheduled catalog data feed (works now). items_batch API after Meta App Review | Meta app + App Review for catalog_management; seller has Commerce Manager | Free | Iz: META_APP_ID, META_APP_SECRET |
| Pinterest catalogs | Product feed (works today) | yes | Catalog data source (feed URL); API v5 catalogs needs Standard access | Pinterest business account; claim website | Free | — |
| TikTok catalog (ads) | Product feed (works today) | yes | Catalog Manager scheduled feed | TikTok Ads/Business Center account | Free | — |
| Amazon | Approval-gated API | no | Selling Partner API — Listings Items putListingsItem | SP-API developer registration + seller authorization; used clothing is restricted (new/Amazon-approved conditions only) | Professional seller plan $39.99/mo (seller's); API free | Iz: AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET, AMAZON_SPAPI_APP_ID |
| Walmart Marketplace | Approval-gated API | no | Marketplace Items API (feeds) | Approved Walmart Marketplace seller; mostly new items only (pre-owned via Walmart Restored) | Free API; referral fees | Iz: (seller) WALMART_CLIENT_ID, (seller) WALMART_CLIENT_SECRET |
| TikTok Shop | Approval-gated API | no | TikTok Shop Partner API (products) | TikTok Shop Partner Center app approval; seller in a supported country/category | Free API; TikTok Shop fees | Iz: TIKTOK_APP_KEY, TIKTOK_APP_SECRET |
| Bonanza | Approval-gated API | no | Bonapitit API (addFixedPriceItem) | Request developer ID/cert from Bonanza (free); seller authorizes via fetchToken | Free API; Bonanza fees | Iz: BONANZA_DEV_ID, BONANZA_CERT_ID |
| Depop | Approval-gated API | no | Depop Selling API (partners) | Partner application to Depop; not open to the public | Unknown until approved | Iz: DEPOP_CLIENT_ID, DEPOP_CLIENT_SECRET |
| Vinted | Approval-gated API | no | Vinted Pro Integrations (CreateItems) | Allowlisted Vinted Pro businesses only (EU/UK); no public application | Free API if allowlisted | Iz: (seller) VINTED_ACCESS_KEY, (seller) VINTED_SIGNING_KEY |
| Vestiaire Collective | Approval-gated API | no | Seller API | Professional sellers with ~1,000 listings/month; CSV mass import from 200/month | Free API if approved; commission | Iz: (seller) VESTIAIRE credentials from account manager |
| Whatnot | Approval-gated API | no | Seller API (GraphQL) — Developer Preview | Not accepting new applicants (2026) | — | — |
| Poshmark | Copy & open only | no | None public | — | — | — |
| Mercari (US) | Copy & open only | no | None public for US marketplace | — | — | — |
| Grailed | Copy & open only | no | None public | — | — | — |
| Facebook Marketplace (personal) | Copy & open only | no | None for personal Marketplace listings (Shops use Meta catalog above) | — | — | — |
| Kidizen | Copy & open only | no | None public | — | — | — |
| Curtsy | Copy & open only | no | None (app only) | — | — | — |
| eBid | Copy & open only | no | No current public listing API found; bulk CSV upload for sellers | — | — | — |
| Ruby Lane | Copy & open only | no | None public; shop-owner bulk tools only | Shop approval + monthly fees | Ruby Lane shop fees | — |
| ThredUp | Copy & open only | no | None — consignment (send a bag) | — | — | — |
| The RealReal | Copy & open only | no | None — consignment | — | — | — |
| Lyst / ShopStyle | Copy & open only | no | Retailer/brand feeds via affiliate networks; not open to individual resellers | Retailer partnership | — | — |

## Crosslisting aggregators as a bridge (Vendoo, List Perfectly, Crosslist, Nifty, PrimeLister)
- None publish a partner API that lets another app post through them. They're consumer subscriptions ($15–$60/mo).
- Their Poshmark/Mercari/Depop "integrations" run inside the seller's own browser via an extension. List Perfectly makes the seller press Post.
- Poshmark's terms prohibit automated access, and there's no Poshmark API. Routing our sellers through those tools would just move that ToS risk onto them. **We don't bridge through aggregators.** Our Copy & open plus the extension auto-fill already gives the same "seller presses Post" result for free.

## Product feed (built, free, works today)
- `/feeds/<sellerId>.xml` is in Google RSS 2.0 format, with `g:` fields (id, title, description, link, image_link, availability, condition, price, brand, size, color).
- `/feeds/<sellerId>.csv` has the same fields.
- Paste it once into:
  - Google Merchant Center → Products → Add feed → Scheduled fetch (free listings).
  - Meta Commerce Manager → Catalog → Data sources → Data feed → Scheduled.
  - Pinterest → Catalogs → Data source.
  - TikTok Catalog Manager → Scheduled feed.
- Each feed contains only that seller's live, for-sale listings, which are already public on /shop.

## Seller-key stores (built, real API, no approval)
- **Stores:** WooCommerce, BigCommerce, Shopify (custom app token), Square, Wix, Squarespace.
- **How it works:** the seller pastes their own key on /seller/board/. It's stored encrypted with AES-GCM using `CHANNEL_KEY`, and "Post via API" creates the product.
- **Honest labels:** an item is marked "listed" only when the remote API returns an id.
- **Photos:** Square and Squarespace need the photo added in their own editor, because their image upload takes a file, not a URL. The app tells the seller.
- **Key status:** `CHANNEL_KEY` is set on Preview only. Production stays off until Iz approves.

## Keys checklist for Iz
1. `CHANNEL_KEY` (production): a random 32-byte secret that turns on seller-key stores in production.
2. eBay: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME` (developer.ebay.com, free).
3. Etsy: `ETSY_API_KEY` (etsy.com/developers, free; commercial access review).
4. Shopify public app (optional; the custom-app token already works): `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` (Shopify Partners, free; App Store review).
5. Square OAuth (optional): `SQUARE_APP_ID` and `SQUARE_APP_SECRET` (developer.squareup.com, free).
6. Google Merchant API (optional; the feed already works): `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Google Cloud, free).
7. Meta catalog API (optional; the feed already works): `META_APP_ID` and `META_APP_SECRET`, plus App Review for `catalog_management`.
8. Amazon SP-API: developer registration, plus `AMAZON_LWA_CLIENT_ID`, `AMAZON_LWA_CLIENT_SECRET` and `AMAZON_SPAPI_APP_ID`. Sellers need the $39.99/mo Pro plan. Used clothing is restricted.
9. TikTok Shop: Partner Center app, `TIKTOK_APP_KEY` and `TIKTOK_APP_SECRET`.
10. Bonanza: email Bonanza for a dev ID and cert: `BONANZA_DEV_ID` and `BONANZA_CERT_ID`.
11. Depop: partner application. Vinted Pro: allowlist only. Vestiaire: about 1,000 listings a month. Whatnot: closed to new applicants.
