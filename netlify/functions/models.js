import { MODEL_REGISTRY } from "../../lib/model-registry.js";
import { fail, preflight, raw } from "../../lib/_responses.js";
import { authenticateRequest } from "../../lib/_security.js";
import { supabase } from "../../lib/_supabase.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "GET") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  const { user: authUser, error: authError } = await authenticateRequest(event, supabase);
  if (authError) return fail(authError, "ERR_AUTH", 401);

  return raw(200, MODEL_REGISTRY);
}
