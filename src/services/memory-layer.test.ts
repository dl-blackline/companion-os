// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/memory-layer.js
 *
 * We test the pure exported function signatures and contract of the new
 * convenience wrappers (saveInteraction, getRecentContext, summarizeMemory).
 * These functions depend on Supabase and AI calls so we only verify they are
 * exported and have the expected function signatures.
 */

import {
  storeShortTerm,
  getShortTerm,
  storeLongTerm,
  searchLongTerm,
  searchAll,
  ingest,
  saveInteraction,
  getRecentContext,
  summarizeMemory,
  classifyMemory,
  storeEpisodicMemory,
  storeRelationshipMemory,
  storeMemorySummary,
  searchEpisodicMemory,
  searchRelationshipMemory,
  searchMemorySummaries,
  getUserProfile,
  processMemory,
} from '@lib/memory-layer.js';

// ─── Export verification ────────────────────────────────────────────────────

describe('memory-layer exports', () => {
  it('exports storeShortTerm as a function', () => {
    expect(typeof storeShortTerm).toBe('function');
  });

  it('exports getShortTerm as a function', () => {
    expect(typeof getShortTerm).toBe('function');
  });

  it('exports storeLongTerm as a function', () => {
    expect(typeof storeLongTerm).toBe('function');
  });

  it('exports searchLongTerm as a function', () => {
    expect(typeof searchLongTerm).toBe('function');
  });

  it('exports searchAll as a function', () => {
    expect(typeof searchAll).toBe('function');
  });

  it('exports ingest as a function', () => {
    expect(typeof ingest).toBe('function');
  });

  it('exports saveInteraction as a function', () => {
    expect(typeof saveInteraction).toBe('function');
  });

  it('exports getRecentContext as a function', () => {
    expect(typeof getRecentContext).toBe('function');
  });

  it('exports summarizeMemory as a function', () => {
    expect(typeof summarizeMemory).toBe('function');
  });

  // Backward-compatibility re-exports
  it('re-exports memory-manager functions', () => {
    expect(typeof classifyMemory).toBe('function');
    expect(typeof storeEpisodicMemory).toBe('function');
    expect(typeof storeRelationshipMemory).toBe('function');
    expect(typeof storeMemorySummary).toBe('function');
    expect(typeof searchEpisodicMemory).toBe('function');
    expect(typeof searchRelationshipMemory).toBe('function');
    expect(typeof searchMemorySummaries).toBe('function');
    expect(typeof getUserProfile).toBe('function');
    expect(typeof processMemory).toBe('function');
  });
});
