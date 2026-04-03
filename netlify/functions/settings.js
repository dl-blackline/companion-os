import { supabase } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

async function getUserFromToken(token) {
  if (!token || !supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user || null;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (!supabase) {
    return fail("Server configuration error: missing Supabase credentials", "ERR_CONFIG", 500);
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  const user = await getUserFromToken(token);

  if (!user) {
    return fail("Unauthorized", "ERR_AUTH", 401);
  }

  try {
    if (event.httpMethod === "GET") {
      const { data, error } = await supabase
        .from("personality_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        log.error("[settings]", "fetch error:", error.message);
        return fail("Failed to fetch settings", "ERR_INTERNAL", 500);
      }

      return ok({ settings: data || null });
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return fail("Invalid JSON body", "ERR_VALIDATION", 400);
      }

      const { settings } = body;

      if (!settings || typeof settings !== "object") {
        return fail("Missing required field: settings", "ERR_VALIDATION", 400);
      }

      const { data, error } = await supabase
        .from("personality_profiles")
        .upsert(
          { user_id: user.id, ...settings, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) {
        log.error("[settings]", "save error:", error.message);
        return fail("Failed to save settings", "ERR_INTERNAL", 500);
      }

      return ok({ settings: data });
    }

    return fail("Method not allowed", "ERR_METHOD", 405);
  } catch (err) {
    log.error("[settings]", "handler error:", err.message);
    return fail("Internal server error", "ERR_INTERNAL", 500);
  }
}
