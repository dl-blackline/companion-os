/**
 * Contract tests for lib/_responses.js
 *
 * Validates: ok(), fail(), preflight(), raw(), CORS_HEADERS, and
 * the response envelope shape that all function consumers depend on.
 */
import { describe, it, expect } from 'vitest';
import { ok, fail, preflight, raw, CORS_HEADERS } from '../../lib/_responses.js';

/* ── ok() ─────────────────────────────────────────────────────────────── */

describe('ok()', () => {
  it('returns 200 with success envelope', () => {
    const res = ok({ items: [1, 2] });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ items: [1, 2] });
  });

  it('accepts custom status code', () => {
    const res = ok({ created: true }, 201);
    expect(res.statusCode).toBe(201);
  });

  it('merges extra headers', () => {
    const res = ok({}, 200, { 'X-Custom': 'yes' });
    expect(res.headers['X-Custom']).toBe('yes');
  });

  it('always includes Content-Type header', () => {
    const res = ok({});
    expect(res.headers['Content-Type']).toBe('application/json');
  });

  it('always includes CORS headers', () => {
    const res = ok({});
    expect(res.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(res.headers['Access-Control-Allow-Methods']).toBeDefined();
  });
});

/* ── fail() ───────────────────────────────────────────────────────────── */

describe('fail()', () => {
  it('returns error envelope with default 500', () => {
    const res = fail('Something broke');
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Something broke');
  });

  it('accepts custom code and status', () => {
    const res = fail('Not found', 'ERR_NOT_FOUND', 404);
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('ERR_NOT_FOUND');
  });

  it('always includes CORS headers', () => {
    const res = fail('error');
    expect(res.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

/* ── preflight() ──────────────────────────────────────────────────────── */

describe('preflight()', () => {
  it('returns 204 with CORS headers', () => {
    const res = preflight();
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(res.body).toBe('');
  });
});

/* ── raw() ────────────────────────────────────────────────────────────── */

describe('raw()', () => {
  it('returns raw body without envelope', () => {
    const res = raw(200, { custom: true });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.custom).toBe(true);
    // raw does NOT wrap in { success, data }
    expect(body.success).toBeUndefined();
  });
});

/* ── CORS_HEADERS export ──────────────────────────────────────────────── */

describe('CORS_HEADERS', () => {
  it('is an object with expected keys', () => {
    expect(CORS_HEADERS).toBeDefined();
    expect(typeof CORS_HEADERS).toBe('object');
    expect(CORS_HEADERS['Content-Type']).toBe('application/json');
  });
});
