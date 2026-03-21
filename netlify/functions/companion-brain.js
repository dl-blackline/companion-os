import { think, listCapabilities } from "../../lib/companion-brain.js";
import { createClient } from "@supabase/supabase-js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { validatePayloadSize, validateAIPayload, sanitizeDeep } from "../../lib/_security.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Companion Brain — unified Netlify function entry point.
 *
 * All AI interactions flow through this single endpoint, which routes
 * to the appropriate sub-capability via the Companion Brain orchestrator.
 *
 * POST /.netlify/functions/companion-brain
 *
 * Body (JSON):
 *   message           (string, required) — user message
 *   user_id           (string, required) — user identifier
 *   conversation_id   (string, required) — conversation id
 *   session_id        (string, optional) — session id for short-term memory
 *   model             (string, optional) — AI model id
 *   capability        (string, optional) — explicit capability override
 *   unfiltered        (boolean, optional) — unfiltered mode
 *   aiMood            (string, optional) — mood/tone
 *   customInstructions (string, optional) — user custom instructions
 *   extra             (object, optional) — additional params for domain handlers
 *
 * GET  /.netlify/functions/companion-brain?action=capabilities
 *   → Returns list of supported capabilities.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  // GET — list capabilities
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    if (params.action === "capabilities") {
      return ok({ capabilities: listCapabilities() });
    }
    return fail("Unknown action. Use ?action=capabilities", "ERR_UNKNOWN_ACTION", 400);
  }

  // POST — process AI interaction
  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return fail("Invalid JSON body", "ERR_PARSE", 400);
  }

  // Input validation
  const sizeCheck = validatePayloadSize(event.body);
  if (!sizeCheck.valid) return fail(sizeCheck.error, "ERR_PAYLOAD_SIZE", 413);

  body = sanitizeDeep(body);

  const validationError = validateAIPayload(body);
  if (validationError) return fail(validationError, "ERR_VALIDATION", 400);

  const { message, user_id, conversation_id } = body;

  // Build a getRecentConversation callback from Supabase
  const getRecentConversation = async (convId) => {
    if (!convId) return [];
    const { data, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      console.error("companion-brain getRecentConversation error:", error.message);
      return [];
    }
    return (data || []).reverse();
  };

  try {
    const result = await think({
      message,
      user_id,
      conversation_id,
      session_id: body.session_id,
      model: body.model,
      capability: body.capability,
      getRecentConversation,
      unfiltered: body.unfiltered,
      aiMood: body.aiMood,
      customInstructions: body.customInstructions,
      extra: body.extra,
    });

    return ok({
      response: result.response,
      intent: result.intent,
      isMedia: result.isMedia,
    });
  } catch (err) {
    console.error("companion-brain error:", err);
    return fail("Internal brain error", "ERR_BRAIN", 500);
  }
}
