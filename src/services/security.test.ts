// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/_security.js
 *
 * Validates the input validation and sanitization layer.
 */

import {
  validatePayloadSize,
  sanitize,
  sanitizeDeep,
  isUUID,
  validateAIPayload,
  safeParseJSON,
  MAX_PAYLOAD_BYTES,
  MAX_MESSAGE_LENGTH,
} from '@lib/_security.js';

// ─── validatePayloadSize ────────────────────────────────────────────────────

describe('validatePayloadSize', () => {
  it('passes for null/undefined body', () => {
    expect(validatePayloadSize(null)).toEqual({ valid: true });
    expect(validatePayloadSize(undefined)).toEqual({ valid: true });
  });

  it('passes for body within limit', () => {
    const body = JSON.stringify({ message: 'hello' });
    expect(validatePayloadSize(body)).toEqual({ valid: true });
  });

  it('fails for body exceeding limit', () => {
    const body = 'x'.repeat(MAX_PAYLOAD_BYTES + 1);
    const result = validatePayloadSize(body);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Payload too large');
  });

  it('respects custom limit', () => {
    const body = 'x'.repeat(100);
    expect(validatePayloadSize(body, 50).valid).toBe(false);
    expect(validatePayloadSize(body, 200).valid).toBe(true);
  });
});

// ─── sanitize ───────────────────────────────────────────────────────────────

describe('sanitize', () => {
  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  it('strips control characters', () => {
    expect(sanitize('hello\x00world')).toBe('helloworld');
    expect(sanitize('test\x1Fdata')).toBe('testdata');
    expect(sanitize('keep\x7Fgone')).toBe('keepgone');
  });

  it('preserves newlines and tabs', () => {
    expect(sanitize('line1\nline2')).toBe('line1\nline2');
    expect(sanitize('col1\tcol2')).toBe('col1\tcol2');
  });

  it('returns non-string values unchanged', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize(null)).toBe(null);
    expect(sanitize(undefined)).toBe(undefined);
    expect(sanitize(true)).toBe(true);
  });
});

// ─── sanitizeDeep ───────────────────────────────────────────────────────────

describe('sanitizeDeep', () => {
  it('sanitizes nested object strings', () => {
    const input = { name: '  hello\x00  ', nested: { msg: ' world\x7F ' } };
    const result = sanitizeDeep(input);
    expect(result).toEqual({ name: 'hello', nested: { msg: 'world' } });
  });

  it('sanitizes array elements', () => {
    const input = ['  a\x00  ', '  b\x7F  '];
    const result = sanitizeDeep(input);
    expect(result).toEqual(['a', 'b']);
  });

  it('preserves non-string values', () => {
    const input = { count: 42, active: true, data: null };
    expect(sanitizeDeep(input)).toEqual(input);
  });

  it('handles null and undefined', () => {
    expect(sanitizeDeep(null)).toBe(null);
    expect(sanitizeDeep(undefined)).toBe(undefined);
  });
});

// ─── isUUID ─────────────────────────────────────────────────────────────────

describe('isUUID', () => {
  it('accepts valid UUID v4', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUUID('00000000-0000-4000-a000-000000000001')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isUUID('not-a-uuid')).toBe(false);
    expect(isUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isUUID('')).toBe(false);
    expect(isUUID('550e8400e29b41d4a716446655440000')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isUUID(123)).toBe(false);
    expect(isUUID(null)).toBe(false);
    expect(isUUID(undefined)).toBe(false);
  });
});

// ─── validateAIPayload ──────────────────────────────────────────────────────

describe('validateAIPayload', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('returns null for valid payload', () => {
    const result = validateAIPayload({
      user_id: validUUID,
      message: 'hello',
      conversation_id: validUUID,
    });
    expect(result).toBeNull();
  });

  it('rejects missing user_id', () => {
    const result = validateAIPayload({ message: 'hello' });
    expect(result).toContain('user_id');
  });

  it('rejects invalid user_id format', () => {
    const result = validateAIPayload({ user_id: 'bad-id', message: 'hello' });
    expect(result).toContain('UUID');
  });

  it('rejects missing message when required', () => {
    const result = validateAIPayload({ user_id: validUUID });
    expect(result).toContain('message');
  });

  it('allows missing message when not required', () => {
    const result = validateAIPayload(
      { user_id: validUUID },
      { requireMessage: false },
    );
    expect(result).toBeNull();
  });

  it('rejects message that is too long', () => {
    const result = validateAIPayload({
      user_id: validUUID,
      message: 'a'.repeat(MAX_MESSAGE_LENGTH + 1),
    });
    expect(result).toContain('too long');
  });

  it('rejects invalid conversation_id format', () => {
    const result = validateAIPayload({
      user_id: validUUID,
      message: 'hello',
      conversation_id: 'not-a-uuid',
    });
    expect(result).toContain('conversation_id');
  });

  it('allows missing user_id when not required', () => {
    const result = validateAIPayload(
      { message: 'hello' },
      { requireUserId: false },
    );
    expect(result).toBeNull();
  });

  it('rejects non-object body', () => {
    expect(validateAIPayload(null)).toContain('JSON object');
    expect(validateAIPayload(undefined)).toContain('JSON object');
  });
});

// ─── safeParseJSON ──────────────────────────────────────────────────────────

describe('safeParseJSON', () => {
  it('parses valid JSON', () => {
    const result = safeParseJSON('{"key": "value"}');
    expect(result).toEqual({ data: { key: 'value' } });
  });

  it('returns empty object for null/undefined', () => {
    expect(safeParseJSON(null)).toEqual({ data: {} });
    expect(safeParseJSON(undefined)).toEqual({ data: {} });
  });

  it('returns error for invalid JSON', () => {
    const result = safeParseJSON('{bad json}');
    expect(result.error).toBe('Invalid JSON body.');
    expect(result.data).toBeUndefined();
  });
});
