/**
 * Universal Media Generation Engine
 *
 * Routes generation requests to the correct provider based on model selection.
 *
 * Usage:
 *   generateMedia({ type: "image", model: "openai-image", prompt: "a futuristic city" })
 *   generateMedia({ type: "video", model: "sora", prompt: "ocean waves at sunset" })
 *   generateMedia({ type: "music", prompt: "upbeat jazz" })
 *   generateMedia({ type: "voice", prompt: "Hello, welcome!" })
 */

import { MODEL_REGISTRY, getModel } from "./model-registry.js";
import { generateImage as generateFluxImage } from "./media/image-generator.js";
import { generateOpenAIImage } from "./media/openai-image-generator.js";
import { generateVideo } from "./media/video-generator.js";
import { generateSoraVideo } from "./sora-client.js";
import { generateMusic } from "./media/music-generator.js";
import { generateVoice } from "./media/voice-generator.js";
import { optimizePrompt } from "./media/prompt-optimizer.js";
import { generateImage } from "./image-engine.js";

/**
 * Resolve the provider for a given media type and optional model id.
 * Falls back to the first model in the registry for that type.
 */
function resolveProvider(type, modelId) {
  if (modelId) {
    const entry = getModel(type, modelId);
    if (entry) return entry;
  }
  // Default to first registered model for this type
  const models = MODEL_REGISTRY[type];
  if (models && models.length > 0) return models[0];
  return null;
}

/**
 * Generate media by routing to the correct provider.
 *
 * @param {object} params
 * @param {string} params.type    - Media type: "image" | "video" | "music" | "voice"
 * @param {string} [params.model] - Model id from the registry (e.g. "openai-image", "sora")
 * @param {string} params.prompt  - Generation prompt
 * @param {object} [params.options] - Additional provider-specific options
 * @returns {Promise<{type: string, model: string, provider: string, prompt: string, url?: string, taskId?: string}>}
 */
export async function generateMedia({ type, model, prompt, options = {} }) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  if (!type) {
    throw new Error("Missing required parameter: type");
  }

  const entry = resolveProvider(type, model);

  if (!entry) {
    throw new Error(
      `No provider found for type "${type}"${model ? ` and model "${model}"` : ""}. ` +
        `Supported types: ${Object.keys(MODEL_REGISTRY).join(", ")}`
    );
  }

  // Optimize the prompt before sending to the generator
  const optimizedPrompt = await optimizePrompt(prompt, type);

  let result;

  switch (type) {
    case "image":
      result = await routeImage(entry, optimizedPrompt, options);
      break;

    case "video":
      result = await routeVideo(entry, optimizedPrompt, options);
      break;

    case "music":
      result = await generateMusic(optimizedPrompt);
      break;

    case "voice":
      result = await generateVoice(optimizedPrompt, options.voiceId);
      break;

    default:
      throw new Error(`Unsupported media type: ${type}`);
  }

  return {
    type,
    model: entry.id,
    provider: entry.provider,
    prompt: optimizedPrompt,
    ...result,
  };
}

/**
 * Route image generation to the correct provider.
 */
async function routeImage(entry, prompt, options) {
  switch (entry.provider) {
    case "openai":
      return generateOpenAIImage(prompt, options);

    case "piapi":
      return generateFluxImage(prompt);

    default:
      throw new Error(`Unsupported image provider: ${entry.provider}`);
  }
}

/**
 * Route video generation to the correct provider.
 */
async function routeVideo(entry, prompt, options) {
  switch (entry.provider) {
    case "openai":
      return generateSoraVideo(prompt, options);

    case "runway":
      return generateVideo(prompt);

    default:
      throw new Error(`Unsupported video provider: ${entry.provider}`);
  }
}

/**
 * Simplified media task runner for the AI gateway.
 *
 * @param {object} params
 * @param {string} params.type  - Media type (e.g. "image")
 * @param {string} params.prompt - Generation prompt
 * @param {string} [params.model] - Model id for non-image types
 * @param {object} [params.options] - Additional provider-specific options
 * @returns {Promise<{type: string, url: string}>}
 */
export async function runMediaTask({ type, prompt, model, options = {} }) {
  if (type === "image") {
    // Pass size option from aspect ratio selection if provided
    if (options.size) {
      return await generateOpenAIImage(prompt, { size: options.size });
    }
    return await generateImage(prompt);
  }

  // For non-image types, delegate to the full media engine
  return await generateMedia({ type, prompt, model, options });
}
