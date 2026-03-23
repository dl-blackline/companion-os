import {
  orchestrateStream,
  validateAIEnv,
  recordInteraction,
} from "../../services/ai/orchestrator.js";
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
 * AI Stream — SSE endpoint for token-by-token AI streaming via the orchestrator.
 *
 * POST via the unified orchestrator stream route
 *
 * Body (JSON):
 *   message            (string, required) — user message
 *   user_id            (string, required) — user identifier
 *   conversation_id    (string, optional) — conversation id
 *   session_id         (string, optional) — realtime session id
 *   model              (string, optional) — AI model id
 *   system_prompt      (string, optional) — custom system prompt
 *   task               (string, optional, default "chat") — task label
 *   includeAvatarState (boolean, optional, default true)
 *   includeVoice       (boolean, optional, default false) — generate TTS audio
 *   voiceId            (string, optional) — ElevenLabs voice id
 *
 * Response: text/event-stream with SSE events:
 *   event: state   — companion + avatar state transitions
 *   event: token   — individual token deltas
 *   event: voice   — TTS audio URL (when includeVoice is true)
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

  const { message, user_id } = body;

  if (!message || !user_id) {
    return fail("Missing required fields: message, user_id", "ERR_VALIDATION", 400);
  }

  try {
    validateAIEnv();
  } catch (err) {
    return fail(err.message, err.code || "ERR_CONFIG", 503);
  }

  const includeAvatarState = body.includeAvatarState !== false;
  const includeVoice = body.includeVoice === true;
  const now = () => new Date().toISOString();

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

  // ── Stream tokens through orchestrator ──
  try {
    const prompt = {
      system: body.system_prompt || "You are a helpful AI companion.",
      user: message,
    };

    companionState = transitionState(companionState, "responding", "stream_start");
    avatarState = transitionAvatar(avatarState, "speaking");

    const lipFrames = generateLipSyncFrames(message, DEFAULT_SPEECH_DURATION_MS);
    avatarState = applyLipSync(avatarState, lipFrames);

    if (includeAvatarState) {
      sseBody += formatSSE("state", {
        companionState: getStateSnapshot(companionState),
        avatarState,
        timestamp: now(),
      });
    }

    let accumulated = "";
    for await (const token of orchestrateStream({
      task: body.task || "chat",
      prompt,
      model: body.model,
      user_id,
      conversation_id: body.conversation_id,
      session_id: body.session_id,
    })) {
      accumulated += token;
      sseBody += formatSSE("token", { content: token, accumulated });
    }

    // ── State: done → idle ──
    sseBody += formatSSE("done", {
      fullText: accumulated,
      timestamp: now(),
    });

    // ── Voice generation (TTS) ──
    if (includeVoice && accumulated) {
      try {
        const { generateVoice } = await import("../../lib/media/voice-generator.js");
        log.info("[ai-stream]", "generating TTS audio", { user_id, chars: accumulated.length });
        const voiceResult = await generateVoice(accumulated, body.voiceId);
        // Estimate duration based on average speaking rate (~150 words/min).
        // ElevenLabs does not return duration metadata, so we approximate.
        const wordCount = accumulated.split(/\s+/).length;
        const estimatedDurationMs = Math.max(1000, Math.round((wordCount / 150) * 60_000));
        sseBody += formatSSE("voice", {
          audioUrl: voiceResult.url,
          durationMs: estimatedDurationMs,
          timestamp: now(),
        });
        log.info("[ai-stream]", "TTS audio generated", { user_id, durationMs: estimatedDurationMs });
      } catch (voiceErr) {
        log.warn("[ai-stream]", "TTS generation failed (non-fatal)", { error: voiceErr.message });
      }
    }

    companionState = transitionState(companionState, "idle", "stream_complete");
    avatarState = transitionAvatar(
      avatarState,
      avatarStateFromCompanion("idle"),
      { force: true },
    );

    if (includeAvatarState) {
      sseBody += formatSSE("state", {
        companionState: getStateSnapshot(companionState),
        avatarState,
        timestamp: now(),
      });
    }

    // Persist both sides of the interaction in the background
    recordInteraction({ user_id, session_id: body.session_id, role: "user", content: message });
    recordInteraction({ user_id, session_id: body.session_id, role: "assistant", content: accumulated });
  } catch (err) {
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
