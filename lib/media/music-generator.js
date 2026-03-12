import {
  piapiFetch,
  piapiGet,
  sleep,
  POLL_INTERVAL_MS,
  MAX_POLL_ATTEMPTS,
} from "./piapi-client.js";

export async function generateMusic(prompt) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  if (!process.env.PIAPI_API_KEY) {
    throw new Error("PIAPI_API_KEY environment variable is not set");
  }

  const createResult = await piapiFetch("/api/suno/v1/music", {
    prompt,
    make_instrumental: false,
  });

  const taskId = createResult.data?.task_id;

  if (!taskId) {
    throw new Error("Failed to create music generation task");
  }

  for (let _i = 0; _i < MAX_POLL_ATTEMPTS; _i++) {
    await sleep(POLL_INTERVAL_MS);

    const status = await piapiGet(`/api/suno/v1/music/${taskId}`);
    const taskStatus = status.data?.status;

    if (taskStatus === "completed") {
      const audioUrl = status.data?.output?.audio_url;

      if (!audioUrl) {
        throw new Error("Music generation completed but no URL returned");
      }

      return { url: audioUrl, taskId };
    }

    if (taskStatus === "failed") {
      throw new Error(
        `Music generation failed: ${status.data?.error || "unknown error"}`
      );
    }
  }

  throw new Error("Music generation timed out");
}
