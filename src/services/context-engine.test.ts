// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/context-engine.js
 *
 * We test the pure helper functions (summarizeContext, formatContextBlock)
 * which don't require Supabase or AI calls.
 */

import { summarizeContext, formatContextBlock } from '@lib/context-engine.js';

// ─── summarizeContext ───────────────────────────────────────────────────────

describe('summarizeContext', () => {
  it('includes user name when profile is present', () => {
    const result = summarizeContext({
      userProfile: { name: 'Alex' },
    });
    expect(result).toContain('User: Alex');
  });

  it('shows "unknown" when profile has no name', () => {
    const result = summarizeContext({
      userProfile: {},
    });
    expect(result).toContain('User: unknown');
  });

  it('includes domain when present', () => {
    const result = summarizeContext({
      domain: 'fitness',
    });
    expect(result).toContain('Domain: fitness');
  });

  it('includes memory counts', () => {
    const result = summarizeContext({
      episodicMemories: [{ event: 'a' }, { event: 'b' }],
      relationshipMemories: [{ memory: 'c' }],
    });
    expect(result).toContain('2 episodic memories');
    expect(result).toContain('1 relationship memories');
  });

  it('includes KG and intelligence engine when available', () => {
    const result = summarizeContext({
      knowledgeGraphContext: 'entities...',
      companionContext: 'goals...',
    });
    expect(result).toContain('KG available');
    expect(result).toContain('Intelligence engine active');
  });

  it('includes short-term memory count', () => {
    const result = summarizeContext({
      shortTermMemory: [{ role: 'user', content: 'hi' }],
    });
    expect(result).toContain('1 short-term entries');
  });

  it('returns fallback when context is empty', () => {
    const result = summarizeContext({});
    expect(result).toBe('No context available');
  });

  it('combines multiple parts with commas', () => {
    const result = summarizeContext({
      userProfile: { name: 'Alex' },
      domain: 'finance',
      knowledgeGraphContext: 'data',
    });
    expect(result).toBe('User: Alex, Domain: finance, KG available');
  });
});

// ─── formatContextBlock ─────────────────────────────────────────────────────

describe('formatContextBlock', () => {
  it('formats user profile section', () => {
    const result = formatContextBlock({
      userProfile: {
        name: 'Alex',
        communication_style: 'casual',
        goals: ['Run 5K'],
      },
    });
    expect(result).toContain('USER PROFILE');
    expect(result).toContain('Name: Alex');
    expect(result).toContain('Style: casual');
    expect(result).toContain('Run 5K');
  });

  it('formats intelligence context section', () => {
    const result = formatContextBlock({
      companionContext: 'Active Goals:\n- Build muscle',
    });
    expect(result).toContain('INTELLIGENCE CONTEXT');
    expect(result).toContain('Build muscle');
  });

  it('formats episodic memory section', () => {
    const result = formatContextBlock({
      episodicMemories: [
        { event: 'Completed first marathon' },
        { event: 'Started new job' },
      ],
    });
    expect(result).toContain('EPISODIC MEMORY');
    expect(result).toContain('- Completed first marathon');
    expect(result).toContain('- Started new job');
  });

  it('formats short-term memory section', () => {
    const result = formatContextBlock({
      shortTermMemory: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    });
    expect(result).toContain('RECENT SESSION');
    expect(result).toContain('[user]: hello');
    expect(result).toContain('[assistant]: hi there');
  });

  it('formats knowledge graph section', () => {
    const result = formatContextBlock({
      knowledgeGraphContext: 'Entity: Workout → linked to: Fitness',
    });
    expect(result).toContain('KNOWLEDGE GRAPH');
    expect(result).toContain('Workout');
  });

  it('returns empty string when context has no data', () => {
    const result = formatContextBlock({});
    expect(result).toBe('');
  });

  it('separates sections with double newlines', () => {
    const result = formatContextBlock({
      userProfile: { name: 'Alex' },
      companionContext: 'Goals active',
    });
    expect(result).toContain('\n\n');
    const sections = result.split('\n\n');
    expect(sections.length).toBe(2);
  });

  it('omits profile section when profile has no displayable fields', () => {
    const result = formatContextBlock({
      userProfile: {},
      companionContext: 'Goals active',
    });
    expect(result).not.toContain('USER PROFILE');
    expect(result).toContain('INTELLIGENCE CONTEXT');
  });
});
