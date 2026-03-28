/**
 * lib/automotive/state-machine.js
 *
 * Explicit workflow state machines for all automotive finance domain objects.
 * Pure logic — no database access.
 */

// ── Deal Lifecycle ─────────────────────────────────────────────────────────

export const DEAL_STATES = Object.freeze({
  LEAD_RECEIVED:          'lead_received',
  INTAKE:                 'intake',
  DOCS_PENDING:           'docs_pending',
  DOCS_UNDER_REVIEW:      'docs_under_review',
  DOCUMENT_REVIEW:        'document_review',       // legacy alias kept for compat
  STRUCTURE_IN_PROGRESS:  'structure_in_progress',
  STRUCTURE_ANALYSIS:     'structure_analysis',    // legacy alias
  CALLBACK_RECEIVED:      'callback_received',
  CALLBACK_INTERPRETED:   'callback_interpreted',
  MENU_READY:             'menu_ready',
  PRESENTED:              'presented',
  SUBMITTED:              'submitted',
  BOOKED:                 'booked',
  FUNDED:                 'funded',
  CIT_HOLD:               'cit_hold',
  ISSUE_OPEN:             'issue_open',
  CANCELLED:              'cancelled',
  ARCHIVED:               'archived',
});

/**
 * Valid forward transitions for deal workflow.
 * Reverse or illegal transitions are blocked in the Netlify function.
 */
export const DEAL_TRANSITIONS = Object.freeze({
  lead_received:          ['intake', 'archived'],
  intake:                 ['docs_pending', 'document_review', 'structure_analysis', 'structure_in_progress', 'archived'],
  docs_pending:           ['docs_under_review', 'document_review', 'structure_in_progress', 'archived'],
  docs_under_review:      ['structure_in_progress', 'structure_analysis', 'docs_pending', 'archived'],
  document_review:        ['structure_analysis', 'structure_in_progress', 'docs_pending', 'archived'],
  structure_in_progress:  ['callback_received', 'menu_ready', 'submitted', 'archived'],
  structure_analysis:     ['callback_received', 'menu_ready', 'submitted', 'archived'],
  callback_received:      ['callback_interpreted', 'structure_in_progress', 'archived'],
  callback_interpreted:   ['menu_ready', 'structure_in_progress', 'submitted', 'archived'],
  menu_ready:             ['presented', 'submitted', 'archived'],
  presented:              ['submitted', 'booked', 'menu_ready', 'archived'],
  submitted:              ['booked', 'callback_received', 'cancelled', 'archived'],
  booked:                 ['cit_hold', 'funded', 'cancelled', 'archived'],
  cit_hold:               ['funded', 'issue_open', 'cancelled', 'archived'],
  funded:                 ['issue_open', 'archived'],
  issue_open:             ['funded', 'cancelled', 'archived'],
  cancelled:              ['archived'],
  archived:               [],
});

/** States that count as active pipeline (not terminal, not archived). */
export const DEAL_ACTIVE_STATES = [
  'lead_received', 'intake', 'docs_pending', 'docs_under_review', 'document_review',
  'structure_in_progress', 'structure_analysis', 'callback_received', 'callback_interpreted',
  'menu_ready', 'presented', 'submitted', 'booked', 'cit_hold', 'issue_open',
];

/** States that count toward funded volume for reporting. */
export const DEAL_FUNDED_STATES = ['funded'];

/** States that count as cancelled/lost. */
export const DEAL_LOST_STATES = ['cancelled'];

// ── Document Lifecycle ─────────────────────────────────────────────────────

export const DOCUMENT_STATES = Object.freeze({
  UPLOADED:     'uploaded',
  CLASSIFIED:   'classified',
  PARSED:       'parsed',
  NEEDS_REVIEW: 'needs_review',
  VERIFIED:     'verified',
  REJECTED:     'rejected',
  REPLACED:     'replaced',
  ARCHIVED:     'archived',
});

