import { getPendingJobs, startJob, updateJobStatus, completeJob } from "./job-queue.js";
import { routeMediaRequest } from "./media-router.js";
import { runWorkflow } from "./workflow-engine.js";
import { getAgent } from "./agent-registry.js";
import {
  getPendingAgentTasks,
  startAgentTask,
  completeAgentTask,
  failAgentTask,
} from "./agent-manager.js";
import { route } from "./ai-router.js";

/**
 * Map of job types to their handler functions.
 */
const JOB_HANDLERS = {
  image_generation: handleImageGeneration,
  video_generation: handleVideoGeneration,
  music_generation: handleMusicGeneration,
  content_workflow: handleContentWorkflow,
  agent_task: handleAgentTask,
};

/**
 * Process all pending jobs in the queue.
 * Picks each pending job, marks it as processing, runs the appropriate
 * handler, and stores the result (or records the failure).
 * @returns {Array} Array of processed job results
 */
export async function processJobs() {
  const jobs = await getPendingJobs();
  const results = [];

  for (const job of jobs) {
    const handler = JOB_HANDLERS[job.job_type];

    if (!handler) {
      await updateJobStatus(job.id, "failed");
      results.push({ id: job.id, status: "failed", error: `Unknown job type: ${job.job_type}` });
      continue;
    }

    await startJob(job.id);

    try {
      const result = await handler(job.payload);
      await completeJob(job.id, result);
      results.push({ id: job.id, status: "completed", result });
    } catch (error) {
      await updateJobStatus(job.id, "failed");
      results.push({ id: job.id, status: "failed", error: error.message });
    }
  }

  return results;
}

/**
 * Process a single job by ID reference (already fetched).
 * @param {object} job - The job record
 * @returns {object} The processing result
 */
export async function processSingleJob(job) {
  const handler = JOB_HANDLERS[job.job_type];

  if (!handler) {
    await updateJobStatus(job.id, "failed");
    return { id: job.id, status: "failed", error: `Unknown job type: ${job.job_type}` };
  }

  await startJob(job.id);

  try {
    const result = await handler(job.payload);
    await completeJob(job.id, result);
    return { id: job.id, status: "completed", result };
  } catch (error) {
    await updateJobStatus(job.id, "failed");
    return { id: job.id, status: "failed", error: error.message };
  }
}

// ---------------------------------------------------------------------------
// Job type handlers
// ---------------------------------------------------------------------------

async function handleImageGeneration(payload) {
  return await routeMediaRequest({ type: "image", prompt: payload.prompt });
}

async function handleVideoGeneration(payload) {
  return await routeMediaRequest({ type: "video", prompt: payload.prompt });
}

async function handleMusicGeneration(payload) {
  return await routeMediaRequest({ type: "music", prompt: payload.prompt });
}

async function handleContentWorkflow(payload) {
  return await runWorkflow(payload.project_id);
}

async function handleAgentTask(payload) {
  const { task_id } = payload;
  if (!task_id) {
    throw new Error("agent_task payload missing task_id");
  }

  // Import dynamically to avoid circular deps at module level
  const { getAgentTask } = await import("./agent-manager.js");
  const task = await getAgentTask(task_id);

  if (!task) {
    throw new Error(`Agent task not found: ${task_id}`);
  }

  const agent = getAgent(task.agent_type);
  if (!agent) {
    await failAgentTask(task_id, `Unknown agent type: ${task.agent_type}`);
    throw new Error(`Unknown agent type: ${task.agent_type}`);
  }

  await startAgentTask(task_id);

  try {
    const prompt = {
      system: agent.prompt + "\n\nRespond with valid JSON only. No markdown, no explanation.",
      user: task.task_description,
    };

    const raw = await route({ task: "chat", prompt });

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      result = { raw_response: raw };
    }

    await completeAgentTask(task_id, result);
    return result;
  } catch (err) {
    await failAgentTask(task_id, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Process pending agent tasks (called independently of the job queue)
// ---------------------------------------------------------------------------

/**
 * Pick up all pending agent tasks, execute them through the agent registry,
 * and store results.
 * @returns {Array} Array of processed agent task results
 */
export async function processAgentTasks() {
  const tasks = await getPendingAgentTasks();
  const results = [];

  for (const task of tasks) {
    const agent = getAgent(task.agent_type);

    if (!agent) {
      await failAgentTask(task.id, `Unknown agent type: ${task.agent_type}`);
      results.push({ id: task.id, status: "failed", error: `Unknown agent type: ${task.agent_type}` });
      continue;
    }

    await startAgentTask(task.id);

    try {
      const prompt = {
        system: agent.prompt + "\n\nRespond with valid JSON only. No markdown, no explanation.",
        user: task.task_description,
      };

      const raw = await route({ task: "chat", prompt });

      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        result = { raw_response: raw };
      }

      await completeAgentTask(task.id, result);
      results.push({ id: task.id, status: "completed", result });
    } catch (err) {
      await failAgentTask(task.id, err.message);
      results.push({ id: task.id, status: "failed", error: err.message });
    }
  }

  return results;
}
