import {
  piapiFetch,
  piapiGet,
  sleep,
  POLL_INTERVAL_MS,
  MAX_POLL_ATTEMPTS,
} from "./piapi-client.js";

export async function generateImage(prompt) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  if (!process.env.PIAPI_API_KEY) {
    throw new Error("PIAPI_API_KEY environment variable is not set");
  }

  const createResult = await piapiFetch("/api/flux/v1/generation", {
    model: "flux-pro",
    prompt,
    width: 1024,
    height: 1024,
  });

  const taskId = createResult.data?.task_id;

  if (!taskId) {
    throw new Error("Failed to create image generation task");
  }

  for (let _i = 0; _i < MAX_POLL_ATTEMPTS; _i++) {
    await sleep(POLL_INTERVAL_MS);

    const status = await piapiGet(`/api/flux/v1/generation/${taskId}`);
    const taskStatus = status.data?.status;

    if (taskStatus === "completed") {
      const imageUrl = status.data?.output?.image_url;

      if (!imageUrl) {
        throw new Error("Image generation completed but no URL returned");
      }

      return { url: imageUrl, taskId };
    }

    if (taskStatus === "failed") {
      throw new Error(
        `Image generation failed: ${status.data?.error || "unknown error"}`
      );
    }
  }

  throw new Error("Image generation timed out");
}
