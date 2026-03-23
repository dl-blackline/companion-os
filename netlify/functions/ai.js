import { handler as aiOrchestratorHandler } from './ai-orchestrator.js';

function toObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function buildConfig(data) {
  return {
    model: data.model || 'gpt-4o',
    tone: data.tone || 'direct',
    memory_enabled: data.memory_enabled !== false,
    temperature: typeof data.temperature === 'number' ? data.temperature : 0.7,
    max_tokens: typeof data.max_tokens === 'number' ? data.max_tokens : 2000,
    capabilities: {
      chat: true,
      voice: true,
      image: true,
      video: true,
    },
  };
}

function mapLegacyBody(body) {
  const legacyType = body.type || 'chat';
  const data = toObject(body.data || body);

  if (legacyType === 'media') {
    const mediaType = data.type === 'video' ? 'video' : 'image';
    return {
      type: mediaType,
      input: {
        prompt: data.prompt || '',
        userId: data.user_id || body.user_id || 'default-user',
        options: toObject(data.options),
      },
      config: buildConfig(data.options || data),
    };
  }

  if (legacyType === 'realtime_token') {
    return {
      type: 'voice',
      input: {
        message: '',
        userId: data.user_id || body.user_id || 'default-user',
        options: {
          backendType: 'realtime_token',
          data,
        },
      },
      config: buildConfig(data),
    };
  }

  if (legacyType === 'live_talk') {
    return {
      type: 'chat',
      input: {
        message: data.message || '',
        userId: data.user_id || body.user_id || 'default-user',
        options: {
          backendType: 'live_talk',
          data,
        },
      },
      config: buildConfig(data),
    };
  }

  if (legacyType === 'voice') {
    return {
      type: 'voice',
      input: {
        message: data.text || data.message || '',
        userId: data.user_id || body.user_id || 'default-user',
      },
      config: buildConfig(data),
    };
  }

  return {
    type: 'chat',
    input: {
      message: data.message || '',
      userId: data.user_id || body.user_id || 'default-user',
      conversationId: data.conversation_id || body.conversation_id,
      mediaUrl: data.media_url,
      mediaType: data.media_type,
      options: toObject(data.options),
    },
    config: buildConfig(data),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return aiOrchestratorHandler(event);
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    body = {};
  }

  const mapped = mapLegacyBody(toObject(body));

  return aiOrchestratorHandler({
    ...event,
    httpMethod: 'POST',
    body: JSON.stringify(mapped),
  });
}
