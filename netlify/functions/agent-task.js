import { createAgentTask, getAgentTask } from "../../lib/agent-manager.js";
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

  // GET — fetch a single task by id (query param)
  if (event.httpMethod === "GET") {
    const taskId = event.queryStringParameters?.id;
    if (!taskId) {
      return response(400, { error: "Missing query parameter: id" });
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
