import { test } from "node:test";
import assert from "node:assert/strict";
import { CHANNELS } from "../functions/_lib/channels.js";
import { ADAPTERS, productOf } from "../functions/_lib/channel-adapters.js";
import { seal, open } from "../functions/_lib/vault.js";

test("every channel states api, approval and mode honestly", () => {
  const modes = new Set(["api_seller_key", "api_oauth", "feed", "partner", "guided"]);
  for (const c of CHANNELS) { assert.ok(modes.has(c.mode), c.id); assert.ok(c.api && c.approval !== undefined && c.cost !== undefined, c.id); }
  for (const c of CHANNELS.filter((c) => c.mode === "guided" || c.mode === "partner")) assert.equal(c.built, false, c.id + " must not claim to be built");
});
test("every built seller-key channel has a real adapter", () => {
  for (const c of CHANNELS.filter((c) => c.mode === "api_seller_key" && c.built)) assert.equal(typeof ADAPTERS[c.id], "function", c.id);
});
test("productOf maps a listing without inventing fields", () => {
  const p = productOf({ id: 7, title: "Jacket", price: 30, photo_url: "https://x/y.jpg", condition: "Good" });
  assert.equal(p.price, "30.00"); assert.equal(p.condition, "used"); assert.equal(p.sku, "FA-7"); assert.ok(!/Brand/.test(p.description));
});
test("vault is off without CHANNEL_KEY and round-trips with it", async () => {
  assert.equal(await seal({}, { a: 1 }), null);
  const env = { CHANNEL_KEY: "test-key" }; const s = await seal(env, { token: "t" });
  assert.ok(s && !s.includes("t\"")); assert.deepEqual(await open(env, s), { token: "t" }); assert.equal(await open({ CHANNEL_KEY: "other" }, s), null);
});
test("adapters only report success when the remote returns an id", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({}), { status: 200 });
  try { const r = await ADAPTERS.woocommerce({ store_url: "shop.example.com", consumer_key: "k", consumer_secret: "s" }, productOf({ id: 1, title: "A", price: 5 })); assert.equal(r.ok, false); }
  finally { globalThis.fetch = orig; }
});
