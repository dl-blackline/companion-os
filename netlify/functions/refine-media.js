import { generateMedia } from "../../lib/media-engine.js";
import { optimizePrompt } from "../../lib/media/prompt-optimizer.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Build a refinement prompt for the given action and optional user instructions.
 */
function buildRefinementPrompt(action, mediaType, customPrompt) {
  const base = {
    enhance: `Enhance this ${mediaType}: improve overall quality, lighting, clarity, and color balance`,
    upscale: `Upscale this ${mediaType} to higher resolution while preserving detail`,
    stylize: customPrompt || `Apply a cinematic, professional style to this ${mediaType}`,
    denoise: `Remove noise and grain from this ${mediaType} while preserving detail`,
    colorize: `Improve the color grading and vibrancy of this ${mediaType}`,
    restore: `Restore this ${mediaType}: fix artifacts, damage, and quality issues`,
    "background-remove": `Remove the background from this image, isolating the main subject`,
    "super-resolution": `Apply super-resolution enhancement for maximum quality`,
    custom: customPrompt || `Improve this ${mediaType}`,
  };

  return base[action] || customPrompt || `Enhance this ${mediaType}`;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { media_url, media_type, action, prompt, model, options } = JSON.parse(
      event.body
    );

    if (!media_url) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "media_url is required" }),
      };
    }

    if (!media_type || !["image", "video"].includes(media_type)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "media_type must be 'image' or 'video'" }),
      };
    }

    if (!action) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "action is required" }),
      };
    }

    // Build the refinement prompt
    const refinementPrompt = buildRefinementPrompt(action, media_type, prompt);

    // Optimize the prompt
    const optimizedPrompt = await optimizePrompt(refinementPrompt, media_type);

    // For image refinement, use OpenAI image edit capabilities
    // For video refinement, generate an enhanced version via the media engine
    const generationResult = await generateMedia({
      type: media_type,
      prompt: `${optimizedPrompt}. Reference source: ${media_url}`,
      model: model || undefined,
      options: {
        ...options,
        source_url: media_url,
        refinement_action: action,
      },
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        id: generationResult.id || crypto.randomUUID(),
        url: generationResult.url,
        refined_url: generationResult.url,
        model: generationResult.model,
        provider: generationResult.provider,
        prompt: optimizedPrompt,
        action,
        taskId: generationResult.taskId,
      }),
    };
  } catch (err) {
    console.error("refine-media error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Media refinement failed",
        details: err.message,
      }),
    };
  }
}
