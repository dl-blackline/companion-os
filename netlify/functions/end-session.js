import { endSession, getSession } from "../../lib/realtime/session-manager.js";
import { ok, fail } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const { session_id } = JSON.parse(event.body);

    if (!session_id) {
      return fail("Missing required field: session_id", "ERR_VALIDATION", 400);
    }

    const existing = await getSession(session_id);

    if (!existing) {
      return fail("Session not found", "ERR_NOT_FOUND", 404);
    }

    if (existing.status !== "active") {
      return fail("Session is not active", "ERR_CONFLICT", 409);
    }

    const session = await endSession(session_id);

    return ok({ session });
  } catch (err) {
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
