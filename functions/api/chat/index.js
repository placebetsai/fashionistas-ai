/**
 * POST /api/chat — the stylist chat, grounded in exactly two things:
 * the caller's own listings, and this repo's fee table.
 *
 * Request:  application/json
 *   { "message": "what should I price the Levi's jacket at?",
 *     "history": [{ "role": "user"|"assistant", "content": "…" }]  optional, <=10 }
 *
 * Response: 200 grounded  { ok, refused:false, answer, sources:[…], topics,
 *                           usage:{…}, model:{provider,model} }
 *           200 refused   { ok, refused:true, reason, answer, sources: [],
 *                           allowedTopics:[…], usage:{…} }
 *           400 bad JSON / bad history      405 non-POST
 *           415 non-JSON content type       422 missing/oversized message
 *           401 no session                  402 free-tier chat cap reached
 *           502 model failed schema OR answer cited nothing real (fail closed)
 *           503 model runtime not configured  504 model timed out
 *
 * `sources` is built from OUR rows — D1 listings and _lib/fees.js fee rows —
 * never from the model's echo of them, so a citation in the response is a real
 * row by construction. An out-of-scope question never reaches the model: the
 * scope gate in _lib/grounding.js refuses it deterministically, which is why
 * the refusal test can also assert that no model call happened.
 */

import { json, requireAuth } from "../_lib/auth.js";
import { ModelError, completeJSON, describeModel, modelConfig } from "../listing/_lib/model.js";
import { charge, checkQuota, listClosetItems, listListings, usageSnapshot } from "../listing/_lib/usage.js";
import {
  ALLOWED_TOPICS,
  CHAT_SYSTEM_PROMPT,
  buildRefusal,
  chatUserPrompt,
  classifyScope,
  feeSources,
  validateChatAnswer,
} from "./_lib/grounding.js";

const ALLOW = "POST, OPTIONS";
const MAX_MESSAGE = 2000;
const MAX_HISTORY = 10;

/** Validate the body. Returns { message, history } or { error }. */
function parseRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: json({ ok: false, error: "invalid_body", detail: "Expected a JSON object." }, 400) };
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return {
      error: json(
        { ok: false, error: "missing_message", detail: 'message is required, e.g. { message: "…" }.' },
        422
      ),
    };
  }
  if (message.length > MAX_MESSAGE) {
    return {
      error: json(
        { ok: false, error: "message_too_long", detail: `message must be <= ${MAX_MESSAGE} characters.` },
        422
      ),
    };
  }

  let history = [];
  if (body.history !== undefined && body.history !== null) {
    if (!Array.isArray(body.history)) {
      return {
        error: json({ ok: false, error: "invalid_history", detail: "history must be an array." }, 400),
      };
    }
    history = [];
    for (const turn of body.history.slice(-MAX_HISTORY)) {
      if (!turn || typeof turn !== "object") {
        return {
          error: json({ ok: false, error: "invalid_history", detail: "each turn must be an object." }, 400),
        };
      }
      const role = turn.role === "assistant" ? "assistant" : turn.role === "user" ? "user" : null;
      const content = typeof turn.content === "string" ? turn.content.trim().slice(0, MAX_MESSAGE) : "";
      if (!role || !content) {
        return {
          error: json(
            {
              ok: false,
              error: "invalid_history",
              detail: 'each turn needs role "user"|"assistant" and a non-empty content string.',
            },
            400
          ),
        };
      }
      history.push({ role, content });
    }
  }
  return { message, history };
}

function modelErrorResponse(err, env) {
  if (err instanceof ModelError) {
    return json(
      { ok: false, error: err.code, detail: err.message, model: describeModel(modelConfig(env)) },
      err.status
    );
  }
  return json(
    { ok: false, error: "model_call_failed", detail: String((err && err.message) || err) },
    502
  );
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { allow: ALLOW, "cache-control": "no-store" },
    });
  }
  if (method !== "POST") {
    return json(
      { ok: false, error: "method_not_allowed", detail: "Use POST with { message }." },
      405,
      { allow: ALLOW }
    );
  }

  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("json")) {
    return json(
      {
        ok: false,
        error: "unsupported_media_type",
        detail: 'Content-Type must be application/json, e.g. { message: "…" }.',
      },
      415,
      { allow: ALLOW }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ ok: false, error: "invalid_json", detail: String((err && err.message) || err) }, 400);
  }

  const parsed = parseRequest(body);
  if (parsed.error) return parsed.error;
  const { message, history } = parsed;

  // --- auth (401) ---------------------------------------------------------
  const auth = await requireAuth(request, env);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  // --- free-tier cap (402) ------------------------------------------------
  const quota = await checkQuota(env, userId, "chat_messages");
  if (!quota.ok) return quota.response;

  // --- context: the user's own rows + the fee table -----------------------
  const listings = [
    ...(await listListings(env, userId, 20)),
    ...(await listClosetItems(env, userId, auth.user.email, 20)),
  ].slice(0, 30);

  // --- scope gate: refuse BEFORE any model call ---------------------------
  const scope = classifyScope(message, listings);
  if (!scope.ok) {
    const refusal = buildRefusal(scope.reason);
    refusal.usage = await usageSnapshot(env, userId);
    return json(refusal, 200);
  }

  // No listings at all and a listing-shaped question: there is nothing to
  // ground on, and saying so is more honest than letting a model improvise.
  if (scope.topics.includes("your_listings") && listings.length === 0) {
    if (!scope.topics.includes("marketplace_fees")) {
      return json(
        {
          ok: true,
          refused: false,
          code: "no_listings",
          answer:
            "You don't have any listings yet, so there is nothing to compare against. " +
            "Write one with POST /api/listing and ask me again.",
          sources: [],
          topics: scope.topics,
          usage: await usageSnapshot(env, userId),
        },
        200
      );
    }
  }

  const fees = feeSources(scope.price);
  const usableListings = scope.topics.includes("your_listings") ? listings : [];

  // --- model --------------------------------------------------------------
  let modelOut;
  try {
    modelOut = await completeJSON(env, {
      system: CHAT_SYSTEM_PROMPT,
      prompt: chatUserPrompt({ message, listings: usableListings, fees, history }),
      temperature: 0,
    });
  } catch (err) {
    return modelErrorResponse(err, env);
  }

  const checked = validateChatAnswer(modelOut, [
    ...usableListings.map((l) => ({
      type: "listing",
      id: l.id,
      title: l.title,
      brand: l.brand || null,
      condition: l.condition || null,
      price: l.price === undefined ? null : l.price,
      origin: l.origin,
    })),
    ...fees,
  ]);
  if (!checked.ok) {
    return json(
      {
        ok: false,
        error: checked.code,
        detail:
          checked.code === "ungrounded_answer"
            ? "The model cited no source that this server supplied; the answer was discarded."
            : "The model answer did not match the chat schema; nothing was returned.",
        errors: checked.errors,
        model: describeModel(modelConfig(env)),
      },
      502
    );
  }

  const charged = await charge(env, userId, "chat_messages");
  if (!charged.ok) console.error("[chat] quota charge failed:", charged.error);

  if (checked.refused) {
    const refusal = buildRefusal(checked.reason);
    refusal.usage = await usageSnapshot(env, userId);
    refusal.model = describeModel(modelConfig(env));
    return json(refusal, 200);
  }

  return json({
    ok: true,
    refused: false,
    answer: checked.answer,
    sources: checked.sources,
    topics: scope.topics,
    usage: await usageSnapshot(env, userId),
    model: describeModel(modelConfig(env)),
    allowedTopics: ALLOWED_TOPICS,
  });
}

export const onRequestPost = onRequest;
