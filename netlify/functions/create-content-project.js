import { createProject, addWorkflowStep, runWorkflow } from "../../lib/workflow-engine.js";

export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { user_id, title, description, project_type, steps } = JSON.parse(
      event.body
    );

    if (!user_id || !title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields: user_id, title",
        }),
      };
    }

    const project = await createProject({
      user_id,
      title,
      description,
      project_type,
    });

    if (!project) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to create project" }),
      };
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ project }),
    };
  } catch (err) {
    console.error("Create content project error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to create content project",
        details: err.message,
      }),
    };
  }
}
