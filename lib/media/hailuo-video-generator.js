const HAILUO_API_BASE = "https://api.minimax.chat/v1";
const POLL_INTERVAL_MS = 10000;
const MAX_POLL_ATTEMPTS = 60;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a video using the Hailuo (MiniMax) video generation API.
 *
 * @param {string} prompt - Text prompt describing the video to generate.
 * @param {object} [options]
 * @param {string} [options.model] - Hailuo model name (default: "T2V-01").
 * @returns {Promise<{url: string, taskId: string}>}
 */
export async function generateHailuoVideo(prompt, options = {}) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  if (!process.env.HAILUO_API_KEY) {
    throw new Error("HAILUO_API_KEY environment variable is not set");
  }

  const model = options.model || "T2V-01";

  // Step 1: Submit the video generation request
  const createRes = await fetch(`${HAILUO_API_BASE}/video_generation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HAILUO_API_KEY}`,
    },
    body: JSON.stringify({ model, prompt }),
  });

  if (!createRes.ok) {
    const error = await createRes.text();
    throw new Error(`Hailuo request failed (${createRes.status}): ${error}`);
  }

  const createData = await createRes.json();
  const taskId = createData.task_id;

  if (!taskId) {
    throw new Error("Hailuo did not return a task ID");
  }

  // Step 2: Poll until the generation is complete
  for (let _i = 0; _i < MAX_POLL_ATTEMPTS; _i++) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(
      `${HAILUO_API_BASE}/query/video_generation?task_id=${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HAILUO_API_KEY}`,
        },
      }
    );

    if (!pollRes.ok) {
      const error = await pollRes.text();
      throw new Error(`Hailuo poll failed (${pollRes.status}): ${error}`);
    }

    const pollData = await pollRes.json();

    if (pollData.status === "Success") {
      const videoUrl = pollData.file_id
        ? `https://api.minimax.chat/v1/files/retrieve?file_id=${pollData.file_id}`
        : pollData.video_url;

      if (!videoUrl) {
        throw new Error(
          "Hailuo video generation completed but no URL returned"
        );
      }

      return { url: videoUrl, taskId };
    }

    if (pollData.status === "Fail") {
      const reason = pollData.base_resp?.status_msg || "unknown error";
      throw new Error(`Hailuo video generation failed: ${reason}`);
    }
  }

  throw new Error(
    `Hailuo video generation timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000} seconds`
  );
}
