// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/realtime/avatar-controller.js
 *
 * Validates avatar state factory, transitions, lip-sync frame generation,
 * expression control, and the companion → avatar state mapping.
 */

import {
  createAvatarState,
  avatarStateFromCompanion,
  transitionAvatar,
  generateLipSyncFrames,
  applyLipSync,
  setExpression,
  isValidAvatarTransition,
  resetAvatar,
} from '@lib/realtime/avatar-controller.js';

// ─── createAvatarState ──────────────────────────────────────────────────────

describe('createAvatarState', () => {
  it('returns idle state with default properties', () => {
    const state = createAvatarState();
    expect(state.state).toBe('idle');
    expect(state.transitionState).toBe('idle');
    expect(state.expression).toBe('neutral');
    expect(state.lipSyncFrames).toEqual([]);
    expect(state.idleIntensity).toBe(0.5);
  });
});

// ─── avatarStateFromCompanion ───────────────────────────────────────────────

describe('avatarStateFromCompanion', () => {
  it('maps idle → idle', () => {
    expect(avatarStateFromCompanion('idle')).toBe('idle');
  });

  it('maps listening → listening', () => {
    expect(avatarStateFromCompanion('listening')).toBe('listening');
  });

  it('maps thinking → thinking', () => {
    expect(avatarStateFromCompanion('thinking')).toBe('thinking');
  });

  it('maps responding → speaking', () => {
    expect(avatarStateFromCompanion('responding')).toBe('speaking');
  });

  it('falls back to idle for unknown companion states', () => {
    expect(avatarStateFromCompanion('unknown')).toBe('idle');
  });
});

// ─── transitionAvatar ───────────────────────────────────────────────────────

describe('transitionAvatar', () => {
  it('transitions idle → listening with correct properties', () => {
    const state = createAvatarState();
    const next = transitionAvatar(state, 'listening');
    expect(next.state).toBe('listening');
    expect(next.transitionState).toBe('idle-to-listening');
    expect(next.expression).toBe('curious');
    expect(next.idleIntensity).toBe(0.8);
  });

  it('transitions listening → thinking', () => {
    let state = createAvatarState();
    state = transitionAvatar(state, 'listening');
    state = transitionAvatar(state, 'thinking');
    expect(state.state).toBe('thinking');
    expect(state.transitionState).toBe('listening-to-thinking');
    expect(state.expression).toBe('thinking');
  });

  it('transitions thinking → speaking', () => {
    let state = createAvatarState();
    state = transitionAvatar(state, 'listening');
    state = transitionAvatar(state, 'thinking');
    state = transitionAvatar(state, 'speaking');
    expect(state.state).toBe('speaking');
    expect(state.transitionState).toBe('thinking-to-speaking');
  });

  it('transitions speaking → idle', () => {
    let state = createAvatarState();
    state = transitionAvatar(state, 'listening');
    state = transitionAvatar(state, 'thinking');
    state = transitionAvatar(state, 'speaking');
    state = transitionAvatar(state, 'idle');
    expect(state.state).toBe('idle');
    expect(state.idleIntensity).toBe(0.5);
  });

  it('throws on invalid transition idle → speaking', () => {
    const state = createAvatarState();
    expect(() => transitionAvatar(state, 'speaking')).toThrow('Invalid avatar transition');
  });

  it('allows forced invalid transitions', () => {
    const state = createAvatarState();
    const next = transitionAvatar(state, 'speaking', { force: true });
    expect(next.state).toBe('speaking');
  });

  it('uses custom expression when provided', () => {
    const state = createAvatarState();
    const next = transitionAvatar(state, 'listening', { expression: 'excited' });
    expect(next.expression).toBe('excited');
  });

  it('clears lipSyncFrames when transitioning away from speaking', () => {
    let state = createAvatarState();
    state = transitionAvatar(state, 'listening');
    state = transitionAvatar(state, 'thinking');
    state = transitionAvatar(state, 'speaking');
    state = applyLipSync(state, [{ timeMs: 0, mouthOpen: 0.5 }]);
    expect(state.lipSyncFrames).toHaveLength(1);
    state = transitionAvatar(state, 'idle');
    expect(state.lipSyncFrames).toEqual([]);
  });

  it('throws when current is null', () => {
    expect(() => transitionAvatar(null, 'listening')).toThrow('Missing required parameters');
  });

  it('throws when nextState is null', () => {
    const state = createAvatarState();
    expect(() => transitionAvatar(state, null)).toThrow('Missing required parameters');
  });
});

// ─── generateLipSyncFrames ──────────────────────────────────────────────────

