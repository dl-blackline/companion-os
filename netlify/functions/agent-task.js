import { createAgentTask, getAgentTask, getAgentTasksByStatus } from "../../lib/agent-manager.js";
import { AGENTS } from "../../lib/agent-registry.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return response(204, {});
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
          return response(200, tasks);
        }
        // Return all tasks (most recent first) – fetch each status bucket
        const [pending, processing, completed, failed] = await Promise.all([
          getAgentTasksByStatus("pending", 50),
          getAgentTasksByStatus("processing", 50),
          getAgentTasksByStatus("completed", 50),
          getAgentTasksByStatus("failed", 50),
        ]);
        return response(200, [...processing, ...pending, ...completed, ...failed]);
      } catch (err) {
        return response(500, { error: err.message });
      }
    }

    // Single task by id
    const taskId = params.id;
    if (!taskId) {
      return response(400, { error: "Missing query parameter: id or list" });
    }

    const task = await getAgentTask(taskId);
    if (!task) {
      return response(404, { error: "Task not found" });
    }

    return response(200, task);
  }

  // POST — create a new agent task
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { error: "Invalid JSON body" });
    }

    const { agent_type, task } = body;

    if (!agent_type || !task) {
      return response(400, { error: "Missing required fields: agent_type, task" });
    }

    if (!AGENTS[agent_type]) {
      return response(400, {
        error: `Unknown agent_type: ${agent_type}. Valid types: ${Object.keys(AGENTS).join(", ")}`,
      });
    }

    try {
      const record = await createAgentTask(agent_type, task);

      if (!record) {
        return response(500, { error: "Failed to create agent task" });
      }

      return response(201, { task_id: record.id, status: record.status });
    } catch (err) {
      return response(500, { error: err.message });
    }
  }

  return response(405, { error: "Method not allowed" });
};
