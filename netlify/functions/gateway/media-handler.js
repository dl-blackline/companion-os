/**
 * gateway/media-handler.js — Media, multimodal, and refine-media handler.
 *
 * Covers request types: media, image, video, multimodal, refine_media
 */

import { runMediaTask, generateMedia } from "../../../lib/media-engine.js";
import { optimizePrompt } from "../../../lib/media/prompt-optimizer.js";
import { runTask } from "../../../lib/multimodal-engine.js";
import {
  ensureFeatureWithinQuota,
  recordFeatureUsage,
} from "../../../lib/_entitlements.js";
import { ok, fail } from "../../../lib/_responses.js";
import { log } from "../../../lib/_log.js";

/* ── Media generation handler ─────────────────────────────────────────────── */

export async function handleMedia(data) {
  if (!data.prompt) {
    return fail("Prompt required", "ERR_VALIDATION", 400);
  }

  if (!data.user_id) {
    return fail("Unauthorized", "ERR_AUTH", 401);
  }

  const quota = await ensureFeatureWithinQuota(
    data.user_id,
    "media_generation",
    data.user_email,
  );
  if (!quota.allowed) {
    return fail(quota.message, "ERR_PLAN_LIMIT", 402);
  }

  try {
    const mediaType = data.media_type || data.type || "image";
    const result = await runMediaTask({
      type: mediaType,
      prompt: data.prompt,
      model: data.model,
      options: data.options || {},
    });

    await recordFeatureUsage(data.user_id, "media_generation", {
      type: mediaType,
      model: data.model || null,
    });

    return ok({ ...result, quota: quota.feature });
  } catch (err) {
    log.error("[ai]", "media generation error:", err.message);
    return fail(err.message, "ERR_MEDIA", 500);
  }
}

/* ── Multimodal handler ───────────────────────────────────────────────────── */

export async function handleMultimodal(data) {
  if (!data.taskType) {
    return fail("Missing required field: taskType", "ERR_VALIDATION", 400);
  }

  try {
    const result = await runTask({
      type: data.taskType,
      prompt: data.prompt,
      model: data.model,
      options: data.options || {},
    });
    return ok(result);
  } catch (err) {
    log.error("[ai]", "multimodal engine error:", err.message);
    return fail(err.message, "ERR_MULTIMODAL", 500);
  }
}

/* ── Refine media handler ─────────────────────────────────────────────────── */

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

export async function handleRefineMedia(data) {
  const { media_url, media_type, action, prompt, model, options } = data;

  if (!media_url) {
    return fail("media_url is required", "ERR_VALIDATION", 400);
  }
  if (!media_type || !["image", "video"].includes(media_type)) {
    return fail("media_type must be 'image' or 'video'", "ERR_VALIDATION", 400);
  }
  if (!action) {
    return fail("action is required", "ERR_VALIDATION", 400);
  }

  const refinementPrompt = buildRefinementPrompt(action, media_type, prompt);
  const optimizedPrompt = await optimizePrompt(refinementPrompt, media_type);

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
}
