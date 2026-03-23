import { describe, it, expect } from 'vitest';
import { isForbiddenBrowserSupabaseKey, isServiceRoleKey } from '@/lib/supabase-client';

/**
 * Tests for the isServiceRoleKey() safety check in supabase-client.ts.
 * Verifies that we can detect when a Supabase service role JWT is
 * accidentally used as the frontend anon key.
 */

/** Helper: create a fake JWT with the given payload. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

/**
 * Helper: create a fake JWT using base64url encoding (as real JWTs do).
 * Replaces '+' with '-', '/' with '_', and strips trailing '='.
 */
function fakeJwtBase64Url(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.fake-signature`;
}

describe('isServiceRoleKey', () => {
  it('returns true for a service_role JWT', () => {
    const key = fakeJwt({ role: 'service_role', iss: 'supabase', iat: 1 });
    expect(isServiceRoleKey(key)).toBe(true);
  });

  it('returns false for an anon JWT', () => {
    const key = fakeJwt({ role: 'anon', iss: 'supabase', iat: 1 });
    expect(isServiceRoleKey(key)).toBe(false);
  });

  it('returns false for a JWT with no role claim', () => {
    const key = fakeJwt({ iss: 'supabase', iat: 1 });
    expect(isServiceRoleKey(key)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isServiceRoleKey('')).toBe(false);
  });

  it('returns false for a non-JWT string', () => {
    expect(isServiceRoleKey('not-a-jwt')).toBe(false);
  });

  it('returns false for malformed base64 payload', () => {
    expect(isServiceRoleKey('aaa.!!!invalid.bbb')).toBe(false);
  });

  it('returns true for a base64url-encoded service_role JWT', () => {
    const key = fakeJwtBase64Url({ role: 'service_role', iss: 'supabase', iat: 1 });
    expect(isServiceRoleKey(key)).toBe(true);
  });

  it('returns false for a base64url-encoded anon JWT', () => {
    const key = fakeJwtBase64Url({ role: 'anon', iss: 'supabase', iat: 1 });
    expect(isServiceRoleKey(key)).toBe(false);
  });
});

describe('isForbiddenBrowserSupabaseKey', () => {
  it('returns true for sb_secret_ keys', () => {
    expect(isForbiddenBrowserSupabaseKey('sb_secret_1234567890abcdef')).toBe(true);
  });

  it('returns true for service_role JWTs', () => {
    const key = fakeJwt({ role: 'service_role', iss: 'supabase', iat: 1 });
    expect(isForbiddenBrowserSupabaseKey(key)).toBe(true);
  });

  it('returns false for anon JWTs', () => {
    const key = fakeJwt({ role: 'anon', iss: 'supabase', iat: 1 });
    expect(isForbiddenBrowserSupabaseKey(key)).toBe(false);
  });
});
