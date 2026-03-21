import { createJob } from "../../lib/job-queue.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

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
    console.log("[generate-media] Incoming request:", { type, prompt: prompt?.slice(0, 80), model, options });

    if (!prompt) {
      console.warn("[generate-media] Missing prompt");
      return fail("Prompt required", "ERR_VALIDATION", 400);
    }

    const job_type = MEDIA_TYPE_TO_JOB[type];

    if (!job_type) {
      console.warn("[generate-media] Unsupported media type:", type);
      return fail("Unsupported media type", "ERR_VALIDATION", 400);
    }

    const job = await createJob(job_type, { type, prompt, model, options });

    if (!job) {
      console.error("[generate-media] Failed to create job for type:", job_type);
      return fail("Failed to create job", "ERR_INTERNAL", 500);
    }

    console.log("[generate-media] Job created:", { job_id: job.id, status: job.status });
    return ok({ job_id: job.id, status: job.status }, 202);
  } catch (error) {
    console.error("[generate-media] Unexpected error:", error?.message || error);
    return fail("Media generation failed", "ERR_INTERNAL", 500);
  }
}
