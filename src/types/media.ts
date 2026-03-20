// ─── Media Domain Types ───────────────────────────────────────────────────────
// Shared types for video and photo/image processing, analysis, and export.

import type { AppError } from './async';

// ─── Common ───────────────────────────────────────────────────────────────────

/** Supported image MIME types. */
export type ImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

/** Supported video MIME types. */
export type VideoMimeType =
  | 'video/mp4'
  | 'video/webm'
  | 'video/quicktime';

export type SupportedMimeType = ImageMimeType | VideoMimeType;

/** Constraints used for client-side validation. */
export interface MediaConstraints {
  readonly maxImageSizeBytes: number;
  readonly maxVideoSizeBytes: number;
  readonly allowedImageTypes: readonly ImageMimeType[];
  readonly allowedVideoTypes: readonly VideoMimeType[];
}

export const DEFAULT_MEDIA_CONSTRAINTS: MediaConstraints = {
  maxImageSizeBytes: 10 * 1024 * 1024,       // 10 MB
  maxVideoSizeBytes: 100 * 1024 * 1024,       // 100 MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedVideoTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
} as const;

// ─── Media Metadata ───────────────────────────────────────────────────────────

export interface ImageMetadata {
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly sizeBytes: number;
  readonly hasAlpha: boolean;
  readonly colorSpace?: string;
}

export interface VideoMetadata {
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly codec?: string;
  readonly fps?: number;
  readonly sizeBytes: number;
  readonly hasAudio: boolean;
  readonly thumbnailUrl?: string;
}

// ─── Upload Types ─────────────────────────────────────────────────────────────

/** Discriminated union for upload job state. */
export type UploadState =
  | { readonly status: 'idle' }
  | { readonly status: 'validating' }
  | { readonly status: 'uploading'; readonly progress: number }
  | { readonly status: 'processing' }
  | { readonly status: 'complete'; readonly url: string }
  | { readonly status: 'error'; readonly error: AppError };

export interface FileValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly fileType: 'image' | 'video' | 'unknown';
  readonly mimeType: string;
  readonly sizeBytes: number;
}

// ─── Image Transform Types ────────────────────────────────────────────────────

