import { ok, fail, preflight } from '../../lib/_responses.js';
import { handler as aiGatewayHandler } from './_ai-core.js';
import { handler as refineMediaHandler } from './_refine-media-core.js';
import { handler as aiStreamHandler } from './_ai-stream-core.js';
import { orchestrateSimple } from '../../services/ai/orchestrator.js';

function toObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

async function invokeHandler(handler, originalEvent, body) {
  return handler({
    ...originalEvent,
    httpMethod: 'POST',
    body: JSON.stringify(body),
  });
}

function buildModelConfig(config = {}) {
  return {
    model: config.model || 'gpt-4o',
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    tone: config.tone,
    memory_enabled: config.memory_enabled,
  };
}

async function routeKnowledge(input, config) {
  const msgList = Array.isArray(input.messages) ? input.messages : [];
  const systemMsg =
    input.systemPrompt ||
    msgList.find((m) => m && m.role === 'system')?.content ||
    'You are a precise knowledge analysis assistant.';
  const userMsg =
    input.userPrompt ||
    msgList.find((m) => m && m.role === 'user')?.content ||
    input.message ||
    '';

  const reply = await orchestrateSimple({
    prompt: { system: String(systemMsg), user: String(userMsg) },
    model: config.model || 'gpt-4.1',
    task: 'knowledge_analysis',
  });

  return ok({ reply });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return preflight();
  }

  if (event.httpMethod !== 'POST') {
    return fail('Method not allowed', 'ERR_METHOD', 405);
  }

  if (!process.env.OPENAI_API_KEY) {
    return fail('OPENAI_API_KEY is not configured', 'ERR_CONFIG', 500);
  }

  const parsed = parseBody(event);
  if (!parsed) {
    return fail('Invalid JSON body', 'ERR_VALIDATION', 400);
  }

  const type = parsed.type;
  const input = toObject(parsed.input);
  const config = toObject(parsed.config);
  const options = toObject(input.options);
  const modelConfig = buildModelConfig(config);

  if (!type) {
    return fail('Missing required field: type', 'ERR_VALIDATION', 400);
  }

  try {
    if (type === 'chat') {
      if (options.backendType === 'live_talk') {
        const liveTalkData = {
          ...toObject(options.data),
          ...modelConfig,
        };
        return invokeHandler(aiGatewayHandler, event, { type: 'live_talk', data: liveTalkData });
      }

      if (options.backendType === 'knowledge_chat') {
        return routeKnowledge(options.data || {}, modelConfig);
      }

      const chatData = {
        conversation_id: input.conversationId || 'orchestrator-conversation',
        user_id: input.userId || 'default-user',
        message: input.message || input.prompt || '',
        ...(input.mediaUrl ? { media_url: input.mediaUrl } : {}),
        ...(input.mediaType ? { media_type: input.mediaType } : {}),
        ...modelConfig,
      };

      return invokeHandler(aiGatewayHandler, event, { type: 'chat', data: chatData });
    }

    if (type === 'image' || type === 'video') {
      if (options.action) {
        const refineBody = {
          media_url: options.media_url,
          media_type: type,
          action: options.action,
          prompt: input.prompt || input.message || '',
          model: config.model,
          options,
        };
        return invokeHandler(refineMediaHandler, event, refineBody);
      }

      const mediaData = {
        type,
        prompt: input.prompt || input.message || '',
        options: {
          ...options,
          ...modelConfig,
        },
      };

      return invokeHandler(aiGatewayHandler, event, { type: 'media', data: mediaData });
    }

    if (type === 'voice') {
      if (options.backendType === 'realtime_token') {
        const realtimeData = {
          ...toObject(options.data),
          model: config.model || toObject(options.data).model || 'gpt-4o-realtime-preview',
        };

        const result = await invokeHandler(aiGatewayHandler, event, {
          type: 'realtime_token',
          data: realtimeData,
        });

        return result;
      }

      const voiceData = {
        text: input.message || input.prompt || '',
        ...modelConfig,
      };

      return invokeHandler(aiGatewayHandler, event, { type: 'voice', data: voiceData });
    }

    if (type === 'knowledge') {
      return routeKnowledge(input, modelConfig);
    }

    if (type === 'stream') {
      return invokeHandler(aiStreamHandler, event, input);
    }

    return fail(`Unsupported orchestrator type: ${type}`, 'ERR_VALIDATION', 400);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Orchestrator failed', 'ERR_INTERNAL', 500);
  }
}
