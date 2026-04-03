import { supabase } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

// PostgREST error code for "row not found" (single-row select returned 0 rows)
const PGRST_NOT_FOUND = "PGRST116";

async function getUserFromToken(supabase, token) {
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return preflight();

  if (!supabase) return fail("Server configuration error", "ERR_CONFIG", 500);

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  const user = await getUserFromToken(supabase, token);

  if (!user) return fail("Unauthorized", "ERR_AUTH", 401);

  try {
    if (event.httpMethod === "GET") {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("prefs")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== PGRST_NOT_FOUND) {
        return fail("Failed to fetch preferences", "ERR_INTERNAL", 500);
      }

      return ok({ prefs: data?.prefs || null });
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return fail("Invalid JSON body", "ERR_VALIDATION", 400);
      }
      const { prefs } = body;

      if (!prefs || typeof prefs !== "object") {
        return fail("Missing or invalid prefs object", "ERR_VALIDATION", 400);
      }

      // Fetch existing prefs to merge (patch support)
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("prefs")
        .eq("user_id", user.id)
        .single();

      const merged = { ...(existing?.prefs || {}), ...prefs };

      const { data, error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, prefs: merged }, { onConflict: "user_id" })
        .select("prefs")
        .single();

      if (error) return fail("Failed to save preferences", "ERR_INTERNAL", 500);

      // Audit log
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        actor_email: user.email,
        action: "preferences.updated",
        target_type: "user_preferences",
        target_id: user.id,
      });

      return ok({ prefs: data.prefs });
    }

    return fail("Method not allowed", "ERR_METHOD", 405);
  } catch (err) {
    log.error("[user-preferences]", "handler error:", err.message);
    return fail("Internal server error", "ERR_INTERNAL", 500);
  }
}
