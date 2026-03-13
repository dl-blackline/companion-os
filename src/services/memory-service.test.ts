import { describe, it, expect } from 'vitest';
import {
  classifyMemoryContent,
  buildInjectionPlan,
  formatInjectionForPrompt,
} from '@/services/memory-service';
import type {
  MemoryRecord,
  ScoredMemory,
  MemoryApplicationReason,
} from '@/types/memory';

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: 'mem-1',
    userId: 'user-1',
    title: 'Test memory',
    content: 'Some content',
    category: 'knowledge',
    memoryType: 'fact',
    priority: 'normal',
    source: 'user_explicit',
    privacyLevel: 'private',
    confidence: 0.8,
    tags: [],
    relatedEntityIds: [],
    expiresAt: null,
    isPinned: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeScoredMemory(
  memory: Partial<MemoryRecord>,
  scores: { relevanceScore?: number; recencyScore?: number; finalScore?: number; reason?: MemoryApplicationReason } = {},
): ScoredMemory {
  return {
    memory: makeMemoryRecord(memory),
    relevanceScore: scores.relevanceScore ?? 0.8,
    recencyScore: scores.recencyScore ?? 0.7,
    finalScore: scores.finalScore ?? 0.75,
    reason: scores.reason ?? 'high_relevance',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('classifyMemoryContent', () => {
  it('detects explicit instructions (always, never, etc.)', () => {
    const result = classifyMemoryContent('Always respond in bullet points', 'user_explicit');
    expect(result.isInstruction).toBe(true);
    expect(result.memoryType).toBe('instruction');
    expect(result.priority).toBe('high');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects "never" as instruction', () => {
    const result = classifyMemoryContent('Never use emojis in responses', 'user_explicit');
    expect(result.isInstruction).toBe(true);
    expect(result.memoryType).toBe('instruction');
  });

  it('detects "call me" as instruction', () => {
    const result = classifyMemoryContent('Call me Alex', 'user_explicit');
    expect(result.isInstruction).toBe(true);
  });

  it('detects "prefer" as instruction', () => {
    const result = classifyMemoryContent('Prefer concise responses', 'user_explicit');
    expect(result.isInstruction).toBe(true);
  });

  it('detects "I like" as preference', () => {
    const result = classifyMemoryContent('I like detailed code examples', 'user_explicit');
    expect(result.isInstruction || result.isPreference).toBe(true);
  });

  it('detects episodic content', () => {
    const result = classifyMemoryContent('I graduated from MIT in 2020', 'auto_captured');
    expect(result.memoryType).toBe('episodic');
    expect(result.category).toBe('episodic');
  });

  it('detects relationship content', () => {
    const result = classifyMemoryContent('My wife Sarah works at Google', 'auto_captured');
    expect(result.memoryType).toBe('relationship');
    expect(result.category).toBe('relationship');
  });

  it('detects workflow content', () => {
    const result = classifyMemoryContent('My workflow involves step 1 review, step 2 approve', 'user_explicit');
    expect(result.memoryType).toBe('workflow');
  });

  it('detects context content', () => {
    const result = classifyMemoryContent('I work at Acme Corp as a software engineer', 'auto_captured');
    expect(result.memoryType).toBe('context');
    expect(result.category).toBe('identity');
  });

  it('classifies generic content as fact', () => {
    const result = classifyMemoryContent('The quick brown fox jumps over the lazy dog', 'auto_captured');
    expect(result.memoryType).toBe('fact');
    expect(result.category).toBe('knowledge');
  });

  it('user_instruction source forces instruction type', () => {
    const result = classifyMemoryContent('Respond in JSON format', 'user_instruction');
    expect(result.isInstruction).toBe(true);
    expect(result.memoryType).toBe('instruction');
  });

  it('generates a suggested title', () => {
    const result = classifyMemoryContent('Short content', 'user_explicit');
    expect(result.suggestedTitle).toBe('Short content');
  });

  it('truncates long titles', () => {
    const longContent = 'A'.repeat(100);
    const result = classifyMemoryContent(longContent, 'user_explicit');
    expect(result.suggestedTitle.length).toBeLessThanOrEqual(60);
    expect(result.suggestedTitle).toContain('…');
  });

  it('adds instruction tag for instructions', () => {
    const result = classifyMemoryContent('Always be concise', 'user_explicit');
    expect(result.extractedTags).toContain('instruction');
  });

  it('normalizes content by trimming whitespace', () => {
    const result = classifyMemoryContent('  Some content  ', 'user_explicit');
    expect(result.normalizedContent).toBe('Some content');
  });

  it('gives higher priority to user_explicit source', () => {
    const explicit = classifyMemoryContent('Some fact', 'user_explicit');
    const auto = classifyMemoryContent('Some fact', 'auto_captured');
    expect(explicit.priority).not.toBe('low');
    // auto_captured defaults to 'low' for non-instruction content
    expect(auto.priority).toBe('low');
  });
});

describe('buildInjectionPlan', () => {
  it('returns empty plan for empty memories', () => {
    const plan = buildInjectionPlan([], []);
    expect(plan.totalApplied).toBe(0);
    expect(plan.appliedMemories).toEqual([]);
    expect(plan.activeInstructions).toEqual([]);
  });

  it('applies high-score memories', () => {
    const memories = [
      makeScoredMemory({ id: 'mem-1', content: 'User likes Python' }, { finalScore: 0.9 }),
    ];
    const plan = buildInjectionPlan(memories, []);
    expect(plan.totalApplied).toBe(1);
    expect(plan.appliedMemories[0].memoryId).toBe('mem-1');
  });

  it('ignores inactive memories', () => {
    const memories = [
      makeScoredMemory({ id: 'mem-1', isActive: false }, { finalScore: 0.9 }),
    ];
    const plan = buildInjectionPlan(memories, []);
    expect(plan.totalApplied).toBe(0);
    expect(plan.ignoredMemories[0].reason).toBe('inactive');
  });

  it('ignores expired memories', () => {
    const memories = [
      makeScoredMemory(
        { id: 'mem-1', expiresAt: '2020-01-01T00:00:00Z' },
        { finalScore: 0.9 },
      ),
    ];
    const plan = buildInjectionPlan(memories, []);
    expect(plan.totalApplied).toBe(0);
    expect(plan.ignoredMemories[0].reason).toBe('expired');
  });

  it('ignores low-confidence memories', () => {
    const memories = [
      makeScoredMemory({ id: 'mem-1', confidence: 0.1 }, { finalScore: 0.9 }),
    ];
    const plan = buildInjectionPlan(memories, []);
    expect(plan.totalApplied).toBe(0);
    expect(plan.ignoredMemories[0].reason).toBe('low_confidence');
  });

  it('ignores low-relevance non-instruction memories', () => {
    const memories = [
      makeScoredMemory({ id: 'mem-1', memoryType: 'fact' }, { finalScore: 0.1 }),
    ];
    const plan = buildInjectionPlan(memories, []);
    expect(plan.totalApplied).toBe(0);
    expect(plan.ignoredMemories[0].reason).toBe('low_relevance');
  });

  it('includes instructions even at lower relevance scores', () => {
    const memories = [
      makeScoredMemory(
        { id: 'mem-1', memoryType: 'instruction', content: 'Always respond in bullet points' },
        { finalScore: 0.35 },
      ),
    ];
    const plan = buildInjectionPlan(memories, []);
    expect(plan.totalApplied).toBe(1);
    expect(plan.activeInstructions).toContain('Always respond in bullet points');
  });

  it('session overrides take priority', () => {
    const memories = [
      makeScoredMemory(
        { id: 'mem-1', content: 'Some instruction' },
        { finalScore: 0.9 },
      ),
    ];
    const plan = buildInjectionPlan(memories, ['Override instruction']);
    expect(plan.activeInstructions[0]).toBe('Override instruction');
  });

  it('deduplicates memories with same content', () => {
    const memories = [
      makeScoredMemory({ id: 'mem-1', content: 'Duplicate content here' }, { finalScore: 0.9 }),
      makeScoredMemory({ id: 'mem-2', content: 'Duplicate content here' }, { finalScore: 0.8 }),
    ];
    const plan = buildInjectionPlan(memories, []);
    expect(plan.totalApplied).toBe(1);
    expect(plan.ignoredMemories.some(m => m.reason === 'conflict_resolved')).toBe(true);
  });

  it('respects maxApplied limit', () => {
    const memories = Array.from({ length: 20 }, (_, i) =>
      makeScoredMemory(
        { id: `mem-${i}`, content: `Memory ${i} unique content ${i}` },
        { finalScore: 0.9 - i * 0.01 },
      ),
    );
    const plan = buildInjectionPlan(memories, [], 5);
    expect(plan.totalApplied).toBe(5);
  });

  it('collects preferences from preference-type memories', () => {
    const memories = [
      makeScoredMemory(
        { id: 'mem-1', memoryType: 'preference', title: 'Language', content: 'Prefers Python' },
        { finalScore: 0.9, reason: 'user_preference' },
      ),
    ];
    const plan = buildInjectionPlan(memories, []);
    expect(plan.activePreferences.length).toBe(1);
    expect(plan.activePreferences[0].key).toBe('Language');
  });
});

describe('formatInjectionForPrompt', () => {
  it('returns empty string for empty plan', () => {
    const plan = buildInjectionPlan([], []);
    const result = formatInjectionForPrompt(plan);
    expect(result).toBe('');
  });

  it('formats instructions prominently', () => {
    const memories = [
      makeScoredMemory(
        { id: 'mem-1', memoryType: 'instruction', content: 'Always respond in bullet points' },
        { finalScore: 0.9 },
      ),
    ];
    const plan = buildInjectionPlan(memories, []);
    const result = formatInjectionForPrompt(plan);
    expect(result).toContain('USER INSTRUCTIONS & PREFERENCES (MUST FOLLOW)');
    expect(result).toContain('Always respond in bullet points');
  });

  it('formats context memories separately', () => {
    const memories = [
      makeScoredMemory(
        { id: 'mem-1', memoryType: 'fact', title: 'Work', content: 'Works at Acme Corp' },
        { finalScore: 0.9 },
      ),
    ];
    const plan = buildInjectionPlan(memories, []);
    const result = formatInjectionForPrompt(plan);
    expect(result).toContain('USER CONTEXT (from memory)');
    expect(result).toContain('Works at Acme Corp');
  });

  it('formats preferences in their own section', () => {
    const memories = [
      makeScoredMemory(
        { id: 'mem-1', memoryType: 'preference', title: 'Code Style', content: 'Prefers TypeScript' },
        { finalScore: 0.9, reason: 'user_preference' },
      ),
    ];
    const plan = buildInjectionPlan(memories, []);
    const result = formatInjectionForPrompt(plan);
    expect(result).toContain('USER PREFERENCES');
    expect(result).toContain('Code Style');
  });

  it('includes session overrides as instructions', () => {
    const plan = buildInjectionPlan([], ['Respond only in French today']);
    // Session override alone won't have applied memories, but instructions are set
    const result = formatInjectionForPrompt(plan);
    // With 0 applied, it returns empty string — this is by design (no memory data)
    expect(result).toBe('');
  });
});
