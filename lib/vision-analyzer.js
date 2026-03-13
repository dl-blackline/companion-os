import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze an image using OpenAI vision capabilities.
 *
 * @param {object} options
 * @param {string} options.image_url - Public URL of the image.
 * @param {string} [options.prompt]  - User prompt to accompany the image.
 * @param {string} [options.model]   - Model override (default: gpt-4o).
 * @returns {Promise<string>} The analysis text.
 */
export async function analyzeImage({ image_url, prompt, model }) {
  const userContent = [
    {
      type: "input_image",
      image_url: image_url,
      detail: "auto",
    },
  ];

  if (prompt) {
    userContent.unshift({ type: "input_text", text: prompt });
  } else {
    userContent.unshift({
      type: "input_text",
      text: "Analyze this image in detail. Describe what you see, any notable elements, and provide relevant insights.",
    });
  }

  // Use a vision-capable model; gpt-4o is the reliable default for vision tasks
  const visionModel = model || "gpt-4o";

  const response = await client.responses.create({
    model: visionModel,
    input: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  return response.output_text;
}

/**
 * Describe a video by analyzing it as an uploaded image/thumbnail.
 * For short videos, the user should provide a representative frame URL.
 *
 * @param {object} options
 * @param {string} options.video_url - Public URL of the video or a key frame.
 * @param {string} [options.prompt]  - User prompt to accompany the video.
 * @param {string} [options.model]   - Model override.
 * @returns {Promise<string>} The description text.
 */
export async function describeVideo({ video_url, prompt, model }) {
  const userPrompt =
    prompt ||
    "This is a frame from a video. Describe what appears to be happening and provide any relevant observations.";

  // Use a vision-capable model; gpt-4o is the reliable default for vision tasks
  const visionModel = model || "gpt-4o";

  const response = await client.responses.create({
    model: visionModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: userPrompt },
          { type: "input_image", image_url: video_url, detail: "auto" },
        ],
      },
    ],
  });

  return response.output_text;
}
