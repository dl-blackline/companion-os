import { orchestrate } from "../../services/ai/orchestrator.js";
import { listCapabilities } from "../../lib/companion-brain.js";
import { supabase, supabaseConfigured } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { validatePayloadSize, validateAIPayload, sanitizeDeep, authenticateRequest } from "../../lib/_security.js";
import { log } from "../../lib/_log.js";

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

  const { user: authUser, error: authError } = await authenticateRequest(event, supabase);
  if (authError) return fail(authError, "ERR_AUTH", 401);

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

  const validationError = validateAIPayload(body, { requireUserId: false });
  if (validationError) return fail(validationError, "ERR_VALIDATION", 400);

  // Use authenticated user_id
  body.user_id = authUser.id;
  const { message, user_id, conversation_id } = body;

  // Build a getRecentConversation callback from Supabase
  const getRecentConversation = async (convId) => {
    if (!convId || !supabaseConfigured) return [];
    const { data, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      log.error("[companion-brain]", "getRecentConversation error:", error.message);
      return [];
    }
    return (data || []).reverse();
  };

  try {
    log.info("[companion-brain]", `user=${user_id?.slice(0, 8)} capability=${body.capability ?? "auto"}`);

    const result = await orchestrate({
      task: body.capability || "chat",
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
    log.error("[companion-brain]", "handler error:", err.message);
    return fail("Internal brain error", "ERR_BRAIN", 500);
  }
}
