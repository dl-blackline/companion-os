/**
 * Contract tests for lib/automotive/state-machine.js
 *
 * Validates: state machine definitions, transition guards, terminal state
 * detection, and that every defined state appears in the transition map.
 */
import { describe, it, expect } from 'vitest';
import {
  DEAL_STATES,
  DEAL_TRANSITIONS,
  DEAL_ACTIVE_STATES,
  DEAL_FUNDED_STATES,
  DEAL_LOST_STATES,
  DOCUMENT_STATES,
  DOCUMENT_TRANSITIONS,
  CALLBACK_STATES,
  CALLBACK_TRANSITIONS,
  CIT_STATES,
  CIT_TRANSITIONS,
  CANCELLATION_STATES,
  CANCELLATION_TRANSITIONS,
  ISSUE_STATES,
  ISSUE_TRANSITIONS,
  canTransition,
  getAvailableTransitions,
  isTerminalState,
  getDealStateLabel,
} from '../../lib/automotive/state-machine.js';

/* ── Data integrity ───────────────────────────────────────────────────── */

describe('state machine data integrity', () => {
  const machines = [
    { name: 'deal', states: DEAL_STATES, transitions: DEAL_TRANSITIONS },
    { name: 'document', states: DOCUMENT_STATES, transitions: DOCUMENT_TRANSITIONS },
    { name: 'callback', states: CALLBACK_STATES, transitions: CALLBACK_TRANSITIONS },
    { name: 'cit', states: CIT_STATES, transitions: CIT_TRANSITIONS },
    { name: 'cancellation', states: CANCELLATION_STATES, transitions: CANCELLATION_TRANSITIONS },
    { name: 'issue', states: ISSUE_STATES, transitions: ISSUE_TRANSITIONS },
  ];

  for (const { name, states, transitions } of machines) {
    it(`${name}: every declared state has a transition entry`, () => {
      for (const value of Object.values(states)) {
        expect(transitions).toHaveProperty(value);
      }
    });

    it(`${name}: every transition target is a valid state`, () => {
      const validStates = new Set(Object.values(states));
      for (const [from, targets] of Object.entries(transitions)) {
        for (const target of targets) {
          expect(validStates.has(target)).toBe(true);
        }
      }
    });

    it(`${name}: at least one terminal state exists`, () => {
      const terminal = Object.entries(transitions).filter(
        ([, targets]) => targets.length === 0,
      );
      expect(terminal.length).toBeGreaterThan(0);
    });
  }
});

/* ── canTransition ────────────────────────────────────────────────────── */

describe('canTransition', () => {
  it('allows valid deal transitions', () => {
    expect(canTransition('deal', 'lead_received', 'intake')).toBe(true);
    expect(canTransition('deal', 'booked', 'funded')).toBe(true);
  });

  it('blocks invalid deal transitions', () => {
    expect(canTransition('deal', 'funded', 'intake')).toBe(false);
    expect(canTransition('deal', 'archived', 'lead_received')).toBe(false);
  });

  it('blocks transitions from terminal states', () => {
    expect(canTransition('deal', 'archived', 'intake')).toBe(false);
    expect(canTransition('document', 'archived', 'uploaded')).toBe(false);
  });

  it('returns false for unknown machine type', () => {
    expect(canTransition('unknown', 'a', 'b')).toBe(false);
  });

  it('returns false for unknown from state', () => {
    expect(canTransition('deal', 'nonexistent', 'intake')).toBe(false);
  });

  it('works for all machine types', () => {
    expect(canTransition('document', 'uploaded', 'classified')).toBe(true);
    expect(canTransition('callback', 'received', 'normalized')).toBe(true);
    expect(canTransition('cit', 'open', 'awaiting_stips')).toBe(true);
    expect(canTransition('cancellation', 'requested', 'pending_docs')).toBe(true);
    expect(canTransition('issue', 'open', 'in_progress')).toBe(true);
  });
});

/* ── getAvailableTransitions ──────────────────────────────────────────── */

describe('getAvailableTransitions', () => {
  it('returns valid targets for deal intake', () => {
    const targets = getAvailableTransitions('deal', 'intake');
    expect(targets).toContain('docs_pending');
    expect(targets).toContain('archived');
  });

  it('returns empty array for terminal states', () => {
    expect(getAvailableTransitions('deal', 'archived')).toEqual([]);
  });

  it('returns empty array for unknown machine', () => {
    expect(getAvailableTransitions('unknown', 'a')).toEqual([]);
  });
});

/* ── isTerminalState ──────────────────────────────────────────────────── */

describe('isTerminalState', () => {
  it('identifies archived as terminal', () => {
    expect(isTerminalState('deal', 'archived')).toBe(true);
  });

  it('identifies active states as non-terminal', () => {
    expect(isTerminalState('deal', 'intake')).toBe(false);
  });
});

/* ── getDealStateLabel ────────────────────────────────────────────────── */

describe('getDealStateLabel', () => {
  it('returns human-readable labels for known states', () => {
    expect(getDealStateLabel('lead_received')).toBe('Lead Received');
    expect(getDealStateLabel('cit_hold')).toBe('CIT Hold');
  });

  it('returns state value as fallback for unknown states', () => {
    expect(getDealStateLabel('unknown_state')).toBe('unknown_state');
  });
});

/* ── Deal categorization arrays ───────────────────────────────────────── */

describe('deal state categorization', () => {
  it('active states do not include terminal states', () => {
    expect(DEAL_ACTIVE_STATES).not.toContain('archived');
    expect(DEAL_ACTIVE_STATES).not.toContain('cancelled');
  });

  it('funded states is exactly ["funded"]', () => {
    expect(DEAL_FUNDED_STATES).toEqual(['funded']);
  });

  it('lost states is exactly ["cancelled"]', () => {
    expect(DEAL_LOST_STATES).toEqual(['cancelled']);
  });
});
