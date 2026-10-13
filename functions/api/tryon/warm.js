/**
 * POST /api/tryon/warm — wake the FASHN GPU before the buyer taps "Try it on".
 * The Modal container loads the model at boot, so a /healthz ping while the
 * buyer is still picking photos turns a ~2-3 min cold first render into the
 * ~20 s warm one. Signed-in only, at most one ping per user per 2 minutes.
 * Cost: one cold boot + 60 s idle on an L4 (~$0.80/h) ≈ $0.03-0.05 per wake,
 * and nothing when the container is already up.
 */
import { requireAuth, json } from "../_lib/auth.js";
import { modalReady, DEFAULT_MODAL_URL } from "../_tryon/vton-paid.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  if (!modalReady(env)) return json({ ok: false, error: "not_configured" }, 503);
  const key = "warm:" + auth.user.id;
  const kv = env.KV || env.CACHE || env.FASHIONISTAS_KV || null;
  try { if (kv && (await kv.get(key))) return json({ ok: true, skipped: true }); } catch {}
  try { if (kv) await kv.put(key, "1", { expirationTtl: 120 }); } catch {}
  const url = String(env.FASHN_MODAL_URL || DEFAULT_MODAL_URL).replace(/\/+$/, "") + "/healthz";
  const t = Date.now();
  const ping = fetch(url, { headers: { "Modal-Key": env.MODAL_PROXY_KEY, "Modal-Secret": env.MODAL_PROXY_SECRET }, signal: AbortSignal.timeout(25000) })
    .then((r) => r.status).catch(() => "pending");
  // Answer fast; a cold boot keeps going on Modal's side after we stop waiting.
  const status = await Promise.race([ping, new Promise((r) => setTimeout(() => r("waking"), 2500))]);
  context.waitUntil && context.waitUntil(ping);
  return json({ ok: true, state: status === 200 ? "warm" : "waking", ms: Date.now() - t });
}
