import { orchestrate } from "../../services/ai/orchestrator.js";
import { supabase } from "../../lib/_supabase.js";
import {
  createCompanionState,
  transitionState,
  getStateSnapshot,
} from "../../lib/realtime/companion-state.js";
import {
  createAvatarState,
  transitionAvatar,
  avatarStateFromCompanion,
  generateLipSyncFrames,
  applyLipSync,
} from "../../lib/realtime/avatar-controller.js";
import { formatSSE } from "../../lib/realtime/stream-handler.js";
import { preflight, fail, CORS_HEADERS } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

/** Default estimated speech duration (ms) used for lip-sync frame generation. */
const DEFAULT_SPEECH_DURATION_MS = 5000;

/**
 * Companion Stream — SSE endpoint for real-time streaming AI responses.
 *
 * POST /.netlify/functions/companion-stream
 *
 * Body (JSON):
 *   message           (string, required) — user message
 *   user_id           (string, required) — user identifier
 *   conversation_id   (string, required) — conversation id
 *   session_id        (string, optional) — realtime session id
 *   model             (string, optional) — AI model id
 *   unfiltered        (boolean, optional)
 *   aiMood            (string, optional)
 *   customInstructions (string, optional)
 *   includeAvatarState (boolean, optional, default true)
 *
 * Response: text/event-stream with SSE events:
 *   event: state   — companion + avatar state transitions
 *   event: token   — individual token deltas
 *   event: image   — inline image generation result
 *   event: done    — stream complete with full text
 *   event: error   — error during stream
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return fail("Invalid JSON body", "ERR_PARSE", 400);
  }

  const { message, user_id, conversation_id } = body;

  if (!message || !user_id || !conversation_id) {
    return fail(
      "Missing required fields: message, user_id, conversation_id",
      "ERR_VALIDATION",
      400
    );
  }

  const includeAvatarState = body.includeAvatarState !== false;
  const now = () => new Date().toISOString();

  // Build SSE response body
  let sseBody = "";

  // ── State: listening ──
  let companionState = createCompanionState();
  let avatarState = createAvatarState();

  companionState = transitionState(companionState, "listening", "user_input_received");
  avatarState = transitionAvatar(avatarState, "listening");

  if (includeAvatarState) {
    sseBody += formatSSE("state", {
      companionState: getStateSnapshot(companionState),
      avatarState,
      timestamp: now(),
    });
  }

  // ── State: thinking ──
  companionState = transitionState(companionState, "thinking", "processing_start");
  avatarState = transitionAvatar(avatarState, "thinking");

  if (includeAvatarState) {
    sseBody += formatSSE("state", {
      companionState: getStateSnapshot(companionState, "generating_response"),
      avatarState,
      timestamp: now(),
    });
  }

  // ── Process through companion brain ──
  const getRecentConversation = async (convId) => {
    if (!convId) return [];
    const { data, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return [];
    return (data || []).reverse();
  };

  try {
    const result = await orchestrate({
      task: "chat",
      message,
      user_id,
      conversation_id,
      model: body.model,
      session_id: body.session_id,
      unfiltered: body.unfiltered,
      aiMood: body.aiMood,
      customInstructions: body.customInstructions,
      getRecentConversation,
    });

    // ── State: responding ──
    companionState = transitionState(companionState, "responding", "stream_start");
    avatarState = transitionAvatar(avatarState, "speaking");

    const lipFrames = generateLipSyncFrames(result.response, DEFAULT_SPEECH_DURATION_MS);
    avatarState = applyLipSync(avatarState, lipFrames);

    if (includeAvatarState) {
      sseBody += formatSSE("state", {
        companionState: getStateSnapshot(companionState),
        avatarState,
        timestamp: now(),
      });
    }

    // Emit response as tokens (simulated chunking of the full response)
    const fullText = result.response;
    const words = fullText.split(/(\s+)/);
    let accumulated = "";

    for (const word of words) {
      accumulated += word;
      sseBody += formatSSE("token", {
        content: word,
        accumulated,
      });
    }

    // If the result includes media, emit an image event
    if (result.isMedia && result.toolResults) {
      for (const toolResult of Object.values(result.toolResults)) {
        const tr = /** @type {any} */ (toolResult);
        if (tr?.url) {
          sseBody += formatSSE("image", {
            imageUrl: tr.url,
            prompt: message,
            timestamp: now(),
          });
        }
      }
    }

    // ── State: done → idle ──
    sseBody += formatSSE("done", {
      fullText,
      intent: result.intent,
      isMedia: result.isMedia || false,
      timestamp: now(),
    });

    companionState = transitionState(companionState, "idle", "stream_complete");
    avatarState = transitionAvatar(avatarState, avatarStateFromCompanion("idle"), { force: true });

    if (includeAvatarState) {
      sseBody += formatSSE("state", {
        companionState: getStateSnapshot(companionState),
        avatarState,
        timestamp: now(),
      });
    }
  } catch (err) {
    log.error("[companion-stream]", "stream error:", err.message);
    sseBody += formatSSE("error", {
      error: err.message || "Internal stream error",
      timestamp: now(),
    });
  }

  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
    body: sseBody,
  };
}
