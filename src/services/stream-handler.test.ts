// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for lib/realtime/stream-handler.js
 *
 * Validates SSE formatting and the streamCompanionResponse async generator.
 */

// Mock ai-client
vi.mock('@lib/ai-client.js', () => ({
  chatStream: vi.fn(async function* () {
    yield 'Hello';
    yield ' world';
  }),
}));

// Mock companion-state — lightweight pass-through
vi.mock('@lib/realtime/companion-state.js', () => ({
  createCompanionState: vi.fn(() => ({ state: 'idle', enteredAt: new Date().toISOString(), transitions: [] })),
  transitionState: vi.fn((current, next) => ({ ...current, state: next })),
  getStateSnapshot: vi.fn((current, sub) => ({
    state: current.state,
    enteredAt: current.enteredAt || new Date().toISOString(),
    durationMs: 0,
    interruptible: current.state === 'responding',
    subState: sub,
  })),
}));

// Mock avatar-controller — lightweight pass-through
vi.mock('@lib/realtime/avatar-controller.js', () => ({
  createAvatarState: vi.fn(() => ({
    state: 'idle',
    transitionState: 'idle',
    expression: 'neutral',
    lipSyncFrames: [],
    idleIntensity: 0.5,
  })),
  transitionAvatar: vi.fn((current, next) => ({ ...current, state: next })),
  avatarStateFromCompanion: vi.fn((s) => {
    const map: Record<string, string> = { idle: 'idle', listening: 'listening', thinking: 'thinking', responding: 'speaking' };
    return map[s] || 'idle';
  }),
  generateLipSyncFrames: vi.fn(() => [{ timeMs: 0, mouthOpen: 0.5 }]),
  applyLipSync: vi.fn((state, frames) => ({ ...state, lipSyncFrames: frames })),
}));

import { formatSSE, streamCompanionResponse } from '@lib/realtime/stream-handler.js';
import { chatStream } from '@lib/ai-client.js';

// ─── formatSSE ──────────────────────────────────────────────────────────────

describe('formatSSE', () => {
  it('formats an SSE event string with event name and JSON data', () => {
    const result = formatSSE('token', { content: 'hi' });
    expect(result).toBe('event: token\ndata: {"content":"hi"}\n\n');
  });

  it('serializes complex data objects', () => {
    const result = formatSSE('state', { companionState: { state: 'thinking' }, timestamp: 'T1' });
    expect(result).toContain('event: state');
    expect(result).toContain('"companionState"');
    expect(result).toContain('"thinking"');
    expect(result.endsWith('\n\n')).toBe(true);
  });

  it('handles empty data object', () => {
    const result = formatSSE('done', {});
    expect(result).toBe('event: done\ndata: {}\n\n');
  });
});

// ─── streamCompanionResponse ────────────────────────────────────────────────

describe('streamCompanionResponse', () => {
  it('yields SSE events in correct order: state → tokens → done → state(idle)', async () => {
    const chunks: string[] = [];
    for await (const chunk of streamCompanionResponse({
      prompt: { system: 'Be helpful', user: 'Hello' },
    })) {
      chunks.push(chunk);
    }

    // Should have: state(listening), state(thinking), state(speaking), tokens, done, state(idle)
    expect(chunks.length).toBeGreaterThanOrEqual(5);

    // First two chunks are state events (listening, thinking)
    expect(chunks[0]).toContain('event: state');
    expect(chunks[1]).toContain('event: state');

    // Third chunk is state (speaking)
    expect(chunks[2]).toContain('event: state');

    // Token chunks
    const tokenChunks = chunks.filter((c) => c.includes('event: token'));
    expect(tokenChunks).toHaveLength(2);
    expect(tokenChunks[0]).toContain('Hello');
    expect(tokenChunks[1]).toContain(' world');

    // Done chunk
    const doneChunks = chunks.filter((c) => c.includes('event: done'));
    expect(doneChunks).toHaveLength(1);
    expect(doneChunks[0]).toContain('Hello world');

    // Final idle state
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk).toContain('event: state');
  });

  it('emits error for missing prompt', async () => {
    const chunks: string[] = [];
    for await (const chunk of streamCompanionResponse({ prompt: null })) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('event: error');
    expect(chunks[0]).toContain('Missing prompt');
  });

  it('skips avatar state events when includeAvatarState is false', async () => {
    const chunks: string[] = [];
    for await (const chunk of streamCompanionResponse({
      prompt: { system: 'sys', user: 'hi' },
      includeAvatarState: false,
    })) {
      chunks.push(chunk);
    }

    const stateChunks = chunks.filter((c) => c.includes('event: state'));
    expect(stateChunks).toHaveLength(0);

    // Should still have token and done events
    const tokenChunks = chunks.filter((c) => c.includes('event: token'));
    expect(tokenChunks.length).toBeGreaterThan(0);
  });

  it('handles AI stream error with error event', async () => {
    vi.mocked(chatStream).mockImplementationOnce(async function* () {
      throw new Error('Model unavailable');
    });

    const chunks: string[] = [];
    for await (const chunk of streamCompanionResponse({
      prompt: { system: 'sys', user: 'hi' },
    })) {
      chunks.push(chunk);
    }

    const errorChunks = chunks.filter((c) => c.includes('event: error'));
    expect(errorChunks.length).toBeGreaterThanOrEqual(1);
    expect(errorChunks[0]).toContain('Model unavailable');
  });

  it('accumulates tokens correctly in the accumulated field', async () => {
    const chunks: string[] = [];
    for await (const chunk of streamCompanionResponse({
      prompt: { system: 'sys', user: 'hi' },
    })) {
      chunks.push(chunk);
    }

    const tokenChunks = chunks.filter((c) => c.includes('event: token'));
    const firstTokenData = JSON.parse(tokenChunks[0].split('data: ')[1]);
    const secondTokenData = JSON.parse(tokenChunks[1].split('data: ')[1]);

    expect(firstTokenData.accumulated).toBe('Hello');
    expect(secondTokenData.accumulated).toBe('Hello world');
  });
});
