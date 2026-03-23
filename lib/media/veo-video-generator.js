const VEO_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const POLL_INTERVAL_MS = 10000;
const MAX_POLL_ATTEMPTS = 60;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a video using the Google Veo video generation API (via Gemini API).
 *
 * @param {string} prompt - Text prompt describing the video to generate.
 * @param {object} [options]
 * @param {string} [options.model]       - Veo model name (default: "veo-3.1-generate-preview").
 * @param {string} [options.aspectRatio] - Aspect ratio: "16:9" or "9:16" (default: "16:9").
 * @param {number} [options.durationSeconds] - Clip duration in seconds: 5–8 (default: 5).
 * @returns {Promise<{url: string, taskId: string}>}
 */
export async function generateVeoVideo(prompt, options = {}) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) environment variable is not set");
  }

  const model = options.model || "veo-3.1-generate-preview";
  const aspectRatio = options.aspectRatio || "16:9";
  const durationSeconds = options.durationSeconds || 5;

  // Step 1: Submit the video generation request
  const createRes = await fetch(
    `${VEO_API_BASE}/models/${model}:predictLongRunning?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          aspectRatio,
          durationSeconds,
          sampleCount: 1,
        },
      }),
    }
  );

  if (!createRes.ok) {
    const error = await createRes.text();
    throw new Error(`Veo request failed (${createRes.status}): ${error}`);
  }

  const createData = await createRes.json();
  const operationName = createData.name;

  if (!operationName) {
    throw new Error("Veo did not return an operation name");
  }

  // Step 2: Poll the long-running operation until complete
  for (let _i = 0; _i < MAX_POLL_ATTEMPTS; _i++) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(
      `${VEO_API_BASE}/${operationName}?key=${geminiApiKey}`
    );

    if (!pollRes.ok) {
      const error = await pollRes.text();
      throw new Error(`Veo poll failed (${pollRes.status}): ${error}`);
    }

    const pollData = await pollRes.json();

    if (pollData.done) {
      if (pollData.error) {
        throw new Error(
          `Veo video generation failed: ${pollData.error.message || "unknown error"}`
        );
      }

      const videoUri =
        pollData.response?.predictions?.[0]?.bytesBase64Encoded
          ? `data:video/mp4;base64,${pollData.response.predictions[0].bytesBase64Encoded}`
          : pollData.response?.predictions?.[0]?.videoUri;

      if (!videoUri) {
        throw new Error("Veo video generation completed but no video returned");
      }

      return { url: videoUri, taskId: operationName };
    }
  }

  throw new Error(
    `Veo video generation timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000} seconds`
  );
}
