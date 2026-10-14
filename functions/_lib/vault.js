/** AES-GCM for seller-supplied channel keys. Off (returns null) until env.CHANNEL_KEY exists. Never logs plaintext. */
async function key(env) {
  if (!env || !env.CHANNEL_KEY) return null;
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(env.CHANNEL_KEY)));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function seal(env, obj) {
  const k = await key(env); if (!k) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(JSON.stringify(obj)));
  return b64(iv) + "." + b64(ct);
}
export async function open(env, s) {
  const k = await key(env); if (!k || !s) return null;
  const [iv, ct] = String(s).split(".");
  try { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, k, unb64(ct)))); } catch { return null; }
}
export async function ensureCreds(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS channel_creds (user_id INTEGER NOT NULL, channel TEXT NOT NULL, enc TEXT NOT NULL, label TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, channel))").run();
}
