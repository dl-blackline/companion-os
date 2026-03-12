import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_SESSION_TYPES = [
  "voice_call",
  "live_assistant",
  "creative_session",
  "screen_assist",
];

/**
 * Create a new real-time session.
 */
export async function createSession({ user_id, session_type, metadata = {} }) {
  if (!user_id) {
    throw new Error("Missing required parameter: user_id");
  }

  if (!VALID_SESSION_TYPES.includes(session_type)) {
    throw new Error(
      `Invalid session_type: ${session_type}. Must be one of: ${VALID_SESSION_TYPES.join(", ")}`
    );
  }

  const { data, error } = await supabase
    .from("realtime_sessions")
    .insert({
      user_id,
      session_type,
      status: "active",
      metadata,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Create session error:", error.message);
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data;
}

/**
 * Get a session by ID.
 */
export async function getSession(session_id) {
  if (!session_id) {
    throw new Error("Missing required parameter: session_id");
  }

  const { data, error } = await supabase
    .from("realtime_sessions")
    .select("*")
    .eq("id", session_id)
    .single();

  if (error) {
    console.error("Get session error:", error.message);
    return null;
  }

  return data;
}

/**
 * End a session by marking it as completed.
 */
export async function endSession(session_id) {
  if (!session_id) {
    throw new Error("Missing required parameter: session_id");
  }

  const { data, error } = await supabase
    .from("realtime_sessions")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", session_id)
    .eq("status", "active")
    .select()
    .single();

  if (error) {
    console.error("End session error:", error.message);
    throw new Error(`Failed to end session: ${error.message}`);
  }

  return data;
}

/**
 * List active sessions for a user.
 */
export async function listActiveSessions(user_id) {
  if (!user_id) {
    throw new Error("Missing required parameter: user_id");
  }

  const { data, error } = await supabase
    .from("realtime_sessions")
    .select("*")
    .eq("user_id", user_id)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) {
    console.error("List sessions error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Update session metadata.
 */
export async function updateSessionMetadata(session_id, metadata) {
  if (!session_id) {
    throw new Error("Missing required parameter: session_id");
  }

  const { data, error } = await supabase
    .from("realtime_sessions")
    .update({ metadata })
    .eq("id", session_id)
    .select()
    .single();

  if (error) {
    console.error("Update session metadata error:", error.message);
    throw new Error(`Failed to update session metadata: ${error.message}`);
  }

  return data;
}
