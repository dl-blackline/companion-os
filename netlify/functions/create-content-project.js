import { createProject, addWorkflowStep } from "../../lib/workflow-engine.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const { user_id, title, description, project_type, steps } = JSON.parse(
      event.body
    );

    if (!user_id || !title) {
      return fail("Missing required fields: user_id, title", "ERR_VALIDATION", 400);
    }

    const project = await createProject({
      user_id,
      title,
      description,
      project_type,
    });

    if (!project) {
      return fail("Failed to create project", "ERR_INTERNAL", 500);
    }

    // Add workflow steps if provided
    if (steps && Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        await addWorkflowStep({
          project_id: project.id,
          step_order: i + 1,
          step_type: steps[i].step_type,
          config: steps[i].config || {},
        });
      }
    }

    return ok({ project });
  } catch (err) {
    console.error("Create content project error:", err.message);
    return fail("Failed to create content project", "ERR_INTERNAL", 500);
  }
}