export const DOCUMENT_TRANSITIONS = Object.freeze({
  uploaded:     ['classified', 'needs_review', 'rejected'],
  classified:   ['parsed', 'needs_review', 'rejected'],
  parsed:       ['needs_review', 'verified', 'rejected'],
  needs_review: ['verified', 'rejected', 'replaced'],
  verified:     ['replaced', 'archived'],
  rejected:     ['replaced', 'archived'],
  replaced:     ['archived'],
  archived:     [],
});

// ── Callback Lifecycle ─────────────────────────────────────────────────────

export const CALLBACK_STATES = Object.freeze({
  RECEIVED:              'received',
  NORMALIZED:            'normalized',
  NEEDS_REVIEW:          'needs_review',
  OPTIONED:              'optioned',
  STRUCTURE_RECOMMENDED: 'structure_recommended',
  RESOLVED:              'resolved',
  SUPERSEDED:            'superseded',
});

export const CALLBACK_TRANSITIONS = Object.freeze({
  received:              ['normalized', 'needs_review'],
  normalized:            ['optioned', 'needs_review'],
  needs_review:          ['normalized', 'optioned', 'superseded'],
  optioned:              ['structure_recommended', 'needs_review', 'superseded'],
  structure_recommended: ['resolved', 'superseded'],
  resolved:              ['superseded'],
  superseded:            [],
});

// ── CIT Lifecycle ──────────────────────────────────────────────────────────

export const CIT_STATES = Object.freeze({
  OPEN:              'open',
  AWAITING_STIPS:    'awaiting_stips',
  AWAITING_CUSTOMER: 'awaiting_customer',
  AWAITING_LENDER:   'awaiting_lender',
  RESOLVED:          'resolved',
  ESCALATED:         'escalated',
  UNFUNDED:          'unfunded',
  ARCHIVED:          'archived',
});

export const CIT_TRANSITIONS = Object.freeze({
  open:              ['awaiting_stips', 'awaiting_customer', 'awaiting_lender', 'escalated', 'resolved', 'unfunded'],
  awaiting_stips:    ['open', 'awaiting_customer', 'awaiting_lender', 'resolved', 'escalated', 'unfunded'],
  awaiting_customer: ['open', 'awaiting_lender', 'resolved', 'escalated', 'unfunded'],
  awaiting_lender:   ['open', 'awaiting_customer', 'resolved', 'escalated', 'unfunded'],
  resolved:          ['archived'],
  escalated:         ['awaiting_stips', 'awaiting_customer', 'awaiting_lender', 'resolved', 'unfunded'],
  unfunded:          ['archived'],
  archived:          [],
});

// ── Cancellation Lifecycle ─────────────────────────────────────────────────

export const CANCELLATION_STATES = Object.freeze({
  REQUESTED:    'requested',
  PENDING_DOCS: 'pending_docs',
  SUBMITTED:    'submitted',
  CONFIRMED:    'confirmed',
  REFUNDED:     'refunded',
  CHARGED_BACK: 'charged_back',
  CLOSED:       'closed',
});

export const CANCELLATION_TRANSITIONS = Object.freeze({
  requested:    ['pending_docs', 'submitted', 'closed'],
  pending_docs: ['submitted', 'closed'],
  submitted:    ['confirmed', 'pending_docs', 'closed'],
  confirmed:    ['refunded', 'charged_back', 'closed'],
  refunded:     ['charged_back', 'closed'],
  charged_back: ['closed'],
  closed:       [],
});

// ── Customer Issue Lifecycle ───────────────────────────────────────────────

export const ISSUE_STATES = Object.freeze({
  OPEN:              'open',
  IN_PROGRESS:       'in_progress',
  AWAITING_CUSTOMER: 'awaiting_customer',
  AWAITING_LENDER:   'awaiting_lender',
  AWAITING_DEALER:   'awaiting_dealer',
  RESOLVED:          'resolved',
  ESCALATED:         'escalated',
  CLOSED:            'closed',
});

