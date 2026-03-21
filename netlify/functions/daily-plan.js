/**
 * daily-plan.js — Netlify function
 *
 * POST /.netlify/functions/daily-plan
 *
 * Generates a daily plan for the user through the Companion Brain orchestrator.
 * Routes through the unified think() pipeline with the "planning" capability.
 */

import { createClient } from "@supabase/supabase-js";
import { think } from "../../lib/companion-brain.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { validatePayloadSize, validateAIPayload, sanitizeDeep } from "../../lib/_security.js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function getRecentConversation(supabase, conversation_id) {
  const table = process.env.CHAT_HISTORY_TABLE || "messages";

  const { data, error } = await supabase
    .from(table)
    .select("role, content")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Recent conversation error:", error.message);
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

    const validationError = validateAIPayload(body, { requireMessage: false });
    if (validationError) return fail(validationError, "ERR_VALIDATION", 400);

    const { user_id, conversation_id, message, model } = body;

    const supabase = getSupabase();

    const planMessage =
      message || "Create a daily plan for today based on my goals and tasks.";

    const result = await think({
      message: planMessage,
      user_id,
      conversation_id: conversation_id || user_id,
      model,
      capability: "planning",
      getRecentConversation: (convId) =>
        getRecentConversation(supabase, convId),
    });

    return ok({
      plan: result.response,
      intent: result.intent,
    });
  } catch (err) {
    console.error("Daily plan error:", err.message);
    return fail(
      err.message || "Failed to generate daily plan",
      "ERR_PLANNING",
      500,
    );
  }
}
