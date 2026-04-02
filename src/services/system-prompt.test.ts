// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/system-prompt.js
 *
 * Validates the hierarchical system prompt builder, including
 * content boundary handling and conversation quality priorities.
 */

import { buildSystemPrompt } from '@lib/system-prompt.js';

// ─── Base prompt tests ──────────────────────────────────────────────────────

describe('buildSystemPrompt — base identity', () => {
  it('returns a non-empty string with base identity', () => {
    const result = buildSystemPrompt({});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('AI assistant');
  });

  it('includes hard boundaries', () => {
    const result = buildSystemPrompt({});
    expect(result).toContain('Hard boundaries');
    expect(result).toContain('Minors');
    expect(result).toContain('non-consensual');
  });

  it('includes conversation quality priorities', () => {
    const result = buildSystemPrompt({});
    expect(result).toContain('Adapt vocabulary, tone, and complexity');
    expect(result).toContain('Remember and reference past conversations');
    expect(result).toContain('Ask clarifying questions');
    expect(result).toContain('content boundaries and privacy preferences');
  });
});

// ─── Unfiltered mode ────────────────────────────────────────────────────────

describe('buildSystemPrompt — unfiltered mode', () => {
  it('includes unfiltered block when enabled', () => {
    const result = buildSystemPrompt({ unfiltered: true });
    expect(result).toContain('UNFILTERED MODE ACTIVE');
  });

  it('omits unfiltered block by default', () => {
    const result = buildSystemPrompt({});
    expect(result).not.toContain('UNFILTERED MODE ACTIVE');
  });
});

// ─── Custom instructions ────────────────────────────────────────────────────

describe('buildSystemPrompt — custom instructions', () => {
  it('includes user-defined instructions when provided', () => {
    const result = buildSystemPrompt({ customInstructions: 'Always respond in French.' });
    expect(result).toContain('USER-DEFINED INSTRUCTIONS');
    expect(result).toContain('Always respond in French.');
  });
});

// ─── Companion context injection ────────────────────────────────────────────

describe('buildSystemPrompt — intelligence context', () => {
  it('injects intelligence engine context', () => {
    const result = buildSystemPrompt({
      companionContext: 'USER GOALS\nBusiness:\n  - Launch MVP [high]',
    });
    expect(result).toContain('INTELLIGENCE ENGINE — USER MODEL');
    expect(result).toContain('Launch MVP');
  });

  it('injects content boundaries from intelligence context', () => {
    const result = buildSystemPrompt({
      companionContext: 'USER CONTENT BOUNDARIES (MUST RESPECT)\nThe user has set these content boundaries. Always respect them:\n- Avoid violence: Do not include graphic violence in responses',
    });
    expect(result).toContain('USER CONTENT BOUNDARIES');
    expect(result).toContain('Avoid violence');
  });

  it('injects privacy preferences from intelligence context', () => {
    const result = buildSystemPrompt({
      companionContext: 'USER PRIVACY PREFERENCES\n- Data retention: Minimize stored personal data',
    });
    expect(result).toContain('USER PRIVACY PREFERENCES');
    expect(result).toContain('Data retention');
  });
});

// ─── User profile ───────────────────────────────────────────────────────────

describe('buildSystemPrompt — user profile', () => {
  it('includes user profile when provided', () => {
    const result = buildSystemPrompt({
      userProfile: {
        name: 'Alex',
        communication_style: 'casual',
        interests: ['music', 'cooking'],
      },
    });
    expect(result).toContain('USER PROFILE');
    expect(result).toContain('Name: Alex');
    expect(result).toContain('Communication style: casual');
    expect(result).toContain('music');
  });

  it('omits user profile when empty', () => {
    const result = buildSystemPrompt({ userProfile: {} });
    expect(result).not.toContain('USER PROFILE');
  });
});

// ─── Mood overlay ───────────────────────────────────────────────────────────

describe('buildSystemPrompt — mood overlay', () => {
  it('includes mood when provided', () => {
    const result = buildSystemPrompt({ aiMood: 'Be extra warm and supportive today.' });
    expect(result).toContain('MOOD / TONE');
    expect(result).toContain('extra warm');
  });
});

// ─── Memory sections ────────────────────────────────────────────────────────

describe('buildSystemPrompt — memory layers', () => {
  it('includes episodic memory', () => {
    const result = buildSystemPrompt({
      episodicMemories: [{ event: 'Got promoted at work' }],
    });
    expect(result).toContain('RELEVANT EPISODIC MEMORY');
    expect(result).toContain('Got promoted at work');
  });

  it('includes recent conversation', () => {
    const result = buildSystemPrompt({
      recentConversation: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there!' },
      ],
    });
    expect(result).toContain('RECENT CONVERSATION');
    expect(result).toContain('[user]: hello');
  });

  it('includes media memory context', () => {
    const result = buildSystemPrompt({
      mediaMemoryContext: 'Photo: sunset beach trip, July 2025',
    });
    expect(result).toContain('MEDIA MEMORIES');
    expect(result).toContain('sunset beach trip');
  });

  it('separates sections with double newlines', () => {
    const result = buildSystemPrompt({
      episodicMemories: [{ event: 'event' }],
      companionContext: 'context',
    });
    expect(result).toContain('\n\n');
  });
});
