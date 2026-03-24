// ─── Media Refinement Service ─────────────────────────────────────────────────
// Service layer for image and video refinement/enhancement flows.
// Routes uploaded media through the AI/media pipeline for refinement.

import type {
  AsyncResult,
  MediaRefinementRequest,
  MediaRefinementResult,
  RefinementAction,
} from '@/types';
import { success, error, appError } from '@/types';
import { DEFAULT_AI_CONTROL_CONFIG } from '@/types/ai-control';
import { runAI } from '@/services/ai-orchestrator';

/** Available refinement actions by media type. */
export const IMAGE_REFINEMENT_ACTIONS: readonly { value: RefinementAction; label: string; description: string }[] = [
  { value: 'enhance', label: 'Auto-Enhance', description: 'AI-powered automatic improvement' },
  { value: 'upscale', label: 'Upscale', description: 'Increase resolution with AI' },
  { value: 'denoise', label: 'Denoise', description: 'Remove noise and grain' },
  { value: 'colorize', label: 'Colorize', description: 'Add or improve colors' },
  { value: 'restore', label: 'Restore', description: 'Fix damage and artifacts' },
  { value: 'background-remove', label: 'Remove Background', description: 'Isolate the subject' },
  { value: 'stylize', label: 'Stylize', description: 'Apply an artistic style' },
  { value: 'custom', label: 'Custom', description: 'Describe what you want' },
] as const;

export const VIDEO_REFINEMENT_ACTIONS: readonly { value: RefinementAction; label: string; description: string }[] = [
  { value: 'enhance', label: 'Auto-Enhance', description: 'AI-powered quality upgrade' },
  { value: 'upscale', label: 'Upscale', description: 'Increase resolution' },
  { value: 'denoise', label: 'Denoise', description: 'Remove noise and grain' },
  { value: 'stylize', label: 'Stylize', description: 'Apply cinematic style' },
  { value: 'super-resolution', label: 'Super-Resolution', description: 'Maximum quality enhancement' },
  { value: 'custom', label: 'Custom', description: 'Describe what you want' },
] as const;

// ─── Refinement API ───────────────────────────────────────────────────────────

/**
 * Submit a media refinement request to the backend.
 * The backend routes to the appropriate AI provider for refinement.
 */
export async function refineMedia(
  request: MediaRefinementRequest,
): Promise<AsyncResult<MediaRefinementResult>> {
  try {
    const result = await runAI<{
      id?: string;
      url?: string;
      refined_url?: string;
      model?: string;
      provider?: string;
      data?: {
        id?: string;
        url?: string;
        refined_url?: string;
        model?: string;
        provider?: string;
      };
    }>({
      type: 'refine_media',
      input: {
        media_url: request.mediaUrl,
        media_type: request.mediaType,
        action: request.action,
        ...(request.prompt ? { prompt: request.prompt } : {}),
        ...(request.model ? { model: request.model } : {}),
        ...(request.options ? { options: request.options } : {}),
      },
      config: {
        ...DEFAULT_AI_CONTROL_CONFIG,
        ...(request.model ? { model: request.model } : {}),
      },
    });

    if (!result.success || !result.data) {
      const msg = result.error || 'Refinement failed';
      return error(appError(
        'server',
        msg,
        { retryable: true },
      ));
    }

    const data = (result.data.data ?? result.data) as Record<string, unknown>;
    const refined: MediaRefinementResult = {
      id: (data.id as string) || crypto.randomUUID(),
      originalUrl: request.mediaUrl,
      refinedUrl: (data.url ?? data.refined_url ?? '') as string,
      action: request.action,
      model: (data.model ?? 'default') as string,
      provider: (data.provider ?? 'openai') as string,
      createdAt: Date.now(),
    };

    return success(refined);
  } catch (e) {
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

/**
 * Build a refinement prompt based on the action and optional user instructions.
 */
export function buildRefinementPrompt(
  action: RefinementAction,
  customPrompt?: string,
): string {
  if (action === 'custom' && customPrompt) {
    return customPrompt;
  }

  const basePrompts: Record<RefinementAction, string> = {
    enhance: 'Enhance this media: improve overall quality, lighting, clarity, and color balance while preserving the original content',
    upscale: 'Upscale this media to higher resolution while preserving detail and sharpness',
    stylize: customPrompt || 'Apply a cinematic, professional style to this media',
    denoise: 'Remove noise and grain from this media while preserving detail',
    colorize: 'Improve the color grading and vibrancy of this media',
    restore: 'Restore this media: fix artifacts, damage, and quality issues',
    'background-remove': 'Remove the background from this image, isolating the main subject',
    'super-resolution': 'Apply super-resolution enhancement for maximum quality improvement',
    custom: customPrompt || 'Improve this media',
  };

  return basePrompts[action];
}
