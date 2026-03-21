import { createSession } from "../../lib/realtime/session-manager.js";
import { ok, fail } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const { user_id, session_type, metadata } = JSON.parse(event.body);

    if (!user_id || !session_type) {
      return fail("Missing required fields: user_id, session_type", "ERR_VALIDATION", 400);
    }

    const session = await createSession({ user_id, session_type, metadata });

    return ok({ session });
  } catch (err) {
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
