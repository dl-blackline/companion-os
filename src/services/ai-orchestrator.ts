import type { MediaType } from '@/types';
import type { AIControlConfig } from '@/types/ai-control';
import { supabase, supabaseConfigured } from '@/lib/supabase-client';

export type OrchestratorRequestType =
  | 'chat'
  | 'image'
  | 'video'
  | 'voice'
  | 'knowledge'
  | 'refine_media';

const ORCHESTRATOR_URL = '/.netlify/functions/ai-orchestrator';

export interface AIOrchestratorInput {
  type: OrchestratorRequestType;
  message?: string;
  prompt?: string;
  userId?: string;
  conversationId?: string;
  config: AIControlConfig;
  history?: string[];
  mediaUrl?: string;
  mediaType?: MediaType;
  options?: Record<string, unknown>;
}

export interface AIRunInput {
  type: OrchestratorRequestType;
  input: Record<string, unknown>;
  config: AIControlConfig;
}

export interface AIOrchestratorOutput<T = unknown> {
  success: boolean;
  data: T | null;
  error?: string;
  meta: {
    model_used: string;
    latency: number;
    type: OrchestratorRequestType;
  };
}

export interface RealtimeTokenResponse {
  key: string;
  endpoint: string;
}
export async function runAI<T = unknown>(payload: AIRunInput): Promise<AIOrchestratorOutput<T>> {
  const startedAt = performance.now();
  const model = payload.config.model || 'gpt-4o';

  // Include the session access token so the backend can opportunistically
  // verify the caller's identity (non-blocking — requests still work without).
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (supabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      // If session fetch fails, proceed without auth header
    }
  }

  try {
    const res = await fetch(ORCHESTRATOR_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const response = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((response as { error?: string }).error || `Orchestrator request failed (${res.status})`);
    }

    if (
      response &&
      typeof response === 'object' &&
      'success' in (response as Record<string, unknown>) &&
      (response as { success?: boolean }).success === false
    ) {
      throw new Error((response as { error?: string }).error || 'Orchestrator response failed');
    }

    const latency = performance.now() - startedAt;

    return {
      success: true,
      data: response as T,
      meta: {
        model_used: model,
        latency,
        type: payload.type,
      },
    };
  } catch (error) {
    const latency = performance.now() - startedAt;
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown orchestrator error',
      meta: {
        model_used: model,
        latency,
        type: payload.type,
      },
    };
  }
}

export async function runAIRequest<T = unknown>(input: AIOrchestratorInput): Promise<AIOrchestratorOutput<T>> {
  const payload: AIRunInput = {
    type: input.type,
    config: input.config,
    input: {
      message: input.message,
      prompt: input.prompt,
      userId: input.userId,
      conversationId: input.conversationId,
      history: input.history,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      options: input.options,
    },
  };

  return runAI<T>(payload);
}

export async function requestRealtimeToken(
  model: string,
  voice: string,
): Promise<RealtimeTokenResponse> {
  const result = await runAI<{ data?: { client_secret?: string; realtime_endpoint?: string } }>({
    type: 'realtime_token',
    input: {
      model,
      voice,
    },
    config: {
      model,
      tone: 'direct',
      memory_enabled: false,
      temperature: 0,
      max_tokens: 1,
      capabilities: {
        chat: true,
        voice: true,
        image: true,
        video: true,
      },
    },
  });

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get realtime token');
  }

  const payload = (result.data.data ?? result.data) as {
    client_secret?: string;
    realtime_endpoint?: string;
  };
  const key = payload.client_secret;
  const endpoint = payload.realtime_endpoint;

  if (!key || !endpoint) {
    throw new Error('Realtime token response missing required fields');
  }

  return { key, endpoint };
}
