import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const conversation_id = params.conversation_id;
    const user_id = params.user_id;
    const limit = parseInt(params.limit || "50", 10);

    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required parameter: user_id" }),
      };
    }

    const table = process.env.CHAT_HISTORY_TABLE || "messages";

    let query = supabase
      .from(table)
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
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch conversations" }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ messages: (data || []).reverse() }),
    };
  } catch (err) {
    console.error("Conversations function error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
