/** POST /api/channels/post {listing_id, channel} — create the listing on a connected store via its real API. Marks "listed" only when the API returned an id. */
import { requireAuth, getDB, json } from "../_lib/auth.js";
import { byId } from "../../_lib/channels.js";
import { open, seal, ensureCreds } from "../../_lib/vault.js";
import { OAUTH } from "../../_lib/oauth-apps.js";
import { ADAPTERS, productOf } from "../../_lib/channel-adapters.js";
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env); if (!auth.ok) return auth.response;
  const db = getDB(env); if (!db) return json({ ok: false, error: "db_unavailable" }, 503);
  const b = await request.json().catch(() => ({}));
  const c = byId(String(b.channel || "")), id = Number(b.listing_id), uid = Number(auth.user.id);
  if (!c || !ADAPTERS[c.id] || !Number.isInteger(id)) return json({ ok: false, error: "bad_request" }, 400);
  const l = await db.prepare("SELECT * FROM listings WHERE id=? AND user_id=?").bind(id, uid).first();
  if (!l) return json({ ok: false, error: "not_found" }, 404);
  await ensureCreds(db);
  const row = await db.prepare("SELECT enc FROM channel_creds WHERE user_id=? AND channel=?").bind(uid, c.id).first();
  let creds = row && await open(env, row.enc);
  if (!creds) return json({ ok: false, error: "not_connected" }, 409);
  const P = OAUTH[c.id];
  if (P && P.refresh && creds.refresh_token && creds.expires_at && creds.expires_at < Date.now() + 60000) {
    try { creds = await P.refresh(env, creds); await db.prepare("UPDATE channel_creds SET enc=? WHERE user_id=? AND channel=?").bind(await seal(env, creds), uid, c.id).run(); }
    catch (e) { return json({ ok: false, error: "reconnect_needed", detail: c.name + " sign-in expired — tap Connect again" }, 409); }
  }
  const r = await ADAPTERS[c.id](creds, productOf(l));
  if (!r.ok) return json({ ok: false, error: "remote_failed", detail: r.error }, 502);
  try { await db.prepare("CREATE TABLE IF NOT EXISTS listing_platforms (id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER, platform TEXT, status TEXT, listing_copy TEXT, url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run(); } catch {}
  try { await db.prepare("ALTER TABLE listing_platforms ADD COLUMN url TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE listing_platforms ADD COLUMN remote_id TEXT").run(); } catch {}
  const url = r.url && /^https:\/\//.test(r.url) ? r.url : null;
  const ex = await db.prepare("SELECT 1 AS x FROM listing_platforms WHERE listing_id=? AND platform=?").bind(id, c.id).first();
  if (ex) await db.prepare("UPDATE listing_platforms SET status='listed', url=?, remote_id=? WHERE listing_id=? AND platform=?").bind(url, r.remote_id, id, c.id).run();
  else await db.prepare("INSERT INTO listing_platforms (listing_id, platform, status, url, remote_id) VALUES (?,?,?,?,?)").bind(id, c.id, "listed", url, r.remote_id).run();
  return json({ ok: true, channel: c.id, remote_id: r.remote_id, url, note: r.note || null });
}
