import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function result(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

async function checkSupabase() {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return "error";
    }
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
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
      return "error";
    }
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function checkGemini() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return "error";
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function checkVectorSearch() {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return "error";
    }
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
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
    // Verify the PiAPI key is present; a lightweight check
    return "ok";
  } catch {
    return "error";
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return result(405, { error: "Method not allowed" });
  }

  try {
    const [openai, gemini, supabase, vector_search, media] = await Promise.all([
      checkOpenAI(),
      checkGemini(),
      checkSupabase(),
      checkVectorSearch(),
      checkMedia(),
    ]);

    return result(200, { openai, gemini, supabase, vector_search, media });
  } catch (err) {
    console.error("System health check error:", err);
    return result(500, { error: err.message });
  }
}
