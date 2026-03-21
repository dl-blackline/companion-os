import { supabase } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

const CHAT_TABLE = process.env.CHAT_HISTORY_TABLE || "messages";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (!supabase) {
    return fail("Server configuration error: missing Supabase credentials", "ERR_CONFIG", 500);
  }

  if (event.httpMethod !== "GET") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const params = event.queryStringParameters || {};
    const conversation_id = params.conversation_id;
    const user_id = params.user_id;
    const limit = parseInt(params.limit || "50", 10);

    if (!user_id) {
      return fail("Missing required parameter: user_id", "ERR_VALIDATION", 400);
    }

    let query = supabase
      .from(CHAT_TABLE)
      .select("id, conversation_id, role, content, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (conversation_id) {
      query = query.eq("conversation_id", conversation_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Conversations fetch error:", error.message);
      return fail("Failed to fetch conversations", "ERR_INTERNAL", 500);
    }

    return ok({ messages: (data || []).reverse() });
  } catch (err) {
    console.error("Conversations function error:", err.message);
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
