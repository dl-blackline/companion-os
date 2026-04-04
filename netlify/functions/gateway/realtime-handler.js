/**
 * gateway/realtime-handler.js — Realtime, voice, and realtime-token handler.
 *
 * Covers request types: realtime, realtime_token, voice
 */

import {
  createSession,
  endSession,
  getSession,
} from "../../../lib/realtime/session-manager.js";
import {
  processVoiceTurn,
  createRealtimeSession,
} from "../../../lib/voice-engine.js";
import { isNofilterModel } from "../../../lib/nofilter-client.js";
import { ok, fail } from "../../../lib/_responses.js";
import { log } from "../../../lib/_log.js";

/* ── Realtime session handler ─────────────────────────────────────────────── */

export async function handleRealtime(data) {
  if (data.action === "start") {
    const session = await createSession(data);
    return ok({ session });
  }

  if (data.action === "end") {
    const existing = await getSession(data.session_id);
    if (!existing) {
      return fail("Session not found", "ERR_NOT_FOUND", 404);
    }
    const session = await endSession(data.session_id);
    return ok({ session });
  }

  return fail("Invalid realtime action", "ERR_VALIDATION", 400);
}

/* ── Realtime token handler ───────────────────────────────────────────────── */

export async function handleRealtimeToken(data) {
  const model = data.model;
  const voice = data.voice;

  if (isNofilterModel(model)) {
    const nofilterApiKey =
      process.env.NOFILTER_GPT_API_KEY || process.env.NOFILTER_GPT_API;
    if (!nofilterApiKey) {
      log.error(
        "[ai]",
        "NOFILTER_GPT_API_KEY/NOFILTER_GPT_API is not configured for realtime token request",
      );
      return fail(
        "NOFILTER_GPT_API_KEY (or NOFILTER_GPT_API) is not configured",
        "ERR_CONFIG",
        500,
      );
    }
  } else if (!process.env.OPENAI_API_KEY) {
    log.error(
      "[ai]",
      "OPENAI_API_KEY is not configured for realtime token request",
    );
    return fail("OpenAI API key not configured", "ERR_CONFIG", 500);
  }

  try {
    const { client_secret, realtime_endpoint } = await createRealtimeSession({
      model,
      voice,
    });
    return ok({ client_secret, realtime_endpoint });
  } catch (err) {
    log.error("[ai]", "realtime token error:", err.message);
    return fail("Failed to create realtime session", "ERR_REALTIME", 500);
  }
}

/* ── Voice handler ────────────────────────────────────────────────────────── */

export async function handleVoice(data) {
  // Delegate realtime_token sub-type
  if (
    data?.backendType === "realtime_token" ||
    data?.options?.backendType === "realtime_token"
  ) {
    return handleRealtimeToken({
      model: data?.model || data?.options?.data?.model,
      voice: data?.voice || data?.options?.data?.voice,
    });
  }

  if (!data.text) {
    return fail("Missing required field: text", "ERR_VALIDATION", 400);
  }

  try {
    const result = await processVoiceTurn({
      text: data.text,
      systemPrompt: data.systemPrompt || "",
      model: data.model,
      voiceId: data.voiceId,
      useElevenLabs: data.useElevenLabs || false,
    });
    return ok(result);
  } catch (err) {
    log.error("[ai]", "voice processing error:", err.message);
    return fail(err.message, "ERR_VOICE", 500);
  }
}
