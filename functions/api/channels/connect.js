/**
 * POST /api/channels/connect {channel, fields:{...}} — store the seller's own store key, encrypted (AES-GCM, env.CHANNEL_KEY).
 * DELETE /api/channels/connect?channel=x — forget it. Off until CHANNEL_KEY exists.
 */
import { requireAuth, getDB, json } from "../_lib/auth.js";
import { byId } from "../../_lib/channels.js";
import { seal, ensureCreds } from "../../_lib/vault.js";
const HOST = /^(?!localhost$)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  if (!env.CHANNEL_KEY) return json({ ok: false, error: "channels_off", detail: "Store connections are off until the site owner sets CHANNEL_KEY." }, 503);
  const db = getDB(env); if (!db) return json({ ok: false, error: "db_unavailable" }, 503);
  const b = await request.json().catch(() => ({}));
  const c = byId(String(b.channel || ""));
  if (!c || c.mode !== "api_seller_key" || !c.built) return json({ ok: false, error: "not_connectable" }, 400);
  const f = {}; for (const k of c.sellerFields) { const v = String((b.fields || {})[k] || "").trim(); if (!v || v.length > 400) return json({ ok: false, error: "missing_" + k }, 400); f[k] = v; }
  for (const k of ["store_url", "shop_domain"]) if (f[k]) { const h = f[k].replace(/^https?:\/\//i, "").replace(/\/.*$/, ""); if (!HOST.test(h)) return json({ ok: false, error: "bad_" + k }, 400); f[k] = h; }
  const enc = await seal(env, f);
  const label = f.store_url || f.shop_domain || f.store_hash || f.site_id || c.name;
  await ensureCreds(db);
  await db.prepare("INSERT INTO channel_creds (user_id, channel, enc, label) VALUES (?,?,?,?) ON CONFLICT(user_id, channel) DO UPDATE SET enc=excluded.enc, label=excluded.label, created_at=CURRENT_TIMESTAMP").bind(Number(auth.user.id), c.id, enc, label).run();
  return json({ ok: true, channel: c.id, label });
}
export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const db = getDB(env); if (!db) return json({ ok: false, error: "db_unavailable" }, 503);
  await ensureCreds(db);
  await db.prepare("DELETE FROM channel_creds WHERE user_id=? AND channel=?").bind(Number(auth.user.id), String(new URL(request.url).searchParams.get("channel") || "")).run();
  return json({ ok: true });
}
