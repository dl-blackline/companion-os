import { createProject, addWorkflowStep } from "../../lib/workflow-engine.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { authenticateRequest , validatePayloadSize } from '../../lib/_security.js';
import { log } from "../../lib/_log.js";
import { supabase } from "../../lib/_supabase.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  const { user: authUser, error: authError } = await authenticateRequest(event, supabase);
  if (authError) return fail(authError, "ERR_AUTH", 401);

  try {
    const sizeCheck = validatePayloadSize(event.body);
    if (!sizeCheck.valid) return fail(sizeCheck.error, "ERR_PAYLOAD_SIZE", 413);

    const { title, description, project_type, steps } = JSON.parse(
      event.body
    );
    const user_id = authUser.id;

    if (!title) {
      return fail("Missing required field: title", "ERR_VALIDATION", 400);
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
    log.error("[create-content-project]", "handler error:", err.message);
    return fail("Failed to create content project", "ERR_INTERNAL", 500);
  }
}
