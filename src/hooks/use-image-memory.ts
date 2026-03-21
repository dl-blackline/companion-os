// ─── useImageMemory Hook ──────────────────────────────────────────────────────
// Focused hook for the image/video upload → AI analysis → memory save pipeline.
// Provides a clean, reusable API for the complete image-memory workflow:
//   upload → AI reviews image → memory candidates created → user approves → memory saved

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { supabase as sharedSupabase, supabaseConfigured } from '@/lib/supabase-client';
import {
  analyzeMedia,
  approveCandidate as approveMediaCandidate,
  rejectCandidate as rejectMediaCandidate,
} from '@/services/media-memory-service';
import type {
  UploadState,
  MemoryCandidate,
  UploadedMedia,
  MediaType,
} from '@/types';
import { appError } from '@/types';
import { generateId } from '@/lib/helpers';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Supabase storage bucket for all media uploads (must match migration 012). */
const STORAGE_BUCKET = 'media_uploads';

// ─── Public Types ─────────────────────────────────────────────────────────────

/** Options passed to `uploadAndAnalyze`. */
export interface ImageUploadOptions {
  /** Optional user-provided label shown in the media list. */
  readonly userTitle?: string;
  /** Optional context note passed to the AI analysis pipeline. */
  readonly userNote?: string;
}

