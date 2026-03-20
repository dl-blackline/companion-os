// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/companion-brain.js
 *
 * We test the pure exported helper (listCapabilities) which requires no
 * external services. The main think() function depends on Supabase and
 * OpenAI so it is tested via integration tests, not here.
 */

import { listCapabilities } from '@lib/companion-brain.js';

// ─── listCapabilities ───────────────────────────────────────────────────────

describe('listCapabilities', () => {
  it('returns an array of capability strings', () => {
    const caps = listCapabilities();
    expect(Array.isArray(caps)).toBe(true);
    expect(caps.length).toBeGreaterThan(0);
    caps.forEach((c: string) => {
      expect(typeof c).toBe('string');
    });
  });

  it('includes core capabilities', () => {
    const caps = listCapabilities();
    expect(caps).toContain('chat');
    expect(caps).toContain('roleplay');
    expect(caps).toContain('planning');
    expect(caps).toContain('research');
    expect(caps).toContain('media_generation');
  });

  it('includes goal and knowledge capabilities', () => {
    const caps = listCapabilities();
    expect(caps).toContain('goal_management');
    expect(caps).toContain('knowledge_lookup');
  });

  it('includes search capabilities', () => {
    const caps = listCapabilities();
    expect(caps).toContain('web_search');
    expect(caps).toContain('location');
  });
});
