/**
 * Legacy AI gateway — thin proxy to the unified ai-orchestrator.
 *
 * This file exists solely for backward compatibility. All logic now lives in
 * ai-orchestrator.js; this wrapper simply delegates every request there.
 */
import { handler as orchestratorHandler } from "./ai-orchestrator.js";

export const handler = orchestratorHandler;