export interface UseImageMemoryReturn {
  /** Current upload/processing state (idle → uploading → processing → complete | error). */
  readonly uploadState: UploadState;
  /** The UploadedMedia record returned by the last successful analysis. */
  readonly analysisResult: UploadedMedia | null;
  /** Memory candidates extracted from the last analysis (pending user approval). */
  readonly candidates: readonly MemoryCandidate[];
  /**
   * Upload a file to storage, run AI analysis, and populate `candidates`.
   * Transitions `uploadState` through uploading → processing → complete | error.
   */
  uploadAndAnalyze: (file: File, options?: ImageUploadOptions) => Promise<void>;
  /**
   * Approve a memory candidate.
   * Persists the memory to the long-term memory system via the media-memory backend pipeline.
   * Updates the candidate's status to 'approved' in local state.
   */
  approve: (
    candidate: MemoryCandidate,
    overrides?: { title?: string; content?: string },
  ) => Promise<void>;
  /**
   * Reject a memory candidate.
   * Marks it rejected in the backend and removes it from the pending list locally.
   */
  reject: (candidateId: string) => Promise<void>;
  /** Reset all state back to the initial idle state. */
  reset: () => void;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Upload a file to Supabase storage (or fall back to a base64 data URL if
 * storage is not configured).  Reports progress via `onProgress` (0–100).
 */
async function uploadFileToStorage(
  file: File,
  userId: string,
  onProgress: (pct: number) => void,
): Promise<{ url: string; path: string }> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${userId}/memory/${generateId()}.${ext}`;
  onProgress(15);

  if (supabaseConfigured) {
    const { data, error } = await sharedSupabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    onProgress(80);
    if (!error && data) {
      const { data: pub } = sharedSupabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(data.path);
      onProgress(100);
      return { url: pub.publicUrl, path: data.path };
    }
  }

  // Fallback: read as data URL (works offline / without Supabase storage)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
  onProgress(100);
  return { url: dataUrl, path };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useImageMemory(): UseImageMemoryReturn {
  const { user: authUser } = useAuth();
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [analysisResult, setAnalysisResult] = useState<UploadedMedia | null>(null);
  const [candidates, setCandidates] = useState<readonly MemoryCandidate[]>([]);

  // ── uploadAndAnalyze ────────────────────────────────────────────────────────

  const uploadAndAnalyze = useCallback(async (
    file: File,
    options: ImageUploadOptions = {},
  ) => {
    const userId = authUser?.id;
    if (!userId) {
      setUploadState({
        status: 'error',
        error: appError('auth', 'User must be authenticated to upload media'),
      });
      return;
    }

    const mediaType: MediaType = file.type.startsWith('video/') ? 'video' : 'image';

    // ── Phase 1: Upload to storage ────────────────────────────────────────────
    setUploadState({ status: 'uploading', progress: 0 });

    let publicUrl: string;
    let storagePath: string;

    try {
      const uploaded = await uploadFileToStorage(file, userId, (pct) => {
        setUploadState({ status: 'uploading', progress: pct });
      });
      publicUrl = uploaded.url;
      storagePath = uploaded.path;
    } catch (uploadErr) {
      setUploadState({
        status: 'error',
        error: appError('network', (uploadErr as Error).message, { retryable: true }),
      });
      return;
    }

    // ── Phase 2: AI analysis → memory candidates ──────────────────────────────
    setUploadState({ status: 'processing' });

    const result = await analyzeMedia({
      user_id: userId,
      public_url: publicUrl,
      storage_path: storagePath,
      filename: file.name,
      media_type: mediaType,
      mime_type: file.type,
      file_size_bytes: file.size,
      user_title: options.userTitle?.trim() || undefined,
      user_note: options.userNote?.trim() || undefined,
    });

    if (result.status === 'error') {
      // Store a failed local record so the UI can still display the uploaded file
      const failedRecord: UploadedMedia = {
        id: generateId(),
        user_id: userId,
        storage_path: storagePath,
        public_url: publicUrl,
        filename: file.name,
        media_type: mediaType,
        mime_type: file.type,
        file_size_bytes: file.size,
        user_title: options.userTitle?.trim() || null,
        user_note: options.userNote?.trim() || null,
        processing_state: 'failed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        media_analysis: [],
        memory_candidates: [],
      };
      setAnalysisResult(failedRecord);
      setUploadState({ status: 'error', error: result.error });
      return;
    }

    if (result.status !== 'success') return;

    const { media_record, candidates: newCandidates } = result.data;

    // Merge candidates into the media record for unified display
    const enrichedRecord: UploadedMedia = {
      ...media_record,
      memory_candidates: newCandidates || [],
    };

    setAnalysisResult(enrichedRecord);
    setCandidates(newCandidates || []);
    setUploadState({ status: 'complete', url: publicUrl });
  }, [authUser?.id]);

  // ── approve ─────────────────────────────────────────────────────────────────

  const approve = useCallback(async (
    candidate: MemoryCandidate,
    overrides?: { title?: string; content?: string },
  ) => {
    const userId = authUser?.id;
    if (!userId) return;

    // Optimistically update local state first for snappy UI feedback
    setCandidates(prev =>
      prev.map(c => c.id === candidate.id ? { ...c, status: 'approved' as const } : c),
    );

    // Persist approval to the backend memory pipeline.
    // The backend `approveCandidate` action stores the memory in the long-term
    // episodic_memory or relationship_memory table (via storeEpisodicMemory /
    // storeRelationshipMemory in lib/memory-manager.js), ensuring it is
    // retrievable by the AI in future chat sessions via context-builder.
    await approveMediaCandidate({
      user_id: userId,
      candidate_id: candidate.id,
      title_override: overrides?.title,
      content_override: overrides?.content,
    });
  }, [authUser?.id]);

  // ── reject ──────────────────────────────────────────────────────────────────

  const reject = useCallback(async (candidateId: string) => {
    const userId = authUser?.id;
    if (!userId) return;

    // Optimistically update local state
    setCandidates(prev =>
      prev.map(c => c.id === candidateId ? { ...c, status: 'rejected' as const } : c),
    );

    await rejectMediaCandidate(userId, candidateId);
  }, [authUser?.id]);

  // ── reset ────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setUploadState({ status: 'idle' });
    setAnalysisResult(null);
    setCandidates([]);
  }, []);

  return {
    uploadState,
    analysisResult,
    candidates,
    uploadAndAnalyze,
    approve,
    reject,
    reset,
  };
}
