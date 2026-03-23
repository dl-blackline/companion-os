// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for netlify/functions/ai-stream.js
 *
 * Validates the SSE streaming endpoint that routes AI requests through
 * the orchestrator with avatar state transitions.
 */

// Mock orchestrator
vi.mock('../../services/ai/orchestrator.js', () => ({
  orchestrateStream: vi.fn(async function* () {
    yield 'Hello';
    yield ' world';
  }),
  validateAIEnv: vi.fn(),
  recordInteraction: vi.fn(),
}));

// Mock companion state
vi.mock('@lib/realtime/companion-state.js', () => {
  let stateIdx = 0;
  const states = ['idle', 'listening', 'thinking', 'responding', 'idle'];
  return {
    createCompanionState: vi.fn(() => ({ state: 'idle', enteredAt: new Date().toISOString(), transitions: [] })),
    transitionState: vi.fn((current, next) => ({ ...current, state: next })),
    getStateSnapshot: vi.fn((current, sub) => ({
      state: current.state,
      enteredAt: current.enteredAt,
      durationMs: 0,
      interruptible: current.state === 'responding',
      subState: sub,
    })),
  };
});

// Mock avatar controller
vi.mock('@lib/realtime/avatar-controller.js', () => ({
  createAvatarState: vi.fn(() => ({
    state: 'idle',
    transitionState: 'idle',
    expression: 'neutral',
    lipSyncFrames: [],
    idleIntensity: 0.5,
  })),
  transitionAvatar: vi.fn((current, next, opts) => ({
    ...current,
    state: next,
    transitionState: `${current.state}-to-${next}`,
  })),
  avatarStateFromCompanion: vi.fn((s) => {
    const map: Record<string, string> = { idle: 'idle', listening: 'listening', thinking: 'thinking', responding: 'speaking' };
    return map[s] || 'idle';
  }),
  generateLipSyncFrames: vi.fn(() => [{ timeMs: 0, mouthOpen: 0.5 }]),
  applyLipSync: vi.fn((state, frames) => ({ ...state, lipSyncFrames: frames })),
}));

// Mock stream handler
vi.mock('@lib/realtime/stream-handler.js', () => ({
  formatSSE: vi.fn((event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
}));

// Mock responses
vi.mock('@lib/_responses.js', () => ({
  preflight: vi.fn(() => ({ statusCode: 204, headers: {}, body: '' })),
  fail: vi.fn((msg, code, status) => ({
    statusCode: status || 500,
    headers: {},
    body: JSON.stringify({ success: false, error: msg, code }),
  })),
  CORS_HEADERS: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
}));

import { handler } from '../../netlify/functions/ai-stream.js';
import { validateAIEnv, recordInteraction } from '../../services/ai/orchestrator.js';
import { formatSSE } from '@lib/realtime/stream-handler.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = 'test-key';
});

function makeEvent(body: Record<string, unknown>, method = 'POST') {
  return {
    httpMethod: method,
    body: JSON.stringify(body),
  };
}

// ─── HTTP method handling ────────────────────────────────────────────────────

describe('ai-stream handler', () => {
  it('returns preflight for OPTIONS', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', body: '' });
    expect(res.statusCode).toBe(204);
  });

  it('rejects non-POST methods', async () => {
    const res = await handler({ httpMethod: 'GET', body: '' });
    expect(res.statusCode).toBe(405);
  });

  it('rejects invalid JSON body', async () => {
    const res = await handler({ httpMethod: 'POST', body: 'not json' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing required fields', async () => {
    const res = await handler(makeEvent({ message: 'hi' }));
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing message', async () => {
    const res = await handler(makeEvent({ user_id: 'u1' }));
    expect(res.statusCode).toBe(400);
  });

  // ─── Successful streaming ──────────────────────────────────────────────

  it('returns SSE response with tokens and state events', async () => {
    const res = await handler(makeEvent({
      message: 'Hello',
      user_id: 'user-1',
      conversation_id: 'conv-1',
    }));

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/event-stream');
    expect(res.headers['Cache-Control']).toBe('no-cache');

    // Should contain state events (listening, thinking, speaking, idle)
    expect(formatSSE).toHaveBeenCalledWith('state', expect.objectContaining({
      companionState: expect.any(Object),
      avatarState: expect.any(Object),
    }));

    // Should contain token events
    expect(formatSSE).toHaveBeenCalledWith('token', expect.objectContaining({
      content: 'Hello',
      accumulated: 'Hello',
    }));

    expect(formatSSE).toHaveBeenCalledWith('token', expect.objectContaining({
      content: ' world',
      accumulated: 'Hello world',
    }));

    // Should contain done event
    expect(formatSSE).toHaveBeenCalledWith('done', expect.objectContaining({
      fullText: 'Hello world',
    }));
  });

  it('records interactions after streaming', async () => {
    await handler(makeEvent({
      message: 'Test message',
      user_id: 'user-1',
    }));

    expect(recordInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', role: 'user', content: 'Test message' }),
    );
    expect(recordInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', role: 'assistant', content: 'Hello world' }),
    );
  });

  it('skips avatar state when includeAvatarState is false', async () => {
    const res = await handler(makeEvent({
      message: 'Hello',
      user_id: 'user-1',
      includeAvatarState: false,
    }));

    expect(res.statusCode).toBe(200);
    // formatSSE should still be called for tokens and done, but not for state
    const stateCallCount = vi.mocked(formatSSE).mock.calls.filter(
      (call) => call[0] === 'state',
    ).length;
    expect(stateCallCount).toBe(0);
  });

  it('returns error SSE event when AI env validation fails', async () => {
    vi.mocked(validateAIEnv).mockImplementation(() => {
      throw Object.assign(new Error('OPENAI_API_KEY is not configured'), { code: 'ERR_CONFIG' });
    });

    const res = await handler(makeEvent({
      message: 'Hello',
      user_id: 'user-1',
    }));

    expect(res.statusCode).toBe(503);
  });
});
