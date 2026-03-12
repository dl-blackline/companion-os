import { getPendingJobs, startJob, updateJobStatus, completeJob } from "./job-queue.js";
import { routeMediaRequest } from "./media-router.js";
import { runWorkflow } from "./workflow-engine.js";

/**
 * Map of job types to their handler functions.
 */
const JOB_HANDLERS = {
  image_generation: handleImageGeneration,
  video_generation: handleVideoGeneration,
  music_generation: handleMusicGeneration,
  content_workflow: handleContentWorkflow,
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
