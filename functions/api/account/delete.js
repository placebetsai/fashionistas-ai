/**
 * POST /api/account/delete — in-app account deletion (Google Play + App Store requirement).
 * Body: {"confirm":"DELETE"}. Signed-in only; deletes only the caller's own rows.
 * Removes: listings, passkeys, marketplace connections, channel keys/posts, orders,
 * hauls, messages, DMs, blocks, popup stores, try-on rows, sessions, the user row,
 * and the caller's uploaded photos in R2 (prefix u/<id>/).
 */
import { requireAuth, getDB, json } from "../_lib/auth.js";

const BY_USER = ["listings", "passkeys", "marketplace_connections", "channel_keys", "channel_posts",
  "orders", "hauls", "messages", "ar_tryons", "sessions", "closet", "closet_items", "tryon_jobs"];
const OTHER = [
  ["dm_messages", "from_id = ?1 OR to_id = ?1"],
  ["dm_blocks", "blocker_id = ?1 OR blocked_id = ?1"],
  ["popup_stores", "owner_id = ?1"],
  ["tryon_slots", "user = CAST(?1 AS TEXT)"],
];

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  if (!body || body.confirm !== "DELETE") {
    return json({ ok: false, error: "confirm_required", detail: 'Send {"confirm":"DELETE"} to delete your account.' }, 400);
  }
  const id = Number(auth.user.id);
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "bad_user" }, 400);
  const db = getDB(env);
  if (!db) return json({ ok: false, error: "db_unavailable", detail: "Try again in a minute." }, 503);

  const removed = {};
  const run = async (table, where) => {
    try {
      const r = await db.prepare(`DELETE FROM ${table} WHERE ${where}`).bind(id).run();
      removed[table] = (r.meta && r.meta.changes) || 0;
    } catch (_) { /* table or column not present on this database */ }
  };
  for (const t of BY_USER) await run(t, "user_id = ?1");
  for (const [t, w] of OTHER) await run(t, w);
  await run("users", "id = ?1");

  let photos = 0;
  const bucket = env.IMAGES || env.TRYON_BUCKET;
  if (bucket && typeof bucket.list === "function") {
    try {
      let cursor;
      do {
        const page = await bucket.list({ prefix: `u/${id}/`, cursor, limit: 1000 });
        const keys = page.objects.map((o) => o.key);
        if (keys.length) { await bucket.delete(keys); photos += keys.length; }
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    } catch (_) {}
  }
  if (!removed.users) {
    return json({ ok: false, error: "not_deleted", detail: "We couldn't delete the account. Use the contact form and a person will do it.", removed }, 500);
  }
  return json({ ok: true, removed, photos }, 200, {
    "set-cookie": "fash_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  });
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
}
