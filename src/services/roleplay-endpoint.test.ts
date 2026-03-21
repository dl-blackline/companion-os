// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for netlify/functions/roleplay.js
 *
 * The handler() depends on Supabase and the full think() pipeline, so we mock
 * those external dependencies and validate the endpoint's input validation,
 * response contract, and routing behaviour.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockThink = vi.fn();

vi.mock('@lib/companion-brain.js', () => ({
  think: (...args: unknown[]) => mockThink(...args),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

import { handler } from '../../netlify/functions/roleplay.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(body: Record<string, unknown>, method = 'POST') {
  return {
    httpMethod: method,
    body: JSON.stringify(body),
  };
}

/** Reusable valid UUIDs for tests. */
const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';
const TEST_CONV_ID = '00000000-0000-4000-a000-000000000002';

function parseBody(result: { body: string }) {
  return JSON.parse(result.body);
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockThink.mockReset();
});

describe('roleplay handler', () => {
  // ── Preflight ────────────────────────────────────────────────────────────

  it('returns 204 for OPTIONS (preflight)', async () => {
    const result = await handler({ httpMethod: 'OPTIONS', body: '' });
    expect(result.statusCode).toBe(204);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  // ── Method validation ────────────────────────────────────────────────────

  it('rejects non-POST methods', async () => {
    const result = await handler({ httpMethod: 'GET', body: '' });
    expect(result.statusCode).toBe(405);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    const body = parseBody(result);
    expect(body.success).toBe(false);
    expect(body.code).toBe('ERR_METHOD');
  });

  // ── Input validation ─────────────────────────────────────────────────────

  it('returns 400 when user_id is missing', async () => {
    const result = await handler(makeEvent({ message: 'hello' }));
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.success).toBe(false);
    expect(body.code).toBe('ERR_VALIDATION');
  });

  it('returns 400 when message is missing', async () => {
    const result = await handler(makeEvent({ user_id: TEST_USER_ID }));
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.success).toBe(false);
    expect(body.code).toBe('ERR_VALIDATION');
  });

  // ── Successful roleplay ──────────────────────────────────────────────────

  it('routes through think() with capability "roleplay"', async () => {
    mockThink.mockResolvedValue({
      response: 'The captain nodded slowly...',
      intent: { intent: 'roleplay', confidence: 1.0 },
    });

    const result = await handler(
      makeEvent({
        user_id: TEST_USER_ID,
        conversation_id: TEST_CONV_ID,
        message: 'I draw my sword',
        model: 'gpt-4o',
        character: 'Captain Nova',
        scenario: 'space adventure',
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
    expect(body.data.response).toBe('The captain nodded slowly...');
    expect(body.data.intent.intent).toBe('roleplay');

    // Verify think() was called with correct params
    expect(mockThink).toHaveBeenCalledTimes(1);
    const thinkArgs = mockThink.mock.calls[0][0];
    expect(thinkArgs.capability).toBe('roleplay');
    expect(thinkArgs.message).toBe('I draw my sword');
    expect(thinkArgs.user_id).toBe(TEST_USER_ID);
    expect(thinkArgs.conversation_id).toBe(TEST_CONV_ID);
    expect(thinkArgs.model).toBe('gpt-4o');
    expect(thinkArgs.extra.roleplayCharacter).toBe('Captain Nova');
    expect(thinkArgs.extra.roleplayScenario).toBe('space adventure');
  });

  it('uses user_id as fallback conversation_id', async () => {
    mockThink.mockResolvedValue({
      response: 'ok',
      intent: { intent: 'roleplay', confidence: 1.0 },
    });

    await handler(
      makeEvent({
        user_id: TEST_USER_ID,
        message: 'hello',
      }),
    );

    const thinkArgs = mockThink.mock.calls[0][0];
    expect(thinkArgs.conversation_id).toBe(TEST_USER_ID);
  });

  it('passes character and scenario as extra params', async () => {
    mockThink.mockResolvedValue({
      response: 'ok',
      intent: { intent: 'roleplay', confidence: 1.0 },
    });

    await handler(
      makeEvent({
        user_id: TEST_USER_ID,
        message: 'Continue the story',
        character: 'Gandalf',
        scenario: 'The Shire',
      }),
    );

    const thinkArgs = mockThink.mock.calls[0][0];
    expect(thinkArgs.extra.roleplayCharacter).toBe('Gandalf');
    expect(thinkArgs.extra.roleplayScenario).toBe('The Shire');
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it('returns 500 when think() throws', async () => {
    mockThink.mockRejectedValue(new Error('AI provider timeout'));

    const result = await handler(
      makeEvent({
        user_id: TEST_USER_ID,
        message: 'hello',
      }),
    );

    expect(result.statusCode).toBe(500);
    const body = parseBody(result);
    expect(body.success).toBe(false);
    expect(body.code).toBe('ERR_ROLEPLAY');
    expect(body.error).toBe('AI provider timeout');
  });
});
