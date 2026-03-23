// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for services/ai/orchestrator.js
 *
 * Validates the new context-injection and memory-recording capabilities
 * added to the orchestrator alongside the existing AI routing logic.
 */

// Mock all external dependencies before importing the module under test
vi.mock('@lib/ai-client.js', () => ({
  chat: vi.fn().mockResolvedValue('mocked response'),
  chatStream: vi.fn(async function* () {
    yield 'tok1';
    yield 'tok2';
  }),
  chatJSON: vi.fn().mockResolvedValue({ key: 'value' }),
  embed: vi.fn().mockResolvedValue([0.1, 0.2]),
}));

vi.mock('@lib/companion-brain.js', () => ({
  think: vi.fn().mockResolvedValue({
    response: 'brain response',
    intent: 'chat',
    isMedia: false,
  }),
}));

vi.mock('@lib/model-config.js', () => ({
  MODEL_CONFIG: { chat: 'test-model', voice: 'test-voice' },
}));

vi.mock('@lib/_log.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock context engine — returns a formatted context string
vi.mock('../../services/context/contextEngine.js', () => ({
  buildFullContext: vi.fn().mockResolvedValue({
    raw: {},
    summary: 'test summary',
    formatted: 'formatted context block',
    companion: null,
  }),
  summarizeContext: vi.fn(),
  formatContextBlock: vi.fn(),
}));

// Mock memory service — stubs for store/retrieve
vi.mock('../../services/memory/memoryService.js', () => ({
  storeInteraction: vi.fn().mockResolvedValue(undefined),
  getRecentInteractions: vi.fn().mockResolvedValue([
    { role: 'user', content: 'previous message' },
    { role: 'assistant', content: 'previous reply' },
  ]),
}));

import {
  validateAIEnv,
  orchestrate,
  orchestrateStream,
  orchestrateSimple,
  orchestrateJSON,
  orchestrateEmbed,
  injectContext,
  recordInteraction,
} from '../../services/ai/orchestrator.js';

import { chat } from '@lib/ai-client.js';
import { think } from '@lib/companion-brain.js';
import { buildFullContext } from '../../services/context/contextEngine.js';
import { storeInteraction, getRecentInteractions } from '../../services/memory/memoryService.js';

beforeEach(() => {
  vi.clearAllMocks();
  // Ensure env is set so validateAIEnv passes
  process.env.OPENAI_API_KEY = 'test-key';
});

// ─── validateAIEnv ──────────────────────────────────────────────────────────

describe('validateAIEnv', () => {
  it('passes when OPENAI_API_KEY is set', () => {
    expect(() => validateAIEnv()).not.toThrow();
  });

  it('throws when OPENAI_API_KEY is missing', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => validateAIEnv()).toThrow('OPENAI_API_KEY is not configured');
  });

  it('skips OpenAI check when requireOpenAI is false', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => validateAIEnv({ requireOpenAI: false })).not.toThrow();
  });
});

// ─── injectContext ──────────────────────────────────────────────────────────

describe('injectContext', () => {
  it('returns the original prompt when no user_id is provided', async () => {
    const prompt = { system: 'sys', user: 'hello' };
    const result = await injectContext(prompt, {});
    expect(result).toBe(prompt);
    expect(buildFullContext).not.toHaveBeenCalled();
  });

  it('enriches the system prompt with context and memory', async () => {
    const prompt = { system: 'Be helpful.', user: 'What is AI?' };
    const result = await injectContext(prompt, { user_id: 'u1', conversation_id: 'c1' });

    expect(buildFullContext).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', conversation_id: 'c1' }),
    );
    expect(getRecentInteractions).toHaveBeenCalled();
    expect(result.system).toContain('Be helpful.');
    expect(result.system).toContain('<context>');
    expect(result.system).toContain('formatted context block');
    expect(result.system).toContain('<recent_memory>');
    expect(result.user).toBe('What is AI?');
  });

  it('gracefully handles context assembly failure', async () => {
    vi.mocked(buildFullContext).mockRejectedValueOnce(new Error('context error'));
    vi.mocked(getRecentInteractions).mockResolvedValueOnce([]);

    const prompt = { system: 'sys', user: 'hello' };
    const result = await injectContext(prompt, { user_id: 'u1' });
    // Should still return a valid prompt (graceful degradation)
    expect(result.system).toBe('sys');
    expect(result.user).toBe('hello');
  });

  it('gracefully handles memory retrieval failure', async () => {
    vi.mocked(getRecentInteractions).mockRejectedValueOnce(new Error('memory error'));

    const prompt = { system: 'sys', user: 'hello' };
    const result = await injectContext(prompt, { user_id: 'u1' });
    // Should still include context even without memory
    expect(result.system).toContain('sys');
    expect(result.system).toContain('<context>');
  });

  it('returns original prompt when prompt is null', async () => {
    const result = await injectContext(null as any, { user_id: 'u1' });
    expect(result).toBeNull();
  });
});

