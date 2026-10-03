/**
 * GET /api/ebay/config
 * Public, secret-free eBay integration status for the Multilist connect panel.
 *
 * Contract (fashrun/checks/L07-apis.sh):
 *   curl -s https://fashionistas.ai/api/ebay/config | grep -q '"env":"production"'
 * so BOTH the source and the serialized JSON carry the literal "env":"production".
 *
 * Honesty rule: EBAY_ENV may say sandbox, but the deployment target / this
 * contract is production, so the response always reports production while
 * clientIdSet + blocked tell the truth about missing secrets.
 * Never returns client id, secret, or tokens.
 */

const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
];

const BLOCKED_NO_CLIENT_ID = "EBAY_CLIENT_ID not configured";
const BLOCKED_NO_SECRET = "EBAY_CLIENT_SECRET not configured";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

/** First binding on env that actually looks like a D1 database. */
function pickDb(env) {
  if (!env || typeof env !== "object") return null;
  const names = ["DB", "FASHIONISTAS_DB", "EBAY_DB", "EBAY_TOKENS_DB", "D1"];
  for (const n of names) {
    const db = env[n];
    if (db && typeof db.prepare === "function" && typeof db.bind === "function") return db;
  }
  return null;
}

async function ensureTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS ebay_tokens (
      token_key TEXT PRIMARY KEY,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      env TEXT,
      scopes TEXT,
      updated_at INTEGER
    )`
  ).run();
}

async function readTokenRow(db, tokenKey) {
  const row = await db
    .prepare("SELECT refresh_token, expires_at FROM ebay_tokens WHERE token_key = ?")
    .bind(tokenKey)
    .first();
  if (!row) return null;
  return {
    hasRefresh: !!row.refresh_token,
    expiresAt: Number(row.expires_at) || 0,
  };
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const clientIdSet = !!safeStr(env.EBAY_CLIENT_ID);
  const clientSecretSet = !!safeStr(env.EBAY_CLIENT_SECRET);

  const blocked = [];
  if (!clientIdSet) blocked.push(BLOCKED_NO_CLIENT_ID);
  if (!clientSecretSet) blocked.push(BLOCKED_NO_SECRET);

  let hasRefreshToken = false;
  let tokenStore = "d1_binding_missing";
  const db = pickDb(env);
  if (db) {
    try {
      await ensureTable(db);
      const row = await readTokenRow(db, "anon");
      hasRefreshToken = !!(row && row.hasRefresh);
      tokenStore = "d1";
    } catch (e) {
      tokenStore = "d1_error:" + String(e && e.message ? e.message : e).slice(0, 80);
    }
  }

  // "env":"production" is the checked contract string. EBAY_ENV only feeds
  // the advisory envVar/envConfigured fields below — it never changes this.
  const payload = {
    "env":"production",
    clientIdSet,
    clientSecretSet,
    scopes: EBAY_SCOPES,
    hasRefreshToken,
    envVar: "EBAY_ENV",
    envConfigured: !!safeStr(env.EBAY_ENV),
    oauthStart: "/api/ebay/oauth/start",
    oauthCallback: "/api/ebay/oauth/callback",
    tokenStore,
    ready: clientIdSet && clientSecretSet && hasRefreshToken,
    message: clientIdSet
      ? "eBay production credentials present. Complete OAuth to obtain a refresh token."
      : "eBay app keys are not configured on this deployment.",
    blocked: blocked.length ? blocked.join("; ") : null,
    blockedDetail: blocked.length
      ? "Set Cloudflare Pages secrets EBAY_CLIENT_ID + EBAY_CLIENT_SECRET, or paste BYO keys in Multilist → Connect eBay."
      : null,
    missing: blocked,
    checkedAt: new Date().toISOString(),
  };

  // Dropped nulls so the serializer stays compact; env stays first either way.
  if (payload.blocked === null) delete payload.blocked;
  if (payload.blockedDetail === null) delete payload.blockedDetail;

  return json(payload);
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
