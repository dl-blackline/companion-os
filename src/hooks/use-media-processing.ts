// ─── useMediaProcessing Hook ──────────────────────────────────────────────────
// Typed hook for managing media upload, generation, and analysis state.

import { useState, useCallback, useRef } from 'react';
import type {
  AsyncResult,
  MediaGenerationResult,
  MediaAnalysisResult,
  ImageGenerationRequest,
  VideoGenerationRequest,
  FileValidationResult,
} from '@/types';
import { idle, loading, error, appError } from '@/types';
import { validateVideoFile, generateVideo, analyzeVideo, extractVideoMetadata, extractVideoThumbnail } from '@/services/video-service';
import { validateImageFile, generateImage, analyzeImage, extractImageMetadata } from '@/services/image-service';
import type { VideoMetadata, ImageMetadata } from '@/types';
import { useAuth } from '@/context/auth-context';

interface UseMediaProcessingReturn {
  /** Current generation state. */
  generationState: AsyncResult<MediaGenerationResult>;
  /** Current analysis state. */
  analysisState: AsyncResult<MediaAnalysisResult>;
  /** Validate a file before upload. */
  validateFile: (file: File) => FileValidationResult;
  /** Generate an image from a prompt. */
  requestImageGeneration: (request: ImageGenerationRequest) => Promise<void>;
  /** Generate a video from a prompt. */
  requestVideoGeneration: (request: VideoGenerationRequest) => Promise<void>;
  /** Analyze an image by URL. */
  requestImageAnalysis: (url: string, filename: string, depth?: 'quick' | 'standard' | 'deep') => Promise<void>;
  /** Analyze a video by URL. */
  requestVideoAnalysis: (url: string, filename: string, depth?: 'quick' | 'standard' | 'deep') => Promise<void>;
  /** Extract metadata from a local file. */
  extractMetadata: (file: File) => Promise<VideoMetadata | ImageMetadata>;
  /** Extract a video thumbnail. */
  getVideoThumbnail: (file: File, atSeconds?: number) => Promise<string>;
  /** Reset all states. */
  reset: () => void;
}

export function useMediaProcessing(): UseMediaProcessingReturn {
  const { user: authUser } = useAuth();
  const [generationState, setGenerationState] = useState<AsyncResult<MediaGenerationResult>>(idle());
  const [analysisState, setAnalysisState] = useState<AsyncResult<MediaAnalysisResult>>(idle());
  const abortRef = useRef<AbortController | null>(null);

  const validateFile = useCallback((file: File): FileValidationResult => {
    const isVideo = file.type.startsWith('video/');
    return isVideo ? validateVideoFile(file) : validateImageFile(file);
  }, []);

  const requestImageGeneration = useCallback(async (request: ImageGenerationRequest) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setGenerationState(loading());

    const result = await generateImage(request);
    setGenerationState(result);
  }, []);

  const requestVideoGeneration = useCallback(async (request: VideoGenerationRequest) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setGenerationState(loading());

    const result = await generateVideo(request);
    setGenerationState(result);
  }, []);

  const requestImageAnalysis = useCallback(async (url: string, filename: string, depth: 'quick' | 'standard' | 'deep' = 'standard') => {
    const userId = authUser?.id;
    if (!userId) {
      setAnalysisState(error(appError('validation', 'User must be authenticated to analyze media')));
      return;
    }
    setAnalysisState(loading());
    const result = await analyzeImage(url, userId, filename, depth);
    setAnalysisState(result);
  }, [authUser?.id]);

  const requestVideoAnalysis = useCallback(async (url: string, filename: string, depth: 'quick' | 'standard' | 'deep' = 'standard') => {
    const userId = authUser?.id;
    if (!userId) {
      setAnalysisState(error(appError('validation', 'User must be authenticated to analyze media')));
      return;
    }
    setAnalysisState(loading());
    const result = await analyzeVideo(url, userId, filename, depth);
    setAnalysisState(result);
  }, [authUser?.id]);

  const extractMetadata = useCallback(async (file: File): Promise<VideoMetadata | ImageMetadata> => {
    if (file.type.startsWith('video/')) {
      return extractVideoMetadata(file);
    }
    return extractImageMetadata(file);
  }, []);

  const getVideoThumbnail = useCallback(async (file: File, atSeconds?: number) => {
    return extractVideoThumbnail(file, atSeconds);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setGenerationState(idle());
    setAnalysisState(idle());
  }, []);

  return {
    generationState,
    analysisState,
    validateFile,
    requestImageGeneration,
    requestVideoGeneration,
    requestImageAnalysis,
    requestVideoAnalysis,
    extractMetadata,
    getVideoThumbnail,
    reset,
  };
}