export type ImageTransformOp =
  | { readonly type: 'crop'; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  | { readonly type: 'resize'; readonly width: number; readonly height: number; readonly maintainAspect: boolean }
  | { readonly type: 'rotate'; readonly degrees: 0 | 90 | 180 | 270 }
  | { readonly type: 'flip'; readonly direction: 'horizontal' | 'vertical' }
  | { readonly type: 'filter'; readonly filterName: ImageFilterName; readonly intensity: number }
  | { readonly type: 'compress'; readonly quality: number; readonly format: 'jpeg' | 'png' | 'webp' }
  | { readonly type: 'enhance'; readonly enhancementType: ImageEnhancementType };

export type ImageFilterName =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'blur'
  | 'sharpen'
  | 'grayscale'
  | 'sepia'
  | 'vintage'
  | 'warm'
  | 'cool';

export type ImageEnhancementType =
  | 'auto_enhance'
  | 'denoise'
  | 'upscale'
  | 'color_correction'
  | 'hdr';

export interface ImageEditorState {
  readonly originalUrl: string;
  readonly currentUrl: string;
  readonly transforms: readonly ImageTransformOp[];
  readonly undoStack: readonly (readonly ImageTransformOp[])[];
  readonly redoStack: readonly (readonly ImageTransformOp[])[];
  readonly isDirty: boolean;
}

// ─── Video Edit Types ─────────────────────────────────────────────────────────

export type VideoEditOp =
  | { readonly type: 'trim'; readonly startSeconds: number; readonly endSeconds: number }
  | { readonly type: 'clip'; readonly startSeconds: number; readonly durationSeconds: number }
  | { readonly type: 'snapshot'; readonly atSeconds: number }
  | { readonly type: 'speed'; readonly factor: number }
  | { readonly type: 'mute_audio' }
  | { readonly type: 'add_caption'; readonly text: string; readonly startSeconds: number; readonly endSeconds: number };

export interface VideoEditorState {
  readonly sourceUrl: string;
  readonly metadata: VideoMetadata | null;
  readonly edits: readonly VideoEditOp[];
  readonly previewTimestamp: number;
  readonly isDirty: boolean;
}

// ─── Media Generation Types ───────────────────────────────────────────────────

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export type MediaGenerationStyle =
  | 'photorealistic'
  | 'cinematic'
  | 'artistic'
  | 'portrait'
  | 'lifestyle'
  | 'editorial';

export interface ImageGenerationRequest {
  readonly prompt: string;
  readonly style: MediaGenerationStyle;
  readonly aspectRatio: AspectRatio;
  readonly model?: string;
  readonly enhancePrompt: boolean;
}

export interface VideoGenerationRequest {
  readonly prompt: string;
  readonly style: MediaGenerationStyle;
  readonly durationSeconds: number;
  readonly model: 'sora' | 'runway-gen3' | 'kling-3.0' | 'kling-omni' | 'hailuo-2.3' | 'veo-3.1' | 'nofilter-video';
  readonly enhancePrompt: boolean;
  readonly audioMode?: VideoAudioMode;
}

export interface MediaGenerationResult {
  readonly id: string;
  readonly type: 'image' | 'video';
  readonly prompt: string;
  readonly enhancedPrompt?: string;
  readonly resultUrl: string;
  readonly model: string;
  readonly provider: string;
  readonly createdAt: number;
}

// ─── Media Analysis Types ─────────────────────────────────────────────────────

export interface MediaAnalysisRequest {
  readonly mediaUrl: string;
  readonly mediaType: 'image' | 'video';
  readonly analysisDepth: 'quick' | 'standard' | 'deep';
  readonly enableOcr: boolean;
  readonly enableTranscript: boolean;
}

export interface DetectedObject {
  readonly label: string;
  readonly confidence: number;
  readonly boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface MediaSceneSegment {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly description: string;
  readonly tags: readonly string[];
  readonly keyObjects: readonly string[];
}

export interface MediaAnalysisResult {
  readonly summary: string;
  readonly description: string;
  readonly extractedText: string | null;
  readonly transcript: string | null;
  readonly tags: readonly string[];
  readonly entities: readonly MediaEntityResult[];
  readonly emotionalCues: readonly string[];
  readonly objects: readonly DetectedObject[];
  readonly scenes: readonly MediaSceneSegment[];
  readonly contentClassification: ContentClassification;
  readonly qualityScore: number;
}

export interface MediaEntityResult {
  readonly name: string;
  readonly type: 'person' | 'place' | 'object' | 'event' | 'brand' | 'other';
  readonly confidence: number;
}

export interface ContentClassification {
  readonly primaryCategory: string;
  readonly subcategories: readonly string[];
  readonly isSafe: boolean;
  readonly sensitivityFlags: readonly string[];
}

// ─── Export Types ──────────────────────────────────────────────────────────────

export interface ImageExportOptions {
  readonly format: 'jpeg' | 'png' | 'webp';
  readonly quality: number;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
}

export interface VideoExportOptions {
  readonly format: 'mp4' | 'webm';
  readonly quality: 'low' | 'medium' | 'high';
  readonly resolution: '480p' | '720p' | '1080p';
  readonly includeAudio: boolean;
}

// ─── Video Audio Mode ─────────────────────────────────────────────────────────

/** Whether the video generation request should include audio. */
export type VideoAudioMode = 'silent' | 'with-audio' | 'audio-only';

// ─── Media Asset (unified wrapper) ────────────────────────────────────────────

export interface MediaAsset {
  readonly id: string;
  readonly userId: string;
  readonly type: 'image' | 'video';
  readonly sourceUrl: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: number;
  readonly metadata?: ImageMetadata | VideoMetadata;
}

// ─── Refinement Types ─────────────────────────────────────────────────────────

export type RefinementAction =
  | 'enhance'
  | 'upscale'
  | 'stylize'
  | 'denoise'
  | 'colorize'
  | 'restore'
  | 'background-remove'
  | 'super-resolution'
  | 'custom';

export interface MediaRefinementRequest {
  readonly mediaUrl: string;
  readonly mediaType: 'image' | 'video';
  readonly action: RefinementAction;
  readonly prompt?: string;
  readonly model?: string;
  readonly options?: Record<string, unknown>;
}

export interface MediaRefinementResult {
  readonly id: string;
  readonly originalUrl: string;
  readonly refinedUrl: string;
  readonly action: RefinementAction;
  readonly model: string;
  readonly provider: string;
  readonly createdAt: number;
}

// ─── Media Processing Job ─────────────────────────────────────────────────────

export type MediaJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface MediaProcessingJob {
  readonly id: string;
  readonly type: 'generation' | 'refinement';
  readonly mediaType: 'image' | 'video';
  readonly status: MediaJobStatus;
  readonly progress?: number;
  readonly resultUrl?: string;
  readonly error?: string;
  readonly createdAt: number;
  readonly completedAt?: number;
}

// ─── Media Save / Persist ─────────────────────────────────────────────────────

export interface MediaSavePayload {
  readonly userId: string;
  readonly mediaUrl: string;
  readonly mediaType: 'image' | 'video';
  readonly filename: string;
  readonly prompt?: string;
  readonly style?: string;
  readonly model?: string;
  readonly provider?: string;
  readonly source: 'generation' | 'refinement' | 'upload';
  readonly mimeType?: string;
  readonly sizeBytes?: number;
}

export interface UserMediaRecord {
  readonly id: string;
  readonly userId: string;
  readonly mediaUrl: string;
  readonly mediaType: 'image' | 'video';
  readonly filename: string;
  readonly prompt?: string;
  readonly style?: string;
  readonly model?: string;
  readonly provider?: string;
  readonly source: 'generation' | 'refinement' | 'upload';
  readonly createdAt: string;
}

// ─── Provider Config ──────────────────────────────────────────────────────────

export interface ProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly type: 'image' | 'video' | 'audio' | 'refinement';
  readonly enabled: boolean;
  readonly models: readonly string[];
}

// ─── API Result ───────────────────────────────────────────────────────────────

export interface ApiResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly code?: number;
}

