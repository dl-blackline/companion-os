// ─── Media Persistence Service ────────────────────────────────────────────────
// Service for saving and retrieving generated/refined media for authenticated users.
// Uses the existing Supabase schema (uploaded_media table) and media_uploads storage bucket.

import type {
  AsyncResult,
  MediaSavePayload,
  UserMediaRecord,
} from '@/types';
import { success, error, appError } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = '/.netlify/functions/media-memory';

// ─── Save Media ───────────────────────────────────────────────────────────────

/**
 * Save a generated or refined media asset for the authenticated user.
 * Persists a record to the `uploaded_media` table via the media-memory function.
 */
export async function saveMedia(
  payload: MediaSavePayload,
): Promise<AsyncResult<UserMediaRecord>> {
  if (!payload.userId) {
    return error(appError('auth', 'User must be authenticated to save media'));
  }
  if (!payload.mediaUrl) {
    return error(appError('validation', 'Media URL is required to save'));
  }

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        user_id: payload.userId,
        public_url: payload.mediaUrl,
        storage_path: payload.mediaUrl,
        filename: payload.filename,
        media_type: payload.mediaType,
        mime_type: payload.mimeType,
        file_size_bytes: payload.sizeBytes,
        user_title: payload.prompt,
        user_note: payload.style ? `Style: ${payload.style}` : undefined,
        source: payload.source,
        model: payload.model,
        provider: payload.provider,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as Record<string, string>).error || `Save failed (${res.status})`;
      return error(appError(
        res.status === 401 ? 'auth' : 'server',
        msg,
        { retryable: res.status >= 500 },
      ));
    }

    const json = await res.json() as Record<string, unknown>;
    const data = (json.data ?? json) as Record<string, unknown>;
    const record: UserMediaRecord = {
      id: (data.id ?? data.media_id ?? crypto.randomUUID()) as string,
      userId: payload.userId,
      mediaUrl: payload.mediaUrl,
      mediaType: payload.mediaType,
      filename: payload.filename,
      prompt: payload.prompt,
      style: payload.style,
      model: payload.model,
      provider: payload.provider,
      source: payload.source,
      createdAt: (data.created_at as string) ?? new Date().toISOString(),
    };

    return success(record);
  } catch (e) {
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

// ─── List User Media ──────────────────────────────────────────────────────────

/**
 * Retrieve saved media for the authenticated user.
 */
export async function listUserMedia(
  userId: string,
  options?: { mediaType?: 'image' | 'video'; limit?: number; offset?: number },
): Promise<AsyncResult<UserMediaRecord[]>> {
  if (!userId) {
    return error(appError('auth', 'User must be authenticated to list media'));
  }

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list',
        user_id: userId,
        media_type: options?.mediaType,
        limit: options?.limit ?? 50,
        offset: options?.offset ?? 0,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return error(appError('server', (body as Record<string, string>).error || 'Failed to list media'));
    }

    const json = await res.json() as Record<string, unknown>;
    const data = (json.data ?? json) as { media?: Array<Record<string, unknown>> };
    const records: UserMediaRecord[] = (data.media ?? []).map((m) => ({
      id: m.id as string,
      userId: m.user_id as string,
      mediaUrl: (m.public_url ?? m.storage_path ?? '') as string,
      mediaType: m.media_type as 'image' | 'video',
      filename: m.filename as string,
      prompt: m.user_title as string | undefined,
      style: undefined,
      model: undefined,
      provider: undefined,
      source: 'upload' as const,
      createdAt: m.created_at as string,
    }));

    return success(records);
  } catch (e) {
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}
