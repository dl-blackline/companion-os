const LEONARDO_API_BASE = "https://cloud.leonardo.ai/api/rest/v1";

// Default model: Leonardo Phoenix 1.0 (versatile, high-quality)
const DEFAULT_MODEL_ID = "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate an image using the Leonardo AI API.
 *
 * @param {string} prompt - The text prompt describing the image to generate.
 * @param {object} [options]
 * @param {string} [options.modelId]  - Leonardo model UUID (defaults to Leonardo Phoenix 1.0).
 * @param {number} [options.width]   - Image width in pixels (default: 1024).
 * @param {number} [options.height]  - Image height in pixels (default: 1024).
 * @returns {Promise<{url: string}>} The generated image URL.
 */
export async function generateLeonardoImage(prompt, options = {}) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  const leonardoApiKey = process.env.LEONARDO_API_KEY || process.env.LEONARDO_AI_Key;

  if (!leonardoApiKey) {
    throw new Error("LEONARDO_API_KEY (or LEONARDO_AI_Key) environment variable is not set");
  }

  const modelId = options.modelId || DEFAULT_MODEL_ID;
  const width = options.width || 1024;
  const height = options.height || 1024;

  // Step 1: Submit the generation request
  const createRes = await fetch(`${LEONARDO_API_BASE}/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${leonardoApiKey}`,
    },
    body: JSON.stringify({
      prompt,
      modelId,
      width,
      height,
      num_images: 1,
    }),
  });

  if (!createRes.ok) {
    const error = await createRes.text();
    throw new Error(`Leonardo generation request failed (${createRes.status}): ${error}`);
  }

  const createData = await createRes.json();
  const generationId = createData.sdGenerationJob?.generationId;

  if (!generationId) {
    throw new Error("Leonardo AI did not return a generation ID");
  }

  // Step 2: Poll until the generation is complete
  for (let _i = 0; _i < MAX_POLL_ATTEMPTS; _i++) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
      headers: {
        Authorization: `Bearer ${leonardoApiKey}`,
      },
    });

    if (!pollRes.ok) {
      const error = await pollRes.text();
      throw new Error(`Leonardo poll failed (${pollRes.status}): ${error}`);
    }

    const pollData = await pollRes.json();
    const generation = pollData.generations_by_pk;

    if (!generation) {
      continue;
    }

    if (generation.status === "COMPLETE") {
      const imageUrl = generation.generated_images?.[0]?.url;

      if (!imageUrl) {
        throw new Error("Leonardo image generation completed but no URL returned");
      }

      return { url: imageUrl };
    }

    if (generation.status === "FAILED") {
      const reason = generation.statusMessage || generation.description || "unknown error";
      throw new Error(`Leonardo image generation failed: ${reason}`);
    }
  }

  throw new Error(
    `Leonardo image generation timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000} seconds`
  );
}
