/**
 * Stream Handler — SSE streaming wrapper for AI responses.
 *
 * Provides a server-side streaming pipeline that:
 *   1. Accepts a user message + context
 *   2. Streams tokens via the AI client's chatStream()
 *   3. Emits companion state transitions at each phase
 *   4. Supports interruption (abort signal)
 *   5. Optionally triggers image generation during streaming
 *
 * Designed to be used by the companion-stream Netlify function to deliver
 * real-time SSE responses to the frontend.
 */

import { chatStream } from "../ai-client.js";
import {
  createCompanionState,
  transitionState,
  getStateSnapshot,
} from "./companion-state.js";
import {
  createAvatarState,
  transitionAvatar,
  avatarStateFromCompanion,
  generateLipSyncFrames,
  applyLipSync,
} from "./avatar-controller.js";

// ── Constants ──────────────────────────────────────────────────────────────

/** Default estimated speech duration (ms) used for lip-sync frame generation. */
const DEFAULT_SPEECH_DURATION_MS = 5000;

// ── SSE formatting ─────────────────────────────────────────────────────────

/**
 * Format an SSE event string.
 *
 * @param {string} event - Event name.
 * @param {object} data  - JSON-serializable data.
 * @returns {string} Formatted SSE string.
 */
export function formatSSE(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Stream pipeline ────────────────────────────────────────────────────────

/**
 * Run the streaming pipeline for a companion response.
 *
 * Yields SSE-formatted strings that the caller writes to the HTTP response.
 * Each yield is a complete SSE message.
 *
 * Phases:
 *   1. State → listening (brief, for UI feedback)
 *   2. State → thinking  (while AI processes)
 *   3. State → responding (token-by-token streaming)
 *   4. State → idle (done)
 *
 * @param {object} params
 * @param {{ system: string, user: string } | null} params.prompt - System + user prompt.
 * @param {string} [params.model]        - AI model id.
 * @param {AbortSignal} [params.signal]  - Abort signal for interruption.
 * @param {boolean} [params.includeAvatarState] - Whether to emit avatar state events.
 * @returns {AsyncGenerator<string>} Yields SSE-formatted strings.
 */
export async function* streamCompanionResponse({
  prompt,
  model,
  signal,
  includeAvatarState = true,
}) {
  if (!prompt || !prompt.system || !prompt.user) {
    yield formatSSE("error", { error: "Missing prompt (system + user required)" });
    return;
  }

  let companionState = createCompanionState();
  let avatarState = createAvatarState();
  const now = () => new Date().toISOString();

  // ── Phase 1: listening → thinking ──
  companionState = transitionState(companionState, "listening", "user_input_received");
  avatarState = transitionAvatar(avatarState, "listening");

  if (includeAvatarState) {
    yield formatSSE("state", {
      companionState: getStateSnapshot(companionState),
      avatarState,
      timestamp: now(),
    });
  }

  companionState = transitionState(companionState, "thinking", "processing_start");
  avatarState = transitionAvatar(avatarState, "thinking");

  if (includeAvatarState) {
    yield formatSSE("state", {
      companionState: getStateSnapshot(companionState, "generating_response"),
      avatarState,
      timestamp: now(),
    });
  }

  // ── Phase 2: thinking → responding (streaming) ──
  let accumulated = "";
  let interrupted = false;

  try {
    companionState = transitionState(companionState, "responding", "stream_start");
    avatarState = transitionAvatar(avatarState, "speaking");

    // Generate placeholder lip-sync frames for the speaking state
    const lipFrames = generateLipSyncFrames(prompt.user, DEFAULT_SPEECH_DURATION_MS);
    avatarState = applyLipSync(avatarState, lipFrames);

    if (includeAvatarState) {
      yield formatSSE("state", {
        companionState: getStateSnapshot(companionState),
        avatarState,
        timestamp: now(),
      });
    }

    // Stream tokens
    for await (const token of chatStream({ prompt, model })) {
      // Check for interruption
      if (signal?.aborted) {
        interrupted = true;
        yield formatSSE("interrupted", {
          partialText: accumulated,
          timestamp: now(),
        });
        break;
      }

      accumulated += token;
      yield formatSSE("token", {
        content: token,
        accumulated,
      });
    }
  } catch (err) {
    yield formatSSE("error", {
      error: err.message || "Streaming error",
      partialText: accumulated,
      timestamp: now(),
    });
  }

  // ── Phase 3: done → idle ──
  if (!interrupted) {
    yield formatSSE("done", {
      fullText: accumulated,
      timestamp: now(),
    });
  }

  // Return to idle (use force via resetToIdle pattern since responding→idle is valid)
  companionState = transitionState(companionState, "idle", interrupted ? "interrupted" : "stream_complete");
  avatarState = transitionAvatar(
    avatarState,
    avatarStateFromCompanion("idle"),
    { force: true }
  );

  if (includeAvatarState) {
    yield formatSSE("state", {
      companionState: getStateSnapshot(companionState),
      avatarState,
      timestamp: now(),
    });
  }
}
