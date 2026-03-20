import { think, listCapabilities } from "../../lib/companion-brain.js";
import { createClient } from "@supabase/supabase-js";

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
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // GET — list capabilities
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    if (params.action === "capabilities") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ capabilities: listCapabilities() }),
      };
    }
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Unknown action. Use ?action=capabilities" }),
    };
  }

  // POST — process AI interaction
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { message, user_id, conversation_id } = body;

  if (!message || !user_id || !conversation_id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields: message, user_id, conversation_id" }),
    };
  }

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        response: result.response,
        intent: result.intent,
        isMedia: result.isMedia,
      }),
    };
  } catch (err) {
    console.error("companion-brain error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal brain error", message: err.message }),
    };
  }
}
