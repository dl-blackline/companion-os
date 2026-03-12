import { createSession } from "../../lib/realtime/session-manager.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { user_id, session_type, metadata } = JSON.parse(event.body);

    if (!user_id || !session_type) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required fields: user_id, session_type",
        }),
      };
    }

    const session = await createSession({ user_id, session_type, metadata });

    return {
      statusCode: 200,
      body: JSON.stringify({ session }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