// ─── recordInteraction ──────────────────────────────────────────────────────

describe('recordInteraction', () => {
  it('stores an interaction via the memory service', async () => {
    await recordInteraction({ user_id: 'u1', session_id: 's1', role: 'user', content: 'hello' });
    expect(storeInteraction).toHaveBeenCalledWith({
      user_id: 'u1',
      session_id: 's1',
      role: 'user',
      content: 'hello',
    });
  });

  it('uses "default" session_id when none provided', async () => {
    await recordInteraction({ user_id: 'u1', role: 'assistant', content: 'hi' });
    expect(storeInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: 'default' }),
    );
  });

  it('does not throw on memory store failure', async () => {
    vi.mocked(storeInteraction).mockRejectedValueOnce(new Error('store error'));
    await expect(
      recordInteraction({ user_id: 'u1', role: 'user', content: 'test' }),
    ).resolves.toBeUndefined();
  });

  it('skips store when user_id is missing', async () => {
    await recordInteraction({ user_id: '', role: 'user', content: 'test' });
    expect(storeInteraction).not.toHaveBeenCalled();
  });

  it('skips store when content is missing', async () => {
    await recordInteraction({ user_id: 'u1', role: 'user', content: '' });
    expect(storeInteraction).not.toHaveBeenCalled();
  });
});

// ─── orchestrate ────────────────────────────────────────────────────────────

describe('orchestrate', () => {
  it('calls think() and returns the result', async () => {
    const result = await orchestrate({ message: 'hello', user_id: 'u1', conversation_id: 'c1' });
    expect(think).toHaveBeenCalled();
    expect(result.response).toBe('brain response');
    expect(result.task).toBe('chat');
  });
});

// ─── orchestrateStream ─────────────────────────────────────────────────────

describe('orchestrateStream', () => {
  it('yields tokens from the AI stream', async () => {
    const tokens: string[] = [];
    for await (const token of orchestrateStream({
      prompt: { system: 'sys', user: 'hi' },
    })) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['tok1', 'tok2']);
  });

  it('injects context when user_id is provided', async () => {
    const tokens: string[] = [];
    for await (const token of orchestrateStream({
      prompt: { system: 'sys', user: 'hi' },
      user_id: 'u1',
      conversation_id: 'c1',
    })) {
      tokens.push(token);
    }
    expect(buildFullContext).toHaveBeenCalled();
    expect(tokens).toEqual(['tok1', 'tok2']);
  });
});

// ─── orchestrateSimple ─────────────────────────────────────────────────────

describe('orchestrateSimple', () => {
  it('returns a direct chat response', async () => {
    const result = await orchestrateSimple({ prompt: { system: 'sys', user: 'hi' } });
    expect(result).toBe('mocked response');
  });

  it('injects context when user_id is provided', async () => {
    await orchestrateSimple({
      prompt: { system: 'sys', user: 'hi' },
      user_id: 'u1',
    });
    expect(buildFullContext).toHaveBeenCalled();
  });

  it('skips context injection without user_id', async () => {
    await orchestrateSimple({ prompt: { system: 'sys', user: 'hi' } });
    expect(buildFullContext).not.toHaveBeenCalled();
  });
});

// ─── orchestrateJSON ────────────────────────────────────────────────────────

describe('orchestrateJSON', () => {
  it('returns parsed JSON from the AI', async () => {
    const result = await orchestrateJSON({ prompt: { system: 'sys', user: 'hi' } });
    expect(result).toEqual({ key: 'value' });
  });
});

// ─── orchestrateEmbed ───────────────────────────────────────────────────────

describe('orchestrateEmbed', () => {
  it('returns an embedding vector', async () => {
    const result = await orchestrateEmbed('hello');
    expect(result).toEqual([0.1, 0.2]);
  });
});
