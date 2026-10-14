import { test } from "node:test";
import assert from "node:assert/strict";
import { OAUTH, oauthReady, signState, readState, shopifyHmacOk } from "../functions/_lib/oauth-apps.js";
const env = { CHANNEL_KEY: "k" };
test("state is signed, tamper-proof and expires", async () => {
  const s = await signState(env, { u: 130, p: "square" });
  assert.equal((await readState(env, s)).u, 130);
  assert.equal(await readState(env, s.replace(/^./, "x")), null);
  assert.equal(await readState({ CHANNEL_KEY: "other" }, s), null);
});
test("providers are off until their app keys exist; WooCommerce needs none", () => {
  for (const p of Object.keys(OAUTH)) if (p !== "woocommerce") assert.equal(oauthReady(p, env), false, p);
  assert.equal(oauthReady("woocommerce", env), true);
});
test("every auth URL carries our redirect/callback and state", () => {
  const e = { SHOPIFY_CLIENT_ID: "a", SQUARE_APP_ID: "a", WIX_APP_ID: "a", SQUARESPACE_CLIENT_ID: "a", GOOGLE_CLIENT_ID: "a", PINTEREST_APP_ID: "a", META_APP_ID: "a", BIGCOMMERCE_APP_ID: "9" };
  for (const [p, P] of Object.entries(OAUTH)) {
    const u = P.authUrl(e, { shop: "s.myshopify.com", state: "ST", redirect: "https://x/api/oauth/" + p + "/callback", origin: "https://x" });
    assert.ok(/^https:\/\//.test(u), p);
    if (p !== "bigcommerce") { assert.ok(u.includes("ST"), p + " state"); assert.ok(u.includes(encodeURIComponent("https://x/api/oauth/" + p + "/callback")), p + " redirect"); }
  }
  assert.ok(OAUTH.woocommerce.authUrl({}, { shop: "a.com", state: "S", redirect: "https://x/cb", origin: "https://x" }).startsWith("https://a.com/wc-auth/v1/authorize?"));
});
test("Shopify HMAC check", async () => {
  const q = new URLSearchParams({ code: "c", shop: "s.myshopify.com", state: "x", timestamp: "1" });
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode("sec"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const msg = "code=c&shop=s.myshopify.com&state=x&timestamp=1";
  q.set("hmac", [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)))].map((b) => b.toString(16).padStart(2, "0")).join(""));
  assert.equal(await shopifyHmacOk({ SHOPIFY_CLIENT_SECRET: "sec" }, q), true);
  q.set("code", "d"); assert.equal(await shopifyHmacOk({ SHOPIFY_CLIENT_SECRET: "sec" }, q), false);
});
