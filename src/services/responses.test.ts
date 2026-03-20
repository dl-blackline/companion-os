// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/_responses.js
 *
 * Validates the unified response contract helpers used by all Netlify endpoints.
 */

import { ok, fail, preflight, raw, CORS_HEADERS } from '@lib/_responses.js';

// ─── ok() ───────────────────────────────────────────────────────────────────

describe('ok', () => {
  it('wraps data in { success: true, data } envelope', () => {
    const result = ok({ message: 'hello' });
    const body = JSON.parse(result.body);
    expect(body).toEqual({ success: true, data: { message: 'hello' } });
  });

  it('defaults to 200 status code', () => {
    const result = ok({});
    expect(result.statusCode).toBe(200);
  });

  it('allows custom status code', () => {
    const result = ok({}, 201);
    expect(result.statusCode).toBe(201);
  });

  it('includes CORS headers', () => {
    const result = ok({});
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('merges extra headers', () => {
    const result = ok({}, 200, { 'X-Custom': 'value' });
    expect(result.headers['X-Custom']).toBe('value');
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});

// ─── fail() ─────────────────────────────────────────────────────────────────

describe('fail', () => {
  it('wraps error in { success: false, error, code } envelope', () => {
    const result = fail('Something went wrong', 'ERR_TEST');
    const body = JSON.parse(result.body);
    expect(body).toEqual({
      success: false,
      error: 'Something went wrong',
      code: 'ERR_TEST',
    });
  });

  it('defaults to 500 status code and ERR_UNKNOWN code', () => {
    const result = fail('Oops');
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('ERR_UNKNOWN');
  });

  it('allows custom status code', () => {
    const result = fail('Not found', 'ERR_NOT_FOUND', 404);
    expect(result.statusCode).toBe(404);
  });

  it('includes CORS headers', () => {
    const result = fail('error');
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

// ─── preflight() ────────────────────────────────────────────────────────────

describe('preflight', () => {
  it('returns 204 with CORS headers and empty body', () => {
    const result = preflight();
    expect(result.statusCode).toBe(204);
    expect(result.body).toBe('');
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Access-Control-Allow-Methods']).toContain('POST');
  });
});

// ─── raw() ──────────────────────────────────────────────────────────────────

describe('raw', () => {
  it('returns body as-is without envelope wrapping', () => {
    const result = raw(200, { response: 'hello' });
    const body = JSON.parse(result.body);
    expect(body).toEqual({ response: 'hello' });
    expect(body.success).toBeUndefined();
  });

  it('uses the specified status code', () => {
    const result = raw(404, { error: 'not found' });
    expect(result.statusCode).toBe(404);
  });
});

// ─── CORS_HEADERS ───────────────────────────────────────────────────────────

describe('CORS_HEADERS', () => {
  it('exports standard CORS headers', () => {
    expect(CORS_HEADERS).toHaveProperty('Content-Type', 'application/json');
    expect(CORS_HEADERS).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(CORS_HEADERS).toHaveProperty('Access-Control-Allow-Methods');
    expect(CORS_HEADERS).toHaveProperty('Access-Control-Allow-Headers');
  });
});
