import { supabase } from "../../lib/_supabase.js";
import { embed } from "../../lib/ai-client.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const { conversation_id, user_id, role, content } = JSON.parse(event.body);

    if (!conversation_id || !user_id || !role || !content) {
      return fail(
        "Missing required fields: conversation_id, user_id, role, content",
        "ERR_VALIDATION",
        400,
      );
    }

    const embedding = await embed(content);

    const table = process.env.CHAT_HISTORY_TABLE || "messages";

    const { data, error } = await supabase.from(table).insert({
      conversation_id,
      user_id,
      role,
      content,
      embedding,
    }).select();

    if (error) {
      return fail(error.message, "ERR_DB", 500);
    }

    return ok({ message: "Message saved", data });
  } catch (err) {
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
