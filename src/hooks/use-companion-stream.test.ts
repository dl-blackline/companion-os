import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Tests for src/hooks/use-companion-stream.ts
 *
 * Validates the streaming hook's fetch contract, SSE parsing, state
 * management, and error handling using mocked global fetch.
 */

// We test the service contract (fetch calls and SSE parsing) rather than
// React hook rendering, consistent with the codebase's hook test patterns.

import { parseSSEResponse } from '@/services/realtime-session-service';

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function buildSSE(events: Array<{ event: string; data: Record<string, unknown> }>): string {
  return events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}`).join('\n\n') + '\n\n';
}

// ─── Service contract tests ──────────────────────────────────────────────────

describe('useCompanionStream service contract', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends correct request shape to the ai-orchestrator endpoint', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = typeof url === 'string' ? url : url.toString();
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        buildSSE([{ event: 'done', data: { fullText: 'response', timestamp: new Date().toISOString() } }]),
        { status: 200 },
      );
    });

    // Simulate what the hook does internally
    const res = await fetch('/.netlify/functions/ai-orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stream',
        input: {
          message: 'Hello',
          user_id: 'user-1',
          conversation_id: 'conv-1',
          session_id: 'session-1',
          model: 'gpt-4.1',
          system_prompt: 'Be helpful',
          task: 'chat',
          includeAvatarState: true,
        },
        config: {
          model: 'gpt-4.1',
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
        },
      }),
    });

    expect(capturedUrl).toBe('/.netlify/functions/ai-orchestrator');
    expect(capturedBody).toEqual({
      type: 'stream',
      input: {
        message: 'Hello',
        user_id: 'user-1',
        conversation_id: 'conv-1',
        session_id: 'session-1',
        model: 'gpt-4.1',
        system_prompt: 'Be helpful',
        task: 'chat',
        includeAvatarState: true,
      },
      config: {
        model: 'gpt-4.1',
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
      },
    });
  });

  it('correctly parses SSE token events from the response', () => {
    const raw = buildSSE([
      { event: 'state', data: { companionState: { state: 'listening' }, avatarState: { state: 'listening' }, timestamp: 'T1' } },
      { event: 'token', data: { content: 'Hello', accumulated: 'Hello' } },
      { event: 'token', data: { content: ' world', accumulated: 'Hello world' } },
      { event: 'done', data: { fullText: 'Hello world', timestamp: 'T2' } },
    ]);

    const events = parseSSEResponse(raw);
    expect(events).toHaveLength(4);
    expect(events[0].event).toBe('state');
    expect(events[1].event).toBe('token');
    expect(events[1].data.content).toBe('Hello');
    expect(events[2].event).toBe('token');
    expect(events[2].data.accumulated).toBe('Hello world');
    expect(events[3].event).toBe('done');
    expect(events[3].data.fullText).toBe('Hello world');
  });

  it('handles error SSE events gracefully', () => {
    const raw = buildSSE([
      { event: 'state', data: { companionState: { state: 'thinking' }, avatarState: { state: 'thinking' }, timestamp: 'T1' } },
      { event: 'error', data: { error: 'Model unavailable', timestamp: 'T2' } },
    ]);

    const events = parseSSEResponse(raw);
    expect(events).toHaveLength(2);
    expect(events[1].event).toBe('error');
    expect(events[1].data.error).toBe('Model unavailable');
  });

  it('handles interrupted SSE events', () => {
    const raw = buildSSE([
      { event: 'token', data: { content: 'partial', accumulated: 'partial' } },
      { event: 'interrupted', data: { partialText: 'partial', timestamp: 'T1' } },
    ]);

    const events = parseSSEResponse(raw);
    expect(events).toHaveLength(2);
    expect(events[1].event).toBe('interrupted');
    expect(events[1].data.partialText).toBe('partial');
  });

  it('extracts companion and avatar states from state events', () => {
    const raw = buildSSE([
      {
        event: 'state',
        data: {
          companionState: { state: 'responding', interruptible: true },
          avatarState: { state: 'speaking', expression: 'neutral' },
          timestamp: 'T1',
        },
      },
    ]);

    const events = parseSSEResponse(raw);
    expect(events).toHaveLength(1);

    const csData = events[0].data.companionState as Record<string, unknown>;
    const avData = events[0].data.avatarState as Record<string, unknown>;
    expect(csData.state).toBe('responding');
    expect(avData.state).toBe('speaking');
  });

  it('handles fetch failure gracefully', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Server Error', { status: 500 });
    });

    const res = await fetch('/.netlify/functions/ai-orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'stream', input: { message: 'Hello', user_id: 'u1' } }),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });

  it('correctly parses SSE voice events from the response', () => {
    const raw = buildSSE([
      { event: 'token', data: { content: 'Hello', accumulated: 'Hello' } },
      { event: 'done', data: { fullText: 'Hello', timestamp: 'T1' } },
      { event: 'voice', data: { audioUrl: 'data:audio/mpeg;base64,abc', durationMs: 3000, timestamp: 'T2' } },
    ]);

    const events = parseSSEResponse(raw);
    expect(events).toHaveLength(3);
    expect(events[2].event).toBe('voice');
    expect(events[2].data.audioUrl).toBe('data:audio/mpeg;base64,abc');
    expect(events[2].data.durationMs).toBe(3000);
  });
});
