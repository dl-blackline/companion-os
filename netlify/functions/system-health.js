import { supabase } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

async function checkSupabase() {
  try {
    if (!supabase) {
      return "error";
    }
    const table = process.env.CHAT_HISTORY_TABLE || "messages";
    const { error } = await supabase.from(table).select("id").limit(1);
    return error ? "error" : "ok";
  } catch {
    return "error";
  }
}

async function checkOpenAI() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[system-health] OPENAI_API_KEY is not configured");
      return "error";
    }
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[system-health] OpenAI API check failed with status ${res.status}`);
    }
    return res.ok ? "ok" : "error";
  } catch (err) {
    console.error("[system-health] OpenAI API check error:", err.message);
    return "error";
  }
}

async function checkVectorSearch() {
  try {
    if (!supabase) {
      return "error";
    }
    // Verify the match_messages RPC function exists by calling with a dummy embedding
    const { error } = await supabase.rpc("match_messages", {
      query_embedding: Array(1536).fill(0),
      match_count: 1,
    });
    return error ? "error" : "ok";
  } catch {
    return "error";
  }
}

async function checkMedia() {
  try {
    if (!process.env.PIAPI_API_KEY) {
      return "error";
    }
    // Lightweight connectivity check against PiAPI
    const res = await fetch("https://api.piapi.ai/api/v1/task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.PIAPI_API_KEY,
      },
      body: JSON.stringify({}),
    });
    // Any response (even 400 for missing params) confirms connectivity
    return res.status < 500 ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function checkLeonardo() {
  try {
    if (!process.env.LEONARDO_API_KEY) {
      return "error";
    }
    // Lightweight connectivity check — fetch the user info endpoint
    const res = await fetch("https://cloud.leonardo.ai/api/rest/v1/me", {
      headers: {
        Authorization: `Bearer ${process.env.LEONARDO_API_KEY}`,
      },
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "GET") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const [openai, supabase, vector_search, media, leonardo] = await Promise.all([
      checkOpenAI(),
      checkSupabase(),
      checkVectorSearch(),
      checkMedia(),
      checkLeonardo(),
    ]);

    return ok({ openai, supabase, vector_search, media, leonardo });
  } catch (err) {
    console.error("System health check error:", err);
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
