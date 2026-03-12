import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../../lib/openai-client.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { conversation_id, user_id, role, content } = JSON.parse(event.body);

    if (!conversation_id || !user_id || !role || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields: conversation_id, user_id, role, content" }),
      };
    }

    const embedding = await generateEmbedding(content);

    const table = process.env.CHAT_HISTORY_TABLE || "messages";

    const { data, error } = await supabase.from(table).insert({
      conversation_id,
      user_id,
      role,
      content,
      embedding,
    }).select();

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Message saved", data }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
