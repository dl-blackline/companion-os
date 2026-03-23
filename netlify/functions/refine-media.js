import { handler as aiOrchestratorHandler } from './ai-orchestrator.js';

function toObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function buildConfig(body) {
  return {
    model: body.model || 'gpt-4o',
    tone: body.tone || 'direct',
    memory_enabled: body.memory_enabled !== false,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
    max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 2000,
    capabilities: {
      chat: true,
      voice: true,
      image: true,
      video: true,
    },
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

  const safe = toObject(body);

  return aiOrchestratorHandler({
    ...event,
    httpMethod: 'POST',
    body: JSON.stringify({
      type: safe.media_type === 'video' ? 'video' : 'image',
      input: {
        prompt: safe.prompt || '',
        userId: safe.user_id || 'default-user',
        options: {
          action: safe.action,
          media_url: safe.media_url,
          ...(toObject(safe.options)),
        },
      },
      config: buildConfig(safe),
    }),
  });
}
