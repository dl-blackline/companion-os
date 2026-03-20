import { describe, it, expect } from 'vitest';

import {
  intentClassification,
  plannerAgent,
  criticAgent,
  memoryClassification,
  conversationSummary,
  roleplaySession,
  dailyPlan,
  researchTask,
  contextAwareChat,
  liveTalkSystem,
  liveTalkIntentClassification,
  liveTalkRoleplay,
  liveTalkTask,
  liveTalkMediaAck,
  getTemplate,
  listTemplates,
  templates,
} from '@lib/prompt-templates.js';

// ─── intentClassification ───────────────────────────────────────────────────

describe('intentClassification', () => {
  it('returns a { system, user } prompt pair', () => {
    const result = intentClassification({ message: 'hello' });
    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
    expect(typeof result.system).toBe('string');
    expect(result.user).toBe('hello');
  });

  it('includes supported intent names in the system prompt', () => {
    const result = intentClassification({ message: 'test' });
    expect(result.system).toContain('chat');
    expect(result.system).toContain('roleplay');
    expect(result.system).toContain('planning');
    expect(result.system).toContain('research');
    expect(result.system).toContain('media_generation');
  });

  it('instructs JSON-only response format', () => {
    const result = intentClassification({ message: 'test' });
    expect(result.system).toContain('valid JSON only');
  });
});

// ─── plannerAgent ───────────────────────────────────────────────────────────

describe('plannerAgent', () => {
  it('includes tool descriptions and context in the prompt', () => {
    const result = plannerAgent({
      message: 'plan my day',
      intent: { intent: 'planning', confidence: 0.9 },
      toolDescriptions: '- memory_search: Search memories\n- web_search: Search web',
      contextSummary: 'User: Alex, Domain: productivity',
    });
    expect(result.system).toContain('memory_search');
    expect(result.system).toContain('web_search');
    expect(result.user).toContain('planning');
    expect(result.user).toContain('plan my day');
    expect(result.user).toContain('Alex');
  });

  it('returns JSON-only instruction', () => {
    const result = plannerAgent({
      message: 'test',
      intent: { intent: 'chat', confidence: 1.0 },
      toolDescriptions: '',
      contextSummary: '',
    });
    expect(result.system).toContain('valid JSON only');
  });
});

// ─── criticAgent ────────────────────────────────────────────────────────────

describe('criticAgent', () => {
  it('includes message, response, and intent in the prompt', () => {
    const result = criticAgent({
      message: 'what is AI?',
      response: 'AI is artificial intelligence.',
      intent: { intent: 'chat' },
    });
    expect(result.user).toContain('what is AI?');
    expect(result.user).toContain('AI is artificial intelligence.');
    expect(result.user).toContain('chat');
  });

  it('instructs to return only the final response text', () => {
    const result = criticAgent({
      message: 'test',
      response: 'response',
      intent: { intent: 'chat' },
    });
    expect(result.system).toContain('ONLY the final response text');
  });
});

// ─── memoryClassification ───────────────────────────────────────────────────

describe('memoryClassification', () => {
  it('includes message and conversation history', () => {
    const result = memoryClassification({
      message: 'I just got promoted',
      conversationHistory: '[user]: I had a great day\n[assistant]: Tell me more!',
    });
    expect(result.user).toContain('I just got promoted');
    expect(result.user).toContain('I had a great day');
  });

  it('handles missing conversation history', () => {
    const result = memoryClassification({
      message: 'hello',
      conversationHistory: '',
    });
    expect(result.user).toContain('hello');
    expect(result.user).toContain('No prior context.');
  });

  it('requests key_facts in the JSON schema', () => {
    const result = memoryClassification({ message: 'test', conversationHistory: '' });
    expect(result.system).toContain('key_facts');
  });
});

// ─── conversationSummary ────────────────────────────────────────────────────

describe('conversationSummary', () => {
  it('passes conversation history as the user prompt', () => {
    const history = '[user]: hi\n[assistant]: hello!';
    const result = conversationSummary({ conversationHistory: history });
    expect(result.user).toBe(history);
    expect(result.system).toContain('summarizer');
  });
});

// ─── roleplaySession ───────────────────────────────────────────────────────

describe('roleplaySession', () => {
  it('includes character, scenario, context, and message', () => {
    const result = roleplaySession({
      character: 'Sherlock Holmes',
      scenario: 'Victorian London mystery',
      contextBlock: 'USER PROFILE\nName: Alex',
      message: 'What do you deduce?',
    });
    expect(result.system).toContain('Sherlock Holmes');
    expect(result.system).toContain('Victorian London mystery');
    expect(result.system).toContain('Alex');
    expect(result.user).toBe('What do you deduce?');
  });
});

// ─── dailyPlan ──────────────────────────────────────────────────────────────

describe('dailyPlan', () => {
  it('includes context block and message', () => {
    const result = dailyPlan({
      contextBlock: 'COMPANION CONTEXT\nGoals: run 5K',
      message: 'Plan my morning',
    });
    expect(result.system).toContain('run 5K');
    expect(result.system).toContain('productivity');
    expect(result.user).toBe('Plan my morning');
  });
});

// ─── researchTask ───────────────────────────────────────────────────────────

