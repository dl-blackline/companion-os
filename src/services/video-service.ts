// ─── Video Service ────────────────────────────────────────────────────────────
// Typed service layer for video upload, generation, processing, and analysis.

import type {
  AsyncResult,
  VideoGenerationRequest,
  MediaGenerationResult,
  MediaAnalysisResult,
  VideoMetadata,
  VideoMimeType,
  UploadState,
  FileValidationResult,
} from '@/types';
import {
  success,
  error,
  processing,
  appError,
  DEFAULT_MEDIA_CONSTRAINTS,
} from '@/types';
import { supabase, supabaseConfigured } from '@/lib/supabase-client';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = '/.netlify/functions';

const ALLOWED_VIDEO_TYPES: readonly VideoMimeType[] = DEFAULT_MEDIA_CONSTRAINTS.allowedVideoTypes;
const MAX_VIDEO_SIZE = DEFAULT_MEDIA_CONSTRAINTS.maxVideoSizeBytes;

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

export function validateVideoFile(file: File): FileValidationResult {
  const mimeType = file.type;
  const sizeBytes = file.size;
  const isVideo = (ALLOWED_VIDEO_TYPES as readonly string[]).includes(mimeType);

  if (!isVideo) {
    return {
      valid: false,
      error: `Unsupported video format: ${mimeType || 'unknown'}. Supported: ${ALLOWED_VIDEO_TYPES.join(', ')}`,
      fileType: 'unknown',
      mimeType,
      sizeBytes,
    };
  }

  if (sizeBytes > MAX_VIDEO_SIZE) {
    const maxMb = Math.round(MAX_VIDEO_SIZE / (1024 * 1024));
    return {
      valid: false,
      error: `Video too large (${Math.round(sizeBytes / (1024 * 1024))} MB). Maximum: ${maxMb} MB.`,
      fileType: 'video',
      mimeType,
      sizeBytes,
    };
  }

  return { valid: true, fileType: 'video', mimeType, sizeBytes };
}

// ─── Video Metadata Extraction ────────────────────────────────────────────────

export function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: video.duration,
        sizeBytes: file.size,
        hasAudio: true, // We assume true by default; detailed detection requires decoding
        fps: undefined,
        codec: undefined,
        thumbnailUrl: undefined,
      };
      URL.revokeObjectURL(url);
      resolve(metadata);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata'));
    };

    video.src = url;
  });
}

/** Extract a thumbnail from a video at a given time offset. */
export function extractVideoThumbnail(
  file: File,
  atSeconds = 1,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;

    video.onloadeddata = () => {
      video.currentTime = Math.min(atSeconds, video.duration);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to seek video for thumbnail'));
    };

    video.src = url;
  });
}

// ─── Video Generation ─────────────────────────────────────────────────────────

export async function generateVideo(
  request: VideoGenerationRequest,
): Promise<AsyncResult<MediaGenerationResult>> {
  try {
    console.log('[video-service] generateVideo request:', { prompt: request.prompt, model: request.model, style: request.style });
    const authHeaders = await getAuthHeaders();

    const res = await fetch(`${API_BASE}/generate-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        type: 'video',
        prompt: request.prompt,
        model: request.model,
        options: {
          style: request.style,
          duration: request.durationSeconds,
          enhance_prompt: request.enhancePrompt,
          audio_mode: request.audioMode ?? 'silent',
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as Record<string, string>).error || `Video generation failed (${res.status})`;
      console.error('[video-service] generateVideo error:', msg);
      return error(appError(
        res.status === 429 ? 'rate_limit' : 'server',
        msg,
        { retryable: res.status >= 500 || res.status === 429 },
      ));
    }

    const json = await res.json() as Record<string, unknown>;
    console.log('[video-service] generateVideo response:', json);

    // Unwrap ok() envelope: { success, data: { ... } }
    const data = (json.data ?? json) as Record<string, unknown>;

    // Check for both taskId (provider APIs) and job_id (Netlify job queue) since
    // different backends return different field names for async job identifiers.
    if (data.taskId || data.job_id) {
      const taskId = (data.taskId ?? data.job_id) as string;
      console.log('[video-service] Async job created:', taskId);
      return processing(taskId);
    }

    const resultUrl = (data.url ?? data.resultUrl ?? '') as string;
    if (!resultUrl) {
      console.error('[video-service] No video URL in response:', data);
      return error(appError('processing_failed', 'Video generation completed but no video URL was returned'));
    }

    const result: MediaGenerationResult = {
      id: crypto.randomUUID(),
      type: 'video',
      prompt: request.prompt,
      enhancedPrompt: data.prompt as string | undefined,
      resultUrl,
      model: (data.model ?? request.model) as string,
      provider: (data.provider ?? 'unknown') as string,
      createdAt: Date.now(),
    };

    return success(result);
  } catch (e) {
    console.error('[video-service] generateVideo exception:', (e as Error).message);
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

// ─── Video Analysis ───────────────────────────────────────────────────────────

/**
 * Analyze a video via the media-memory backend pipeline.
 *
 * The backend `media-memory` function requires `user_id`, `public_url`, and
 * `filename` to be present in the request body.  Earlier versions of this
 * helper sent only `media_url` (wrong key) and omitted `user_id` / `filename`,
 * causing a 400 "Missing required field" error from the backend.
 */
export async function analyzeVideo(
  videoUrl: string,
  userId: string,
  filename: string,
  depth: 'quick' | 'standard' | 'deep' = 'standard',
): Promise<AsyncResult<MediaAnalysisResult>> {
  if (!userId) {
    return error(appError('validation', 'Missing required user_id for video analysis'));
  }
  if (!filename) {
    return error(appError('validation', 'Missing required filename for video analysis'));
  }

  try {
    const res = await fetch(`${API_BASE}/media-memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze',
        user_id: userId,
        public_url: videoUrl,
        filename,
        media_type: 'video',
        analysis_depth: depth,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return error(appError('server', (body as Record<string, string>).error || 'Video analysis failed', { retryable: true }));
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

// ─── Job Polling ──────────────────────────────────────────────────────────────

export interface VideoJobStatus {
  readonly status: 'queued' | 'processing' | 'completed' | 'failed';
  readonly progress?: number;
  readonly resultUrl?: string;
  readonly error?: string;
}

export async function pollVideoJobStatus(jobId: string): Promise<VideoJobStatus> {
  const res = await fetch(`${API_BASE}/job-status?id=${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    throw new Error(`Job status check failed: ${res.status}`);
  }
  return await res.json() as VideoJobStatus;
}

/** Poll a video job until completion or failure. Returns the final result. */
export async function waitForVideoJob(
  jobId: string,
  onProgress?: (status: VideoJobStatus) => void,
  intervalMs = 3000,
  maxAttempts = 100,
): Promise<AsyncResult<MediaGenerationResult>> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await pollVideoJobStatus(jobId);
    onProgress?.(status);

    if (status.status === 'completed' && status.resultUrl) {
      return success({
        id: jobId,
        type: 'video',
        prompt: '',
        resultUrl: status.resultUrl,
        model: '',
        provider: '',
        createdAt: Date.now(),
      });
    }

    if (status.status === 'failed') {
      return error(appError('processing_failed', status.error || 'Video processing failed'));
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return error(appError('timeout', 'Video processing timed out'));
}

// ─── Upload Helpers ───────────────────────────────────────────────────────────

export function createInitialUploadState(): UploadState {
  return { status: 'idle' };
}
