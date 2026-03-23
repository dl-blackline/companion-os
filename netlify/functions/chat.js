import { supabase, supabaseConfigured } from "../../lib/_supabase.js";
import { orchestrate, orchestrateEmbed } from "../../services/ai/orchestrator.js";
import { ok, fail, preflight, raw } from "../../lib/_responses.js";
import { validatePayloadSize, validateAIPayload, sanitizeDeep } from "../../lib/_security.js";
import { log } from "../../lib/_log.js";

async function getRecentConversation(conversation_id) {
  if (!supabaseConfigured) return [];

  const table = process.env.CHAT_HISTORY_TABLE || "messages";

  const { data, error } = await supabase
    .from(table)
    .select("role, content")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    log.error("[chat]", "recent conversation error:", error.message);
    return [];
  }

  return (data || []).reverse();
}

async function saveMessage({ conversation_id, user_id, role, content, embedding }) {
  if (!supabaseConfigured) return;

  const table = process.env.CHAT_HISTORY_TABLE || "messages";

  const { error } = await supabase.from(table).insert({
    conversation_id,
    user_id,
    role,
    content,
    embedding,
  });

  if (error) {
    log.error("[chat]", "save message error:", error.message);
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  let message;
  let model;

  try {
    // Input validation
    const sizeCheck = validatePayloadSize(event.body);
    if (!sizeCheck.valid) return fail(sizeCheck.error, "ERR_PAYLOAD_SIZE", 413);

    let body = JSON.parse(event.body);
    body = sanitizeDeep(body);

    const validationError = validateAIPayload(body);
    if (validationError) return fail(validationError, "ERR_VALIDATION", 400);

    const { conversation_id, user_id } = body;
    model = body.model;
    message = body.message;

    if (!conversation_id) {
      return fail(
        "Missing required field: conversation_id",
        "ERR_VALIDATION",
        400,
      );
    }

    log.info("[chat]", `user=${user_id?.slice(0, 8)} conv=${conversation_id?.slice(0, 8)}`);

    // Route through unified AI orchestrator
    const result = await orchestrate({
      task: "chat",
      message,
      user_id,
      conversation_id,
      model,
      getRecentConversation: (convId) => getRecentConversation(convId),
    });

    // For media results, return the media payload directly
    if (result.isMedia) {
      return ok({
        response: result.response,
        intent: result.intent,
      });
    }

    // Save both the user message and the assistant response (best-effort)
    const assistantEmbedding = await orchestrateEmbed(result.response).catch(() => null);

    await Promise.all([
      saveMessage({
        conversation_id,
        user_id,
        role: "user",
        content: message,
        embedding: null,
      }),
      saveMessage({
        conversation_id,
        user_id,
        role: "assistant",
        content: result.response,
        embedding: assistantEmbedding,
      }),
    ]).catch((err) => {
      log.error("[chat]", "failed to persist messages:", err.message);
    });

    return ok({
      response: result.response,
      intent: result.intent,
    });
  } catch (err) {
    log.error("[chat]", "handler error:", err.message);

    // Backward compatibility: return a soft-fail 200 with a human-friendly
    // message so the frontend doesn't surface a raw error.
    return raw(200, {
      response: "I'm having trouble connecting to the AI service right now.",
    });
  }
}
