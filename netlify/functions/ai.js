/**
 * Legacy AI gateway — thin proxy to the unified ai-orchestrator.
 *
 * Main's frontend services (via runAIRequest in src/services/ai-orchestrator.ts)
 * call this endpoint. All logic lives in ai-orchestrator.js.
 */
import { handler as orchestratorHandler } from "./ai-orchestrator.js";

export const handler = orchestratorHandler;
