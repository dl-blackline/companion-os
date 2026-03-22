import OpenAI from "openai";
import { isPortraitSubject } from "./prompt-optimizer.js";

/**
 * Generate an image using the OpenAI Images API (gpt-image-1 / dall-e-3).
 *
 * @param {string} prompt - The text prompt describing the image to generate.
 * @param {object} [options]
 * @param {string} [options.model] - OpenAI image model name (default: "gpt-image-1").
 * @param {string} [options.size]  - Image dimensions (default: "1024x1024").
 * @returns {Promise<{url: string}>} The generated image URL.
 */
export async function generateOpenAIImage(prompt, options = {}) {
  if (!prompt) {
    throw new Error("Missing required parameter: prompt");
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("[openai-image-generator] OPENAI_API_KEY is not set");
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const model = options.model || "gpt-image-1";

  // Use portrait orientation for face/person prompts so faces aren't cropped
  const portraitSize = model === "dall-e-3" ? "1024x1792" : "1024x1536";
  const size = options.size || (isPortraitSubject(prompt) ? portraitSize : "1024x1024");

  // Use highest quality by default for accurate, detailed images
  const quality = options.quality || (model === "dall-e-3" ? "hd" : "high");

  const response = await client.images.generate({
    model,
    prompt,
    size,
    quality,
    n: 1,
  });

  const item = response.data?.[0];
  // gpt-image-1 returns base64 (b64_json); dall-e-3 returns a URL
  const imageUrl = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);

  if (!imageUrl) {
    throw new Error("OpenAI image generation completed but no image data returned");
  }

  return { url: imageUrl };
}
