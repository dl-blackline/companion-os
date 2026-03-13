import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function res(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

// PostgREST error code for "row not found" (single-row select returned 0 rows)
const PGRST_NOT_FOUND = "PGRST116";

async function getUserFromToken(supabase, token) {
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const supabase = getSupabase();
  if (!supabase) return res(500, { error: "Server configuration error" });

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  const user = await getUserFromToken(supabase, token);

  if (!user) return res(401, { error: "Unauthorized" });

  try {
    if (event.httpMethod === "GET") {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("prefs")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== PGRST_NOT_FOUND) {
        return res(500, { error: "Failed to fetch preferences" });
      }

      return res(200, { prefs: data?.prefs || null });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { prefs } = body;

      if (!prefs || typeof prefs !== "object") {
        return res(400, { error: "Missing or invalid prefs object" });
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

      if (error) return res(500, { error: "Failed to save preferences" });

      // Audit log
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        actor_email: user.email,
        action: "preferences.updated",
        target_type: "user_preferences",
        target_id: user.id,
      });

      return res(200, { prefs: data.prefs });
    }

    return res(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("user-preferences error:", err);
    return res(500, { error: err.message });
  }
}
