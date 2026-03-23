/**
 * Legacy media refinement endpoint — thin proxy to the unified ai-orchestrator.
 *
 * Translates the flat refine-media request body into the orchestrator's
 * { type, data } envelope and delegates.
 */
import { handler as orchestratorHandler } from "./ai-orchestrator.js";
import { preflight } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  // Re-wrap the flat body as an orchestrator request with type "refine_media"
  const translated = JSON.stringify({
    type: "refine_media",
    data: JSON.parse(event.body || "{}"),
  });

  return orchestratorHandler({ ...event, body: translated });
}
