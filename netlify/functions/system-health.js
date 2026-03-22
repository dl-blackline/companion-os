import { supabase, supabaseConfigured } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

// ── Status values ───────────────────────────────────────────────────────────
// "ok"             — service is reachable and healthy
// "not_configured" — required env var(s) missing; expected when key isn't set
// "error"          — configured but unreachable or returning errors

async function checkSupabase() {
  try {
    if (!supabaseConfigured) {
      return "not_configured";
    }
    const table = process.env.CHAT_HISTORY_TABLE || "messages";
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      console.warn("[system-health] Supabase query failed:", error.message);
      return "error";
    }
    return "ok";
  } catch (err) {
    console.error("[system-health] Supabase check error:", err.message);
    return "error";
  }
}

async function checkOpenAI() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[system-health] OPENAI_API_KEY is not configured");
      return "not_configured";
    }
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    if (!res.ok) {
      console.warn(`[system-health] OpenAI API check failed with status ${res.status}`);
      return "error";
    }
    return "ok";
  } catch (err) {
    console.error("[system-health] OpenAI API check error:", err.message);
    return "error";
  }
}

async function checkVectorSearch() {
  try {
    if (!supabaseConfigured) {
      return "not_configured";
    }
    // Verify the match_messages RPC function exists by calling with a dummy embedding
    const { error } = await supabase.rpc("match_messages", {
      query_embedding: Array(1536).fill(0),
      match_count: 1,
    });
    if (error) {
      console.warn("[system-health] Vector search check failed:", error.message);
      return "error";
    }
    return "ok";
  } catch (err) {
    console.error("[system-health] Vector search check error:", err.message);
    return "error";
  }
}

async function checkMedia() {
  try {
    if (!process.env.PIAPI_API_KEY) {
      return "not_configured";
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
  } catch (err) {
    console.error("[system-health] Media API check error:", err.message);
    return "error";
  }
}

async function checkLeonardo() {
  try {
    if (!process.env.LEONARDO_API_KEY) {
      return "not_configured";
    }
    // Lightweight connectivity check — fetch the user info endpoint
    const res = await fetch("https://cloud.leonardo.ai/api/rest/v1/me", {
      headers: {
        Authorization: `Bearer ${process.env.LEONARDO_API_KEY}`,
      },
    });
    return res.ok ? "ok" : "error";
  } catch (err) {
    console.error("[system-health] Leonardo check error:", err.message);
    return "error";
  }
}

/** Map a check result to a display status for the structured services array. */
function toDisplayStatus(result) {
  if (result === "ok") return "healthy";
  if (result === "not_configured") return "not_configured";
  return "down";
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "GET") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const [openai, supa, vector_search, media, leonardo] = await Promise.all([
      checkOpenAI(),
      checkSupabase(),
      checkVectorSearch(),
      checkMedia(),
      checkLeonardo(),
    ]);

    const checkedAt = new Date().toISOString();

    const services = [
      { service: "openai", label: "OpenAI", status: toDisplayStatus(openai), checked_at: checkedAt },
      { service: "supabase", label: "Supabase", status: toDisplayStatus(supa), checked_at: checkedAt },
      { service: "vector_search", label: "Vector Search", status: toDisplayStatus(vector_search), checked_at: checkedAt },
      { service: "media", label: "Media APIs", status: toDisplayStatus(media), checked_at: checkedAt },
      { service: "leonardo", label: "Leonardo AI", status: toDisplayStatus(leonardo), checked_at: checkedAt },
    ];

    return ok({
      // Flat format (backward compat with SettingsView diagnostics)
      openai,
      supabase: supa,
      vector_search,
      media,
      leonardo,
      // Structured format (AdminConsoleView)
      services,
    });
  } catch (err) {
    console.error("System health check error:", err);
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
