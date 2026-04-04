import { supabase, supabaseConfigured } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

// ── Status values ───────────────────────────────────────────────────────────
// "ok"             — service is reachable and healthy
// "not_configured" — required env var(s) missing; expected when key isn't set
// "error"          — configured but unreachable or returning errors

/** AbortController-based timeout wrapper for external health checks. */
async function fetchWithTimeout(url, options, timeoutMs = 5000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

async function checkSupabase() {
  try {
    if (!supabaseConfigured) {
      return "not_configured";
    }
    const table = process.env.CHAT_HISTORY_TABLE || "messages";
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      log.warn("[system-health]", "supabase query failed:", error.message);
      return "error";
    }
    return "ok";
  } catch (err) {
    log.error("[system-health]", "supabase check error:", err.message);
    return "error";
  }
}

async function checkOpenAI() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      log.warn("[system-health]", "OPENAI_API_KEY is not configured");
      return "not_configured";
    }
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/models",
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } },
    );
    if (!res.ok) {
      log.warn("[system-health]", `OpenAI API check failed with status ${res.status}`);
      return "error";
    }
    return "ok";
  } catch (err) {
    log.error("[system-health]", "OpenAI check error:", err.message);
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
      log.warn("[system-health]", "vector search check failed:", error.message);
      return "error";
    }
    return "ok";
  } catch (err) {
    log.error("[system-health]", "vector search check error:", err.message);
    return "error";
  }
}

async function checkMedia() {
  try {
    if (!process.env.PIAPI_API_KEY) {
      return "not_configured";
    }
    // Lightweight connectivity check against PiAPI
    const res = await fetchWithTimeout(
      "https://api.piapi.ai/api/v1/task",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.PIAPI_API_KEY,
        },
        body: JSON.stringify({}),
      },
    );
    // Any response (even 400 for missing params) confirms connectivity
    return res.status < 500 ? "ok" : "error";
  } catch (err) {
    log.error("[system-health]", "media API check error:", err.message);
    return "error";
  }
}

async function checkLeonardo() {
  try {
    const leonardoApiKey = process.env.LEONARDO_API_KEY || process.env.LEONARDO_AI_Key;
    if (!leonardoApiKey) {
      return "not_configured";
    }
    // Lightweight connectivity check — fetch the user info endpoint
    const res = await fetchWithTimeout(
      "https://cloud.leonardo.ai/api/rest/v1/me",
      { headers: { Authorization: `Bearer ${leonardoApiKey}` } },
    );
    return res.ok ? "ok" : "error";
  } catch (err) {
    log.error("[system-health]", "leonardo check error:", err.message);
    return "error";
  }
}

/** Map a check result to a display status for the structured services array. */
function toDisplayStatus(result) {
  if (result === "ok") return "healthy";
  if (result === "not_configured") return "not_configured";
  // "error" (configured but unreachable) maps to "down"
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
    log.error("[system-health]", "health check error:", err.message);
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
