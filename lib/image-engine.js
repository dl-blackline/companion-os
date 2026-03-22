import OpenAI from "openai";
import { isPortraitSubject } from "./media/prompt-optimizer.js";
import { generateImage as nofilterGenerateImage } from "./nofilter-client.js";
import { getModel } from "./model-registry.js";

/** @returns {OpenAI} */
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[image-engine] OPENAI_API_KEY is not set");
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Generate an image, routing to the correct provider based on the model id.
 *
 * Supported models:
 *   "nofilter-image" → NoFilter GPT API (unrestricted generation)
 *   (default)        → OpenAI gpt-image-1
 *
 * @param {string} prompt - The text prompt describing the image to generate.
 * @param {string} [model] - Model id from the registry (e.g. "nofilter-image").
 * @returns {Promise<{type: string, url: string}>}
 */
export async function generateImage(prompt, model) {
  console.log("Image generation prompt:", prompt);

  // Route to NoFilter when the selected image model uses the nofilter provider
  if (model) {
    const entry = getModel("image", model);
    if (entry?.provider === "nofilter") {
      return await nofilterGenerateImage(prompt);
    }
  }

  // Default: OpenAI gpt-image-1
  // Use portrait orientation for face/person prompts so faces aren't cropped
  const size = isPortraitSubject(prompt) ? "1024x1536" : "1024x1024";

  const openai = getOpenAIClient();
  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
    quality: "high",
  });

  const item = result.data[0];
  // gpt-image-1 returns base64 (b64_json); dall-e-3 returns a URL
  const url = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null);

  if (!url) {
    throw new Error("Image generation completed but no image data returned");
  }

  return {
    type: "image",
    url,
  };
}
