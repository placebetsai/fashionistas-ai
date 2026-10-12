/**
 * GET /api/auth/me
 * Same credential as the rest of the app: a Worker HMAC bearer token, or the
 * HttpOnly fash_session cookie. Both are checked by requireAuth. A signed-in
 * shopper used to get 401 here because this route only looked in the D1
 * sessions table, which the web app never writes.
 */
import { requireAuth, json } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const auth = await requireAuth(context.request, context.env);
  if (!auth.ok) {
    if (auth.response && auth.response.status === 401) return json({ error: "Not signed in." }, 401);
    return auth.response;
  }
  return json({ id: auth.user.id, email: auth.user.email || "", authenticated: true });
}

export async function onRequest(context) {
  return onRequestGet(context);
}