describe('researchTask', () => {
  it('augments message with tool context when provided', () => {
    const result = researchTask({
      contextBlock: 'USER PROFILE\nName: Alex',
      message: 'Tell me about quantum computing',
      toolContext: '[web_search]: Latest quantum breakthroughs...',
    });
    expect(result.user).toContain('quantum computing');
    expect(result.user).toContain('[Research data]');
    expect(result.user).toContain('quantum breakthroughs');
  });

  it('does not add research data section when toolContext is empty', () => {
    const result = researchTask({
      contextBlock: '',
      message: 'Tell me about AI',
      toolContext: '',
    });
    expect(result.user).toBe('Tell me about AI');
  });
});

// ─── contextAwareChat ───────────────────────────────────────────────────────

describe('contextAwareChat', () => {
  it('passes system prompt through and augments message with tool context', () => {
    const result = contextAwareChat({
      systemPrompt: 'You are a helpful assistant.',
      message: 'Hello there',
      toolContext: '[memory_search]: Found 3 memories',
    });
    expect(result.system).toBe('You are a helpful assistant.');
    expect(result.user).toContain('Hello there');
    expect(result.user).toContain('[Tool context]');
    expect(result.user).toContain('Found 3 memories');
  });

  it('does not add tool context section when not provided', () => {
    const result = contextAwareChat({
      systemPrompt: 'System.',
      message: 'Hi',
      toolContext: undefined,
    });
    expect(result.user).toBe('Hi');
  });
});

// ─── getTemplate / listTemplates ────────────────────────────────────────────

describe('template registry', () => {
  it('getTemplate returns the function for a known template', () => {
    const fn = getTemplate('intentClassification');
    expect(fn).toBe(intentClassification);
  });

  it('getTemplate returns undefined for unknown template', () => {
    expect(getTemplate('nonexistent')).toBeUndefined();
  });

  it('listTemplates returns all template names', () => {
    const names = listTemplates();
    expect(names).toContain('intentClassification');
    expect(names).toContain('plannerAgent');
    expect(names).toContain('criticAgent');
    expect(names).toContain('memoryClassification');
    expect(names).toContain('conversationSummary');
    expect(names).toContain('roleplaySession');
    expect(names).toContain('dailyPlan');
    expect(names).toContain('researchTask');
    expect(names).toContain('contextAwareChat');
    expect(names).toContain('liveTalkSystem');
    expect(names).toContain('liveTalkIntentClassification');
    expect(names).toContain('liveTalkRoleplay');
    expect(names).toContain('liveTalkTask');
    expect(names).toContain('liveTalkMediaAck');
    expect(names).toHaveLength(Object.keys(templates).length);
  });
});

// ─── liveTalkSystem ─────────────────────────────────────────────────────────

describe('liveTalkSystem', () => {
  it('returns a system prompt string with the AI name', () => {
    const result = liveTalkSystem({ aiName: 'Aria', mode: 'neutral' });
    expect(typeof result).toBe('string');
    expect(result).toContain('Aria');
  });

  it('appends mode-specific instructions for known modes', () => {
    expect(liveTalkSystem({ aiName: 'AI', mode: 'strategist' })).toContain('strategic');
    expect(liveTalkSystem({ aiName: 'AI', mode: 'coach' })).toContain('encouraging');
  });

  it('uses defaults when params are omitted', () => {
    const result = liveTalkSystem({});
    expect(result).toContain('Companion');
  });
});

// ─── liveTalkIntentClassification ───────────────────────────────────────────

describe('liveTalkIntentClassification', () => {
  it('returns { system, user } prompt pair', () => {
    const result = liveTalkIntentClassification({
      message: 'draw me a sunset',
      historyContext: 'User: hello',
    });
    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
    expect(result.system).toContain('intent classifier');
    expect(result.user).toContain('draw me a sunset');
  });
});

// ─── liveTalkRoleplay ───────────────────────────────────────────────────────

describe('liveTalkRoleplay', () => {
  it('includes character, scenario, and message', () => {
    const result = liveTalkRoleplay({
      character: 'Sherlock',
      scenario: 'solving a mystery',
      historyContext: 'User: Hi',
      message: 'What do you see?',
    });
    expect(result.system).toContain('Sherlock');
    expect(result.system).toContain('solving a mystery');
    expect(result.user).toContain('What do you see?');
  });
});

// ─── liveTalkTask ───────────────────────────────────────────────────────────

describe('liveTalkTask', () => {
  it('includes task type and description', () => {
    const result = liveTalkTask({
      aiName: 'Genie',
      taskType: 'summary',
      taskDescription: 'Summarize the meeting',
    });
    expect(result.system).toContain('Genie');
    expect(result.user).toContain('summary');
    expect(result.user).toContain('Summarize the meeting');
  });
});

// ─── liveTalkMediaAck ───────────────────────────────────────────────────────

describe('liveTalkMediaAck', () => {
  it('acknowledges image generation', () => {
    const result = liveTalkMediaAck({
      aiName: 'Aria',
      mediaType: 'image',
      prompt: 'a sunset over the ocean',
    });
    expect(result.system).toContain('Aria');
    expect(result.system).toContain('image');
    expect(result.user).toContain('sunset over the ocean');
  });

  it('acknowledges video generation', () => {
    const result = liveTalkMediaAck({
      aiName: 'AI',
      mediaType: 'video',
      prompt: 'dancing cat',
    });
    expect(result.system).toContain('video');
    expect(result.user).toContain('a video');
  });
});
