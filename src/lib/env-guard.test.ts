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
    vi.stubEnv('VITE_OPENAI_API_KEY', '');
    vi.stubEnv('VITE_SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('NOFILTER_GPT_API_KEY', '');
    vi.stubEnv('PIAPI_API_KEY', '');
    vi.stubEnv('LEONARDO_API_KEY', '');
    vi.stubEnv('RUNWAY_API_KEY', '');
    vi.stubEnv('KLING_ACCESS_KEY', '');
    vi.stubEnv('KLING_SECRET_KEY', '');
    vi.stubEnv('HAILUO_API_KEY', '');
    vi.stubEnv('ELEVENLABS_API_KEY', '');
    vi.stubEnv('SUNO_API_KEY', '');
    vi.stubEnv('BRAVE_SEARCH_API_KEY', '');
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
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

  it('throws when VITE_SUPABASE_SERVICE_ROLE_KEY is in import.meta.env', () => {
    vi.stubEnv('VITE_SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.leaked');
    expect(() => assertNoSecrets()).toThrowError(/Forbidden use of secret API key: VITE_SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('throws when VITE_OPENAI_API_KEY is in import.meta.env', () => {
    vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-leaked-key');
    expect(() => assertNoSecrets()).toThrowError(/Forbidden use of secret API key: VITE_OPENAI_API_KEY/);
  });

  it('does not throw when keys exist but are empty strings', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('VITE_OPENAI_API_KEY', '');
    vi.stubEnv('VITE_SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => assertNoSecrets()).not.toThrow();
  });

  it.each([
    'GEMINI_API_KEY',
    'NOFILTER_GPT_API_KEY',
    'PIAPI_API_KEY',
    'LEONARDO_API_KEY',
    'RUNWAY_API_KEY',
    'KLING_ACCESS_KEY',
    'KLING_SECRET_KEY',
    'HAILUO_API_KEY',
    'ELEVENLABS_API_KEY',
    'SUNO_API_KEY',
    'BRAVE_SEARCH_API_KEY',
    'GOOGLE_MAPS_API_KEY',
  ])('throws when %s is in import.meta.env', (key) => {
    vi.stubEnv(key, 'leaked-secret-value');
    expect(() => assertNoSecrets()).toThrowError(new RegExp(`Forbidden use of secret API key: ${key}`));
  });

  it('error message mentions server-side usage', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-secret');
    expect(() => assertNoSecrets()).toThrowError(/server-side code/);
  });

  // ── Value-based detection (Layer 2) ──

  it('throws when a VITE_ var contains an OpenAI-style sk- key', () => {
    vi.stubEnv('VITE_CUSTOM_KEY', 'sk-abcdefghij1234567890ABCD');
    expect(() => assertNoSecrets()).toThrowError(/Forbidden secret value in VITE_CUSTOM_KEY.*OpenAI API key/);
  });

  it('throws when a VITE_ var contains a Supabase sb_secret key', () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_secret_abcdefghijklmnopqrstuvwxyz1234');
    expect(() => assertNoSecrets()).toThrowError(/Forbidden secret value in VITE_SUPABASE_ANON_KEY.*Supabase secret key/);
  });

  it('does not throw for short sk- values that are not real keys', () => {
    vi.stubEnv('VITE_SHORT', 'sk-short');
    expect(() => assertNoSecrets()).not.toThrow();
  });

  it('throws when a VITE_ var contains a service_role JWT', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ role: 'service_role', iss: 'supabase' }));
    vi.stubEnv('VITE_DB_KEY', `${header}.${payload}.sig`);
    expect(() => assertNoSecrets()).toThrowError(/Forbidden secret value in VITE_DB_KEY.*service_role JWT/);
  });

  it('does not throw for a VITE_ var containing an anon JWT', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ role: 'anon', iss: 'supabase' }));
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', `${header}.${payload}.sig`);
    expect(() => assertNoSecrets()).not.toThrow();
  });

  it('does not throw for non-VITE_ vars with secret-looking values', () => {
    // Backend-only env vars (no VITE_ prefix) are not embedded by Vite,
    // so the value-based scan should skip them.
    vi.stubEnv('BACKEND_KEY', 'sk-abcdefghij1234567890ABCD');
    expect(() => assertNoSecrets()).not.toThrow();
  });
});
