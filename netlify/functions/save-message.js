import { supabase } from "../../lib/_supabase.js";
import { orchestrateEmbed } from "../../services/ai/orchestrator.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { authenticateRequest, safeParseJSON } from "../../lib/_security.js";
import { log } from "../../lib/_log.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  const { user: authUser, error: authError } = await authenticateRequest(event, supabase);
  if (authError) return fail(authError, "ERR_AUTH", 401);

  try {
    const { data: body, error: parseError } = safeParseJSON(event.body);
    if (parseError) return fail(parseError, "ERR_VALIDATION", 400);

    const { conversation_id, role, content } = body;
    const user_id = authUser.id;

    if (!conversation_id || !role || !content) {
      return fail(
        "Missing required fields: conversation_id, role, content",
        "ERR_VALIDATION",
        400,
      );
    }

    const embedding = await orchestrateEmbed(content);

    const table = process.env.CHAT_HISTORY_TABLE || "messages";

    const { data, error } = await supabase.from(table).insert({
      conversation_id,
      user_id,
      role,
      content,
      embedding,
    }).select();

    if (error) {
      log.error("[save-message]", "db error:", error.message);
      return fail("Failed to save message", "ERR_DB", 500);
    }

    return ok({ message: "Message saved", data });
  } catch (err) {
    log.error("[save-message]", "handler error:", err.message);
    return fail("Internal server error", "ERR_INTERNAL", 500);
  }
}
