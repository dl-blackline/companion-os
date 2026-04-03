import { createSession } from "../../lib/realtime/session-manager.js";
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

    const { session_type, metadata } = body;
    const user_id = authUser.id;

    if (!session_type) {
      return fail("Missing required field: session_type", "ERR_VALIDATION", 400);
    }

    const session = await createSession({ user_id, session_type, metadata });

    return ok({ session });
  } catch (err) {
    return fail("Internal server error", "ERR_INTERNAL", 500);
  }
}
