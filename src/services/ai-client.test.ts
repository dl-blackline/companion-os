// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for lib/ai-client.js
 *
 * Validates retry, timeout, cost tracking, and the public API surface.
 * All LLM calls are mocked to avoid real API requests.
 */

// Mock the underlying providers before importing ai-client
vi.mock('@lib/openai-client.js', () => ({
  generateChatCompletion: vi.fn().mockResolvedValue('mocked completion'),
  streamChatCompletion: vi.fn(),
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

vi.mock('@lib/ai-router.js', () => ({
  route: vi.fn().mockResolvedValue('mocked route response'),
  runAI: vi.fn().mockResolvedValue('mocked runAI response'),
  streamAI: vi.fn(async function* () {
    yield 'token1';
    yield 'token2';
  }),
}));

import { chat, chatJSON, embed, onCost, offCost, isRetryable } from '@lib/ai-client.js';
import { route } from '@lib/ai-router.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── chat() ─────────────────────────────────────────────────────────────────

describe('chat', () => {
  it('returns the AI response text', async () => {
    const result = await chat({ prompt: { system: 'test', user: 'hello' } });
    expect(result).toBe('mocked route response');
  });

  it('passes model and task to the router', async () => {
    await chat({ prompt: { system: 's', user: 'u' }, model: 'gpt-4.1', task: 'planning' });
    expect(route).toHaveBeenCalledWith({ task: 'planning', prompt: { system: 's', user: 'u' }, model: 'gpt-4.1' });
  });

  it('retries on transient errors', async () => {
    const transientError = new Error('timeout');
    vi.mocked(route)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce('recovered');

    const result = await chat({
      prompt: { system: '', user: 'hi' },
      retries: 2,
      timeoutMs: 0,
    });
    expect(result).toBe('recovered');
    expect(route).toHaveBeenCalledTimes(2);
  });

  it('throws on non-retryable errors without retry', async () => {
    const badRequest = Object.assign(new Error('bad request'), { status: 400 });
    vi.mocked(route).mockRejectedValueOnce(badRequest);

    await expect(chat({
      prompt: { system: '', user: 'hi' },
      retries: 2,
      timeoutMs: 0,
    })).rejects.toThrow('bad request');
    expect(route).toHaveBeenCalledTimes(1);
  });
});

// ─── chatJSON() ─────────────────────────────────────────────────────────────

describe('chatJSON', () => {
  it('parses a plain JSON response', async () => {
    vi.mocked(route).mockResolvedValueOnce('{"intent":"chat","confidence":0.9}');
    const result = await chatJSON({ prompt: { system: '', user: '' } });
    expect(result).toEqual({ intent: 'chat', confidence: 0.9 });
  });

  it('extracts JSON from markdown fences', async () => {
    vi.mocked(route).mockResolvedValueOnce('```json\n{"key":"value"}\n```');
    const result = await chatJSON({ prompt: { system: '', user: '' } });
    expect(result).toEqual({ key: 'value' });
  });

  it('throws when response contains no valid JSON', async () => {
    vi.mocked(route).mockResolvedValueOnce('This is not JSON at all');
    await expect(chatJSON({ prompt: { system: '', user: '' } })).rejects.toThrow('Failed to parse');
  });
});

// ─── embed() ────────────────────────────────────────────────────────────────

describe('embed', () => {
  it('returns an embedding vector', async () => {
    const result = await embed('test text');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });
});

// ─── isRetryable() ──────────────────────────────────────────────────────────

describe('isRetryable', () => {
  it('returns true for timeout errors', () => {
    expect(isRetryable(new Error('request timeout'))).toBe(true);
  });

  it('returns true for 429 status', () => {
    expect(isRetryable(Object.assign(new Error('rate limit'), { status: 429 }))).toBe(true);
  });

  it('returns true for 500 status', () => {
    expect(isRetryable(Object.assign(new Error('server error'), { status: 500 }))).toBe(true);
  });

  it('returns false for 400 status', () => {
    expect(isRetryable(Object.assign(new Error('bad request'), { status: 400 }))).toBe(false);
  });

  it('returns true for network errors', () => {
    expect(isRetryable(new Error('ECONNRESET'))).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isRetryable(null as any)).toBe(false);
    expect(isRetryable(undefined as any)).toBe(false);
  });
});

// ─── Cost tracking hooks ────────────────────────────────────────────────────

describe('cost tracking', () => {
  it('calls registered cost hooks on successful chat completion', async () => {
    const hook = vi.fn();
    onCost(hook);

    await chat({ prompt: { system: '', user: 'hello' }, timeoutMs: 0 });

    expect(hook).toHaveBeenCalledTimes(1);
    const event = hook.mock.calls[0][0];
    expect(event).toHaveProperty('task', 'chat');
    expect(event).toHaveProperty('model');
    expect(event).toHaveProperty('durationMs');
    expect(typeof event.durationMs).toBe('number');
    expect(event).toHaveProperty('fromRetry', false);

    offCost(hook);
  });

  it('can remove a cost hook with offCost()', async () => {
    const hook = vi.fn();
    onCost(hook);
    offCost(hook);

    await chat({ prompt: { system: '', user: 'hello' }, timeoutMs: 0 });

    expect(hook).not.toHaveBeenCalled();
  });

  it('marks fromRetry=true when result came from a retry', async () => {
    const hook = vi.fn();
    onCost(hook);

    vi.mocked(route)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('ok');

    await chat({ prompt: { system: '', user: 'hi' }, retries: 1, timeoutMs: 0 });

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][0].fromRetry).toBe(true);

    offCost(hook);
  });
});
