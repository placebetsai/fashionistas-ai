/**
 * POST /api/etsy/listing
 * createDraftListing + image upload against the Etsy Open API v3:
 *   POST https://openapi.etsy.com/v3/application/listings            (draft)
 *   POST https://openapi.etsy.com/v3/application/listings/:id/images (binary upload)
 *   PUT  https://openapi.etsy.com/v3/application/listings/:id        (state ACTIVE when publish:true)
 *
 * Auth: x-api-key: ETSY_API_KEY + Authorization: Bearer <token from D1 etsy_tokens>.
 * Missing secrets return {"error":"etsy_not_configured","blocked":...} — never a
 * fabricated success.
 */

import { requireAuth } from "../_lib/auth.js";

const OPEN_API = "https://openapi.etsy.com/v3/application";
const REFRESH_HINT = "/api/etsy/oauth/start";

const TOKEN_SCHEMA = `CREATE TABLE IF NOT EXISTS etsy_tokens (
  token_key TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  shop_id TEXT,
  updated_at INTEGER
)`;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith(name + "=")) continue;
    return p.slice(name.length + 1);
  }
  return null;
}

function tokenKey(request) {
  for (const name of ["fash_uid", "fash_user_id", "fash_session", "fash_connect_v1"]) {
    const v = safeStr(readCookie(request, name));
    if (v) return "u:" + v.slice(0, 120);
  }
  return "anon";
}

function pickDb(env) {
  if (!env || typeof env !== "object") return null;
  for (const n of ["DB", "FASHIONISTAS_DB", "ETSY_DB", "ETSY_TOKENS_DB", "D1"]) {
    const db = env[n];
    if (db && typeof db.prepare === "function" && typeof db.bind === "function") return db;
  }
  return null;
}

async function ensureTable(db) {
  await db.prepare(TOKEN_SCHEMA).run();
}

async function readToken(db, key) {
  const row = await db
    .prepare("SELECT access_token, expires_at, shop_id FROM etsy_tokens WHERE token_key = ?")
    .bind(key)
    .first();
  if (!row) return null;
  return {
    access_token: row.access_token || "",
    expires_at: Number(row.expires_at) || 0,
    shop_id: row.shop_id || "",
  };
}

async function etsyFetch(path, { method = "GET", apiKey, token, body, contentType, query }) {
  const url = OPEN_API + path + (query ? "?" + new URLSearchParams(query).toString() : "");
  const headers = { "x-api-key": apiKey, Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
    headers["Content-Type"] = contentType || "image/jpeg";
    payload = body;
  } else if (body != null) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: String(text).slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, data };
}

function firstError(data, status) {
  return (
    (data &&
      (data.error ||
        (data.details && JSON.stringify(data.details).slice(0, 200)) ||
        (Array.isArray(data.errors) && data.errors[0]) ||
        data.message)) ||
    `etsy_http_${status}`
  );
}

function mapCondition(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return "used_good";
  if (/\bnew\b|bnwt|nwt|deadstock/.test(s)) return "new";
  if (/like.?new|excellent|pristine|mint/.test(s)) return "like_new";
  if (/very.?good|gently/.test(s)) return "very_good";
  if (/fair|worn|distressed/.test(s)) return "acceptable";
  return "good";
}

function buildDraftBody(body) {
  const title = safeStr(body.title) || "Untitled item";
  const price = Number(body.price);
  const draft = {
    title: title.slice(0, 140),
    description: (safeStr(body.description) || title).slice(0, 50000),
    quantity: Math.max(1, Number(body.quantity) || 1),
    price: {
      value: (Number.isFinite(price) && price > 0 ? price : 0).toFixed(2),
      currency_code: safeStr(body.currency) || "USD",
    },
    who_made: safeStr(body.whoMade) || "i_did",
    when_made: safeStr(body.whenMade) || "2020_2024",
    is_digital: !!body.isDigital,
    taxonomy_id: Number(body.taxonomyId || body.categoryId) || 2078,
  };
  const tags = Array.isArray(body.tags)
    ? body.tags.map(safeStr).filter(Boolean).slice(0, 13)
    : safeStr(body.tags)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 13);
  if (tags.length) draft.tags = tags;
  const materials = Array.isArray(body.materials)
    ? body.materials.map(safeStr).filter(Boolean).slice(0, 10)
    : [];
  if (materials.length) draft.materials = materials;
  return draft;
}

function imageList(body) {
  const arr = Array.isArray(body.imageUrls)
    ? body.imageUrls
    : Array.isArray(body.images)
      ? body.images
      : [];
  return arr.map(safeStr).filter(Boolean).slice(0, 10);
}

