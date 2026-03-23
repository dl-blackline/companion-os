import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertNoSecrets } from '@/lib/env-guard';

/**
 * Tests for env-guard.ts — verifies that assertNoSecrets() throws when
 * a secret key is present in import.meta.env and stays silent when the
 * environment is clean.
 *
 * Note: src/test/setup.ts sets process.env.OPENAI_API_KEY and
 * SUPABASE_SERVICE_ROLE_KEY for backend module imports.  Those values
 * bleed into import.meta.env in Vitest, so we stub them to '' in each
 * test to start from a known-clean state.
 */

describe('assertNoSecrets', () => {
  beforeEach(() => {
    // Clear secrets injected by test setup so each test starts clean.
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not throw when no secret keys are present', () => {
    expect(() => assertNoSecrets()).not.toThrow();
  });

  it('throws when OPENAI_API_KEY is in import.meta.env', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-leaked-key');
    expect(() => assertNoSecrets()).toThrowError(/Forbidden use of secret API key: OPENAI_API_KEY/);
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is in import.meta.env', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.leaked');
    expect(() => assertNoSecrets()).toThrowError(/Forbidden use of secret API key: SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('does not throw when keys exist but are empty strings', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => assertNoSecrets()).not.toThrow();
  });

  it('error message mentions server-side usage', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-secret');
    expect(() => assertNoSecrets()).toThrowError(/server-side code/);
  });
});
