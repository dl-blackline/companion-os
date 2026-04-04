/**
 * Contract tests for lib/_security.js
 *
 * Validates: payload size, sanitization, UUID checks, AI payload validation,
 * safe JSON parsing, and authenticateRequest.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  validatePayloadSize,
  sanitize,
  sanitizeDeep,
  isUUID,
  validateAIPayload,
  safeParseJSON,
  authenticateRequest,
  MAX_PAYLOAD_BYTES,
  MAX_MESSAGE_LENGTH,
} from '../../lib/_security.js';

/* ── validatePayloadSize ──────────────────────────────────────────────── */

describe('validatePayloadSize', () => {
  it('returns valid for null/undefined body', () => {
    expect(validatePayloadSize(null)).toEqual({ valid: true });
    expect(validatePayloadSize(undefined)).toEqual({ valid: true });
  });

  it('returns valid for small payloads', () => {
    expect(validatePayloadSize('{"hello":"world"}')).toEqual({ valid: true });
  });

  it('rejects payloads exceeding default limit', () => {
    const oversized = 'x'.repeat(MAX_PAYLOAD_BYTES + 1);
    const result = validatePayloadSize(oversized);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Payload too large');
  });

  it('accepts custom limit', () => {
    const result = validatePayloadSize('12345', 3);
    expect(result.valid).toBe(false);
  });

  it('handles empty string as valid', () => {
    expect(validatePayloadSize('')).toEqual({ valid: true });
  });
});

/* ── sanitize ─────────────────────────────────────────────────────────── */

describe('sanitize', () => {
  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  it('strips control characters', () => {
    expect(sanitize('hello\x00world')).toBe('helloworld');
    expect(sanitize('abc\x07def')).toBe('abcdef');
  });

  it('preserves newlines and tabs', () => {
    expect(sanitize('hello\nworld\ttab')).toBe('hello\nworld\ttab');
  });

  it('returns non-strings unchanged', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize(null)).toBe(null);
    expect(sanitize(undefined)).toBe(undefined);
  });
});

/* ── sanitizeDeep ─────────────────────────────────────────────────────── */

describe('sanitizeDeep', () => {
  it('sanitizes nested object strings', () => {
    const input = { name: '  alice\x00  ', nested: { email: '  bob@test.com  ' } };
    const result = sanitizeDeep(input);
    expect(result.name).toBe('alice');
    expect(result.nested.email).toBe('bob@test.com');
  });

  it('sanitizes arrays', () => {
    expect(sanitizeDeep(['  a  ', '  b  '])).toEqual(['a', 'b']);
  });

  it('returns null/undefined as-is', () => {
    expect(sanitizeDeep(null)).toBe(null);
    expect(sanitizeDeep(undefined)).toBe(undefined);
  });

  it('returns numbers unchanged', () => {
    expect(sanitizeDeep(42)).toBe(42);
  });
});

/* ── isUUID ───────────────────────────────────────────────────────────── */

describe('isUUID', () => {
  it('accepts valid UUID v4', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects malformed strings', () => {
    expect(isUUID('not-a-uuid')).toBe(false);
    expect(isUUID('')).toBe(false);
    expect(isUUID(null)).toBe(false);
    expect(isUUID(123)).toBe(false);
  });
});

/* ── validateAIPayload ────────────────────────────────────────────────── */

describe('validateAIPayload', () => {
  const validPayload = {
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    message: 'Hello',
    conversation_id: '660e8400-e29b-41d4-a716-446655440001',
  };

  it('returns null for valid payload', () => {
    expect(validateAIPayload(validPayload)).toBeNull();
  });

  it('rejects missing user_id', () => {
    const { user_id, ...rest } = validPayload;
    expect(validateAIPayload(rest)).toContain('user_id');
  });

  it('rejects invalid user_id format', () => {
    expect(validateAIPayload({ ...validPayload, user_id: 'bad' })).toContain('UUID');
  });

  it('rejects missing message', () => {
    const { message, ...rest } = validPayload;
    expect(validateAIPayload(rest)).toContain('message');
  });

  it('rejects oversized messages', () => {
    const long = 'x'.repeat(MAX_MESSAGE_LENGTH + 1);
    expect(validateAIPayload({ ...validPayload, message: long })).toContain('too long');
  });

  it('rejects non-object body', () => {
    expect(validateAIPayload(null)).toContain('JSON object');
    expect(validateAIPayload('string')).toContain('JSON object');
  });

  it('skips user_id check when opt-out', () => {
    expect(validateAIPayload({ message: 'hi' }, { requireUserId: false })).toBeNull();
  });

  it('skips message check when opt-out', () => {
    expect(
      validateAIPayload(
        { user_id: '550e8400-e29b-41d4-a716-446655440000' },
        { requireMessage: false },
      ),
    ).toBeNull();
  });
});

/* ── safeParseJSON ────────────────────────────────────────────────────── */

describe('safeParseJSON', () => {
  it('parses valid JSON', () => {
    expect(safeParseJSON('{"a":1}')).toEqual({ data: { a: 1 } });
  });

  it('returns empty object for null/undefined', () => {
    expect(safeParseJSON(null)).toEqual({ data: {} });
    expect(safeParseJSON(undefined)).toEqual({ data: {} });
  });

  it('returns error for invalid JSON', () => {
    const result = safeParseJSON('{bad}');
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });
});

/* ── authenticateRequest ──────────────────────────────────────────────── */

describe('authenticateRequest', () => {
  it('returns error when no authorization header', async () => {
    const event = { headers: {} };
    const result = await authenticateRequest(event, {});
    expect(result.error).toContain('Missing authorization');
    expect(result.user).toBeNull();
  });

  it('returns error when supabase is null', async () => {
    const event = { headers: { authorization: 'Bearer token123' } };
    const result = await authenticateRequest(event, null);
    expect(result.error).toContain('Server configuration');
  });

  it('returns user on valid token', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    };
    const event = { headers: { authorization: 'Bearer valid-token' } };
    const result = await authenticateRequest(event, mockSupabase);
    expect(result.user).toEqual(mockUser);
    expect(result.error).toBeNull();
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('valid-token');
  });

  it('returns error when getUser returns no user', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    const event = { headers: { authorization: 'Bearer expired-token' } };
    const result = await authenticateRequest(event, mockSupabase);
    expect(result.user).toBeNull();
    expect(result.error).toContain('Invalid or expired');
  });

  it('returns error when getUser throws', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error('network error')),
      },
    };
    const event = { headers: { authorization: 'Bearer bad' } };
    const result = await authenticateRequest(event, mockSupabase);
    expect(result.user).toBeNull();
    expect(result.error).toContain('Authentication failed');
  });
});
