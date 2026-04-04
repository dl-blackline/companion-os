import '@testing-library/jest-dom/vitest';

// Provide dummy environment variables so that backend modules (e.g.
// openai-client.js, supabase) can be imported without crashing at load time.
// These are only used for unit-testing pure functions — no real API calls are made.
if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = 'test-dummy-key';
if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'https://test.supabase.co';
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-dummy-key';

// Polyfill window.matchMedia for jsdom (used by Sonner, Framer Motion, etc.)
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}