import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_EVENT_TYPES = [
  "transcription",
  "assistant_response",
  "voice_output",
  "media_generation_progress",
];

/**
 * Emit a streaming event to the realtime_events table.
 */
export async function emitEvent({ session_id, event_type, payload = {} }) {
  if (!session_id) {
    throw new Error("Missing required parameter: session_id");
  }

  if (!VALID_EVENT_TYPES.includes(event_type)) {
    throw new Error(
      `Invalid event_type: ${event_type}. Must be one of: ${VALID_EVENT_TYPES.join(", ")}`
    );
  }

  const { data, error } = await supabase
    .from("realtime_events")
    .insert({
      session_id,
      event_type,
      payload,
    })
    .select()
    .single();

  if (error) {
    console.error("Emit event error:", error.message);
    throw new Error(`Failed to emit event: ${error.message}`);
  }

  return data;
}

/**
 * Get events for a session, ordered by creation time.
 */
export async function getSessionEvents(session_id, { limit = 50 } = {}) {
  if (!session_id) {
    throw new Error("Missing required parameter: session_id");
  }

  const { data, error } = await supabase
    .from("realtime_events")
    .select("*")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Get session events error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Subscribe to real-time events for a session using Supabase Realtime.
 * Returns a subscription channel that can be unsubscribed later.
 */
export function subscribeToSessionEvents(session_id, callback) {
  if (!session_id) {
    throw new Error("Missing required parameter: session_id");
  }

  const channel = supabase
    .channel(`session-events-${session_id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "realtime_events",
        filter: `session_id=eq.${session_id}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Emit a media generation progress event.
 */
export async function emitMediaProgress({
  session_id,
  media_type,
  status,
  progress,
  result_url = null,
}) {
  return emitEvent({
    session_id,
    event_type: "media_generation_progress",
    payload: {
      media_type,
      status,
      progress,
      result_url,
    },
  });
}

/**
 * Emit a transcription event.
 */
export async function emitTranscription({ session_id, text, is_final = false }) {
  return emitEvent({
    session_id,
    event_type: "transcription",
    payload: {
      text,
      is_final,
    },
  });
}

/**
 * Emit an assistant response event.
 */
export async function emitAssistantResponse({ session_id, text, is_final = false }) {
  return emitEvent({
    session_id,
    event_type: "assistant_response",
    payload: {
      text,
      is_final,
    },
  });
}

/**
 * Emit a voice output event.
 */
export async function emitVoiceOutput({ session_id, audio_url }) {
  return emitEvent({
    session_id,
    event_type: "voice_output",
    payload: {
      audio_url,
    },
  });
}
