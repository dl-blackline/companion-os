/**
 * Realtime Session Service
 *
 * Client-side service for managing realtime companion sessions, including:
 *   - Starting / ending realtime sessions
 *   - Consuming SSE streams for token-by-token AI responses
 *   - Tracking companion and avatar state
 *   - Inline image generation during conversation
 *
 * All AI calls route through existing backend endpoints to maintain
 * backward compatibility with the current architecture.
 */

import type {
  CompanionState,
  AvatarState,
  RealtimeStreamEvent,
  ConversationImageRequest,
  ConversationImageResult,
  RealtimeSession,
  SSEEventName,
} from '@/types/realtime';
import { supabase, supabaseConfigured } from '@/lib/supabase-client';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANION_STREAM_URL = '/.netlify/functions/companion-stream';
const COMPANION_BRAIN_URL = '/.netlify/functions/companion-brain';
const START_SESSION_URL = '/.netlify/functions/start-session';
const END_SESSION_URL = '/.netlify/functions/end-session';
const GENERATE_MEDIA_URL = '/.netlify/functions/generate-media';

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabaseConfigured) return {};
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
}

// ─── SSE Event Parsing ────────────────────────────────────────────────────────

/** Parsed SSE event from the stream. */
export interface ParsedSSEEvent {
  event: SSEEventName;
  data: Record<string, unknown>;
}

/**
 * Parse a raw SSE text response into individual events.
 *
 * @param raw - The raw SSE text (multiple `event: ...\ndata: ...\n\n` blocks)
 * @returns Array of parsed events
 */
export function parseSSEResponse(raw: string): ParsedSSEEvent[] {
  if (!raw) return [];

  const events: ParsedSSEEvent[] = [];
  const blocks = raw.split('\n\n').filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n');
    let eventName: SSEEventName = 'token';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventName = line.slice(7).trim() as SSEEventName;
      } else if (line.startsWith('data: ')) {
        dataStr = line.slice(6);
      }
    }

    if (dataStr) {
      try {
        events.push({ event: eventName, data: JSON.parse(dataStr) });
      } catch {
        // Skip malformed data
      }
    }
  }

  return events;
}

// ─── Streaming Companion Response ─────────────────────────────────────────────

/** Options for a streaming companion request. */
export interface StreamCompanionOptions {
  message: string;
  userId: string;
  conversationId: string;
  sessionId?: string;
  model?: string;
  unfiltered?: boolean;
  aiMood?: string;
  customInstructions?: string;
  includeAvatarState?: boolean;
}

/** Callback type for streaming events. */
export type StreamEventCallback = (event: RealtimeStreamEvent) => void;

/**
 * Send a message and receive a streamed SSE response from the companion.
 *
 * Uses the companion-stream endpoint for real-time token delivery.
 * Falls back to the companion-brain endpoint if streaming fails.
 *
 * @param options - Stream options
 * @param onEvent - Callback for each stream event
 * @param signal - Optional AbortSignal for cancellation
 * @returns The full response text
 */
