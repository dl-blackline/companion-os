import { endSession, getSession } from "../../lib/realtime/session-manager.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { authenticateRequest, safeParseJSON } from "../../lib/_security.js";
import { supabase } from "../../lib/_supabase.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  const { user: authUser, error: authError } = await authenticateRequest(event, supabase);
  if (authError) return fail(authError, "ERR_AUTH", 401);

  try {
    const { data: body, error: parseError } = safeParseJSON(event.body);
    if (parseError) return fail(parseError, "ERR_VALIDATION", 400);

    const { session_id } = body;

    if (!session_id) {
      return fail("Missing required field: session_id", "ERR_VALIDATION", 400);
    }

    const existing = await getSession(session_id);

    if (!existing) {
      return fail("Session not found", "ERR_NOT_FOUND", 404);
    }

    // Ownership check
    if (existing.user_id && existing.user_id !== authUser.id) {
      return fail("Unauthorized", "ERR_AUTH", 403);
    }

    if (existing.status !== "active") {
      return fail("Session is not active", "ERR_CONFLICT", 409);
    }

    const session = await endSession(session_id);

    return ok({ session });
  } catch (err) {
    return fail("Internal server error", "ERR_INTERNAL", 500);
  }
}
