import { createAgentTask, getAgentTask, getAgentTasksByStatus } from "../../lib/agent-manager.js";
import { AGENTS } from "../../lib/agent-registry.js";
import { ok, fail, preflight, raw } from "../../lib/_responses.js";
import { supabase } from "../../lib/_supabase.js";
import { ensureFeatureWithinQuota, recordFeatureUsage } from "../../lib/_entitlements.js";

async function resolveActor(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  return user || null;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  const actor = await resolveActor(event);
  if (!actor) {
    return fail("Unauthorized", "ERR_AUTH", 401);
  }

  // GET — list tasks or fetch a single task by id
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};

    // List mode: ?list=true (optionally filter by &status=pending)
    if (params.list) {
      const status = params.status;
      try {
        if (status) {
          const tasks = await getAgentTasksByStatus(status, 50, actor.id);
          return raw(200, tasks);
        }
        // Return all tasks (most recent first) – fetch each status bucket
        const [pending, processing, completed, failed] = await Promise.all([
          getAgentTasksByStatus("pending", 50, actor.id),
          getAgentTasksByStatus("processing", 50, actor.id),
          getAgentTasksByStatus("completed", 50, actor.id),
          getAgentTasksByStatus("failed", 50, actor.id),
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

    const task = await getAgentTask(taskId, actor.id);
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
      const quota = await ensureFeatureWithinQuota(actor.id, "agent_task", actor.email);
      if (!quota.allowed) {
        return fail(quota.message, "ERR_PLAN_LIMIT", 402);
      }

      const record = await createAgentTask(agent_type, task, actor.id);

      if (!record) {
        return fail("Failed to create agent task", "ERR_INTERNAL", 500);
      }

      await recordFeatureUsage(actor.id, "agent_task", {
        task_id: record.id,
        agent_type,
      });

      return ok({ task_id: record.id, status: record.status, quota: quota.feature }, 201);
    } catch (err) {
      return fail(err.message, "ERR_INTERNAL", 500);
    }
  }

  return fail("Method not allowed", "ERR_METHOD", 405);
};
