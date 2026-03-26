// ─── useMediaProcessing Hook ──────────────────────────────────────────────────
// Typed hook for managing media upload, generation, refinement, and save state.

import { useState, useCallback, useRef } from 'react';
import type {
  AsyncResult,
  MediaGenerationResult,
  MediaAnalysisResult,
  MediaRefinementRequest,
  MediaRefinementResult,
  MediaSavePayload,
  UserMediaRecord,
  ImageGenerationRequest,
  VideoGenerationRequest,
  FileValidationResult,
  MediaPipelineState,
} from '@/types';
import { idle, loading, error, appError } from '@/types';
import { validateVideoFile, generateVideo, analyzeVideo, extractVideoMetadata, extractVideoThumbnail } from '@/services/video-service';
import { validateImageFile, generateImage, analyzeImage, extractImageMetadata } from '@/services/image-service';
import { refineMedia } from '@/services/media-refinement-service';
import { saveMedia, listUserMedia } from '@/services/media-persistence-service';
import type { VideoMetadata, ImageMetadata } from '@/types';
import { useAuth } from '@/context/auth-context';

interface UseMediaProcessingReturn {
  /** Current generation state. */
  generationState: AsyncResult<MediaGenerationResult>;
  /** Current analysis state. */
  analysisState: AsyncResult<MediaAnalysisResult>;
  /** Current refinement state. */
  refinementState: AsyncResult<MediaRefinementResult>;
  /** Current save state. */
  saveState: AsyncResult<UserMediaRecord>;
  /** Current pipeline phase. */
  pipelineState: MediaPipelineState;
  /** Saved media records. */
  savedMedia: UserMediaRecord[];
  /** Validate a file before upload. */
  validateFile: (file: File) => FileValidationResult;
  /** Generate an image from a prompt. */
  requestImageGeneration: (request: ImageGenerationRequest) => Promise<void>;
  /** Generate a video from a prompt. */
  requestVideoGeneration: (request: VideoGenerationRequest) => Promise<void>;
  /** Refine/enhance uploaded media. */
  requestRefinement: (request: MediaRefinementRequest) => Promise<void>;
  /** Save generated/refined media for the authenticated user. */
  requestSave: (payload: Omit<MediaSavePayload, 'userId'>) => Promise<void>;
  /** Load saved media for the authenticated user. */
  loadSavedMedia: (mediaType?: 'image' | 'video') => Promise<void>;
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
  const [refinementState, setRefinementState] = useState<AsyncResult<MediaRefinementResult>>(idle());
  const [saveState, setSaveState] = useState<AsyncResult<UserMediaRecord>>(idle());
  const [pipelineState, setPipelineState] = useState<MediaPipelineState>({ phase: 'idle' });
  const [savedMedia, setSavedMedia] = useState<UserMediaRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const validateFile = useCallback((file: File): FileValidationResult => {
    const isVideo = file.type.startsWith('video/');
    return isVideo ? validateVideoFile(file) : validateImageFile(file);
  }, []);

  const requestImageGeneration = useCallback(async (request: ImageGenerationRequest) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setGenerationState(loading());
    setPipelineState({ phase: 'generating', mediaType: 'image' });

    const result = await generateImage(request);
    setGenerationState(result);

    if (result.status === 'success') {
      setPipelineState({ phase: 'preview-ready', resultUrl: result.data.resultUrl, mediaType: 'image' });
    } else if (result.status === 'error') {
      setPipelineState({ phase: 'error', message: result.error.message, retryable: result.error.retryable });
    }
  }, []);

  const requestVideoGeneration = useCallback(async (request: VideoGenerationRequest) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setGenerationState(loading());
    setPipelineState({ phase: 'generating', mediaType: 'video' });

    const result = await generateVideo(request);
    setGenerationState(result);

    if (result.status === 'success') {
      setPipelineState({ phase: 'preview-ready', resultUrl: result.data.resultUrl, mediaType: 'video' });
    } else if (result.status === 'error') {
      setPipelineState({ phase: 'error', message: result.error.message, retryable: result.error.retryable });
    }
  }, []);

  const requestRefinement = useCallback(async (request: MediaRefinementRequest) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRefinementState(loading());
    setPipelineState({ phase: 'refining', action: request.action });

    const result = await refineMedia(request);
    setRefinementState(result);

    if (result.status === 'success') {
      setPipelineState({ phase: 'preview-ready', resultUrl: result.data.refinedUrl, mediaType: request.mediaType });
    } else if (result.status === 'error') {
      setPipelineState({ phase: 'error', message: result.error.message, retryable: result.error.retryable });
    }
  }, []);

  const requestSave = useCallback(async (payload: Omit<MediaSavePayload, 'userId'>) => {
    const userId = authUser?.id;
    if (!userId) {
      setSaveState(error(appError('auth', 'User must be authenticated to save media')));
      setPipelineState({ phase: 'error', message: 'Authentication required to save', retryable: false });
      return;
    }

    setSaveState(loading());
    setPipelineState({ phase: 'saving' });

    const result = await saveMedia({ ...payload, userId });
    setSaveState(result);

    if (result.status === 'success') {
      setPipelineState({ phase: 'success', savedId: result.data.id });
      // Add to saved media list
      setSavedMedia((prev) => [result.data, ...prev]);
    } else if (result.status === 'error') {
      setPipelineState({ phase: 'error', message: result.error.message, retryable: result.error.retryable });
    }
  }, [authUser?.id]);

  const loadSavedMedia = useCallback(async (mediaType?: 'image' | 'video') => {
    const userId = authUser?.id;
    if (!userId) return;

    const result = await listUserMedia(userId, { mediaType });
    if (result.status === 'success') {
      setSavedMedia(result.data);
    }
  }, [authUser?.id]);

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
    setRefinementState(idle());
    setSaveState(idle());
    setPipelineState({ phase: 'idle' });
  }, []);

  return {
    generationState,
    analysisState,
    refinementState,
    saveState,
    pipelineState,
    savedMedia,
    validateFile,
    requestImageGeneration,
    requestVideoGeneration,
    requestRefinement,
    requestSave,
    loadSavedMedia,
    requestImageAnalysis,
    requestVideoAnalysis,
    extractMetadata,
    getVideoThumbnail,
    reset,
  };
}
