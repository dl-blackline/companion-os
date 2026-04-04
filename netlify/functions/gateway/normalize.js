/**
 * gateway/normalize.js — Request normalization and mode resolution.
 *
 * Parses the raw event body, normalizes field names (snake_case / camelCase),
 * resolves the request type/mode, and produces a canonical request shape that
 * domain handlers can rely on.
 */

import { validatePayloadSize, sanitizeDeep } from "../../../lib/_security.js";
import { log } from "../../../lib/_log.js";

/**
 * Normalize field names — accept both snake_case (backend) and camelCase
 * (frontend) conventions so callers don't need to know which one to use.
 */
function normalizeFieldNames(p) {
  if (!p || typeof p !== "object") return p;
  return {
    ...p,
    conversation_id: p.conversation_id ?? p.conversationId,
    user_id: p.user_id ?? p.userId,
    media_url: p.media_url ?? p.mediaUrl,
    media_type: p.media_type ?? p.mediaType,
  };
}

/**
 * Parse, validate, and normalize a raw Netlify event into a canonical request.
 *
 * @param {object} event      Netlify function event
 * @param {object} authUser   Authenticated user from gateway/auth
 * @returns {{ type: string, payload: object }}
 * @throws {Error} on invalid payload size, missing body, or bad JSON
 */
export function normalizeRequest(event, authUser) {
  const sizeCheck = validatePayloadSize(event.body);
  if (!sizeCheck.valid) {
    const err = new Error(sizeCheck.error);
    err.code = "ERR_PAYLOAD_SIZE";
    err.statusCode = 413;
    throw err;
  }

  const body = sanitizeDeep(JSON.parse(event.body));

  const { type, data, input, action, config } = body;

  log.info("[ai-orchestrator]", "gateway request:", { type });

  // Accept both 'data' (backend-native) and 'input' (frontend convention).
  // Hoist config.model into the payload so callers that send the model inside
  // a config block don't need to duplicate it.
  const rawPayload = data || input || {};
  const modelFromConfig = config?.model;
  const payload = normalizeFieldNames({
    ...rawPayload,
    ...(modelFromConfig && !rawPayload.model ? { model: modelFromConfig } : {}),
  });

  // Stamp authenticated identity onto the payload
  if (payload && typeof payload === "object") {
    payload.user_id = authUser.id;
    if (authUser.email) payload.user_email = authUser.email;
  }

  // Hoist body-level action into payload when present
  if (action && typeof payload === "object") {
    payload.action = payload.action || action;
  }

  if (!type) {
    const err = new Error("Missing request type");
    err.code = "ERR_VALIDATION";
    err.statusCode = 400;
    throw err;
  }

  return { type, payload };
}
