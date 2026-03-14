/**
 * Video Engine — routes video generation to the correct provider.
 *
 * Routing:
 *   model == "sora"          → OpenAI Sora video endpoint
 *   model == "runway-gen3"   → Runway API
 *   model == "kling-3.0"     → Kling AI
 *   model == "kling-omni"    → Kling AI
 *   model == "hailuo-2.3"    → Hailuo (MiniMax)
 *   model == "veo-3.1"       → Google Veo
 *   model == "nofilter-video" → NoFilter GPT API
 *   (default)                → first registered video model
 */

import { generateSoraVideo } from "./sora-client.js";
import { generateVideo } from "./media/video-generator.js";
import { generateKlingVideo } from "./media/kling-video-generator.js";
import { generateHailuoVideo } from "./media/hailuo-video-generator.js";
import { generateVeoVideo } from "./media/veo-video-generator.js";
import { generateVideo as nofilterGenerateVideo } from "./nofilter-client.js";
import { getModel, MODEL_REGISTRY } from "./model-registry.js";

/**
 * Resolve the video provider entry from the model registry.
 */
function resolveVideoProvider(modelId) {
  if (modelId) {
    const entry = getModel("video", modelId);
    if (entry) return entry;
  }
  // Default to the first registered video model
  const models = MODEL_REGISTRY.video;
  return models && models.length > 0 ? models[0] : null;
}

/**
 * Generate a video by routing to the correct provider.
 *
 * @param {string} prompt   - Text prompt describing the video.
 * @param {string} [model]  - Model id: "sora", "runway-gen3", "kling-3.0", "kling-omni",
 *                            "hailuo-2.3", "veo-3.1", or "nofilter-video".
 * @param {object} [options] - Additional provider-specific options.
 * @returns {Promise<{model: string, provider: string, prompt: string, url?: string, taskId?: string}>}
 */
export async function generateVideoFromEngine(prompt, model, options = {}) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  const entry = resolveVideoProvider(model);

  if (!entry) {
    const supported = (MODEL_REGISTRY.video || []).map((m) => m.id).join(", ");
    throw new Error(
      `No video provider found${model ? ` for model "${model}"` : ""}. ` +
        `Supported: ${supported}`
    );
  }

  let result;

  switch (entry.provider) {
    case "openai":
      result = await generateSoraVideo(prompt, options);
      break;

    case "runway":
      result = await generateVideo(prompt);
      break;

    case "kling":
      result = await generateKlingVideo(prompt, {
        ...options,
        ...(entry.modelId ? { model: entry.modelId } : {}),
      });
      break;

    case "hailuo":
      result = await generateHailuoVideo(prompt, {
        ...options,
        ...(entry.modelId ? { model: entry.modelId } : {}),
      });
      break;

    case "google":
      result = await generateVeoVideo(prompt, {
        ...options,
        ...(entry.modelId ? { model: entry.modelId } : {}),
      });
      break;

    case "nofilter":
      result = await nofilterGenerateVideo(prompt);
      break;

    default:
      throw new Error(`Unsupported video provider: ${entry.provider}`);
  }

  return {
    model: entry.id,
    provider: entry.provider,
    prompt,
    ...result,
  };
}
