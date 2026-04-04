/**
 * Unified AI Orchestrator — Thin Gateway
 *
 * Single entry point for ALL AI operations. This module only handles:
 *   1. Preflight / method guard
 *   2. Authentication
 *   3. Request normalization
 *   4. Dispatch to the correct domain handler
 *   5. Error mapping
 *
 * All business/domain logic lives in gateway/* handler modules.
 *
 * Supported types:
 *   chat · memory · media · image · video · workflow · agent · realtime
 *   voice · realtime_token · multimodal · live_talk · stream · knowledge
 *   refine_media
 */

import { preflight, fail } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

import { authenticate } from "./gateway/auth.js";
import { normalizeRequest } from "./gateway/normalize.js";
import { mapGatewayError } from "./gateway/error-mapping.js";

import { handleChat, handleMemory } from "./gateway/chat-handler.js";
import { handleMedia, handleMultimodal, handleRefineMedia } from "./gateway/media-handler.js";
import { handleRealtime, handleRealtimeToken, handleVoice } from "./gateway/realtime-handler.js";
import { handleLiveTalk } from "./gateway/live-talk-handler.js";
import { handleKnowledge, handleWorkflow } from "./gateway/knowledge-handler.js";

/* ── Dispatch registry ────────────────────────────────────────────────────── */

const DISPATCH = {
  chat:           (p) => handleChat(p),
  memory:         (p) => handleMemory(p),
  media:          (p) => handleMedia(p),
  image:          (p) => handleMedia({ ...p, media_type: "image" }),
  video:          (p) => handleMedia({ ...p, media_type: "video" }),
  workflow:       (p) => handleWorkflow(p),
  agent:          (p) => handleWorkflow(p),
  realtime:       (p) => handleRealtime(p),
  voice:          (p) => handleVoice(p),
  realtime_token: (p) => handleRealtimeToken(p),
  multimodal:     (p) => handleMultimodal(p),
  live_talk:      (p) => handleLiveTalk(p),
  stream:         (p) => handleChat({ ...p, stream: true }),
  knowledge:      (p) => handleKnowledge(p),
  refine_media:   (p) => handleRefineMedia(p),
};

/* ── Gateway entrypoint ───────────────────────────────────────────────────── */

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const authUser = await authenticate(event);
    if (!authUser?.id) {
      return fail("Unauthorized", "ERR_AUTH", 401);
    }

    const { type, payload } = normalizeRequest(event, authUser);

    const domainHandler = DISPATCH[type];
    if (!domainHandler) {
      return fail("Invalid request type", "ERR_VALIDATION", 400);
    }

    log.info("[ai-orchestrator]", "dispatching:", { type, user: authUser.id });
    return await domainHandler(payload);
  } catch (err) {
    return mapGatewayError(err);
  }
}
