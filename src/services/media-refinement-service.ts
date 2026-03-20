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

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = '/.netlify/functions';

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
    const res = await fetch(`${API_BASE}/refine-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_url: request.mediaUrl,
        media_type: request.mediaType,
        action: request.action,
        prompt: request.prompt,
        model: request.model,
        options: request.options,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as Record<string, string>).error || `Refinement failed (${res.status})`;
      return error(appError(
        res.status === 429 ? 'rate_limit' : 'server',
        msg,
        { retryable: res.status >= 500 || res.status === 429 },
      ));
    }

    const data = await res.json() as Record<string, unknown>;
    const result: MediaRefinementResult = {
      id: (data.id as string) || crypto.randomUUID(),
      originalUrl: request.mediaUrl,
      refinedUrl: (data.url ?? data.refined_url ?? '') as string,
      action: request.action,
      model: (data.model ?? 'default') as string,
      provider: (data.provider ?? 'openai') as string,
      createdAt: Date.now(),
    };

    return success(result);
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
