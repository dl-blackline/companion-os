const PIAPI_BASE_URL = "https://api.piapi.ai";
const POLL_INTERVAL_MS = 10000;
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

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
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
