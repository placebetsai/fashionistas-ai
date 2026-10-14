/** GET /api/channels — every channel with its honest status for the signed-in seller (never returns secrets). */
import { requireAuth, getDB, json } from "../_lib/auth.js";
import { CHANNELS, platformReady } from "../../_lib/channels.js";
import { ensureCreds } from "../../_lib/vault.js";
import { OAUTH, oauthReady } from "../../_lib/oauth-apps.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const db = getDB(env); const connected = {};
  if (db) { try { await ensureCreds(db); const r = await db.prepare("SELECT channel, label, created_at FROM channel_creds WHERE user_id=?").bind(Number(auth.user.id)).all(); for (const x of r.results || []) connected[x.channel] = { label: x.label, since: x.created_at }; } catch {} }
  const origin = new URL(request.url).origin;
  return json({ ok: true, vault: !!env.CHANNEL_KEY, feed: { xml: origin + "/feeds/" + Number(auth.user.id) + ".xml", csv: origin + "/feeds/" + Number(auth.user.id) + ".csv" },
    channels: CHANNELS.map((c) => ({ id: c.id, name: c.name, mode: c.mode, built: c.built, apiBuilt: c.apiBuilt, api: c.api, approval: c.approval, cost: c.cost, why: c.why || null, keyHelp: c.keyHelp || null, sellerFields: c.sellerFields || null, feed: !!c.feed || c.mode === "feed", platformReady: platformReady(c, env), connected: connected[c.id] || null, oauth: !!OAUTH[c.id], oauthReady: oauthReady(c.id, env), needsShop: (OAUTH[c.id] && OAUTH[c.id].needsShop) || null, clicks: (OAUTH[c.id] && OAUTH[c.id].clicks) || null, oauthEnv: (OAUTH[c.id] && OAUTH[c.id].env) || null })) });
}
