// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for the pure formatCompanionContext() helper in lib/companion-engine.js.
 *
 * This function is side-effect-free (no Supabase calls) and can be tested
 * in isolation. It validates how companion context is rendered into
 * prompt-ready strings, including the new content-boundary and privacy sections.
 */

import { formatCompanionContext } from '@lib/companion-engine.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeGoal(overrides = {}) {
  return {
    id: 'goal-1',
    user_id: 'user-1',
    domain: 'personal',
    title: 'Test goal',
    description: null,
    status: 'active',
    priority: 'medium',
    target_date: null,
    progress: 0,
    milestones: [],
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeConstraint(overrides = {}) {
  return {
    id: 'cst-1',
    user_id: 'user-1',
    domain: 'general',
    label: 'Test constraint',
    value: 'some value',
    is_active: true,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── basic formatting ───────────────────────────────────────────────────────

describe('formatCompanionContext — basic', () => {
  it('returns empty string when all arrays are empty', () => {
    const result = formatCompanionContext({
      goals: [],
      constraints: [],
      recentInteractions: [],
      pendingInitiatives: [],
    });
    expect(result).toBe('');
  });

  it('formats goals grouped by domain', () => {
    const result = formatCompanionContext({
      goals: [
        makeGoal({ domain: 'business', title: 'Launch MVP', priority: 'high' }),
        makeGoal({ domain: 'health', title: 'Run 5K', priority: 'medium', progress: 0.5 }),
      ],
      constraints: [],
      recentInteractions: [],
      pendingInitiatives: [],
    });
    expect(result).toContain('USER GOALS');
    expect(result).toContain('Business:');
    expect(result).toContain('Launch MVP [high]');
    expect(result).toContain('Health:');
    expect(result).toContain('Run 5K [medium]');
    expect(result).toContain('50%');
  });
});

// ─── content boundaries ─────────────────────────────────────────────────────

describe('formatCompanionContext — content boundaries', () => {
  it('separates content constraints into their own section', () => {
    const result = formatCompanionContext({
      goals: [],
      constraints: [
        makeConstraint({ domain: 'content', label: 'Avoid violence', value: 'Do not include graphic violence' }),
        makeConstraint({ domain: 'content', label: 'No politics', value: 'Skip political discussions' }),
      ],
      recentInteractions: [],
      pendingInitiatives: [],
    });
    expect(result).toContain('USER CONTENT BOUNDARIES (MUST RESPECT)');
    expect(result).toContain('Avoid violence: Do not include graphic violence');
    expect(result).toContain('No politics: Skip political discussions');
    expect(result).not.toContain('USER CONSTRAINTS & BOUNDARIES');
  });

  it('separates privacy constraints into their own section', () => {
    const result = formatCompanionContext({
      goals: [],
      constraints: [
        makeConstraint({ domain: 'privacy', label: 'Data retention', value: 'Minimize stored data' }),
      ],
      recentInteractions: [],
      pendingInitiatives: [],
    });
    expect(result).toContain('USER PRIVACY PREFERENCES');
    expect(result).toContain('Data retention: Minimize stored data');
    expect(result).not.toContain('USER CONSTRAINTS & BOUNDARIES');
  });

  it('groups content, privacy, and other constraints into separate sections', () => {
    const result = formatCompanionContext({
      goals: [],
      constraints: [
        makeConstraint({ domain: 'content', label: 'Avoid violence', value: 'No graphic violence' }),
        makeConstraint({ domain: 'privacy', label: 'Data retention', value: '30 days max' }),
        makeConstraint({ domain: 'financial', label: 'Budget', value: '$5000/mo' }),
      ],
      recentInteractions: [],
      pendingInitiatives: [],
    });
    expect(result).toContain('USER CONTENT BOUNDARIES (MUST RESPECT)');
    expect(result).toContain('USER PRIVACY PREFERENCES');
    expect(result).toContain('USER CONSTRAINTS & BOUNDARIES');
    expect(result).toContain('[financial] Budget');
  });

  it('omits content boundaries section when no content constraints exist', () => {
    const result = formatCompanionContext({
      goals: [],
      constraints: [
        makeConstraint({ domain: 'financial', label: 'Budget', value: '$5000/mo' }),
      ],
      recentInteractions: [],
      pendingInitiatives: [],
    });
    expect(result).not.toContain('USER CONTENT BOUNDARIES');
    expect(result).toContain('USER CONSTRAINTS & BOUNDARIES');
    expect(result).toContain('[financial] Budget');
  });
});

// ─── recent interactions ────────────────────────────────────────────────────

describe('formatCompanionContext — interactions', () => {
  it('formats recent interactions', () => {
    const result = formatCompanionContext({
      goals: [],
      constraints: [],
      recentInteractions: [
        { module: 'chat', action: 'sent_message', summary: 'Discussed goals' },
      ],
      pendingInitiatives: [],
    });
    expect(result).toContain('RECENT ACTIVITY');
    expect(result).toContain('[chat] sent_message: Discussed goals');
  });
});

// ─── pending initiatives ────────────────────────────────────────────────────

describe('formatCompanionContext — initiatives', () => {
  it('formats pending initiatives', () => {
    const result = formatCompanionContext({
      goals: [],
      constraints: [],
      recentInteractions: [],
      pendingInitiatives: [
        { type: 'suggestion', title: 'Morning routine', body: 'Start with stretching' },
      ],
    });
    expect(result).toContain('PENDING PROACTIVE SUGGESTIONS');
    expect(result).toContain('[suggestion] Morning routine: Start with stretching');
  });
});
