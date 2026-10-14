/**
 * Every listing channel we know of, with the honest truth about how a listing can get there.
 *  mode:  api_seller_key  – the seller pastes a key from their own store; works without any platform approval
 *         api_oauth       – real API; needs our app keys (env) and the seller clicks Connect
 *         feed            – the seller pastes our product-feed URL into that service once; it pulls listings on a schedule
 *         partner         – a real API exists but access is invite/approval-only; built only once approved
 *         guided          – no listing API for third parties; Copy & open only (automation would break their ToS)
 *  built: true when this repo can actually create a listing there once keys exist.
 */
export const CHANNELS = [
  // ---- works with the seller's own key, no approval needed ----
  { id: "woocommerce", name: "WooCommerce", mode: "api_seller_key", built: true, api: "REST v3 (/wp-json/wc/v3/products)", approval: "None — the store owner creates a REST key", cost: "Free (plugin); hosting is the seller's", sellerFields: ["store_url", "consumer_key", "consumer_secret"], keyHelp: "WooCommerce → Settings → Advanced → REST API → Add key (Read/Write)" },
  { id: "bigcommerce", name: "BigCommerce", mode: "api_seller_key", built: true, api: "REST Catalog v3", approval: "None — store owner creates a store-level API account", cost: "BigCommerce plan (from $29/mo, seller's)", sellerFields: ["store_hash", "access_token"], keyHelp: "Settings → Store-level API accounts → Create (Products: modify)" },
  { id: "shopify", name: "Shopify", mode: "api_seller_key", built: true, api: "Admin GraphQL productCreate", approval: "None for a custom app in the seller's own store (public OAuth app needs Shopify review)", cost: "Shopify plan (seller's); API free", sellerFields: ["shop_domain", "admin_token"], keyHelp: "Settings → Apps → Develop apps → Create app → Admin API scopes write_products → Install → copy Admin API token", env: ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"] },
  { id: "square", name: "Square Online", mode: "api_seller_key", built: true, api: "Catalog API (UpsertCatalogObject)", approval: "None for the seller's own production access token; OAuth app is free", cost: "Free API; Square processing fees on sales", sellerFields: ["access_token"], keyHelp: "developer.squareup.com → Applications → (create) → Production → Access token", env: ["SQUARE_APP_ID", "SQUARE_APP_SECRET"] },
  { id: "wix", name: "Wix Stores", mode: "api_seller_key", built: true, api: "Wix Stores Catalog API (products)", approval: "None — site owner creates an API key", cost: "Wix business plan (seller's)", sellerFields: ["api_key", "site_id"], keyHelp: "Wix → Account settings → API Keys → Generate (Wix Stores permissions); site ID from the dashboard URL" },
  { id: "squarespace", name: "Squarespace", mode: "api_seller_key", built: true, api: "Commerce Products API (v1/commerce/products)", approval: "None — site owner creates an API key (Commerce Advanced plan)", cost: "Squarespace Commerce Advanced (seller's)", sellerFields: ["api_key"], keyHelp: "Settings → Advanced → Developer API keys → Generate (Products: read & write)" },
  { id: "reverb", name: "Reverb (music gear only)", mode: "api_seller_key", built: false, why: "needs make/model/category/condition mapping for gear; not useful for clothing", api: "REST /api/listings", approval: "None — personal access token", cost: "Free API; Reverb selling fees", sellerFields: ["token"], keyHelp: "Reverb → My Profile → API & Integrations → Generate token (write_listings)" },
  { id: "mercari_shops", name: "Mercari Shops (Japan only)", mode: "api_seller_key", built: false, why: "Japan-only, needs category IDs and a JP fixed IP; build on request", api: "GraphQL createProduct", approval: "Mercari Shops API contract; JP shops; may need a registered fixed IP", cost: "Free API; Mercari Shops fees", sellerFields: ["token"], keyHelp: "Mercari Shops admin → API → Personal API Access Token" },
  // ---- real APIs that need our app keys (OAuth) ----
  { id: "ebay", name: "eBay", mode: "api_oauth", built: true, api: "Sell Inventory API", approval: "eBay developer account (free) + production keyset", cost: "Free API; eBay fees", env: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_RU_NAME"] },
  { id: "etsy", name: "Etsy", mode: "api_oauth", built: true, api: "Open API v3 createDraftListing", approval: "Etsy developer app (free); commercial access review", cost: "Free API; $0.20 listing fee + Etsy fees (seller's)", env: ["ETSY_API_KEY"] },
  { id: "google", name: "Google (free listings / Merchant Center)", mode: "feed", built: true, apiBuilt: false, api: "Our feed URL (works now). Merchant API productInputs.insert later", approval: "Google Cloud OAuth client (free); seller has a Merchant Center account", cost: "Free", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], feed: true },
  { id: "meta", name: "Facebook & Instagram Shops", mode: "feed", built: true, apiBuilt: false, api: "Our feed URL as a scheduled catalog data feed (works now). items_batch API after Meta App Review", approval: "Meta app + App Review for catalog_management; seller has Commerce Manager", cost: "Free", env: ["META_APP_ID", "META_APP_SECRET"], feed: true },
  { id: "pinterest", name: "Pinterest catalogs", mode: "feed", built: true, api: "Catalog data source (feed URL); API v5 catalogs needs Standard access", approval: "Pinterest business account; claim website", cost: "Free", feed: true },
  { id: "tiktok_catalog", name: "TikTok catalog (ads)", mode: "feed", built: true, api: "Catalog Manager scheduled feed", approval: "TikTok Ads/Business Center account", cost: "Free", feed: true },
  // ---- real APIs, approval-gated (not built until approved) ----
  { id: "amazon", name: "Amazon", mode: "partner", built: false, api: "Selling Partner API — Listings Items putListingsItem", approval: "SP-API developer registration + seller authorization; used clothing is restricted (new/Amazon-approved conditions only)", cost: "Professional seller plan $39.99/mo (seller's); API free", env: ["AMAZON_LWA_CLIENT_ID", "AMAZON_LWA_CLIENT_SECRET", "AMAZON_SPAPI_APP_ID"] },
  { id: "walmart", name: "Walmart Marketplace", mode: "partner", built: false, api: "Marketplace Items API (feeds)", approval: "Approved Walmart Marketplace seller; mostly new items only (pre-owned via Walmart Restored)", cost: "Free API; referral fees", env: ["(seller) WALMART_CLIENT_ID", "(seller) WALMART_CLIENT_SECRET"] },
  { id: "tiktok_shop", name: "TikTok Shop", mode: "partner", built: false, api: "TikTok Shop Partner API (products)", approval: "TikTok Shop Partner Center app approval; seller in a supported country/category", cost: "Free API; TikTok Shop fees", env: ["TIKTOK_APP_KEY", "TIKTOK_APP_SECRET"] },
  { id: "bonanza", name: "Bonanza", mode: "partner", built: false, api: "Bonapitit API (addFixedPriceItem)", approval: "Request developer ID/cert from Bonanza (free); seller authorizes via fetchToken", cost: "Free API; Bonanza fees", env: ["BONANZA_DEV_ID", "BONANZA_CERT_ID"] },
  { id: "depop", name: "Depop", mode: "partner", built: false, api: "Depop Selling API (partners)", approval: "Partner application to Depop; not open to the public", cost: "Unknown until approved", env: ["DEPOP_CLIENT_ID", "DEPOP_CLIENT_SECRET"] },
  { id: "vinted", name: "Vinted", mode: "partner", built: false, api: "Vinted Pro Integrations (CreateItems)", approval: "Allowlisted Vinted Pro businesses only (EU/UK); no public application", cost: "Free API if allowlisted", env: ["(seller) VINTED_ACCESS_KEY", "(seller) VINTED_SIGNING_KEY"] },
  { id: "vestiaire", name: "Vestiaire Collective", mode: "partner", built: false, api: "Seller API", approval: "Professional sellers with ~1,000 listings/month; CSV mass import from 200/month", cost: "Free API if approved; commission", env: ["(seller) VESTIAIRE credentials from account manager"] },
  { id: "whatnot", name: "Whatnot", mode: "partner", built: false, api: "Seller API (GraphQL) — Developer Preview", approval: "Not accepting new applicants (2026)", cost: "—" },
  // ---- no third-party listing API: guided only ----
  { id: "poshmark", name: "Poshmark", mode: "guided", built: false, api: "None public", approval: "—", cost: "—" },
  { id: "mercari", name: "Mercari (US)", mode: "guided", built: false, api: "None public for US marketplace", approval: "—", cost: "—" },
  { id: "grailed", name: "Grailed", mode: "guided", built: false, api: "None public", approval: "—", cost: "—" },
  { id: "facebook", name: "Facebook Marketplace (personal)", mode: "guided", built: false, api: "None for personal Marketplace listings (Shops use Meta catalog above)", approval: "—", cost: "—" },
  { id: "kidizen", name: "Kidizen", mode: "guided", built: false, api: "None public", approval: "—", cost: "—" },
  { id: "curtsy", name: "Curtsy", mode: "guided", built: false, api: "None (app only)", approval: "—", cost: "—" },
  { id: "ebid", name: "eBid", mode: "guided", built: false, api: "No current public listing API found; bulk CSV upload for sellers", approval: "—", cost: "—" },
  { id: "rubylane", name: "Ruby Lane", mode: "guided", built: false, api: "None public; shop-owner bulk tools only", approval: "Shop approval + monthly fees", cost: "Ruby Lane shop fees" },
  { id: "thredup", name: "ThredUp", mode: "guided", built: false, api: "None — consignment (send a bag)", approval: "—", cost: "—" },
  { id: "therealreal", name: "The RealReal", mode: "guided", built: false, api: "None — consignment", approval: "—", cost: "—" },
  { id: "lyst", name: "Lyst / ShopStyle", mode: "guided", built: false, api: "Retailer/brand feeds via affiliate networks; not open to individual resellers", approval: "Retailer partnership", cost: "—" },
];
export const byId = (id) => CHANNELS.find((c) => c.id === id) || null;
export function platformReady(c, env) { return !c.env || c.env.filter((k) => !k.startsWith("(")).every((k) => !!(env && env[k])); }
