const RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1";
const POLL_INTERVAL_MS = 10000;
const MAX_POLL_ATTEMPTS = 60;

async function runwayFetch(path, body) {
  const response = await fetch(`${RUNWAY_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runway request failed (${response.status}): ${error}`);
  }

  return response.json();
}

async function runwayGet(path) {
  const response = await fetch(`${RUNWAY_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
      "X-Runway-Version": "2024-11-06",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runway poll failed (${response.status}): ${error}`);
  }

  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateVideo(prompt) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  if (!process.env.RUNWAY_API_KEY) {
    throw new Error("RUNWAY_API_KEY environment variable is not set");
  }

  const createResult = await runwayFetch("/image_to_video", {
    model: "gen4_turbo",
    promptText: prompt,
    ratio: "1280:768",
    duration: 10,
  });

  const taskId = createResult.id;

  if (!taskId) {
    throw new Error("Failed to create video generation task");
  }

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const status = await runwayGet(`/tasks/${taskId}`);

    if (status.status === "SUCCEEDED") {
      const videoUrl = status.output?.[0];

      if (!videoUrl) {
        throw new Error("Video generation completed but no URL returned");
      }

      return { url: videoUrl, taskId };
    }

    if (status.status === "FAILED") {
      throw new Error(
        `Video generation failed: ${status.failure || "unknown error"}`
      );
    }
  }

  throw new Error("Video generation timed out");
}