export async function streamCompanionMessage(
  options: StreamCompanionOptions,
  onEvent: StreamEventCallback,
  signal?: AbortSignal,
): Promise<string> {
  const {
    message,
    userId,
    conversationId,
    sessionId,
    model,
    unfiltered,
    aiMood,
    customInstructions,
    includeAvatarState = true,
  } = options;

  // Emit initial state
  onEvent({
    type: 'stream_start',
    timestamp: new Date().toISOString(),
  });

  try {
    const res = await fetch(COMPANION_STREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        user_id: userId,
        conversation_id: conversationId,
        session_id: sessionId,
        model,
        unfiltered,
        aiMood,
        customInstructions,
        includeAvatarState,
      }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Stream request failed: ${res.status}`);
    }

    const text = await res.text();
    const events = parseSSEResponse(text);
    let fullText = '';

    for (const sseEvent of events) {
      switch (sseEvent.event) {
        case 'token':
          onEvent({
            type: 'token',
            content: sseEvent.data.content as string,
            accumulated: sseEvent.data.accumulated as string,
          });
          fullText = sseEvent.data.accumulated as string;
          break;

        case 'state': {
          const companionData = sseEvent.data.companionState;
          const avatarData = sseEvent.data.avatarState;
          const csState = (companionData && typeof companionData === 'object')
            ? (companionData as Record<string, unknown>).state as CompanionState
            : 'idle' as CompanionState;
          const avState = (avatarData && typeof avatarData === 'object')
            ? (avatarData as Record<string, unknown>).state as AvatarState
            : 'idle' as AvatarState;
          onEvent({
            type: 'state_change',
            state: csState,
            avatarState: avState,
            timestamp: sseEvent.data.timestamp as string,
          });
          break;
        }

        case 'image':
          onEvent({
            type: 'image_generated',
            imageUrl: sseEvent.data.imageUrl as string,
            prompt: sseEvent.data.prompt as string,
            timestamp: sseEvent.data.timestamp as string,
          });
          break;

        case 'done':
          fullText = sseEvent.data.fullText as string;
          onEvent({
            type: 'stream_end',
            timestamp: sseEvent.data.timestamp as string,
          });
          break;

        case 'error':
          onEvent({
            type: 'stream_error',
            timestamp: sseEvent.data.timestamp as string,
            error: sseEvent.data.error as string,
          });
          break;

        case 'interrupted':
          onEvent({
            type: 'stream_interrupt',
            timestamp: sseEvent.data.timestamp as string,
            partialText: sseEvent.data.partialText as string,
          });
          fullText = sseEvent.data.partialText as string;
          break;
      }
    }

    return fullText;
  } catch (err) {
    if (signal?.aborted) {
      onEvent({
        type: 'stream_interrupt',
        timestamp: new Date().toISOString(),
        partialText: '',
      });
      return '';
    }

    // Fallback to non-streaming endpoint
    onEvent({
      type: 'stream_error',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown streaming error',
    });
    throw err;
  }
}

// ─── Session Management ───────────────────────────────────────────────────────

/**
 * Start a new realtime session.
 *
 * @param userId - User identifier
 * @param sessionType - Type of session
 * @returns The created session data
 */
export async function startRealtimeSession(
  userId: string,
  sessionType: RealtimeSession['sessionType'] = 'live_assistant',
): Promise<RealtimeSession> {
  const res = await fetch(START_SESSION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, session_type: sessionType }),
  });

  if (!res.ok) {
    throw new Error(`Failed to start session: ${res.status}`);
  }

  const data = await res.json();
  const session = data.data || data;

  return {
    sessionId: session.id,
    userId: session.user_id,
    sessionType: session.session_type,
    status: session.status || 'active',
    companionState: 'idle',
    avatarState: 'idle',
    createdAt: session.started_at || new Date().toISOString(),
  };
}

/**
 * End a realtime session.
 *
 * @param sessionId - Session to end
 */
export async function endRealtimeSession(sessionId: string): Promise<void> {
  await fetch(END_SESSION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

// ─── Image Generation ─────────────────────────────────────────────────────────

/**
 * Generate an image during a conversation via the existing media endpoint.
 *
 * Routes through the generate-media Netlify function to maintain
 * integration with the existing backend architecture.
 *
 * @param request - Image generation parameters
 * @returns Image generation result
 */
export async function generateConversationImage(
  request: ConversationImageRequest,
): Promise<ConversationImageResult> {
  const start = Date.now();

  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(GENERATE_MEDIA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        type: 'image',
        prompt: request.prompt,
        style: request.style,
        user_id: request.userId,
        conversation_id: request.conversationId,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({
        error: `Image generation endpoint returned ${res.status}`,
      }));
      return {
        success: false,
        error: errData.error || `Image generation failed: ${res.status}`,
        durationMs: Date.now() - start,
      };
    }

    const data = await res.json();
    return {
      success: true,
      imageUrl: data.data?.url || data.url,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Image generation request failed unexpectedly',
      durationMs: Date.now() - start,
    };
  }
}

// ─── Companion State Mapping ──────────────────────────────────────────────────

/**
 * Map a companion state to its corresponding avatar state.
 * Convenience helper for frontend components.
 */
export function companionToAvatarState(state: CompanionState): AvatarState {
  const map: Record<CompanionState, AvatarState> = {
    idle: 'idle',
    listening: 'listening',
    thinking: 'thinking',
    responding: 'speaking',
  };
  return map[state] ?? 'idle';
}
