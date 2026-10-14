/**
 * POST /api/oauth/<provider>/start  {shop?}  (signed in) → {ok, url}; the browser then navigates to url.
 * GET  /api/oauth/<provider>/callback          → exchanges the code, stores tokens encrypted, back to the board.
 * POST /api/oauth/woocommerce/callback          → WooCommerce's key grant POSTs the new REST keys here.
 * Every provider is off until its one-time app keys exist in env (see functions/_lib/oauth-apps.js).
 */
import { requireAuth, getDB, json } from "../_lib/auth.js";
import { seal, ensureCreds } from "../../_lib/vault.js";
import { OAUTH, oauthReady, signState, readState, shopifyHmacOk, SHOP_HOST } from "../../_lib/oauth-apps.js";

const back = (origin, p, err) => Response.redirect(origin + "/seller/board/?" + (err ? "connect_error=" + encodeURIComponent(p + ": " + String(err).slice(0, 160)) : "connected=" + p) + "#ch", 302);
async function save(db, env, uid, ch, creds, label) {
  await ensureCreds(db);
  const enc = await seal(env, creds); if (!enc) throw new Error("vault off");
  await db.prepare("INSERT INTO channel_creds (user_id, channel, enc, label) VALUES (?,?,?,?) ON CONFLICT(user_id, channel) DO UPDATE SET enc=excluded.enc, label=excluded.label, created_at=CURRENT_TIMESTAMP").bind(Number(uid), ch, enc, String(label || "").slice(0, 120)).run();
}
function cookie(req, n) { const m = (req.headers.get("Cookie") || "").match(new RegExp("(?:^|; )" + n + "=([^;]+)")); return m ? decodeURIComponent(m[1]) : null; }
function normShop(p, raw) {
  let h = String(raw || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (p === "shopify" && h && !h.includes(".")) h += ".myshopify.com";
  if (!SHOP_HOST.test(h)) return null;
  if (p === "shopify" && !/\.myshopify\.com$/.test(h)) return null;
  return h;
}

export async function onRequest({ request, env, params }) {
  const [p, step] = [].concat(params.path || []);
  const P = OAUTH[p]; const url = new URL(request.url); const origin = url.origin;
  const redirect = origin + "/api/oauth/" + p + "/callback";
  if (!P || !["start", "callback"].includes(step)) return json({ ok: false, error: "not_found" }, 404);
  if (!env.CHANNEL_KEY) return json({ ok: false, error: "channels_off" }, 503);
  const db = getDB(env); if (!db) return json({ ok: false, error: "db_unavailable" }, 503);

  if (step === "start") {
    if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
    if (!oauthReady(p, env)) return json({ ok: false, error: "app_not_registered", detail: P.name + " needs the site owner's one-time app keys: " + P.env.join(", ") }, 503);
    const b = await request.json().catch(() => ({}));
    let shop = null; if (P.needsShop) { shop = normShop(p, b.shop); if (!shop) return json({ ok: false, error: "bad_shop", detail: "Enter your " + P.needsShop + (p === "shopify" ? " (e.g. mystore or mystore.myshopify.com)" : " (e.g. mystore.com)") }, 400); }
    const state = await signState(env, { u: Number(auth.user.id), p, shop });
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
    if (P.cookieState) headers["Set-Cookie"] = "fa_oauth_" + p + "=" + encodeURIComponent(state) + "; Path=/api/oauth/" + p + "; HttpOnly; Secure; SameSite=None; Max-Age=900";
    return new Response(JSON.stringify({ ok: true, url: P.authUrl(env, { shop, state, redirect, origin }) }), { headers });
  }

  // ---- callbacks ----
  if (p === "woocommerce" && request.method === "POST") {
    const b = await request.json().catch(() => null);
    const st = b && await readState(env, b.user_id);
    if (!st || st.p !== "woocommerce" || !b.consumer_key || !b.consumer_secret) return json({ ok: false, error: "bad_state" }, 400);
    await save(db, env, st.u, "woocommerce", { store_url: st.shop, consumer_key: String(b.consumer_key), consumer_secret: String(b.consumer_secret) }, st.shop);
    return json({ ok: true });
  }
  if (request.method !== "GET") return json({ ok: false, error: "method" }, 405);
  if (url.searchParams.get("error")) return back(origin, p, url.searchParams.get("error_description") || url.searchParams.get("error"));
  const st = await readState(env, P.cookieState ? cookie(request, "fa_oauth_" + p) : url.searchParams.get("state"));
  if (!st || st.p !== p) return back(origin, p, "sign-in expired — tap Connect again");
  if (!oauthReady(p, env) || !P.exchange) return back(origin, p, "not set up");
  try {
    if (p === "shopify") { if (!(await shopifyHmacOk(env, url.searchParams)) || normShop(p, url.searchParams.get("shop")) !== st.shop) return back(origin, p, "signature check failed"); }
    const r = await P.exchange(env, url.searchParams, st, redirect);
    if (!r.creds || !(r.creds.access_token || r.creds.admin_token || r.creds.api_key)) throw new Error("no token returned");
    let label = r.label;
    if (P.feed && P.pushFeed) { const f = await P.pushFeed(r.creds, origin + "/feeds/" + st.u + ".xml"); label = f.label; r.creds.feed_remote = f.remote || null; }
    await save(db, env, st.u, p, r.creds, label);
    return back(origin, p);
  } catch (e) { return back(origin, p, e.message || e); }
}
