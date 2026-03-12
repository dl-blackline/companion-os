import { createClient } from "@supabase/supabase-js";
import {
  createTask,
  processPendingTasks,
} from "./agent-manager.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Default schedule intervals in milliseconds.
 */
const DEFAULT_SCHEDULES = {
  memory_consolidation: 30 * 60 * 1000,   // every 30 minutes
  knowledge_graph_update: 60 * 60 * 1000,  // every hour
  goal_analysis: 12 * 60 * 60 * 1000,      // every 12 hours
  project_monitor: 6 * 60 * 60 * 1000,     // every 6 hours
  content_advisor: 24 * 60 * 60 * 1000,    // every 24 hours
};

/**
 * Tracks active interval handles so the scheduler can be stopped.
 */
const activeIntervals = new Map();

/**
 * Retrieve all distinct user IDs that have recent activity.
 */
async function getActiveUserIds() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("messages")
    .select("user_id")
    .gte("created_at", since);

  if (error) {
    console.error("Get active users error:", error.message);
    return [];
  }

  const uniqueIds = [...new Set((data || []).map((row) => row.user_id))];
  return uniqueIds;
}

/**
 * Run a specific agent type for all active users.
 */
async function runAgentForAllUsers(taskType) {
  const userIds = await getActiveUserIds();

  for (const user_id of userIds) {
    try {
      await createTask({ user_id, task_type: taskType });
    } catch (err) {
      console.error(`Scheduler: failed to create ${taskType} task for ${user_id}:`, err.message);
    }
  }

  await processPendingTasks();
}

/**
 * Start the autonomous scheduler with configurable intervals.
 * @param {object} [customSchedules] — Override default intervals per agent type (values in ms).
 * @returns {object} Control handle with a stop() method.
 */
export function startScheduler(customSchedules = {}) {
  const schedules = { ...DEFAULT_SCHEDULES, ...customSchedules };

  for (const [taskType, intervalMs] of Object.entries(schedules)) {
    if (activeIntervals.has(taskType)) {
      continue;
    }

    const handle = setInterval(async () => {
      try {
        console.log(`Scheduler: running ${taskType}`);
        await runAgentForAllUsers(taskType);
        console.log(`Scheduler: completed ${taskType}`);
      } catch (err) {
        console.error(`Scheduler: ${taskType} error:`, err.message);
      }
    }, intervalMs);

    activeIntervals.set(taskType, handle);
  }

  console.log(
    "Autonomous scheduler started with agents:",
    Object.keys(schedules).join(", ")
  );

  return { stop: stopScheduler };
}

/**
 * Stop all scheduled agents.
 */
export function stopScheduler() {
  for (const [taskType, handle] of activeIntervals) {
    clearInterval(handle);
  }
  activeIntervals.clear();
  console.log("Autonomous scheduler stopped.");
}

/**
 * Run all agents once immediately (useful for triggering after a conversation).
 */
export async function runOnce(user_id) {
  const taskTypes = Object.keys(DEFAULT_SCHEDULES);

  for (const taskType of taskTypes) {
    try {
      await createTask({ user_id, task_type: taskType });
    } catch (err) {
      console.error(`runOnce: failed to create ${taskType} task:`, err.message);
    }
  }

  return await processPendingTasks();
}

/**
 * Trigger background agents after a conversation event.
 * Enqueues memory consolidation and knowledge graph update tasks for the user.
 */
export async function onConversation(user_id) {
  const immediateAgents = ["memory_consolidation", "knowledge_graph_update"];

  for (const taskType of immediateAgents) {
    try {
      await createTask({ user_id, task_type: taskType });
    } catch (err) {
      console.error(`onConversation: failed to create ${taskType} task:`, err.message);
    }
  }

  await processPendingTasks();
}
