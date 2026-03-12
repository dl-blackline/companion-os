import OpenAI from "openai";

const POLL_INTERVAL_MS = 10000;
const MAX_POLL_ATTEMPTS = 60;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a video using the OpenAI Sora video generation API.
 *
 * Flow:
 *   1. Submit a video generation task
 *   2. Poll for completion
 *   3. Return the generated video URL
 *
 * @param {string} prompt - Text prompt describing the video to generate.
 * @param {object} [options]
 * @param {string} [options.model] - Sora model name (default: "sora").
 * @param {string} [options.size]  - Video dimensions (default: "1920x1080").
 * @param {number} [options.duration] - Video duration in seconds (default: 10).
 * @returns {Promise<{url: string, taskId: string}>}
 */
export async function generateSoraVideo(prompt, options = {}) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const model = options.model || "sora";
  const size = options.size || "1920x1080";
  const duration = options.duration || 10;

  // Submit video generation task via the OpenAI responses API
  const response = await client.responses.create({
    model,
    input: prompt,
    tools: [
      {
        type: "video_generation",
        size,
        duration,
      },
    ],
  });

  // Extract the generation ID from the output
  const videoOutput = response.output?.find(
    (item) => item.type === "video_generation_call"
  );

  if (!videoOutput?.id) {
    throw new Error("Failed to create Sora video generation task");
  }

  const taskId = videoOutput.id;

  // Poll for completion
  for (let _i = 0; _i < MAX_POLL_ATTEMPTS; _i++) {
    await sleep(POLL_INTERVAL_MS);

    const statusResponse = await client.responses.retrieve(response.id);

    const updatedOutput = statusResponse.output?.find(
      (item) => item.type === "video_generation_call" && item.id === taskId
    );

    if (updatedOutput?.status === "completed") {
      const videoUrl = updatedOutput.video_url;

      if (!videoUrl) {
        throw new Error(
          "Sora video generation completed but no URL returned"
        );
      }

      return { url: videoUrl, taskId };
    }

    if (updatedOutput?.status === "failed") {
      throw new Error(
        `Sora video generation failed: ${updatedOutput.error || "unknown error"}`
      );
    }
  }

  throw new Error("Sora video generation timed out");
}
