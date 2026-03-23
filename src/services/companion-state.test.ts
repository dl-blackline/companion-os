// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for lib/realtime/companion-state.js
 *
 * Validates the companion state engine: factory, transitions, snapshots,
 * and convenience helpers.
 */

import {
  createCompanionState,
  transitionState,
  getStateSnapshot,
  isValidTransition,
  allowedTransitions,
  resetToIdle,
} from '@lib/realtime/companion-state.js';

// ─── createCompanionState ───────────────────────────────────────────────────

describe('createCompanionState', () => {
  it('returns an idle state with empty transition history', () => {
    const state = createCompanionState();
    expect(state.state).toBe('idle');
    expect(state.enteredAt).toBeTruthy();
    expect(state.transitions).toEqual([]);
  });

  it('sets a valid ISO-8601 enteredAt timestamp', () => {
    const state = createCompanionState();
    expect(() => new Date(state.enteredAt)).not.toThrow();
    expect(new Date(state.enteredAt).toISOString()).toBe(state.enteredAt);
  });
});

// ─── transitionState ────────────────────────────────────────────────────────

describe('transitionState', () => {
  it('transitions idle → listening', () => {
    const state = createCompanionState();
    const next = transitionState(state, 'listening', 'user_input');
    expect(next.state).toBe('listening');
    expect(next.transitions).toHaveLength(1);
    expect(next.transitions[0].from).toBe('idle');
    expect(next.transitions[0].to).toBe('listening');
    expect(next.transitions[0].reason).toBe('user_input');
  });

  it('transitions listening → thinking', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening', 'input');
    state = transitionState(state, 'thinking', 'processing');
    expect(state.state).toBe('thinking');
    expect(state.transitions).toHaveLength(2);
  });

  it('transitions thinking → responding', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    state = transitionState(state, 'responding', 'stream_start');
    expect(state.state).toBe('responding');
    expect(state.transitions).toHaveLength(3);
  });

  it('transitions responding → idle', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    state = transitionState(state, 'responding');
    state = transitionState(state, 'idle', 'stream_complete');
    expect(state.state).toBe('idle');
    expect(state.transitions).toHaveLength(4);
  });

  it('throws on invalid transition idle → thinking', () => {
    const state = createCompanionState();
    expect(() => transitionState(state, 'thinking')).toThrow('Invalid companion state transition');
  });

  it('throws on invalid transition idle → responding', () => {
    const state = createCompanionState();
    expect(() => transitionState(state, 'responding')).toThrow('Invalid companion state transition');
  });

  it('throws when current is null', () => {
    expect(() => transitionState(null, 'listening')).toThrow('Missing required parameters');
  });

  it('throws when nextState is null', () => {
    const state = createCompanionState();
    expect(() => transitionState(state, null)).toThrow('Missing required parameters');
  });

  it('preserves transition history across multiple transitions', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening', 'r1');
    state = transitionState(state, 'thinking', 'r2');
    state = transitionState(state, 'responding', 'r3');
    state = transitionState(state, 'idle', 'r4');
    expect(state.transitions).toHaveLength(4);
    expect(state.transitions.map((t) => t.to)).toEqual(['listening', 'thinking', 'responding', 'idle']);
    expect(state.transitions.map((t) => t.reason)).toEqual(['r1', 'r2', 'r3', 'r4']);
  });

  it('allows listening → idle (interrupt)', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'idle', 'cancelled');
    expect(state.state).toBe('idle');
  });

  it('allows thinking → idle (interrupt)', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    state = transitionState(state, 'idle', 'interrupted');
    expect(state.state).toBe('idle');
  });
});

// ─── getStateSnapshot ───────────────────────────────────────────────────────

describe('getStateSnapshot', () => {
  it('returns a snapshot with state, enteredAt, durationMs, and interruptible', () => {
    const state = createCompanionState();
    const snap = getStateSnapshot(state);
    expect(snap.state).toBe('idle');
    expect(snap.enteredAt).toBe(state.enteredAt);
    expect(typeof snap.durationMs).toBe('number');
    expect(snap.durationMs).toBeGreaterThanOrEqual(0);
    expect(snap.interruptible).toBe(false);
  });

  it('marks thinking as interruptible', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    const snap = getStateSnapshot(state);
    expect(snap.interruptible).toBe(true);
  });

  it('marks responding as interruptible', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    state = transitionState(state, 'responding');
    const snap = getStateSnapshot(state);
    expect(snap.interruptible).toBe(true);
  });

  it('includes optional subState', () => {
    const state = createCompanionState();
    const snap = getStateSnapshot(state, 'loading_context');
    expect(snap.subState).toBe('loading_context');
  });

  it('omits subState when not provided', () => {
    const state = createCompanionState();
    const snap = getStateSnapshot(state);
    expect(snap.subState).toBeUndefined();
  });
});

// ─── isValidTransition ──────────────────────────────────────────────────────

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
    expect(isValidTransition('responding', 'thinking')).toBe(false);
  });

  it('returns false for unknown states', () => {
    expect(isValidTransition('unknown', 'idle')).toBe(false);
  });
});

// ─── allowedTransitions ─────────────────────────────────────────────────────

describe('allowedTransitions', () => {
  it('returns allowed next states for each state', () => {
    expect(allowedTransitions('idle')).toEqual(['listening']);
    expect(allowedTransitions('listening')).toEqual(['thinking', 'idle']);
    expect(allowedTransitions('thinking')).toEqual(['responding', 'idle']);
    expect(allowedTransitions('responding')).toEqual(['idle', 'listening']);
  });

  it('returns empty array for unknown state', () => {
    expect(allowedTransitions('unknown')).toEqual([]);
  });
});

// ─── resetToIdle ────────────────────────────────────────────────────────────

describe('resetToIdle', () => {
  it('resets to idle from any state', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    const reset = resetToIdle(state);
    expect(reset.state).toBe('idle');
  });

  it('records force_reset in transition history', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    const reset = resetToIdle(state);
    const last = reset.transitions[reset.transitions.length - 1];
    expect(last.from).toBe('listening');
    expect(last.to).toBe('idle');
    expect(last.reason).toBe('force_reset');
  });

  it('preserves prior transitions', () => {
    let state = createCompanionState();
    state = transitionState(state, 'listening');
    state = transitionState(state, 'thinking');
    const reset = resetToIdle(state);
    expect(reset.transitions).toHaveLength(3);
  });
});
