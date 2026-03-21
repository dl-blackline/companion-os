import { createJob } from "../../lib/job-queue.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MEDIA_TYPE_TO_JOB = {
  image: "image_generation",
  video: "video_generation",
  music: "music_generation",
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    const { type, prompt, model, options } = JSON.parse(event.body);

    if (!prompt) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Prompt required" }),
      };
    }

    const job_type = MEDIA_TYPE_TO_JOB[type];

    if (!job_type) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Unsupported media type" }),
      };
    }

    const job = await createJob(job_type, { type, prompt, model, options });

    if (!job) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Failed to create job" }),
      };
    }

    return {
      statusCode: 202,
      headers: CORS_HEADERS,
      body: JSON.stringify({ job_id: job.id, status: job.status }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Media generation failed",
        details: error.message,
      }),
    };
  }
}
