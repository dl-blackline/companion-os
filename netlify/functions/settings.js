import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    if (event.httpMethod === "GET") {
      const user_id =
        event.queryStringParameters && event.queryStringParameters.user_id;

      if (!user_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing required parameter: user_id" }),
        };
      }

      const { data, error } = await supabase
        .from("personality_profiles")
        .select("*")
        .eq("user_id", user_id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Settings fetch error:", error.message);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Failed to fetch settings" }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ settings: data || null }),
      };
    }

    if (event.httpMethod === "POST") {
      const { user_id, settings } = JSON.parse(event.body);

      if (!user_id || !settings) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "Missing required fields: user_id, settings",
          }),
        };
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
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Failed to save settings" }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ settings: data }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (err) {
    console.error("Settings function error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
