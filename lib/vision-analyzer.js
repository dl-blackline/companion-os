import OpenAI from "openai";

/** @returns {OpenAI} */
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[vision-analyzer] OPENAI_API_KEY is not set");
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Analyze an image using OpenAI vision capabilities.
 * Enhanced with structured analysis prompts and quality-aware depth control.
 *
 * @param {object} options
 * @param {string} options.image_url          - Public URL or base64 data URL of the image.
 * @param {string} [options.prompt]           - User prompt to accompany the image.
 * @param {string} [options.model]            - Model override (default: gpt-4.1).
 * @param {string} [options.systemPrompt]     - System-level instructions for the AI.
 * @param {Array}  [options.conversationHistory] - Recent conversation messages for context.
 * @param {string} [options.analysisDepth]    - Analysis depth: 'quick', 'standard', 'deep'.
 * @returns {Promise<string>} The analysis text.
 */
export async function analyzeImage({ image_url, prompt, model, systemPrompt, conversationHistory, analysisDepth }) {
  const client = getClient();
  const userContent = [
    {
      type: "input_image",
      image_url: image_url,
      detail: "auto",
    },
  ];

  const depthPrompts = {
    quick: "Briefly describe this image. Focus on the main subject and key elements.",
    standard: "Analyze this image in detail. Describe what you see, identify any notable elements, objects, people, text, and provide relevant insights.",
    deep: `Perform a comprehensive analysis of this image. Include:
1. Overall scene description
2. Key objects and their positions
3. People (if any) — approximate count, actions, expressions
4. Text or signage visible (OCR)
5. Colors, lighting, composition
6. Mood and emotional tone
7. Notable or unusual elements
8. Content classification and categorization
9. Potential context or setting
Provide structured, detailed observations.`,
  };

  const depth = analysisDepth || "standard";
  const analysisPrompt = prompt || depthPrompts[depth] || depthPrompts.standard;

  userContent.unshift({ type: "input_text", text: analysisPrompt });

  // Use a vision-capable model; gpt-4.1 is the reliable default for vision tasks
  const visionModel = model || "gpt-4.1";

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
 * Enhanced with structured analysis and multi-aspect coverage.
 *
 * @param {object} options
 * @param {string} options.video_url          - Public URL of the video or a key frame.
 * @param {string} [options.prompt]           - User prompt to accompany the video.
 * @param {string} [options.model]            - Model override.
 * @param {string} [options.systemPrompt]     - System-level instructions for the AI.
 * @param {Array}  [options.conversationHistory] - Recent conversation messages for context.
 * @param {string} [options.analysisDepth]    - Analysis depth: 'quick', 'standard', 'deep'.
 * @returns {Promise<string>} The description text.
 */
export async function describeVideo({ video_url, prompt, model, systemPrompt, conversationHistory, analysisDepth }) {
  const client = getClient();
  const depth = analysisDepth || "standard";

  const depthPrompts = {
    quick: "Briefly describe this video content. Focus on the main subject.",
    standard: "Analyze this video content and describe what you observe, including key details, subjects, actions, and any relevant insights.",
    deep: `Perform a comprehensive analysis of this video content. Cover:
1. Overall scene and setting
2. Main subjects and their actions
3. Visible text, captions, or signage
4. Audio cues (if inferable from visual context)
5. Mood, tone, and emotional quality
6. Notable moments or transitions
7. Content classification
8. Quality observations (lighting, composition, stability)
Provide structured, detailed observations.`,
  };

  const userPrompt = prompt || depthPrompts[depth] || depthPrompts.standard;

  // Use a vision-capable model; gpt-4.1 is the reliable default for vision tasks
  const visionModel = model || "gpt-4.1";

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
