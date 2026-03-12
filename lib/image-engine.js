import OpenAI from "openai";

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

  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
  });

  return {
    type: "image",
    url: result.data[0].url,
  };
}
