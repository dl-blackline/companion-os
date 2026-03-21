import { createAgentTask, getAgentTask, getAgentTasksByStatus } from "../../lib/agent-manager.js";
import { AGENTS } from "../../lib/agent-registry.js";
import { ok, fail, preflight, raw } from "../../lib/_responses.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  // GET — list tasks or fetch a single task by id
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};

    // List mode: ?list=true (optionally filter by &status=pending)
    if (params.list) {
      const status = params.status;
      try {
        if (status) {
          const tasks = await getAgentTasksByStatus(status);
          return raw(200, tasks);
        }
        // Return all tasks (most recent first) – fetch each status bucket
        const [pending, processing, completed, failed] = await Promise.all([
          getAgentTasksByStatus("pending", 50),
          getAgentTasksByStatus("processing", 50),
          getAgentTasksByStatus("completed", 50),
          getAgentTasksByStatus("failed", 50),
        ]);
        return raw(200, [...processing, ...pending, ...completed, ...failed]);
      } catch (err) {
        return fail(err.message, "ERR_INTERNAL", 500);
      }
    }

    // Single task by id
    const taskId = params.id;
    if (!taskId) {
      return fail("Missing query parameter: id or list", "ERR_VALIDATION", 400);
    }

    const task = await getAgentTask(taskId);
    if (!task) {
      return fail("Task not found", "ERR_NOT_FOUND", 404);
    }

    return raw(200, task);
  }

  // POST — create a new agent task
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return fail("Invalid JSON body", "ERR_VALIDATION", 400);
    }

    const { agent_type, task } = body;

    if (!agent_type || !task) {
      return fail("Missing required fields: agent_type, task", "ERR_VALIDATION", 400);
    }

    if (!AGENTS[agent_type]) {
      return fail(
        `Unknown agent_type: ${agent_type}. Valid types: ${Object.keys(AGENTS).join(", ")}`,
        "ERR_VALIDATION",
        400,
      );
    }

    try {
      const record = await createAgentTask(agent_type, task);

      if (!record) {
        return fail("Failed to create agent task", "ERR_INTERNAL", 500);
      }

      return ok({ task_id: record.id, status: record.status }, 201);
    } catch (err) {
      return fail(err.message, "ERR_INTERNAL", 500);
    }
  }

  return fail("Method not allowed", "ERR_METHOD", 405);
};
