/**
 * One-time developer apps (registered by the site owner, not per seller) and the OAuth flow for each.
 * Every provider is OFF until its env vars exist; nothing here pretends a connection worked.
 * Tokens are stored via vault.seal in the same field shape channel-adapters.js reads.
 */
const enc = encodeURIComponent;
const form = (o) => Object.entries(o).map(([k, v]) => enc(k) + "=" + enc(v)).join("&");
const basic = (a, b) => "Basic " + btoa(a + ":" + b);
async function jfetch(url, init) {
  const r = await fetch(url, init); let j = null; try { j = await r.json(); } catch {}
  if (!r.ok || !j) throw new Error("HTTP " + r.status + (j ? ": " + JSON.stringify(j).slice(0, 200) : ""));
  return j;
}
const exp = (sec) => sec ? Date.now() + Number(sec) * 1000 : null;
export const SHOP_HOST = /^(?!localhost$)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export const OAUTH = {
  woocommerce: { name: "WooCommerce", env: [], needsShop: "store URL", clicks: 2,
    // WooCommerce's built-in key grant: the seller approves on their own wp-admin; Woo POSTs keys to callback_url.
    authUrl: (env, o) => "https://" + o.shop + "/wc-auth/v1/authorize?" + form({ app_name: "fashionistas.ai", scope: "read_write", user_id: o.state, return_url: o.origin + "/seller/board/?connected=woocommerce", callback_url: o.redirect }) },
  shopify: { name: "Shopify", env: ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"], needsShop: "shop name", clicks: 2,
    authUrl: (env, o) => "https://" + o.shop + "/admin/oauth/authorize?" + form({ client_id: env.SHOPIFY_CLIENT_ID, scope: "write_products,read_products", redirect_uri: o.redirect, state: o.state }),
    async exchange(env, q, st) { const j = await jfetch("https://" + st.shop + "/admin/oauth/access_token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: env.SHOPIFY_CLIENT_ID, client_secret: env.SHOPIFY_CLIENT_SECRET, code: q.get("code") }) }); return { creds: { shop_domain: st.shop, admin_token: j.access_token }, label: st.shop }; } },
  bigcommerce: { name: "BigCommerce", env: ["BIGCOMMERCE_APP_ID", "BIGCOMMERCE_CLIENT_ID", "BIGCOMMERCE_CLIENT_SECRET"], clicks: 2, cookieState: true,
    authUrl: (env) => "https://login.bigcommerce.com/app/" + enc(env.BIGCOMMERCE_APP_ID) + "/install",
    async exchange(env, q, st, redirect) { const j = await jfetch("https://login.bigcommerce.com/oauth2/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: env.BIGCOMMERCE_CLIENT_ID, client_secret: env.BIGCOMMERCE_CLIENT_SECRET, code: q.get("code"), scope: q.get("scope"), grant_type: "authorization_code", redirect_uri: redirect, context: q.get("context") }) }); const hash = String(j.context || "").replace("stores/", ""); return { creds: { store_hash: hash, access_token: j.access_token }, label: "store " + hash }; } },
  square: { name: "Square", env: ["SQUARE_APP_ID", "SQUARE_APP_SECRET"], clicks: 2,
    authUrl: (env, o) => "https://connect.squareup.com/oauth2/authorize?" + form({ client_id: env.SQUARE_APP_ID, scope: "ITEMS_READ ITEMS_WRITE MERCHANT_PROFILE_READ", session: "false", state: o.state, redirect_uri: o.redirect }),
    async exchange(env, q, st, redirect) { const j = await jfetch("https://connect.squareup.com/oauth2/token", { method: "POST", headers: { "Content-Type": "application/json", "Square-Version": "2025-07-16" }, body: JSON.stringify({ client_id: env.SQUARE_APP_ID, client_secret: env.SQUARE_APP_SECRET, code: q.get("code"), grant_type: "authorization_code", redirect_uri: redirect }) }); return { creds: { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at ? Date.parse(j.expires_at) : null }, label: "merchant " + (j.merchant_id || "") }; },
    async refresh(env, c) { const j = await jfetch("https://connect.squareup.com/oauth2/token", { method: "POST", headers: { "Content-Type": "application/json", "Square-Version": "2025-07-16" }, body: JSON.stringify({ client_id: env.SQUARE_APP_ID, client_secret: env.SQUARE_APP_SECRET, refresh_token: c.refresh_token, grant_type: "refresh_token" }) }); return { ...c, access_token: j.access_token, refresh_token: j.refresh_token || c.refresh_token, expires_at: j.expires_at ? Date.parse(j.expires_at) : null }; } },
  wix: { name: "Wix", env: ["WIX_APP_ID", "WIX_APP_SECRET"], clicks: 2,
    authUrl: (env, o) => "https://www.wix.com/installer/install?" + form({ appId: env.WIX_APP_ID, redirectUrl: o.redirect, state: o.state }),
    async exchange(env, q) { const j = await jfetch("https://www.wixapis.com/oauth/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "authorization_code", client_id: env.WIX_APP_ID, client_secret: env.WIX_APP_SECRET, code: q.get("code") }) }); return { creds: { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + 4 * 60 * 1000, instance_id: q.get("instanceId") || "" }, label: "Wix site" }; },
    async refresh(env, c) { const j = await jfetch("https://www.wixapis.com/oauth/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "refresh_token", client_id: env.WIX_APP_ID, client_secret: env.WIX_APP_SECRET, refresh_token: c.refresh_token }) }); return { ...c, access_token: j.access_token, refresh_token: j.refresh_token || c.refresh_token, expires_at: Date.now() + 4 * 60 * 1000 }; } },
  squarespace: { name: "Squarespace", env: ["SQUARESPACE_CLIENT_ID", "SQUARESPACE_CLIENT_SECRET"], clicks: 2,
    authUrl: (env, o) => "https://login.squarespace.com/api/1/login/oauth/provider/authorize?" + form({ client_id: env.SQUARESPACE_CLIENT_ID, redirect_uri: o.redirect, scope: "website.products,website.inventory", state: o.state, access_type: "offline" }),
    async exchange(env, q, st, redirect) { const j = await jfetch("https://login.squarespace.com/api/1/login/oauth/provider/tokens", { method: "POST", headers: { "Content-Type": "application/json", Authorization: basic(env.SQUARESPACE_CLIENT_ID, env.SQUARESPACE_CLIENT_SECRET), "User-Agent": "fashionistas.ai" }, body: JSON.stringify({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirect }) }); return { creds: { api_key: j.access_token, refresh_token: j.refresh_token, expires_at: j.access_token_expires_at ? Number(j.access_token_expires_at) * 1000 : exp(1800) }, label: "Squarespace site" }; },
    async refresh(env, c) { const j = await jfetch("https://login.squarespace.com/api/1/login/oauth/provider/tokens", { method: "POST", headers: { "Content-Type": "application/json", Authorization: basic(env.SQUARESPACE_CLIENT_ID, env.SQUARESPACE_CLIENT_SECRET), "User-Agent": "fashionistas.ai" }, body: JSON.stringify({ grant_type: "refresh_token", refresh_token: c.refresh_token }) }); return { ...c, api_key: j.access_token, refresh_token: j.refresh_token || c.refresh_token, expires_at: j.access_token_expires_at ? Number(j.access_token_expires_at) * 1000 : exp(1800) }; } },
  // ---- feeds: connect once, we register the seller's feed URL with the service ----
  google: { name: "Google Merchant Center", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], clicks: 2, feed: true,
    authUrl: (env, o) => "https://accounts.google.com/o/oauth2/v2/auth?" + form({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: o.redirect, response_type: "code", scope: "https://www.googleapis.com/auth/content", access_type: "offline", prompt: "consent", state: o.state }),
    async exchange(env, q, st, redirect) { const j = await jfetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ code: q.get("code"), client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirect, grant_type: "authorization_code" }) }); return { creds: { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: exp(j.expires_in) }, label: "Google account" }; },
    async pushFeed(c, feedUrl) {
      const H = { Authorization: "Bearer " + c.access_token, "Content-Type": "application/json" };
      const a = await jfetch("https://merchantapi.googleapis.com/accounts/v1/accounts", { headers: H });
      const acct = (a.accounts || [])[0]; if (!acct) throw new Error("No Merchant Center account on this Google login — create one at merchants.google.com first");
      const ds = await jfetch("https://merchantapi.googleapis.com/datasources/v1/" + acct.name + "/dataSources", { method: "POST", headers: H, body: JSON.stringify({ displayName: "fashionistas.ai", primaryProductDataSource: { contentLanguage: "en", feedLabel: "US", countries: ["US"] }, fileInput: { fetchSettings: { enabled: true, fetchUri: feedUrl, frequency: "FREQUENCY_DAILY", timeOfDay: { hours: 6 }, timeZone: "America/New_York" } } }) });
      return { label: "Merchant " + (acct.accountName || acct.name), remote: ds.name };
    } },
  pinterest: { name: "Pinterest catalogs", env: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"], clicks: 2, feed: true,
    authUrl: (env, o) => "https://www.pinterest.com/oauth/?" + form({ client_id: env.PINTEREST_APP_ID, redirect_uri: o.redirect, response_type: "code", scope: "catalogs:read,catalogs:write,user_accounts:read", state: o.state }),
    async exchange(env, q, st, redirect) { const j = await jfetch("https://api.pinterest.com/v5/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basic(env.PINTEREST_APP_ID, env.PINTEREST_APP_SECRET) }, body: form({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirect }) }); return { creds: { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: exp(j.expires_in) }, label: "Pinterest business" }; },
    async pushFeed(c, feedUrl) { const f = await jfetch("https://api.pinterest.com/v5/catalogs/feeds", { method: "POST", headers: { Authorization: "Bearer " + c.access_token, "Content-Type": "application/json" }, body: JSON.stringify({ name: "fashionistas.ai", format: "XML", location: feedUrl, default_locale: "en-US", default_currency: "USD", default_availability: "IN_STOCK" }) }); return { label: "Pinterest feed " + (f.id || ""), remote: f.id }; } },
  meta: { name: "Facebook & Instagram catalog", env: ["META_APP_ID", "META_APP_SECRET"], clicks: 3, feed: true,
    authUrl: (env, o) => "https://www.facebook.com/v21.0/dialog/oauth?" + form({ client_id: env.META_APP_ID, redirect_uri: o.redirect, state: o.state, scope: "catalog_management,business_management" }),
    async exchange(env, q, st, redirect) { const j = await jfetch("https://graph.facebook.com/v21.0/oauth/access_token?" + form({ client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, redirect_uri: redirect, code: q.get("code") })); return { creds: { access_token: j.access_token, expires_at: exp(j.expires_in) }, label: "Meta business" }; },
    async pushFeed(c, feedUrl) {
      const G = (p, body) => jfetch("https://graph.facebook.com/v21.0/" + p + (body ? "" : (p.includes("?") ? "&" : "?") + "access_token=" + enc(c.access_token)), body ? { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ ...body, access_token: c.access_token }) } : undefined);
      const biz = ((await G("me/businesses")).data || [])[0]; if (!biz) throw new Error("No Meta Business on this login — create one in Commerce Manager first");
      const cat = await G(biz.id + "/owned_product_catalogs", { name: "fashionistas.ai" });
      const feed = await G(cat.id + "/product_feeds", { name: "fashionistas.ai", schedule: JSON.stringify({ interval: "DAILY", url: feedUrl, hour: 6 }) });
      return { label: "Meta catalog " + cat.id, remote: feed.id };
    } },
};
export const oauthReady = (p, env) => !!OAUTH[p] && OAUTH[p].env.every((k) => !!(env && env[k]));

// ---- signed state (HMAC over CHANNEL_KEY; never changes the key itself) ----
const b64u = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => atob(String(s).replace(/-/g, "+").replace(/_/g, "/"));
async function hkey(env) { return crypto.subtle.importKey("raw", new TextEncoder().encode("oauth-state:" + env.CHANNEL_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function signState(env, obj) { const body = b64u(JSON.stringify({ ...obj, x: Date.now() + 15 * 60 * 1000, n: crypto.randomUUID().slice(0, 8) })); return body + "." + hex(await crypto.subtle.sign("HMAC", await hkey(env), new TextEncoder().encode(body))).slice(0, 32); }
export async function readState(env, s) {
  const [body, sig] = String(s || "").split("."); if (!body || !sig || !env.CHANNEL_KEY) return null;
  const good = hex(await crypto.subtle.sign("HMAC", await hkey(env), new TextEncoder().encode(body))).slice(0, 32);
  if (good !== sig) return null; try { const o = JSON.parse(unb64u(body)); return o.x > Date.now() ? o : null; } catch { return null; }
}
export async function shopifyHmacOk(env, q) {
  const h = q.get("hmac"); if (!h) return false;
  const msg = [...q.entries()].filter(([k]) => k !== "hmac" && k !== "signature").sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => k + "=" + v).join("&");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SHOPIFY_CLIENT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg))) === h;
}
