import { endSession, getSession } from "../../lib/realtime/session-manager.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { session_id } = JSON.parse(event.body);

    if (!session_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required field: session_id",
        }),
      };
    }

    const existing = await getSession(session_id);

    if (!existing) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Session not found" }),
      };
    }

    if (existing.status !== "active") {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "Session is not active" }),
      };
    }

    const session = await endSession(session_id);

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
