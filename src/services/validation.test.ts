// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/validation.js
 *
 * Validates the domain-specific validation utilities.
 */

import {
  isValidAIMode,
  isValidMediaType,
  clampPage,
  clampLimit,
  // Re-exports from _security.js — quick smoke tests
  isUUID,
  sanitize,
} from '@lib/validation.js';

// ─── isValidAIMode ──────────────────────────────────────────────────────────

describe('isValidAIMode', () => {
  it('accepts supported AI modes', () => {
    expect(isValidAIMode('chat')).toBe(true);
    expect(isValidAIMode('roleplay')).toBe(true);
    expect(isValidAIMode('planning')).toBe(true);
    expect(isValidAIMode('research')).toBe(true);
  });

  it('rejects unsupported modes', () => {
    expect(isValidAIMode('unknown')).toBe(false);
    expect(isValidAIMode('')).toBe(false);
    expect(isValidAIMode('CHAT')).toBe(false);
  });
});

// ─── isValidMediaType ───────────────────────────────────────────────────────

describe('isValidMediaType', () => {
  it('accepts supported media types', () => {
    expect(isValidMediaType('image')).toBe(true);
    expect(isValidMediaType('video')).toBe(true);
    expect(isValidMediaType('music')).toBe(true);
    expect(isValidMediaType('voice')).toBe(true);
  });

  it('rejects unsupported types', () => {
    expect(isValidMediaType('audio')).toBe(false);
    expect(isValidMediaType('')).toBe(false);
  });
});

// ─── clampPage ──────────────────────────────────────────────────────────────

describe('clampPage', () => {
  it('returns fallback for invalid values', () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage('abc')).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-1)).toBe(1);
  });

  it('clamps to max', () => {
    expect(clampPage(200, 100)).toBe(100);
  });

  it('passes through valid values', () => {
    expect(clampPage(5)).toBe(5);
    expect(clampPage('10')).toBe(10);
  });
});

// ─── clampLimit ─────────────────────────────────────────────────────────────

describe('clampLimit', () => {
  it('returns fallback for invalid values', () => {
    expect(clampLimit(undefined)).toBe(50);
    expect(clampLimit('abc')).toBe(50);
    expect(clampLimit(0)).toBe(50);
  });

  it('clamps to max', () => {
    expect(clampLimit(200, 100)).toBe(100);
  });

  it('passes through valid values', () => {
    expect(clampLimit(25)).toBe(25);
    expect(clampLimit('30')).toBe(30);
  });
});

// ─── Re-exports smoke tests ─────────────────────────────────────────────────

describe('re-exports from _security.js', () => {
  it('isUUID is available', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('sanitize is available', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
});