function guessContentType(url, declared) {
  if (declared) return declared;
  const u = String(url).toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const req = context.request;

  // Session gate first. This route previously had none: it read the body and
  // then answered 501 with a description of which Etsy env vars are missing,
  // so an anonymous caller could both drive it and read our configuration
  // state. Nothing below may run until a session is proven.
  const auth = await requireAuth(req, env);
  if (!auth.ok) return auth.response;

  const apiKey = safeStr(env.ETSY_API_KEY);

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!body || typeof body !== "object") body = {};

  if (!apiKey) {
    return json(
      {
        ok: false,
        error: "etsy_not_configured",
        blocked: "ETSY_API_KEY not configured",
        missing: ["ETSY_API_KEY", "ETSY_API_SECRET"],
        message:
          "Etsy app key is not set on this deployment, so no draft listing was created. Nothing was sent to Etsy.",
        nextStep:
          "Create an Open API v3 app at https://www.etsy.com/developers/your-apps and set ETSY_API_KEY (+ ETSY_API_SECRET) as Cloudflare Pages secrets, then connect Etsy.",
        connect: REFRESH_HINT,
      },
      501
    );
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    return json(
      {
        ok: false,
        error: "invalid_price",
        message: "A positive price is required to create an Etsy draft listing.",
      },
      400
    );
  }

  const db = pickDb(env);
  const key = tokenKey(req);
  let token = null;
  let tokenStore = "d1_binding_missing";
  if (db) {
    try {
      await ensureTable(db);
      token = await readToken(db, key);
      tokenStore = token ? "d1" : "d1_empty";
    } catch (e) {
      tokenStore = "d1_error:" + String(e && e.message ? e.message : e).slice(0, 80);
    }
  }

  if (!token || !token.access_token) {
    return json(
      {
        ok: false,
        error: "etsy_not_connected",
        message:
          "No Etsy OAuth token on file (store: " +
          tokenStore +
          "). Connect the Etsy shop before creating listings.",
        nextStep: "GET " + REFRESH_HINT + " → consent → retry POST /api/etsy/listing.",
        tokenStore,
        connect: REFRESH_HINT,
      },
      401
    );
  }

  if (token.expires_at && token.expires_at - Date.now() <= 0) {
    return json(
      {
        ok: false,
        error: "etsy_token_expired",
        message: "The Etsy access token expired; refresh it via OAuth before listing.",
        nextStep: "GET " + REFRESH_HINT + " to refresh tokens, then retry.",
        tokenStore,
      },
      401
    );
  }

  const draftBody = buildDraftBody(body);
  const draft = await etsyFetch("/listings", {
    method: "POST",
    apiKey,
    token: token.access_token,
    body: draftBody,
  });

  if (!draft.ok) {
    const msg = firstError(draft.data, draft.status);
    const authBlocked = draft.status === 401 || draft.status === 403;
    return json(
      {
        ok: false,
        error: authBlocked ? "etsy_auth_failed" : "etsy_draft_create_failed",
        message: String(msg).slice(0, 300),
        nextStep: authBlocked
          ? "Reconnect Etsy (scope listings_w missing or token revoked): " + REFRESH_HINT
          : "Check title/price/taxonomy_id against Etsy's category tree and retry.",
        status: draft.status,
        tokenStore,
        sent: draftBody,
      },
      authBlocked ? 403 : 502
    );
  }

  const listingId = String(
    (draft.data && (draft.data.listing_id || (draft.data.results && draft.data.results.listing_id))) ||
      ""
  );
  if (!listingId) {
    return json(
      {
        ok: false,
        error: "etsy_draft_missing_id",
        message: "Etsy accepted the draft but returned no listing_id.",
        raw: JSON.stringify(draft.data || {}).slice(0, 300),
        tokenStore,
      },
      502
    );
  }

  // Image upload: fetch each provided URL server-side and POST the bytes.
  const uploaded = [];
  const failed = [];
  const urls = imageList(body);
  for (let i = 0; i < urls.length; i++) {
    const src = urls[i];
    try {
      const imgRes = await fetch(src, { method: "GET" });
      if (!imgRes.ok) {
        failed.push({ url: src, reason: `fetch_http_${imgRes.status}` });
        continue;
      }
      const buf = await imgRes.arrayBuffer();
      if (!buf || buf.byteLength < 1) {
        failed.push({ url: src, reason: "empty_image" });
        continue;
      }
      const up = await etsyFetch(`/listings/${encodeURIComponent(listingId)}/images`, {
        method: "POST",
        apiKey,
        token: token.access_token,
        body: new Uint8Array(buf),
        contentType: guessContentType(src, (imgRes.headers.get("content-type") || "").split(";")[0]),
        query: { rank: i + 1, overwrite: "true" },
      });
      if (up.ok) uploaded.push({ url: src, rank: i + 1 });
      else failed.push({ url: src, reason: String(firstError(up.data, up.status)).slice(0, 160) });
    } catch (e) {
      failed.push({ url: src, reason: String(e && e.message ? e.message : e).slice(0, 120) });
    }
  }

  let state = "draft";
  let publishError = null;
  if (body.publish === true || body.publish === "true") {
    const pub = await etsyFetch(`/listings/${encodeURIComponent(listingId)}`, {
      method: "PUT",
      apiKey,
      token: token.access_token,
      body: { state: "ACTIVE" },
    });
    if (pub.ok) state = "active";
    else publishError = String(firstError(pub.data, pub.status)).slice(0, 240);
  }

  return json(
    {
      ok: true,
      listingId,
      state,
      title: draftBody.title,
      price: draftBody.price,
      imagesUploaded: uploaded.length,
      imagesFailed: failed,
      imageErrors: failed.length ? failed : undefined,
      publishError,
      tokenStore,
      conditionHint: mapCondition(body.condition),
      note: publishError
        ? "Draft + images created, but activating the listing failed: " + publishError
        : state === "active"
          ? "Listing live on Etsy."
          : "Draft created. Send publish:true to activate.",
    },
    200
  );
}

/** Usage/discovery — same session gate as the POST, so it is not public. */
export async function onRequestGet(context) {
  const auth = await requireAuth(context.request, context.env || {});
  if (!auth.ok) return auth.response;
  return json({
    ok: true,
    method: "POST",
    usage:
      'POST JSON { title, description, price, quantity, taxonomyId?, tags?, imageUrls?, publish?, whoMade?, whenMade? } with an Etsy OAuth token (see /api/etsy/oauth/start).',
  });
}
