import { createJob } from "../../lib/job-queue.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

const MEDIA_TYPE_TO_JOB = {
  image: "image_generation",
  video: "video_generation",
  music: "music_generation",
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  try {
    const { type, prompt, model, options } = JSON.parse(event.body);
    log.info("[generate-media]", "incoming request:", { type, model, options, promptLength: prompt?.length });

    if (!prompt) {
      log.warn("[generate-media]", "missing prompt");
      return fail("Prompt required", "ERR_VALIDATION", 400);
    }

    const job_type = MEDIA_TYPE_TO_JOB[type];

    if (!job_type) {
      log.warn("[generate-media]", "unsupported media type:", type);
      return fail("Unsupported media type", "ERR_VALIDATION", 400);
    }

    const job = await createJob(job_type, { type, prompt, model, options });

    if (!job) {
      log.error("[generate-media]", "failed to create job for type:", job_type);
      return fail("Failed to create job", "ERR_INTERNAL", 500);
    }

    log.info("[generate-media]", "job created:", { job_id: job.id, status: job.status });
    return ok({ job_id: job.id, status: job.status }, 202);
  } catch (error) {
    log.error("[generate-media]", "unexpected error:", error?.message || error);
    return fail("Media generation failed", "ERR_INTERNAL", 500);
  }
}
