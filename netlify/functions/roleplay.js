/**
 * roleplay.js — Netlify function
 *
 * POST /.netlify/functions/roleplay
 *
 * Handles roleplay interactions through the Companion Brain orchestrator.
 * Routes through the unified think() pipeline with the "roleplay" capability.
 */

import { supabase, supabaseConfigured } from "../../lib/_supabase.js";
import { think } from "../../lib/companion-brain.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { validatePayloadSize, validateAIPayload, sanitizeDeep } from "../../lib/_security.js";
import { log } from "../../lib/_log.js";

async function getRecentConversation(supabase, conversation_id) {
  if (!supabaseConfigured) return [];

  const table = process.env.CHAT_HISTORY_TABLE || "messages";

  const { data, error } = await supabase
    .from(table)
    .select("role, content")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    log.error("[roleplay]", "recent conversation error:", error.message);
    return [];
  }

  return (data || []).reverse();
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const sizeCheck = validatePayloadSize(event.body);
    if (!sizeCheck.valid) return fail(sizeCheck.error, "ERR_PAYLOAD_SIZE", 413);

    let body = JSON.parse(event.body);
    body = sanitizeDeep(body);

    const validationError = validateAIPayload(body);
    if (validationError) return fail(validationError, "ERR_VALIDATION", 400);

    const { user_id, conversation_id, message, model, character, scenario } =
      body;

    log.info("[roleplay]", `user=${user_id?.slice(0, 8)} character=${character ?? "default"}`);

    const result = await think({
      message,
      user_id,
      conversation_id: conversation_id || user_id,
      model,
      capability: "roleplay",
      getRecentConversation: (convId) =>
        getRecentConversation(supabase, convId),
      extra: {
        roleplayCharacter: character,
        roleplayScenario: scenario,
      },
    });

    return ok({
      response: result.response,
      intent: result.intent,
    });
  } catch (err) {
    log.error("[roleplay]", "handler error:", err.message);
    return fail(
      err.message || "Failed to process roleplay interaction",
      "ERR_ROLEPLAY",
      500,
    );
  }
}
