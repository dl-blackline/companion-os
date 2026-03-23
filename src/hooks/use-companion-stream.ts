import { useCallback, useRef, useState } from 'react';

import type { AvatarState, CompanionState, RealtimeStreamEvent } from '@/types/realtime';
import { parseSSEResponse } from '@/services/realtime-session-service';

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_STREAM_URL = '/.netlify/functions/ai-stream';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseCompanionStreamOptions {
  /** Netlify function URL override (defaults to ai-stream). */
  endpoint?: string;
}

export interface StreamRequestOptions {
  message: string;
  userId: string;
  conversationId?: string;
  sessionId?: string;
  model?: string;
  systemPrompt?: string;
  task?: string;
  includeAvatarState?: boolean;
}

export interface CompanionStreamState {
  /** Whether a stream is currently in progress. */
  isStreaming: boolean;
  /** Accumulated response text so far. */
  text: string;
  /** Current companion processing state. */
  companionState: CompanionState;
  /** Current avatar visual state. */
  avatarState: AvatarState;
  /** Error message if the stream failed. */
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * React hook for consuming SSE streams from the AI companion backend.
 *
 * Provides a simple interface for sending messages and receiving streamed
 * responses with companion/avatar state tracking.
 *
 * @example
 * ```tsx
 * const { state, send, cancel } = useCompanionStream();
 *
 * const handleSend = () => {
 *   send(
 *     { message: 'Hello', userId: 'u1' },
 *     (event) => console.log('stream event:', event),
 *   );
 * };
 * ```
 */
export function useCompanionStream(options: UseCompanionStreamOptions = {}) {
  const { endpoint = AI_STREAM_URL } = options;

  const [state, setState] = useState<CompanionStreamState>({
    isStreaming: false,
    text: '',
    companionState: 'idle',
    avatarState: 'idle',
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  /**
   * Send a message and stream the response.
   *
   * @param request - Stream request parameters
   * @param onEvent - Optional callback for each stream event
   * @returns The full response text
   */
  const send = useCallback(
    async (
      request: StreamRequestOptions,
      onEvent?: (event: RealtimeStreamEvent) => void,
    ): Promise<string> => {
      // Cancel any in-flight stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        isStreaming: true,
        text: '',
        companionState: 'idle',
        avatarState: 'idle',
        error: null,
      });

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: request.message,
            user_id: request.userId,
            conversation_id: request.conversationId,
            session_id: request.sessionId,
            model: request.model,
            system_prompt: request.systemPrompt,
            task: request.task,
            includeAvatarState: request.includeAvatarState ?? true,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Stream request failed: ${res.status}`);
        }

        const raw = await res.text();
        const events = parseSSEResponse(raw);
        let fullText = '';

        for (const sse of events) {
          switch (sse.event) {
            case 'token': {
              const accumulated = sse.data.accumulated as string;
              fullText = accumulated;
              setState((prev) => ({ ...prev, text: accumulated }));
              onEvent?.({ type: 'token', content: sse.data.content as string, accumulated });
              break;
            }

            case 'state': {
              const csData = sse.data.companionState;
              const avData = sse.data.avatarState;
              const cs =
                csData && typeof csData === 'object'
                  ? ((csData as Record<string, unknown>).state as CompanionState)
                  : ('idle' as CompanionState);
              const av =
                avData && typeof avData === 'object'
                  ? ((avData as Record<string, unknown>).state as AvatarState)
                  : ('idle' as AvatarState);
              setState((prev) => ({ ...prev, companionState: cs, avatarState: av }));
              onEvent?.({
                type: 'state_change',
                state: cs,
                avatarState: av,
                timestamp: sse.data.timestamp as string,
              });
              break;
            }

            case 'done':
              fullText = sse.data.fullText as string;
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                text: fullText,
                companionState: 'idle',
                avatarState: 'idle',
              }));
              onEvent?.({ type: 'stream_end', timestamp: sse.data.timestamp as string });
              break;

            case 'error':
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                error: sse.data.error as string,
                companionState: 'idle',
                avatarState: 'idle',
              }));
              onEvent?.({
                type: 'stream_error',
                timestamp: sse.data.timestamp as string,
                error: sse.data.error as string,
              });
              break;

            case 'interrupted':
              fullText = sse.data.partialText as string;
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                text: fullText,
                companionState: 'idle',
                avatarState: 'idle',
              }));
              onEvent?.({
                type: 'stream_interrupt',
                timestamp: sse.data.timestamp as string,
                partialText: fullText,
              });
              break;
          }
        }

        return fullText;
      } catch (err) {
        if (controller.signal.aborted) {
          setState((prev) => ({ ...prev, isStreaming: false }));
          return '';
        }

        const msg = err instanceof Error ? err.message : 'Unknown streaming error';
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: msg,
          companionState: 'idle',
          avatarState: 'idle',
        }));
        throw err;
      }
    },
    [endpoint],
  );

  /** Cancel any in-flight stream. */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      companionState: 'idle',
      avatarState: 'idle',
    }));
  }, []);

  return { state, send, cancel };
}
