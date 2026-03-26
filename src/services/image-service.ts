// ─── Image Service ────────────────────────────────────────────────────────────
// Typed service layer for image upload, generation, transforms, and analysis.

import type {
  AsyncResult,
  ImageGenerationRequest,
  MediaGenerationResult,
  MediaAnalysisResult,
  ImageMetadata,
  ImageMimeType,
  ImageTransformOp,
  ImageEditorState,
  FileValidationResult,
} from '@/types';
import {
  success,
  error,
  appError,
  DEFAULT_MEDIA_CONSTRAINTS,
} from '@/types';
import { supabase, supabaseConfigured } from '@/lib/supabase-client';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = '/.netlify/functions';

const ALLOWED_IMAGE_TYPES: readonly ImageMimeType[] = DEFAULT_MEDIA_CONSTRAINTS.allowedImageTypes;
const MAX_IMAGE_SIZE = DEFAULT_MEDIA_CONSTRAINTS.maxImageSizeBytes;

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabaseConfigured) return {};
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateImageFile(file: File): FileValidationResult {
  const mimeType = file.type;
  const sizeBytes = file.size;
  const isImage = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType);

  if (!isImage) {
    return {
      valid: false,
      error: `Unsupported image format: ${mimeType || 'unknown'}. Supported: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      fileType: 'unknown',
      mimeType,
      sizeBytes,
    };
  }

  if (sizeBytes > MAX_IMAGE_SIZE) {
    const maxMb = Math.round(MAX_IMAGE_SIZE / (1024 * 1024));
    return {
      valid: false,
      error: `Image too large (${Math.round(sizeBytes / (1024 * 1024))} MB). Maximum: ${maxMb} MB.`,
      fileType: 'image',
      mimeType,
      sizeBytes,
    };
  }

  return { valid: true, fileType: 'image', mimeType, sizeBytes };
}

// ─── Image Metadata Extraction ────────────────────────────────────────────────

export function extractImageMetadata(file: File): Promise<ImageMetadata> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const metadata: ImageMetadata = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: file.type.split('/')[1] || 'unknown',
        sizeBytes: file.size,
        hasAlpha: file.type === 'image/png' || file.type === 'image/webp',
        colorSpace: undefined,
      };
      URL.revokeObjectURL(url);
      resolve(metadata);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image metadata'));
    };

    img.src = url;
  });
}

// ─── Image Editor State ───────────────────────────────────────────────────────

export function createEditorState(originalUrl: string): ImageEditorState {
  return {
    originalUrl,
    currentUrl: originalUrl,
    transforms: [],
    undoStack: [],
    redoStack: [],
    isDirty: false,
  };
}

export function applyTransform(
  state: ImageEditorState,
  op: ImageTransformOp,
): ImageEditorState {
  return {
    ...state,
    transforms: [...state.transforms, op],
    undoStack: [...state.undoStack, state.transforms],
    redoStack: [],
    isDirty: true,
  };
}

export function undoTransform(state: ImageEditorState): ImageEditorState {
  if (state.undoStack.length === 0) return state;
  const previous = state.undoStack[state.undoStack.length - 1];
  return {
    ...state,
    transforms: previous,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, state.transforms],
    isDirty: previous.length > 0,
  };
}

export function redoTransform(state: ImageEditorState): ImageEditorState {
  if (state.redoStack.length === 0) return state;
  const next = state.redoStack[state.redoStack.length - 1];
  return {
    ...state,
    transforms: next,
    undoStack: [...state.undoStack, state.transforms],
    redoStack: state.redoStack.slice(0, -1),
    isDirty: true,
  };
}

export function resetEditor(state: ImageEditorState): ImageEditorState {
  return createEditorState(state.originalUrl);
}

// ─── Client-Side Image Transforms ─────────────────────────────────────────────

/**
 * Apply a series of transforms to an image using Canvas API.
 * Returns a data URL of the result.
 */
export async function applyImageTransforms(
  imageUrl: string,
  transforms: readonly ImageTransformOp[],
): Promise<string> {
  const img = await loadImage(imageUrl);
  let canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d')!;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);

  for (const op of transforms) {
    switch (op.type) {
      case 'crop': {
        const imageData = ctx.getImageData(op.x, op.y, op.width, op.height);
        canvas.width = op.width;
        canvas.height = op.height;
        ctx = canvas.getContext('2d')!;
        ctx.putImageData(imageData, 0, 0);
        break;
      }
      case 'resize': {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = op.width;
        tmpCanvas.height = op.height;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        tmpCtx.drawImage(canvas, 0, 0, op.width, op.height);
        canvas = tmpCanvas;
        ctx = tmpCtx;
        break;
      }
      case 'rotate': {
        const tmpCanvas = document.createElement('canvas');
        const radians = (op.degrees * Math.PI) / 180;
        const isRightAngle = op.degrees === 90 || op.degrees === 270;
        tmpCanvas.width = isRightAngle ? canvas.height : canvas.width;
        tmpCanvas.height = isRightAngle ? canvas.width : canvas.height;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        tmpCtx.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
        tmpCtx.rotate(radians);
        tmpCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        canvas = tmpCanvas;
        ctx = tmpCtx;
        break;
      }
      case 'flip': {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = canvas.width;
        tmpCanvas.height = canvas.height;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        if (op.direction === 'horizontal') {
          tmpCtx.scale(-1, 1);
          tmpCtx.drawImage(canvas, -canvas.width, 0);
        } else {
          tmpCtx.scale(1, -1);
          tmpCtx.drawImage(canvas, 0, -canvas.height);
        }
        canvas = tmpCanvas;
        ctx = tmpCtx;
        break;
      }
      case 'filter': {
        const filterStr = buildCssFilter(op.filterName, op.intensity);
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = canvas.width;
        tmpCanvas.height = canvas.height;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        tmpCtx.filter = filterStr;
        tmpCtx.drawImage(canvas, 0, 0);
        canvas = tmpCanvas;
        ctx = tmpCtx;
        break;
      }
      case 'compress':
        // Compression is handled at export time via toDataURL quality
        break;
      case 'enhance':
        // Enhancement would require server-side processing
        break;
    }
  }

  return canvas.toDataURL('image/png');
}

function buildCssFilter(filterName: string, intensity: number): string {
  const clamped = Math.max(0, Math.min(1, intensity));
  switch (filterName) {
    case 'brightness': return `brightness(${0.5 + clamped})`;
    case 'contrast': return `contrast(${0.5 + clamped})`;
    case 'saturation': return `saturate(${clamped * 2})`;
    case 'blur': return `blur(${clamped * 10}px)`;
    case 'sharpen': return `contrast(${1 + clamped * 0.3})`;
    case 'grayscale': return `grayscale(${clamped})`;
    case 'sepia': return `sepia(${clamped})`;
    case 'vintage': return `sepia(${clamped * 0.6}) contrast(${1 + clamped * 0.1})`;
    case 'warm': return `sepia(${clamped * 0.3}) saturate(${1 + clamped * 0.3})`;
    case 'cool': return `hue-rotate(${clamped * 30}deg) saturate(${1 - clamped * 0.2})`;
    default: return 'none';
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

// ─── Image Generation ─────────────────────────────────────────────────────────

export async function generateImage(
  request: ImageGenerationRequest,
): Promise<AsyncResult<MediaGenerationResult>> {
  try {
    console.log('[image-service] generateImage request:', { prompt: request.prompt, model: request.model, style: request.style });
    const authHeaders = await getAuthHeaders();

    const res = await fetch(`${API_BASE}/generate-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        type: 'image',
        prompt: request.prompt,
        model: request.model,
        options: {
          style: request.style,
          aspect_ratio: request.aspectRatio,
          enhance_prompt: request.enhancePrompt,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as Record<string, string>).error || `Image generation failed (${res.status})`;
      console.error('[image-service] generateImage error:', msg);
      return error(appError(
        res.status === 429 ? 'rate_limit' : 'server',
        msg,
        { retryable: res.status >= 500 || res.status === 429 },
      ));
    }

    const json = await res.json() as Record<string, unknown>;
    console.log('[image-service] generateImage response:', json);

    // Unwrap ok() envelope: { success, data: { ... } }
    const data = (json.data ?? json) as Record<string, unknown>;

    const resultUrl = (data.url ?? data.resultUrl ?? '') as string;
    if (!resultUrl) {
      console.error('[image-service] No image URL in response:', data);
      return error(appError('processing_failed', 'Image generation completed but no image URL was returned'));
    }

    const result: MediaGenerationResult = {
      id: crypto.randomUUID(),
      type: 'image',
      prompt: request.prompt,
      enhancedPrompt: data.prompt as string | undefined,
      resultUrl,
      model: (data.model ?? 'gpt-image-1') as string,
      provider: (data.provider ?? 'openai') as string,
      createdAt: Date.now(),
    };

    return success(result);
  } catch (e) {
    console.error('[image-service] generateImage exception:', (e as Error).message);
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

// ─── Image Analysis ───────────────────────────────────────────────────────────

/**
 * Analyze an image via the media-memory backend pipeline.
 *
 * The backend `media-memory` function requires `user_id`, `public_url`, and
 * `filename` to be present in the request body.  Earlier versions of this
 * helper sent only `media_url` (wrong key) and omitted `user_id` / `filename`,
 * causing a 400 "Missing required field" error that surfaced as a
 * "base table not found" confusion downstream.
 */
export async function analyzeImage(
  imageUrl: string,
  userId: string,
  filename: string,
  depth: 'quick' | 'standard' | 'deep' = 'standard',
): Promise<AsyncResult<MediaAnalysisResult>> {
  if (!userId) {
    return error(appError('validation', 'Missing required user_id for image analysis'));
  }
  if (!filename) {
    return error(appError('validation', 'Missing required filename for image analysis'));
  }

  try {
    const res = await fetch(`${API_BASE}/media-memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze',
        user_id: userId,
        public_url: imageUrl,
        filename,
        media_type: 'image',
        analysis_depth: depth,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return error(appError('server', (body as Record<string, string>).error || 'Image analysis failed', { retryable: true }));
    }

    const json = await res.json() as Record<string, unknown>;
    const data = (json.data ?? json) as { analysis_record?: MediaAnalysisResult; analysis?: MediaAnalysisResult };
    const analysis = data.analysis_record || data.analysis;
    if (!analysis) {
      return error(appError('processing_failed', 'No analysis result returned from backend'));
    }
    return success(analysis);
  } catch (e) {
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

// ─── Image Export ─────────────────────────────────────────────────────────────

export async function exportImage(
  imageUrl: string,
  transforms: readonly ImageTransformOp[],
  format: 'jpeg' | 'png' | 'webp' = 'png',
  quality = 0.92,
): Promise<Blob> {
  const resultDataUrl = await applyImageTransforms(imageUrl, transforms);
  const res = await fetch(resultDataUrl);
  const blob = await res.blob();

  // If the desired format differs, convert via canvas
  if (!blob.type.includes(format)) {
    const img = await loadImage(resultDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Export failed'))),
        `image/${format}`,
        quality,
      );
    });
  }

  return blob;
}

/** Trigger a browser download for an image. */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Thumbnail Generation ─────────────────────────────────────────────────────

export async function generateThumbnail(
  imageUrl: string,
  maxDimension = 200,
): Promise<string> {
  const img = await loadImage(imageUrl);
  const scale = Math.min(maxDimension / img.naturalWidth, maxDimension / img.naturalHeight, 1);
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.7);
}
