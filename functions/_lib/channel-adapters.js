/**
 * Create a listing on a seller-key channel. Returns {ok, remote_id, url} or {ok:false, error}.
 * Only reports success when the remote API returned an id — nothing is ever marked listed on a guess.
 */
const money = (n) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
const esc = (s) => String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
export function productOf(l) {
  const facts = [l.brand && "Brand: " + l.brand, l.size && "Size: " + l.size, l.condition && "Condition: " + l.condition, l.color && "Colour: " + l.color].filter(Boolean);
  return { title: String(l.title || "Item").slice(0, 140), price: money(l.price), description: [l.description || "", facts.join(" · ")].filter(Boolean).join("\n\n"), image: l.photo_url || "", sku: "FA-" + l.id, condition: /new/i.test(l.condition || "") ? "new" : "used" };
}
const bad = async (r, who) => { let t = ""; try { t = (await r.text()).slice(0, 300); } catch {} return { ok: false, error: who + " HTTP " + r.status + (t ? ": " + t.replace(/\s+/g, " ") : "") }; };
const cleanHost = (u) => String(u || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

export const ADAPTERS = {
  async woocommerce(c, p) {
    const base = "https://" + cleanHost(c.store_url);
    const r = await fetch(base + "/wp-json/wc/v3/products", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(c.consumer_key + ":" + c.consumer_secret) },
      body: JSON.stringify({ name: p.title, type: "simple", status: "publish", regular_price: p.price, description: esc(p.description).replace(/\n/g, "<br>"), sku: p.sku, manage_stock: true, stock_quantity: 1, images: p.image ? [{ src: p.image }] : [] }) });
    if (!r.ok) return bad(r, "WooCommerce");
    const d = await r.json(); return d && d.id ? { ok: true, remote_id: String(d.id), url: d.permalink || base } : { ok: false, error: "WooCommerce returned no id" };
  },
  async bigcommerce(c, p) {
    const h = String(c.store_hash || "").trim();
    const r = await fetch("https://api.bigcommerce.com/stores/" + encodeURIComponent(h) + "/v3/catalog/products", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "X-Auth-Token": c.access_token },
      body: JSON.stringify({ name: p.title, type: "physical", weight: 1, price: Number(p.price), sku: p.sku, description: esc(p.description).replace(/\n/g, "<br>"), condition: p.condition === "new" ? "New" : "Used", is_condition_shown: true, is_visible: true, inventory_tracking: "product", inventory_level: 1, images: p.image ? [{ image_url: p.image, is_thumbnail: true }] : [] }) });
    if (!r.ok) return bad(r, "BigCommerce");
    const d = (await r.json()).data || {}; return d.id ? { ok: true, remote_id: String(d.id), url: d.custom_url && d.custom_url.url ? "https://store-" + h + ".mybigcommerce.com" + d.custom_url.url : null } : { ok: false, error: "BigCommerce returned no id" };
  },
  async shopify(c, p) {
    const shop = cleanHost(c.shop_domain), gql = async (query, variables) => {
      const r = await fetch("https://" + shop + "/admin/api/2025-07/graphql.json", { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": c.admin_token }, body: JSON.stringify({ query, variables }) });
      if (!r.ok) throw new Error("Shopify HTTP " + r.status); return r.json();
    };
    try {
      const a = await gql("mutation($p:ProductCreateInput!,$m:[CreateMediaInput!]){productCreate(product:$p,media:$m){product{id handle onlineStoreUrl variants(first:1){nodes{id}}} userErrors{message}}}",
        { p: { title: p.title, descriptionHtml: esc(p.description).replace(/\n/g, "<br>"), status: "ACTIVE" }, m: p.image ? [{ originalSource: p.image, mediaContentType: "IMAGE" }] : [] });
      const pc = a.data && a.data.productCreate; if (!pc || !pc.product) return { ok: false, error: "Shopify: " + ((pc && pc.userErrors && pc.userErrors.map((e) => e.message).join("; ")) || JSON.stringify(a.errors || "no product")) };
      const v = pc.product.variants.nodes[0];
      if (v) await gql("mutation($id:ID!,$v:[ProductVariantsBulkInput!]!){productVariantsBulkUpdate(productId:$id,variants:$v){userErrors{message}}}", { id: pc.product.id, v: [{ id: v.id, price: p.price }] });
      return { ok: true, remote_id: pc.product.id, url: pc.product.onlineStoreUrl || "https://" + shop + "/products/" + pc.product.handle };
    } catch (e) { return { ok: false, error: String(e.message || e) }; }
  },
  async square(c, p) {
    const r = await fetch("https://connect.squareup.com/v2/catalog/object", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.access_token, "Square-Version": "2025-07-16" },
      body: JSON.stringify({ idempotency_key: p.sku + "-" + Date.now(), object: { type: "ITEM", id: "#item", item_data: { name: p.title, description: p.description.slice(0, 4000), variations: [{ type: "ITEM_VARIATION", id: "#var", item_variation_data: { name: "Regular", sku: p.sku, pricing_type: "FIXED_PRICING", price_money: { amount: Math.round(Number(p.price) * 100), currency: "USD" } } }] } } }) });
    if (!r.ok) return bad(r, "Square");
    const d = await r.json(); const id = d.catalog_object && d.catalog_object.id;
    return id ? { ok: true, remote_id: id, url: null, note: "Square: add the photo in Square Dashboard (image upload needs a file, not a URL)" } : { ok: false, error: "Square returned no id" };
  },
  async wix(c, p) {
    const h = { "Content-Type": "application/json", Authorization: c.api_key || c.access_token }; if (c.site_id) h["wix-site-id"] = String(c.site_id).trim();
    const r = await fetch("https://www.wixapis.com/stores/v1/products", { method: "POST", headers: h, body: JSON.stringify({ product: { name: p.title.slice(0, 80), productType: "physical", priceData: { price: Number(p.price) }, description: esc(p.description).replace(/\n/g, "<br>"), sku: p.sku, visible: true } }) });
    if (!r.ok) return bad(r, "Wix");
    const d = (await r.json()).product || {}; if (!d.id) return { ok: false, error: "Wix returned no id" };
    if (p.image) { try { await fetch("https://www.wixapis.com/stores/v1/products/" + d.id + "/media", { method: "POST", headers: h, body: JSON.stringify({ media: [{ url: p.image }] }) }); } catch {} }
    return { ok: true, remote_id: d.id, url: d.productPageUrl ? (d.productPageUrl.base || "") + (d.productPageUrl.path || "") : null };
  },
  async squarespace(c, p) {
    const h = { "Content-Type": "application/json", Authorization: "Bearer " + c.api_key, "User-Agent": "fashionistas.ai" };
    const sp = await fetch("https://api.squarespace.com/1.0/commerce/store_pages", { headers: h });
    if (!sp.ok) return bad(sp, "Squarespace store pages");
    const page = ((await sp.json()).storePages || [])[0]; if (!page) return { ok: false, error: "Squarespace: no store page on this site — add a Store page first" };
    const r = await fetch("https://api.squarespace.com/1.0/commerce/products", { method: "POST", headers: h, body: JSON.stringify({ type: "PHYSICAL", storePageId: page.id, name: p.title, description: esc(p.description).replace(/\n/g, "<br>"), isVisible: true, variants: [{ sku: p.sku, pricing: { basePrice: { currency: "USD", value: p.price } }, stock: { quantity: 1, unlimited: false } }] }) });
    if (!r.ok) return bad(r, "Squarespace");
    const d = await r.json(); return d.id ? { ok: true, remote_id: d.id, url: d.url || null, note: "Squarespace: add the photo in the editor (image upload needs a file)" } : { ok: false, error: "Squarespace returned no id" };
  },
};
