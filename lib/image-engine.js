import OpenAI from "openai";
import { isPortraitSubject } from "./media/prompt-optimizer.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an image using the OpenAI Images API (gpt-image-1).
 *
 * @param {string} prompt - The text prompt describing the image to generate.
 * @returns {Promise<{type: string, url: string}>}
 */
export async function generateImage(prompt) {
  console.log("Image generation prompt:", prompt);

  // Use portrait orientation for face/person prompts so faces aren't cropped
  const size = isPortraitSubject(prompt) ? "1024x1536" : "1024x1024";

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