export const ISSUE_TRANSITIONS = Object.freeze({
  open:              ['in_progress', 'escalated', 'closed'],
  in_progress:       ['awaiting_customer', 'awaiting_lender', 'awaiting_dealer', 'resolved', 'escalated'],
  awaiting_customer: ['in_progress', 'resolved', 'escalated'],
  awaiting_lender:   ['in_progress', 'resolved', 'escalated'],
  awaiting_dealer:   ['in_progress', 'resolved', 'escalated'],
  resolved:          ['closed'],
  escalated:         ['in_progress', 'resolved', 'closed'],
  closed:            [],
});

// ── Shared Utilities ───────────────────────────────────────────────────────

const STATE_MACHINES = {
  deal:         DEAL_TRANSITIONS,
  document:     DOCUMENT_TRANSITIONS,
  callback:     CALLBACK_TRANSITIONS,
  cit:          CIT_TRANSITIONS,
  cancellation: CANCELLATION_TRANSITIONS,
  issue:        ISSUE_TRANSITIONS,
};

/**
 * Validate whether a state transition is permitted.
 *
 * @param {'deal'|'document'|'callback'|'cit'|'cancellation'|'issue'} machineType
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
export function canTransition(machineType, fromState, toState) {
  const machine = STATE_MACHINES[machineType];
  if (!machine) return false;
  const allowed = machine[fromState];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(toState);
}

/**
 * Return all valid next states from the current state.
 *
 * @param {'deal'|'document'|'callback'|'cit'|'cancellation'|'issue'} machineType
 * @param {string} fromState
 * @returns {string[]}
 */
export function getAvailableTransitions(machineType, fromState) {
  const machine = STATE_MACHINES[machineType];
  if (!machine) return [];
  return machine[fromState] || [];
}

/**
 * Whether a state has no further valid transitions (terminal).
 *
 * @param {'deal'|'document'|'callback'|'cit'|'cancellation'|'issue'} machineType
 * @param {string} state
 * @returns {boolean}
 */
export function isTerminalState(machineType, state) {
  return getAvailableTransitions(machineType, state).length === 0;
}

/** Human-readable label for a deal state. */
export function getDealStateLabel(state) {
  const labels = {
    lead_received:         'Lead Received',
    intake:                'Intake',
    docs_pending:          'Docs Pending',
    docs_under_review:     'Docs Under Review',
    document_review:       'Document Review',
    structure_in_progress: 'Structure In Progress',
    structure_analysis:    'Structure Analysis',
    callback_received:     'Callback Received',
    callback_interpreted:  'Callback Interpreted',
    menu_ready:            'Menu Ready',
    presented:             'Presented',
    submitted:             'Submitted',
    booked:                'Booked',
    funded:                'Funded',
    cit_hold:              'CIT Hold',
    issue_open:            'Issue Open',
    cancelled:             'Cancelled',
    archived:              'Archived',
  };
  return labels[state] || state;
}

/** Human-readable label for a CIT state. */
export function getCitStateLabel(state) {
  const labels = {
    open:              'Open',
    awaiting_stips:    'Awaiting Stips',
    awaiting_customer: 'Awaiting Customer',
    awaiting_lender:   'Awaiting Lender',
    resolved:          'Resolved',
    escalated:         'Escalated',
    unfunded:          'Unfunded',
    archived:          'Archived',
  };
  return labels[state] || state;
}

/** Human-readable label for a cancellation state. */
export function getCancellationStateLabel(state) {
  const labels = {
    requested:    'Requested',
    pending_docs: 'Pending Docs',
    submitted:    'Submitted',
    confirmed:    'Confirmed',
    refunded:     'Refunded',
    charged_back: 'Charged Back',
    closed:       'Closed',
  };
  return labels[state] || state;
}
