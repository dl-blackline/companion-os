import * as crypto from "crypto";

const KLING_API_BASE = "https://api.klingai.com/v1";
const POLL_INTERVAL_MS = 10000;
const MAX_POLL_ATTEMPTS = 60;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a JWT token for Kling AI API authentication.
 * Kling uses HMAC-SHA256 signed JWT with access_key (iss) and secret_key.
 */
function generateKlingJWT(accessKey, secretKey) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })
  ).toString("base64url");
  const signing = `${header}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(signing)
    .digest("base64url");
  return `${signing}.${signature}`;
}

/**
 * Generate a video using the Kling AI API.
 *
 * @param {string} prompt - Text prompt describing the video to generate.
 * @param {object} [options]
 * @param {string} [options.model]       - Kling model name (e.g. "kling-v3", "kling-omni").
 * @param {string} [options.duration]    - Clip duration in seconds: "5" or "10" (default: "5").
 * @param {string} [options.aspectRatio] - Aspect ratio: "16:9", "9:16", "1:1" (default: "16:9").
 * @returns {Promise<{url: string, taskId: string}>}
 */
export async function generateKlingVideo(prompt, options = {}) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error(
      "KLING_ACCESS_KEY and KLING_SECRET_KEY environment variables are not set"
    );
  }

  const model = options.model || "kling-v3";
  const duration = options.duration || "5";
  const aspectRatio = options.aspectRatio || "16:9";

  // Step 1: Submit the video generation request
  const token = generateKlingJWT(accessKey, secretKey);
  const createRes = await fetch(`${KLING_API_BASE}/videos/text2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model_name: model,
      prompt,
      duration,
      aspect_ratio: aspectRatio,
    }),
  });

  if (!createRes.ok) {
    const error = await createRes.text();
    throw new Error(`Kling request failed (${createRes.status}): ${error}`);
  }

  const createData = await createRes.json();
  const taskId = createData.data?.task_id;

  if (!taskId) {
    throw new Error("Kling AI did not return a task ID");
  }

  // Step 2: Poll until the generation is complete
  for (let _i = 0; _i < MAX_POLL_ATTEMPTS; _i++) {
    await sleep(POLL_INTERVAL_MS);

    const pollToken = generateKlingJWT(accessKey, secretKey);
    const pollRes = await fetch(
      `${KLING_API_BASE}/videos/text2video/${taskId}`,
      {
        headers: { Authorization: `Bearer ${pollToken}` },
      }
    );

    if (!pollRes.ok) {
      const error = await pollRes.text();
      throw new Error(`Kling poll failed (${pollRes.status}): ${error}`);
    }

    const pollData = await pollRes.json();
    const task = pollData.data;

    if (!task) {
      continue;
    }

    if (task.task_status === "succeed") {
      const videoUrl = task.task_result?.videos?.[0]?.url;

      if (!videoUrl) {
        throw new Error("Kling video generation completed but no URL returned");
      }

      return { url: videoUrl, taskId };
    }

    if (task.task_status === "failed") {
      const reason = task.task_status_msg || "unknown error";
      throw new Error(`Kling video generation failed: ${reason}`);
    }
  }

  throw new Error(
    `Kling video generation timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000} seconds`
  );
}
