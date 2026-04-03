import { supabase } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { authenticateRequest } from "../../lib/_security.js";
import { log } from "../../lib/_log.js";

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
    const { user: authUser, error: authError } = await authenticateRequest(event, supabase);
    if (authError) return fail(authError, "ERR_AUTH", 401);

    const params = event.queryStringParameters || {};
    const conversation_id = params.conversation_id;
    const user_id = authUser.id;
    const limit = parseInt(params.limit || "50", 10);

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
      log.error("[conversations]", "fetch error:", error.message);
      return fail("Failed to fetch conversations", "ERR_INTERNAL", 500);
    }

    return ok({ messages: (data || []).reverse() });
  } catch (err) {
    log.error("[conversations]", "handler error:", err.message);
    return fail("Internal server error", "ERR_INTERNAL", 500);
  }
}