export interface ErrorResult {
  readonly success: false;
  readonly error: string;
  readonly code?: number;
  readonly details?: Record<string, unknown>;
}

// ─── Media Pipeline State (discriminated union) ───────────────────────────────

export type MediaPipelineState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'uploading'; readonly progress: number }
  | { readonly phase: 'generating'; readonly mediaType: 'image' | 'video' }
  | { readonly phase: 'refining'; readonly action: RefinementAction }
  | { readonly phase: 'preview-ready'; readonly resultUrl: string; readonly mediaType: 'image' | 'video' }
  | { readonly phase: 'saving' }
  | { readonly phase: 'success'; readonly savedId: string }
  | { readonly phase: 'error'; readonly message: string; readonly retryable: boolean };

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateMediaFile(
  file: File,
  constraints: MediaConstraints = DEFAULT_MEDIA_CONSTRAINTS,
): FileValidationResult {
  const mimeType = file.type;
  const sizeBytes = file.size;
  const isImage = (constraints.allowedImageTypes as readonly string[]).includes(mimeType);
  const isVideo = (constraints.allowedVideoTypes as readonly string[]).includes(mimeType);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType || 'unknown'}. Supported: ${[...constraints.allowedImageTypes, ...constraints.allowedVideoTypes].join(', ')}`,
      fileType: 'unknown',
      mimeType,
      sizeBytes,
    };
  }

  const fileType = isImage ? 'image' as const : 'video' as const;
  const maxSize = isImage ? constraints.maxImageSizeBytes : constraints.maxVideoSizeBytes;

  if (sizeBytes > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `File too large (${Math.round(sizeBytes / (1024 * 1024))} MB). Maximum for ${fileType}: ${maxMb} MB.`,
      fileType,
      mimeType,
      sizeBytes,
    };
  }

  return { valid: true, fileType, mimeType, sizeBytes };
}