describe('generateLipSyncFrames', () => {
  it('generates frames from text', () => {
    const frames = generateLipSyncFrames('Hello world', 3000);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0]).toHaveProperty('timeMs');
    expect(frames[0]).toHaveProperty('mouthOpen');
    expect(frames[0]).toHaveProperty('viseme');
  });

  it('returns empty array for empty text', () => {
    expect(generateLipSyncFrames('')).toEqual([]);
    expect(generateLipSyncFrames(null)).toEqual([]);
  });

  it('generates frames at ~80ms intervals', () => {
    const frames = generateLipSyncFrames('Hello world test', 1000);
    if (frames.length > 1) {
      const interval = frames[1].timeMs - frames[0].timeMs;
      expect(interval).toBe(80);
    }
  });

  it('uses default duration when not specified', () => {
    const frames = generateLipSyncFrames('Hello');
    expect(frames.length).toBeGreaterThan(0);
  });

  it('assigns vowel viseme AA for vowels', () => {
    const frames = generateLipSyncFrames('aaaa', 500);
    const vowelFrames = frames.filter((f) => f.viseme === 'AA');
    expect(vowelFrames.length).toBeGreaterThan(0);
  });

  it('assigns silence viseme sil for spaces', () => {
    const frames = generateLipSyncFrames('a b', 500);
    const silFrames = frames.filter((f) => f.viseme === 'sil');
    expect(silFrames.length).toBeGreaterThan(0);
  });

  it('keeps mouthOpen values between 0 and 1', () => {
    const frames = generateLipSyncFrames('Hello world, this is a test.', 5000);
    frames.forEach((f) => {
      expect(f.mouthOpen).toBeGreaterThanOrEqual(0);
      expect(f.mouthOpen).toBeLessThanOrEqual(1);
    });
  });
});

// ─── applyLipSync ───────────────────────────────────────────────────────────

describe('applyLipSync', () => {
  it('applies frames to avatar state', () => {
    const state = createAvatarState();
    const frames = [{ timeMs: 0, mouthOpen: 0.5, viseme: 'AA' }];
    const updated = applyLipSync(state, frames);
    expect(updated.lipSyncFrames).toEqual(frames);
    expect(updated.state).toBe('idle');
  });

  it('handles null frames gracefully', () => {
    const state = createAvatarState();
    const updated = applyLipSync(state, null);
    expect(updated.lipSyncFrames).toEqual([]);
  });
});

// ─── setExpression ──────────────────────────────────────────────────────────

describe('setExpression', () => {
  it('updates expression without changing state', () => {
    const state = createAvatarState();
    const updated = setExpression(state, 'happy');
    expect(updated.expression).toBe('happy');
    expect(updated.state).toBe('idle');
  });

  it('falls back to neutral for falsy expression', () => {
    const state = createAvatarState();
    const updated = setExpression(state, '');
    expect(updated.expression).toBe('neutral');
  });
});

// ─── isValidAvatarTransition ────────────────────────────────────────────────

describe('isValidAvatarTransition', () => {
  it('returns true for valid transitions', () => {
    expect(isValidAvatarTransition('idle', 'listening')).toBe(true);
    expect(isValidAvatarTransition('listening', 'thinking')).toBe(true);
    expect(isValidAvatarTransition('thinking', 'speaking')).toBe(true);
    expect(isValidAvatarTransition('speaking', 'idle')).toBe(true);
  });

  it('returns false for invalid transitions', () => {
    expect(isValidAvatarTransition('idle', 'thinking')).toBe(false);
    expect(isValidAvatarTransition('idle', 'speaking')).toBe(false);
    expect(isValidAvatarTransition('speaking', 'thinking')).toBe(false);
  });

  it('returns false for unknown states', () => {
    expect(isValidAvatarTransition('unknown', 'idle')).toBe(false);
  });
});

// ─── resetAvatar ────────────────────────────────────────────────────────────

describe('resetAvatar', () => {
  it('resets to idle from any state', () => {
    let state = createAvatarState();
    state = transitionAvatar(state, 'listening');
    state = transitionAvatar(state, 'thinking');
    const reset = resetAvatar(state);
    expect(reset.state).toBe('idle');
    expect(reset.expression).toBe('neutral');
    expect(reset.lipSyncFrames).toEqual([]);
    expect(reset.idleIntensity).toBe(0.5);
  });

  it('generates correct transitionState when resetting from non-idle', () => {
    let state = createAvatarState();
    state = transitionAvatar(state, 'listening');
    const reset = resetAvatar(state);
    expect(reset.transitionState).toBe('listening-to-idle');
  });

  it('uses plain idle transitionState when already idle', () => {
    const state = createAvatarState();
    const reset = resetAvatar(state);
    expect(reset.transitionState).toBe('idle');
  });
});
