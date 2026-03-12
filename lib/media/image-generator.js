const PIAPI_BASE_URL = "https://api.piapi.ai";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

async function piapiFetch(path, body) {
  const response = await fetch(`${PIAPI_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.PIAPI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PiAPI request failed (${response.status}): ${error}`);
  }

  return response.json();
}

async function piapiGet(path) {
  const response = await fetch(`${PIAPI_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "x-api-key": process.env.PIAPI_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PiAPI poll failed (${response.status}): ${error}`);
  }

  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
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
