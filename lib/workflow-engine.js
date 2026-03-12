import { createClient } from "@supabase/supabase-js";
import { routeMediaRequest } from "./media-router.js";
import { route } from "./ai-router.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Create a new content project.
 */
export async function createProject({ user_id, title, description, project_type }) {
  const { data, error } = await supabase
    .from("content_projects")
    .insert({
      user_id,
      title,
      description: description || "",
      project_type: project_type || "general",
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    console.error("Create project error:", error.message);
    return null;
  }

  return data;
}

/**
 * Get a content project by ID.
 */
export async function getProject(project_id) {
  const { data, error } = await supabase
    .from("content_projects")
    .select("*")
    .eq("id", project_id)
    .single();

  if (error) {
    console.error("Get project error:", error.message);
    return null;
  }

  return data;
}

/**
 * List content projects for a user.
 */
export async function listProjects(user_id) {
  const { data, error } = await supabase
    .from("content_projects")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("List projects error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Add a workflow step to a project.
 */
export async function addWorkflowStep({ project_id, step_order, step_type, config }) {
  const { data, error } = await supabase
    .from("workflow_steps")
    .insert({
      project_id,
      step_order,
      step_type,
      config: config || {},
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Add workflow step error:", error.message);
    return null;
  }

  return data;
}

/**
 * Get workflow steps for a project, ordered by step_order.
 */
export async function getWorkflowSteps(project_id) {
  const { data, error } = await supabase
    .from("workflow_steps")
    .select("*")
    .eq("project_id", project_id)
    .order("step_order", { ascending: true });

  if (error) {
    console.error("Get workflow steps error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Store a content asset produced by a workflow step.
 */
export async function storeAsset({ project_id, step_id, asset_type, url, metadata }) {
  const { data, error } = await supabase
    .from("content_assets")
    .insert({
      project_id,
      step_id: step_id || null,
      asset_type,
      url,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error("Store asset error:", error.message);
    return null;
  }

  return data;
}

/**
 * Execute a single workflow step.
 */
async function executeStep(step) {
  try {
    switch (step.step_type) {
      case "generate_text": {
        const prompt = step.config?.prompt || "";
        if (!prompt) {
          return { success: false, error: "generate_text step requires a prompt in config" };
        }
        const text = await route({ task: "chat", prompt: { system: "You are a content writer.", user: prompt } });
        return { success: true, output: text };
      }

      case "generate_image":
      case "generate_video":
      case "generate_music":
      case "generate_voice": {
        const typeMap = {
          generate_image: "image",
          generate_video: "video",
          generate_music: "music",
          generate_voice: "voice",
        };
        const result = await routeMediaRequest({
          type: typeMap[step.step_type],
          prompt: step.config?.prompt || "",
        });
        return { success: true, output: result };
      }

      default:
        return { success: false, error: `Unknown step type: ${step.step_type}` };
    }
  } catch (err) {
    console.error(`Workflow step execution error (${step.step_type}):`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Run all pending workflow steps for a project in order.
 *
 * Updates step status and stores generated assets along the way.
 */
export async function runWorkflow(project_id) {
  console.log("Running workflow:", project_id);

  const steps = await getWorkflowSteps(project_id);

  if (steps.length === 0) {
    return { success: false, error: "No workflow steps found" };
  }

  // Mark project as in-progress
  await supabase
    .from("content_projects")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", project_id);

  const results = [];

  for (const step of steps) {
    if (step.status === "completed") {
      results.push({ step_id: step.id, skipped: true });
      continue;
    }

    // Mark step as processing
    await supabase
      .from("workflow_steps")
      .update({ status: "processing" })
      .eq("id", step.id);

    const result = await executeStep(step);

    if (result.success) {
      await supabase
        .from("workflow_steps")
        .update({ status: "completed", result: result.output, completed_at: new Date().toISOString() })
        .eq("id", step.id);

      // Store asset if the step produced a URL
      if (result.output?.url) {
        await storeAsset({
          project_id,
          step_id: step.id,
          asset_type: step.step_type.replace("generate_", ""),
          url: result.output.url,
          metadata: result.output,
        });
      }
    } else {
      await supabase
        .from("workflow_steps")
        .update({ status: "failed", result: { error: result.error } })
        .eq("id", step.id);

      // Mark project as failed and stop execution
      await supabase
        .from("content_projects")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", project_id);

      return { success: false, error: result.error, completedSteps: results };
    }

    results.push({ step_id: step.id, result: result.output });
  }

  // Mark project as completed
  await supabase
    .from("content_projects")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", project_id);

  return { success: true, results };
}
