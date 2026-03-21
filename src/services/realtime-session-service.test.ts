// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/realtime/companion-state.js and lib/realtime/avatar-controller.js
 *
 * These test the pure state machine logic — no external services required.
 */

import {
  createCompanionState,
  transitionState,
  getStateSnapshot,
  isValidTransition,
  allowedTransitions,
  resetToIdle,
} from '@lib/realtime/companion-state.js';

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

import { formatSSE } from '@lib/realtime/stream-handler.js';

import {
  parseSSEResponse,
  companionToAvatarState,
} from '@/services/realtime-session-service';

// ─── SSE Response Parsing ────────────────────────────────────────────────────

describe('parseSSEResponse', () => {
  it('returns empty array for empty input', () => {
    expect(parseSSEResponse('')).toEqual([]);
    expect(parseSSEResponse(null as unknown as string)).toEqual([]);
  });

  it('parses a single SSE event', () => {
    const raw = 'event: token\ndata: {"content":"hello"}\n\n';
    const events = parseSSEResponse(raw);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('token');
    expect(events[0].data.content).toBe('hello');
  });

  it('parses multiple SSE events', () => {
    const raw = [
      'event: state\ndata: {"state":"listening"}',
      'event: token\ndata: {"content":"Hi"}',
      'event: done\ndata: {"fullText":"Hi"}',
    ].join('\n\n') + '\n\n';
    const events = parseSSEResponse(raw);
    expect(events).toHaveLength(3);
    expect(events[0].event).toBe('state');
    expect(events[1].event).toBe('token');
    expect(events[2].event).toBe('done');
  });

  it('skips malformed JSON data', () => {
    const raw = 'event: token\ndata: not-json\n\n';
    const events = parseSSEResponse(raw);
    expect(events).toHaveLength(0);
  });
});

describe('companionToAvatarState', () => {
  it('maps companion states to avatar states', () => {
    expect(companionToAvatarState('idle')).toBe('idle');
    expect(companionToAvatarState('listening')).toBe('listening');
    expect(companionToAvatarState('thinking')).toBe('thinking');
    expect(companionToAvatarState('responding')).toBe('speaking');
  });

  it('defaults to idle for unknown states', () => {
    expect(companionToAvatarState('unknown' as any)).toBe('idle');
  });
});

// ─── Companion State Engine ──────────────────────────────────────────────────

describe('createCompanionState', () => {
  it('returns initial idle state', () => {
    const state = createCompanionState();
    expect(state.state).toBe('idle');
    expect(state.enteredAt).toBeTruthy();
    expect(state.transitions).toEqual([]);
  });
});

describe('transitionState', () => {
  it('transitions idle → listening', () => {
    const state = createCompanionState();
    const next = transitionState(state, 'listening', 'user_spoke');
    expect(next.state).toBe('listening');
    expect(next.transitions).toHaveLength(1);
    expect(next.transitions[0].from).toBe('idle');
    expect(next.transitions[0].to).toBe('listening');
    expect(next.transitions[0].reason).toBe('user_spoke');
  });

  it('transitions listening → thinking', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    expect(state.state).toBe('thinking');
    expect(state.transitions).toHaveLength(2);
  });

  it('transitions thinking → responding', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    state = transitionState(state, 'responding');
    expect(state.state).toBe('responding');
  });

  it('transitions responding → idle (completion)', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    state = transitionState(state, 'responding');
    state = transitionState(state, 'idle', 'stream_complete');
    expect(state.state).toBe('idle');
    expect(state.transitions).toHaveLength(4);
  });

  it('transitions responding → listening (interruption)', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    state = transitionState(state, 'responding');
    state = transitionState(state, 'listening', 'user_interrupted');
    expect(state.state).toBe('listening');
  });

  it('throws on invalid transition idle → thinking', () => {
    const state = createCompanionState();
    expect(() => transitionState(state, 'thinking')).toThrow('Invalid companion state transition');
  });

  it('throws on invalid transition idle → responding', () => {
    const state = createCompanionState();
    expect(() => transitionState(state, 'responding')).toThrow('Invalid companion state transition');
  });

  it('throws on missing parameters', () => {
    expect(() => transitionState(null, 'listening')).toThrow('Missing required parameters');
    expect(() => transitionState(createCompanionState(), null)).toThrow('Missing required parameters');
  });
});

