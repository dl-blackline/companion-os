import { supabase } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (!supabase) {
    return fail("Server configuration error: missing Supabase credentials", "ERR_CONFIG", 500);
  }

  try {
    if (event.httpMethod === "GET") {
      const user_id =
        event.queryStringParameters && event.queryStringParameters.user_id;

      if (!user_id) {
        return fail("Missing required parameter: user_id", "ERR_VALIDATION", 400);
      }

      const { data, error } = await supabase
        .from("personality_profiles")
        .select("*")
        .eq("user_id", user_id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Settings fetch error:", error.message);
        return fail("Failed to fetch settings", "ERR_INTERNAL", 500);
      }

      return ok({ settings: data || null });
    }

    if (event.httpMethod === "POST") {
      const { user_id, settings } = JSON.parse(event.body);

      if (!user_id || !settings) {
        return fail("Missing required fields: user_id, settings", "ERR_VALIDATION", 400);
      }

      const { data, error } = await supabase
        .from("personality_profiles")
        .upsert(
          { user_id, ...settings, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) {
        console.error("Settings save error:", error.message);
        return fail("Failed to save settings", "ERR_INTERNAL", 500);
      }

      return ok({ settings: data });
    }

    return fail("Method not allowed", "ERR_METHOD", 405);
  } catch (err) {
    console.error("Settings function error:", err.message);
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
