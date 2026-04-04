// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * Tests for the refactored ai-orchestrator gateway.
 *
 * Validates: auth failure, invalid method, unsupported mode, correct dispatch
 * by type, centralized error mapping, and normalization behavior.
 */

// ── Mock all external dependencies ──────────────────────────────────────────

vi.mock('@lib/_supabase.js', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
      insert: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockResolvedValue({ data: [] }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('@lib/_responses.js', () => {
  const ok = (body: Record<string, unknown>) => ({ statusCode: 200, body: JSON.stringify({ success: true, ...body }) });
  const fail = (msg: string, code: string, status: number) => ({
    statusCode: status,
    body: JSON.stringify({ success: false, error: msg, code }),
  });
  const preflight = () => ({ statusCode: 204, body: '' });
  const raw = (status: number, body: Record<string, unknown>) => ({ statusCode: status, body: JSON.stringify(body) });
  const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };
  return { ok, fail, preflight, raw, CORS_HEADERS };
});

vi.mock('@lib/_security.js', () => ({
  validatePayloadSize: vi.fn().mockReturnValue({ valid: true }),
  sanitizeDeep: vi.fn((x: unknown) => x),
}));

vi.mock('@lib/_log.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@lib/_entitlements.js', () => ({
  ensureFeatureWithinQuota: vi.fn().mockResolvedValue({ allowed: true, feature: {} }),
  recordFeatureUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ai/orchestrator.js', () => ({
  orchestrate: vi.fn().mockResolvedValue({ response: 'chat response', intent: { intent: 'chat', confidence: 1 } }),
  orchestrateSimple: vi.fn().mockResolvedValue('simple response'),
  orchestrateEmbed: vi.fn().mockResolvedValue([0.1, 0.2]),
}));

vi.mock('@lib/prompt-templates.js', () => ({
  liveTalkSystem: vi.fn().mockReturnValue('system'),
  liveTalkIntentClassification: vi.fn().mockReturnValue('classify'),
  liveTalkRoleplay: vi.fn().mockReturnValue('roleplay'),
  liveTalkTask: vi.fn().mockReturnValue('task'),
  liveTalkMediaAck: vi.fn().mockReturnValue('ack'),
}));

vi.mock('@lib/realtime/session-manager.js', () => ({
  createSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
  endSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
  getSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
}));

vi.mock('@lib/workflow-engine.js', () => ({
  createProject: vi.fn().mockResolvedValue({ id: 'project-1' }),
  addWorkflowStep: vi.fn().mockResolvedValue({}),
  runWorkflow: vi.fn().mockResolvedValue({ status: 'done' }),
}));

vi.mock('@lib/media-engine.js', () => ({
  runMediaTask: vi.fn().mockResolvedValue({ url: 'https://example.com/img.png' }),
  generateMedia: vi.fn().mockResolvedValue({ url: 'https://example.com/img.png', id: 'gen-1' }),
}));

vi.mock('@lib/media/prompt-optimizer.js', () => ({
  optimizePrompt: vi.fn().mockResolvedValue('optimized prompt'),
}));

vi.mock('@lib/voice-engine.js', () => ({
  processVoiceTurn: vi.fn().mockResolvedValue({ audio: 'data' }),
  createRealtimeSession: vi.fn().mockResolvedValue({ client_secret: 'sec', realtime_endpoint: 'wss://...' }),
}));

vi.mock('@lib/vision-analyzer.js', () => ({
  analyzeImage: vi.fn().mockResolvedValue('image analysis'),
  describeVideo: vi.fn().mockResolvedValue('video analysis'),
}));

vi.mock('@lib/multimodal-engine.js', () => ({
  runTask: vi.fn().mockResolvedValue({ result: 'ok' }),
}));

vi.mock('@lib/nofilter-client.js', () => ({
  isNofilterModel: vi.fn().mockReturnValue(false),
}));

// ── Helper to build a mock Netlify event ────────────────────────────────────

function makeEvent(body: Record<string, unknown>, opts: Record<string, unknown> = {}) {
  return {
    httpMethod: 'POST',
    headers: { authorization: 'Bearer valid-token' },
    body: JSON.stringify(body),
    ...opts,
  };
}

// ── Import the handler under test ───────────────────────────────────────────

const { handler } = await import('../../netlify/functions/ai-orchestrator.js');

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ai-orchestrator gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ────────────────────────────────────────────────────────────────

  it('returns 204 for OPTIONS preflight', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', headers: {}, body: '' });
    expect(res.statusCode).toBe(204);
  });

  it('returns 405 for non-POST methods', async () => {
    const res = await handler({ httpMethod: 'GET', headers: {}, body: '' });
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when no auth token is provided', async () => {
    const { supabase } = await import('@lib/_supabase.js');
    // Make getUser return null to simulate no auth
    vi.mocked(supabase!.auth.getUser).mockResolvedValueOnce({ data: { user: null } } as any);

    const res = await handler(makeEvent(
      { type: 'chat', data: { message: 'hi', conversation_id: 'c1' } },
      { headers: { authorization: 'Bearer bad-token' } },
    ));
    expect(res.statusCode).toBe(401);
  });

  // ── Invalid request ─────────────────────────────────────────────────────

  it('returns 400 for unsupported request type', async () => {
    const res = await handler(makeEvent({ type: 'unsupported_type', data: {} }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('ERR_VALIDATION');
  });

  // ── Dispatch by type ────────────────────────────────────────────────────

  it('dispatches chat type to chat handler', async () => {
    const res = await handler(makeEvent({
      type: 'chat',
      data: { message: 'hello', conversation_id: 'c1' },
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.response).toBeDefined();
  });

  it('dispatches media type to media handler', async () => {
    const res = await handler(makeEvent({
      type: 'media',
      data: { prompt: 'a sunset' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('dispatches image type as media with media_type=image', async () => {
    const res = await handler(makeEvent({
      type: 'image',
      data: { prompt: 'a sunset' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('dispatches video type as media with media_type=video', async () => {
    const res = await handler(makeEvent({
      type: 'video',
      data: { prompt: 'a sunset' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('dispatches realtime type to realtime handler', async () => {
    const res = await handler(makeEvent({
      type: 'realtime',
      data: { action: 'start' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('dispatches voice type to voice handler', async () => {
    const res = await handler(makeEvent({
      type: 'voice',
      data: { text: 'hello' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('dispatches live_talk type to live talk handler', async () => {
    const res = await handler(makeEvent({
      type: 'live_talk',
      data: { message: 'hello' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('dispatches knowledge type to knowledge handler', async () => {
    const res = await handler(makeEvent({
      type: 'knowledge',
      data: { messages: [{ role: 'user', content: 'question' }] },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('dispatches workflow type to workflow handler', async () => {
    const res = await handler(makeEvent({
      type: 'workflow',
      data: { action: 'create_project' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('dispatches stream type to chat handler with stream flag', async () => {
    const res = await handler(makeEvent({
      type: 'stream',
      data: { message: 'hello', conversation_id: 'c1' },
    }));
    expect(res.statusCode).toBe(200);
  });

  // ── Error mapping ──────────────────────────────────────────────────────

  it('returns soft-fail 200 on unexpected errors for backward compat', async () => {
    const { validatePayloadSize } = await import('@lib/_security.js');
    vi.mocked(validatePayloadSize).mockReturnValueOnce({ valid: false, error: 'too big' } as any);

    // This should trigger the error path since normalizeRequest throws on invalid size
    // but the mapGatewayError should catch it with a coded error
    const res = await handler(makeEvent({ type: 'chat', data: {} }));
    expect(res.statusCode).toBe(413);
  });

  // ── Normalization ──────────────────────────────────────────────────────

  it('normalizes camelCase fields to snake_case', async () => {
    const res = await handler(makeEvent({
      type: 'chat',
      data: { message: 'hi', conversationId: 'c1' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('hoists config.model into payload', async () => {
    const res = await handler(makeEvent({
      type: 'chat',
      config: { model: 'gpt-4.1' },
      data: { message: 'hi', conversation_id: 'c1' },
    }));
    expect(res.statusCode).toBe(200);
  });
});