describe('getStateSnapshot', () => {
  it('returns snapshot with duration and interruptible flag', () => {
    const state = createCompanionState();
    const snapshot = getStateSnapshot(state);
    expect(snapshot.state).toBe('idle');
    expect(snapshot.durationMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.interruptible).toBe(false); // idle is not interruptible
  });

  it('marks responding as interruptible', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    state = transitionState(state, 'responding');
    const snapshot = getStateSnapshot(state);
    expect(snapshot.interruptible).toBe(true);
  });

  it('marks thinking as interruptible', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    const snapshot = getStateSnapshot(state, 'assembling_context');
    expect(snapshot.interruptible).toBe(true);
    expect(snapshot.subState).toBe('assembling_context');
  });

  it('includes subState when provided', () => {
    const state = createCompanionState();
    const snapshot = getStateSnapshot(state, 'searching_memories');
    expect(snapshot.subState).toBe('searching_memories');
  });
});

describe('isValidTransition', () => {
  it('returns true for valid transitions', () => {
    expect(isValidTransition('idle', 'listening')).toBe(true);
    expect(isValidTransition('listening', 'thinking')).toBe(true);
    expect(isValidTransition('thinking', 'responding')).toBe(true);
    expect(isValidTransition('responding', 'idle')).toBe(true);
  });

  it('returns false for invalid transitions', () => {
    expect(isValidTransition('idle', 'thinking')).toBe(false);
    expect(isValidTransition('idle', 'responding')).toBe(false);
    expect(isValidTransition('listening', 'responding')).toBe(false);
  });

  it('returns false for unknown states', () => {
    expect(isValidTransition('unknown', 'idle')).toBe(false);
  });
});

describe('allowedTransitions', () => {
  it('returns allowed transitions for each state', () => {
    expect(allowedTransitions('idle')).toEqual(['listening']);
    expect(allowedTransitions('listening')).toEqual(['thinking', 'idle']);
    expect(allowedTransitions('thinking')).toEqual(['responding', 'idle']);
    expect(allowedTransitions('responding')).toEqual(['idle', 'listening']);
  });

  it('returns empty array for unknown states', () => {
    expect(allowedTransitions('unknown')).toEqual([]);
  });
});

describe('resetToIdle', () => {
  it('force resets any state to idle', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    const reset = resetToIdle(state);
    expect(reset.state).toBe('idle');
    expect(reset.transitions.at(-1).reason).toBe('force_reset');
  });
});

// ─── Avatar Controller ───────────────────────────────────────────────────────

describe('createAvatarState', () => {
  it('returns initial idle avatar state', () => {
    const state = createAvatarState();
    expect(state.state).toBe('idle');
    expect(state.transitionState).toBe('idle');
    expect(state.expression).toBe('neutral');
    expect(state.lipSyncFrames).toEqual([]);
    expect(state.idleIntensity).toBe(0.5);
  });
});

describe('avatarStateFromCompanion', () => {
  it('maps companion states to avatar states', () => {
    expect(avatarStateFromCompanion('idle')).toBe('idle');
    expect(avatarStateFromCompanion('listening')).toBe('listening');
    expect(avatarStateFromCompanion('thinking')).toBe('thinking');
    expect(avatarStateFromCompanion('responding')).toBe('speaking');
  });

  it('falls back to idle for unknown states', () => {
    expect(avatarStateFromCompanion('unknown')).toBe('idle');
  });
});

describe('transitionAvatar', () => {
  it('transitions idle → listening', () => {
    const state = createAvatarState();
    const next = transitionAvatar(state, 'listening');
    expect(next.state).toBe('listening');
    expect(next.transitionState).toBe('idle-to-listening');
    expect(next.expression).toBe('curious');
  });

  it('transitions thinking → speaking with thinking expression', () => {
    let state = createAvatarState();
    state = transitionAvatar(state, 'listening');
    state = transitionAvatar(state, 'thinking');
    expect(state.expression).toBe('thinking');
    state = transitionAvatar(state, 'speaking');
    expect(state.state).toBe('speaking');
  });

  it('throws on invalid transition', () => {
    const state = createAvatarState();
    expect(() => transitionAvatar(state, 'speaking')).toThrow('Invalid avatar transition');
  });

  it('allows force transition', () => {
    const state = createAvatarState();
    const next = transitionAvatar(state, 'speaking', { force: true });
    expect(next.state).toBe('speaking');
  });

  it('allows custom expression override', () => {
    const state = createAvatarState();
    const next = transitionAvatar(state, 'listening', { expression: 'excited' });
    expect(next.expression).toBe('excited');
  });

  it('throws on missing parameters', () => {
    expect(() => transitionAvatar(null, 'listening')).toThrow('Missing required parameters');
  });

  it('clears lip sync when leaving speaking state', () => {
    let state = createAvatarState();
    state = transitionAvatar(state, 'listening');
    state = transitionAvatar(state, 'thinking');
    state = transitionAvatar(state, 'speaking');
    state = { ...state, lipSyncFrames: [{ timeMs: 0, mouthOpen: 0.5 }] };
    state = transitionAvatar(state, 'idle', { force: true });
    expect(state.lipSyncFrames).toEqual([]);
  });

  it('adjusts idleIntensity based on state', () => {
    let state = createAvatarState();
    expect(state.idleIntensity).toBe(0.5); // idle
    state = transitionAvatar(state, 'listening');
    expect(state.idleIntensity).toBe(0.8); // listening = high
    state = transitionAvatar(state, 'thinking');
    expect(state.idleIntensity).toBe(0.3); // thinking = low
  });
});

