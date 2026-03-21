import { supabase } from "./_supabase.js";
import { AGENTS } from "./agent-registry.js";

/**
 * Create a new agent task and store it in the agent_tasks table.
 *
 * @param {string} agent_type - One of the registered agent types.
 * @param {string} task_description - Human-readable description of the task.
 * @returns {object|null} The created task record, or null on error.
 */
export async function createAgentTask(agent_type, task_description) {
  if (!AGENTS[agent_type]) {
    throw new Error(`Unknown agent type: ${agent_type}`);
  }

  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent_type,
      task_description,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("createAgentTask error:", error.message);
    return null;
  }

  return data;
}

/**
 * Fetch pending agent tasks, ordered oldest-first.
 *
 * @param {number} [limit=10] - Maximum number of tasks to return.
 * @returns {Array} Array of pending agent task records.
 */
export async function getPendingAgentTasks(limit = 10) {
  const { data, error } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("getPendingAgentTasks error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Fetch agent tasks filtered by status.
 *
 * @param {string} status - Task status to filter by.
 * @param {number} [limit=20] - Maximum number of tasks to return.
 * @returns {Array} Array of agent task records.
 */
export async function getAgentTasksByStatus(status, limit = 20) {
  const { data, error } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getAgentTasksByStatus error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Fetch a single agent task by ID.
 *
 * @param {string} task_id - UUID of the task.
 * @returns {object|null} The task record.
 */
export async function getAgentTask(task_id) {
  const { data, error } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", task_id)
    .single();

  if (error) {
    console.error("getAgentTask error:", error.message);
    return null;
  }

  return data;
}

/**
 * Mark an agent task as started.
 *
 * @param {string} task_id - UUID of the task.
 */
export async function startAgentTask(task_id) {
  const { error } = await supabase
    .from("agent_tasks")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", task_id);

  if (error) {
    console.error("startAgentTask error:", error.message);
  }
}

/**
 * Mark an agent task as completed and store its result.
 *
 * @param {string} task_id - UUID of the task.
 * @param {object} result - The result payload to persist.
 */
export async function completeAgentTask(task_id, result) {
  const { error } = await supabase
    .from("agent_tasks")
    .update({
      status: "completed",
      result: result || {},
      completed_at: new Date().toISOString(),
    })
    .eq("id", task_id);

  if (error) {
    console.error("completeAgentTask error:", error.message);
  }
}

/**
 * Mark an agent task as failed and record the error.
 *
 * @param {string} task_id - UUID of the task.
 * @param {string} errorMessage - Description of the failure.
 */
export async function failAgentTask(task_id, errorMessage) {
  const { error } = await supabase
    .from("agent_tasks")
    .update({
      status: "failed",
      result: { error: errorMessage },
      completed_at: new Date().toISOString(),
    })
    .eq("id", task_id);

  if (error) {
    console.error("failAgentTask error:", error.message);
  }
}
