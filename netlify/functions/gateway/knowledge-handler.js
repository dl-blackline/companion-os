/**
 * gateway/knowledge-handler.js — Knowledge analysis and workflow handler.
 *
 * Covers request types: knowledge, workflow, agent
 */

import { orchestrateSimple } from "../../../services/ai/orchestrator.js";
import {
  createProject,
  addWorkflowStep,
  runWorkflow,
} from "../../../lib/workflow-engine.js";
import { ok, fail } from "../../../lib/_responses.js";

/* ── Knowledge handler ────────────────────────────────────────────────────── */

export async function handleKnowledge(data) {
  const { messages, model, temperature } = data;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return fail("messages array is required", "ERR_VALIDATION", 400);
  }

  const systemMsg = messages.find((m) => m.role === "system");
  const userMsg = messages.find((m) => m.role === "user");

  // NOTE: The original code called `aiChat()` here which was never imported.
  // Fixed to use the centralized orchestrateSimple service.
  const response = await orchestrateSimple({
    prompt: {
      system: systemMsg?.content || "You are a helpful AI assistant.",
      user: userMsg?.content || "",
    },
    model: model || "gpt-4.1",
    temperature: temperature ?? 0.3,
    task: "knowledge_analysis",
  });

  return ok({ response });
}

/* ── Workflow handler ─────────────────────────────────────────────────────── */

export async function handleWorkflow(data) {
  if (data.action === "create_project") {
    const project = await createProject(data);

    if (data.steps) {
      await Promise.all(
        data.steps.map((step, i) =>
          addWorkflowStep({
            project_id: project.id,
            step_order: i + 1,
            step_type: step.step_type,
            config: step.config || {},
          }),
        ),
      );
    }

    return ok({ project });
  }

  if (data.action === "run") {
    const result = await runWorkflow(data.project_id);
    return ok(result);
  }

  return fail("Invalid workflow action", "ERR_VALIDATION", 400);
}
