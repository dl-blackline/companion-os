import { describe, it, expect } from 'vitest';
import { isServiceRoleKey } from '@/lib/supabase-client';

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
});
