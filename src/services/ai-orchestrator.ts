import type { MediaType } from '@/types';
import type { AIControlConfig } from '@/types/ai-control';

export type OrchestratorRequestType = 'chat' | 'image' | 'video' | 'voice';

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

async function getRelevantMemory(_userId: string, _input: AIOrchestratorInput): Promise<unknown[]> {
  return [];
}

function chooseModel(input: AIOrchestratorInput): string {
  return input.config.model || 'gpt-4o';
}

function assertCapability(input: AIOrchestratorInput): void {
  const caps = input.config.capabilities;
  if (input.type === 'chat' && !caps.chat) throw new Error('Chat capability is disabled');
  if (input.type === 'voice' && !caps.voice) throw new Error('Voice capability is disabled');
  if (input.type === 'image' && !caps.image) throw new Error('Image capability is disabled');
  if (input.type === 'video' && !caps.video) throw new Error('Video capability is disabled');
}

async function callAI(input: AIOrchestratorInput, model: string, memoryContext: unknown[]): Promise<unknown> {
  if (input.type === 'chat') {
    const backendType = input.options?.backendType === 'live_talk' ? 'live_talk' : 'chat';
    const chatData =
      backendType === 'live_talk'
        ? {
            ...(input.options?.data as Record<string, unknown>),
            model,
            temperature: input.config.temperature,
            max_tokens: input.config.max_tokens,
            tone: input.config.tone,
            memory_enabled: input.config.memory_enabled,
            memory_context: memoryContext,
          }
        : {
            conversation_id: input.conversationId || 'orchestrator-conversation',
            user_id: input.userId || 'default-user',
            message: input.message || input.prompt || '',
            model,
            temperature: input.config.temperature,
            max_tokens: input.config.max_tokens,
            tone: input.config.tone,
            memory_enabled: input.config.memory_enabled,
            memory_context: memoryContext,
            ...(input.mediaUrl ? { media_url: input.mediaUrl } : {}),
            ...(input.mediaType ? { media_type: input.mediaType } : {}),
          };

    const res = await fetch('/.netlify/functions/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: backendType,
        data: chatData,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as { error?: string }).error || `Chat request failed (${res.status})`);
    }
    return json;
  }

  if (input.type === 'image' || input.type === 'video') {
    const isRefine = input.options?.action != null;

    if (isRefine) {
      const res = await fetch('/.netlify/functions/refine-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: input.options?.media_url,
          media_type: input.type,
          action: input.options?.action,
          prompt: input.prompt,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || `Refine request failed (${res.status})`);
      }
      return json;
    }

    const res = await fetch('/.netlify/functions/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'media',
        data: {
          type: input.type,
          prompt: input.prompt || input.message || '',
          options: {
            ...(input.options || {}),
            model,
            temperature: input.config.temperature,
            max_tokens: input.config.max_tokens,
            tone: input.config.tone,
            memory_enabled: input.config.memory_enabled,
            memory_context: memoryContext,
          },
        },
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as { error?: string }).error || `Media request failed (${res.status})`);
    }
    return json;
  }

  if (input.type === 'voice') {
    const res = await fetch('/.netlify/functions/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'voice',
        data: {
          text: input.message || input.prompt || '',
          model,
          temperature: input.config.temperature,
          max_tokens: input.config.max_tokens,
          tone: input.config.tone,
        },
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as { error?: string }).error || `Voice request failed (${res.status})`);
    }
    return json;
  }

  throw new Error(`Unsupported request type: ${input.type}`);
}

export async function runAIRequest<T = unknown>(input: AIOrchestratorInput): Promise<AIOrchestratorOutput<T>> {
  const startedAt = performance.now();
  const model = chooseModel(input);

  try {
    assertCapability(input);

    const memoryContext =
      input.config.memory_enabled && input.userId
        ? await getRelevantMemory(input.userId, input)
        : [];

    console.log('[ORCHESTRATOR]', {
      model,
      type: input.type,
      config: input.config,
    });

    const response = await callAI(input, model, memoryContext);
    const latency = performance.now() - startedAt;

    return {
      success: true,
      data: response as T,
      meta: {
        model_used: model,
        latency,
        type: input.type,
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
        type: input.type,
      },
    };
  }
}
