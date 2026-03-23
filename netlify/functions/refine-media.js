import { generateMedia } from "../../lib/media-engine.js";
import { optimizePrompt } from "../../lib/media/prompt-optimizer.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

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
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    const { media_url, media_type, action, prompt, model, options } = JSON.parse(
      event.body
    );

    if (!media_url) {
      return fail("media_url is required", "ERR_VALIDATION", 400);
    }

    if (!media_type || !["image", "video"].includes(media_type)) {
      return fail("media_type must be 'image' or 'video'", "ERR_VALIDATION", 400);
    }

    if (!action) {
      return fail("action is required", "ERR_VALIDATION", 400);
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

    return ok({
      id: generationResult.id || crypto.randomUUID(),
      url: generationResult.url,
      refined_url: generationResult.url,
      model: generationResult.model,
      provider: generationResult.provider,
      prompt: optimizedPrompt,
      action,
      taskId: generationResult.taskId,
    });
  } catch (err) {
    log.error("[refine-media]", "handler error:", err.message);
    return fail("Media refinement failed", "ERR_INTERNAL", 500);
  }
}
