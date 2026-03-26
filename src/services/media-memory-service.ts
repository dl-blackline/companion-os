// ─── Media Memory Service ─────────────────────────────────────────────────────
// Typed frontend service layer for all media-memory pipeline operations.
// Communicates with /.netlify/functions/media-memory and mirrors the
// backend table contracts defined in lib/media-memory-service.js.

import type {
  AsyncResult,
  UploadedMedia,
  MemoryCandidate,
  MediaType,
} from '@/types';
import { success, error, appError } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = '/.netlify/functions/media-memory';

/**
 * Canonical table names used by the media-memory pipeline.
 * These MUST match the backend constants exported from lib/media-memory-service.js
 * and the tables defined in supabase/migrations/011_media_memory.sql.
 */
export const MEDIA_TABLE_NAMES = {
  UPLOADED_MEDIA: 'uploaded_media',
  MEDIA_ANALYSIS: 'media_analysis',
  MEMORY_CANDIDATES: 'memory_candidates',
  MEDIA_MEMORY_LINKS: 'media_memory_links',
  MEDIA_KNOWLEDGE_ENTRIES: 'media_knowledge_entries',
  USER_MEMORY_PREFERENCES: 'user_memory_preferences',
} as const;

// ─── Request / Response Payloads ──────────────────────────────────────────────

export interface AnalyzeMediaRequest {
  readonly user_id: string;
  readonly public_url: string;
  readonly storage_path?: string;
  readonly filename: string;
  readonly media_type: MediaType;
  readonly mime_type?: string;
  readonly file_size_bytes?: number;
  readonly user_title?: string;
  readonly user_note?: string;
  readonly model?: string;
}

export interface AnalyzeMediaResponse {
  readonly media_record: UploadedMedia;
  readonly analysis_record: {
    readonly id: string;
    readonly media_id: string;
    readonly summary: string | null;
    readonly description: string | null;
    readonly extracted_text: string | null;
    readonly transcript: string | null;
    readonly tags: string[];
    readonly entities: Array<{ name: string; type: string; confidence: number }>;
    readonly emotional_cues: string[];
    readonly timestamped_moments: Array<{ timestamp: string; description: string }>;
    readonly model_used: string | null;
    readonly created_at: string;
  } | null;
  readonly candidates: MemoryCandidate[];
  readonly knowledge_entry: {
    readonly id: string;
    readonly media_id: string;
    readonly title: string;
    readonly content: string;
    readonly category: string;
    readonly tags: string[];
    readonly summary: string | null;
    readonly created_at: string;
  } | null;
}

export interface ListMediaRequest {
  readonly user_id: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly media_type?: MediaType;
}

export interface ApproveRejectRequest {
  readonly user_id: string;
  readonly candidate_id: string;
  readonly title_override?: string;
  readonly content_override?: string;
}

export interface SearchMediaRequest {
  readonly user_id: string;
  readonly query: string;
  readonly limit?: number;
}

export interface MediaSearchResult {
  readonly id: string;
  readonly media_id: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly tags: string[];
  readonly similarity: number;
  readonly created_at: string;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function post<T>(body: Record<string, unknown>): Promise<AsyncResult<T>> {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = (errBody as Record<string, string>).error || `Request failed (${res.status})`;
      return error(appError(
        res.status === 429 ? 'rate_limit' : 'server',
        msg,
        { retryable: res.status >= 500 || res.status === 429 },
      ));
    }

    const data = await res.json() as T;
    return success(data);
  } catch (e) {
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full media analysis pipeline (upload record → vision analysis →
 * memory candidates → knowledge entry).
 */
export function analyzeMedia(
  req: AnalyzeMediaRequest,
): Promise<AsyncResult<AnalyzeMediaResponse>> {
  return post<AnalyzeMediaResponse>({ action: 'analyze', ...req });
}

/**
 * List uploaded media for a user with optional filtering.
 */
export function listMedia(
  req: ListMediaRequest,
): Promise<AsyncResult<{ media: UploadedMedia[] }>> {
  return post<{ media: UploadedMedia[] }>({ action: 'list', ...req });
}

/**
 * Get pending memory candidates awaiting user approval.
 */
export function getPendingCandidates(
  userId: string,
): Promise<AsyncResult<{ candidates: MemoryCandidate[] }>> {
  return post<{ candidates: MemoryCandidate[] }>({ action: 'pending', user_id: userId });
}

/**
 * Approve a memory candidate — persists it to long-term memory.
 */
export function approveCandidate(
  req: ApproveRejectRequest,
): Promise<AsyncResult<{ approved: boolean; memory_type: string }>> {
  return post<{ approved: boolean; memory_type: string }>({
    action: 'approve',
    ...req,
  });
}

/**
 * Reject a memory candidate.
 */
export function rejectCandidate(
  userId: string,
  candidateId: string,
): Promise<AsyncResult<{ rejected: boolean }>> {
  return post<{ rejected: boolean }>({
    action: 'reject',
    user_id: userId,
    candidate_id: candidateId,
  });
}

/**
 * Soft-delete an uploaded media record.
 */
export function deleteMedia(
  userId: string,
  mediaId: string,
): Promise<AsyncResult<{ deleted: boolean }>> {
  return post<{ deleted: boolean }>({
    action: 'delete',
    user_id: userId,
    media_id: mediaId,
  });
}

/**
 * Semantic search over media analysis embeddings.
 */
export function searchMedia(
  req: SearchMediaRequest,
): Promise<AsyncResult<{ results: MediaSearchResult[] }>> {
  return post<{ results: MediaSearchResult[] }>({ action: 'search', ...req });
}
