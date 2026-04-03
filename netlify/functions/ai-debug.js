import { orchestrateSimple } from "../../services/ai/orchestrator.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { authenticateRequest } from "../../lib/_security.js";
import { supabase } from "../../lib/_supabase.js";
import { log } from "../../lib/_log.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  const { user: authUser, error: authError } = await authenticateRequest(event, supabase);
  if (authError) return fail(authError, "ERR_AUTH", 401);

  const message = event.queryStringParameters?.message || "hello";
  const model = event.queryStringParameters?.model;

  try {
    const prompt = {
      system: "You are a helpful assistant.",
      user: message,
    };

    const reply = await orchestrateSimple({ prompt, model, task: "debug" });

    return ok({
      status: "ok",
      message: message,
      reply: reply,
    });
  } catch (error) {
    log.error("[ai-debug]", "handler error:", error.message);

    return fail(error.message, "ERR_INTERNAL", 500);
  }
}