describe('generateLipSyncFrames', () => {
  it('returns empty array for empty text', () => {
    expect(generateLipSyncFrames('')).toEqual([]);
    expect(generateLipSyncFrames(null)).toEqual([]);
  });

  it('generates frames for text', () => {
    const frames = generateLipSyncFrames('Hello world', 1000);
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f) => {
      expect(f.timeMs).toBeGreaterThanOrEqual(0);
      expect(f.mouthOpen).toBeGreaterThanOrEqual(0);
      expect(f.mouthOpen).toBeLessThanOrEqual(1);
    });
  });

  it('uses default duration when not specified', () => {
    const frames = generateLipSyncFrames('Test');
    expect(frames.length).toBeGreaterThan(0);
  });

  it('includes viseme data', () => {
    const frames = generateLipSyncFrames('Hello world', 2000);
    const withViseme = frames.filter((f) => f.viseme);
    expect(withViseme.length).toBeGreaterThan(0);
  });
});

describe('applyLipSync', () => {
  it('applies lip sync frames to avatar state', () => {
    const state = createAvatarState();
    const frames = [{ timeMs: 0, mouthOpen: 0.5, viseme: 'AA' }];
    const updated = applyLipSync(state, frames);
    expect(updated.lipSyncFrames).toEqual(frames);
    expect(updated.state).toBe('idle'); // state unchanged
  });

  it('handles null frames', () => {
    const state = createAvatarState();
    const updated = applyLipSync(state, null);
    expect(updated.lipSyncFrames).toEqual([]);
  });
});

describe('setExpression', () => {
  it('updates expression without changing state', () => {
    const state = createAvatarState();
    const updated = setExpression(state, 'happy');
    expect(updated.expression).toBe('happy');
    expect(updated.state).toBe('idle'); // unchanged
  });

  it('defaults to neutral for falsy input', () => {
    const state = createAvatarState();
    const updated = setExpression(state, '');
    expect(updated.expression).toBe('neutral');
  });
});

describe('isValidAvatarTransition', () => {
  it('returns true for valid transitions', () => {
    expect(isValidAvatarTransition('idle', 'listening')).toBe(true);
    expect(isValidAvatarTransition('speaking', 'idle')).toBe(true);
    expect(isValidAvatarTransition('speaking', 'listening')).toBe(true);
  });

  it('returns false for invalid transitions', () => {
    expect(isValidAvatarTransition('idle', 'speaking')).toBe(false);
    expect(isValidAvatarTransition('idle', 'thinking')).toBe(false);
  });
});

describe('resetAvatar', () => {
  it('resets to idle with transition state', () => {
    let state = createAvatarState();
    state = transitionAvatar(state, 'listening');
    state = transitionAvatar(state, 'thinking');
    const reset = resetAvatar(state);
    expect(reset.state).toBe('idle');
    expect(reset.transitionState).toBe('thinking-to-idle');
    expect(reset.expression).toBe('neutral');
    expect(reset.lipSyncFrames).toEqual([]);
  });

  it('stays at idle transition state when already idle', () => {
    const state = createAvatarState();
    const reset = resetAvatar(state);
    expect(reset.transitionState).toBe('idle');
  });
});

// ─── Stream Handler ──────────────────────────────────────────────────────────

describe('formatSSE', () => {
  it('formats event with JSON data', () => {
    const result = formatSSE('token', { content: 'hello' });
    expect(result).toBe('event: token\ndata: {"content":"hello"}\n\n');
  });

  it('formats complex data objects', () => {
    const data = { state: 'thinking', durationMs: 100 };
    const result = formatSSE('state', data);
    expect(result).toContain('event: state');
    expect(result).toContain('"state":"thinking"');
    expect(result).toContain('"durationMs":100');
    expect(result.endsWith('\n\n')).toBe(true);
  });
});
