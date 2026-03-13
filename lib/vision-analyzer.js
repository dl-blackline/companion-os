import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze an image using OpenAI vision capabilities.
 *
 * @param {object} options
 * @param {string} options.image_url          - Public URL or base64 data URL of the image.
 * @param {string} [options.prompt]           - User prompt to accompany the image.
 * @param {string} [options.model]            - Model override (default: gpt-4o).
 * @param {string} [options.systemPrompt]     - System-level instructions for the AI.
 * @param {Array}  [options.conversationHistory] - Recent conversation messages for context.
 * @returns {Promise<string>} The analysis text.
 */
export async function analyzeImage({ image_url, prompt, model, systemPrompt, conversationHistory }) {
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

  // Build input array, prepending conversation history for contextual analysis
  const input = [];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      input.push({
        role: msg.role,
        content: [{ type: "input_text", text: msg.content }],
      });
    }
  }
  input.push({ role: "user", content: userContent });

  const requestOptions = {
    model: visionModel,
    input,
  };

  if (systemPrompt) {
    requestOptions.instructions = systemPrompt;
  }

  const response = await client.responses.create(requestOptions);

  return response.output_text;
}

/**
 * Describe a video by analyzing it. Attempts to analyze a thumbnail/frame from
 * the URL using vision; falls back to text-based analysis for video files
 * (mp4/webm/mov) that cannot be processed as images by the vision API.
 *
 * @param {object} options
 * @param {string} options.video_url          - Public URL of the video or a key frame.
 * @param {string} [options.prompt]           - User prompt to accompany the video.
 * @param {string} [options.model]            - Model override.
 * @param {string} [options.systemPrompt]     - System-level instructions for the AI.
 * @param {Array}  [options.conversationHistory] - Recent conversation messages for context.
 * @returns {Promise<string>} The description text.
 */
export async function describeVideo({ video_url, prompt, model, systemPrompt, conversationHistory }) {
  const userPrompt =
    prompt ||
    "Analyze this video content and describe what you observe, including any details and insights you can provide.";

  // Use a vision-capable model; gpt-4o is the reliable default for vision tasks
  const visionModel = model || "gpt-4o";

  // Build conversation history prefix for context
  const historyInput = [];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      historyInput.push({
        role: msg.role,
        content: [{ type: "input_text", text: msg.content }],
      });
    }
  }

  const requestBase = {
    model: visionModel,
    ...(systemPrompt && { instructions: systemPrompt }),
  };

  // First attempt: treat the URL as an image (works for image-format files and
  // some platforms that serve thumbnail URLs for videos)
  try {
    const response = await client.responses.create({
      ...requestBase,
      input: [
        ...historyInput,
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
  } catch (imgErr) {
    // Video files (mp4/webm/mov) cannot be processed as images; fall back to
    // text-based analysis using the URL and conversation context.
    console.warn(
      "Video-as-image analysis failed, using text-based analysis:",
      imgErr.message
    );

    const fallbackText =
      `${userPrompt}\n\nA video file was uploaded (source: ${video_url}). ` +
      "Based on the conversation context and any details you can infer from " +
      "the source URL, describe what this video likely contains and provide " +
      "any observations or insights you can offer about it.";

    const response = await client.responses.create({
      ...requestBase,
      input: [
        ...historyInput,
        {
          role: "user",
          content: [{ type: "input_text", text: fallbackText }],
        },
      ],
    });
    return response.output_text;
  }
}
