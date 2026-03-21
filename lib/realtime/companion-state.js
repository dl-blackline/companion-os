/**
 * Companion State Engine — tracks the companion's processing state.
 *
 * States:
 *   idle       – waiting for user input
 *   listening  – receiving user input (speech or text)
 *   thinking   – AI is processing / context assembly / tool execution
 *   responding – streaming response back to the user
 *
 * State transitions are validated to ensure only legal transitions occur.
 * Each transition emits an event that the frontend can subscribe to for
 * driving avatar animations and UI updates.
 *
 * This module is intentionally side-effect-free — it operates on a state
 * object that callers create via createCompanionState().
 */

// ── Valid transitions ──────────────────────────────────────────────────────

const VALID_TRANSITIONS = {
  idle: ["listening"],
  listening: ["thinking", "idle"],
  thinking: ["responding", "idle"],
  responding: ["idle", "listening"],
};

// ── State factory ──────────────────────────────────────────────────────────

/**
 * Create a new companion state instance.
 *
 * @returns {{ state: string, enteredAt: string, transitions: Array }}
 */
export function createCompanionState() {
  return {
    state: "idle",
    enteredAt: new Date().toISOString(),
    transitions: [],
  };
}

// ── Transition logic ───────────────────────────────────────────────────────

/**
 * Attempt a state transition.  Returns an updated state object on success,
 * or throws if the transition is invalid.
 *
 * @param {{ state: string, enteredAt: string, transitions: Array }} current
 * @param {string} nextState
 * @param {string} [reason]
 * @returns {{ state: string, enteredAt: string, transitions: Array }}
 */
export function transitionState(current, nextState, reason) {
  if (!current || !nextState) {
    throw new Error("Missing required parameters for state transition");
  }

  const allowed = VALID_TRANSITIONS[current.state];
  if (!allowed || !allowed.includes(nextState)) {
    throw new Error(
      `Invalid companion state transition: ${current.state} → ${nextState}. ` +
        `Allowed: ${(allowed || []).join(", ") || "none"}`
    );
  }

  const now = new Date().toISOString();
  const transition = {
    from: current.state,
    to: nextState,
    timestamp: now,
    reason: reason || undefined,
  };

  return {
    state: nextState,
    enteredAt: now,
    transitions: [...current.transitions, transition],
  };
}

// ── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Build a snapshot of the current companion state, suitable for sending
 * to the frontend.
 *
 * @param {{ state: string, enteredAt: string }} current
 * @param {string} [subState]
 * @returns {{ state: string, enteredAt: string, durationMs: number, interruptible: boolean, subState?: string }}
 */
export function getStateSnapshot(current, subState) {
  const durationMs = Date.now() - new Date(current.enteredAt).getTime();
  const interruptible = current.state === "responding" || current.state === "thinking";

  return {
    state: current.state,
    enteredAt: current.enteredAt,
    durationMs,
    interruptible,
    subState: subState || undefined,
  };
}

// ── Convenience helpers ────────────────────────────────────────────────────

/**
 * Check whether a transition is valid without performing it.
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isValidTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Return all states reachable from the given state.
 *
 * @param {string} from
 * @returns {string[]}
 */
export function allowedTransitions(from) {
  return VALID_TRANSITIONS[from] || [];
}

/**
 * Force-reset to idle.  Use after an error or unexpected condition.
 *
 * @param {{ state: string, enteredAt: string, transitions: Array }} current
 * @returns {{ state: string, enteredAt: string, transitions: Array }}
 */
export function resetToIdle(current) {
  const now = new Date().toISOString();
  return {
    state: "idle",
    enteredAt: now,
    transitions: [
      ...current.transitions,
      { from: current.state, to: "idle", timestamp: now, reason: "force_reset" },
    ],
  };
}
