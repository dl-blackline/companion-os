import { handler as aiOrchestratorHandler } from './ai-orchestrator.js';

function toObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function buildConfig(input) {
  return {
    model: input.model || 'gpt-4o',
    tone: 'direct',
    memory_enabled: true,
    temperature: 0.7,
    max_tokens: 2000,
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

  const input = toObject(body);

  return aiOrchestratorHandler({
    ...event,
    httpMethod: 'POST',
    body: JSON.stringify({
      type: 'stream',
      input,
      config: buildConfig(input),
    }),
  });
}
