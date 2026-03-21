/**
 * Avatar Controller — state machine for avatar visual behavior.
 *
 * Maps companion processing states to avatar visual states and manages
 * transitions with animation timing support.
 *
 * Avatar states:
 *   idle      – default breathing / floating animation
 *   listening – active input visualization (e.g. audio level response)
 *   thinking  – processing indicator animation
 *   speaking  – mouth / lip-sync animation, expression changes
 *
 * This module is pure — no side effects, no external dependencies.
 * It operates on an avatar state object created via createAvatarState().
 */

// ── Companion → Avatar state mapping ───────────────────────────────────────

const COMPANION_TO_AVATAR = {
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  responding: "speaking",
};

// ── Valid avatar transitions ───────────────────────────────────────────────

const VALID_TRANSITIONS = {
  idle: ["listening"],
  listening: ["thinking", "idle"],
  thinking: ["speaking", "idle"],
  speaking: ["idle", "listening"],
};

// ── Default expressions per state ──────────────────────────────────────────

const STATE_EXPRESSIONS = {
  idle: "neutral",
  listening: "curious",
  thinking: "thinking",
  speaking: "neutral",
};

// ── State factory ──────────────────────────────────────────────────────────

/**
 * Create a fresh avatar state.
 *
 * @returns {{ state: string, transitionState: string, expression: string, lipSyncFrames: Array, idleIntensity: number }}
 */
export function createAvatarState() {
  return {
    state: "idle",
    transitionState: "idle",
    expression: "neutral",
    lipSyncFrames: [],
    idleIntensity: 0.5,
  };
}

// ── Core transitions ───────────────────────────────────────────────────────

/**
 * Derive the avatar state from a companion state string.
 *
 * @param {string} companionState
 * @returns {string} The mapped avatar state.
 */
export function avatarStateFromCompanion(companionState) {
  return COMPANION_TO_AVATAR[companionState] || "idle";
}

/**
 * Transition the avatar to a new state.  Returns an updated state object.
 * Throws on invalid transitions unless `force` is true.
 *
 * @param {{ state: string, transitionState: string, expression: string, lipSyncFrames: Array, idleIntensity: number }} current
 * @param {string} nextState
 * @param {{ force?: boolean, expression?: string }} [options]
 * @returns {{ state: string, transitionState: string, expression: string, lipSyncFrames: Array, idleIntensity: number }}
 */
export function transitionAvatar(current, nextState, options = {}) {
  if (!current || !nextState) {
    throw new Error("Missing required parameters for avatar transition");
  }

  const { force = false, expression } = options;

  if (!force) {
    const allowed = VALID_TRANSITIONS[current.state];
    if (!allowed || !allowed.includes(nextState)) {
      throw new Error(
        `Invalid avatar transition: ${current.state} → ${nextState}. ` +
          `Allowed: ${(allowed || []).join(", ") || "none"}`
      );
    }
  }

  // Build transition state name for animations
  const transitionState =
    current.state !== nextState ? `${current.state}-to-${nextState}` : nextState;

  return {
    state: nextState,
    transitionState,
    expression: expression || STATE_EXPRESSIONS[nextState] || "neutral",
    lipSyncFrames: nextState === "speaking" ? current.lipSyncFrames : [],
    idleIntensity: nextState === "idle" ? 0.5 : nextState === "listening" ? 0.8 : 0.3,
  };
}

// ── Lip-sync support ───────────────────────────────────────────────────────

/**
 * Generate placeholder lip-sync frames from text.
 *
 * In production this would be replaced with real viseme data from the TTS
 * engine. This heuristic approximation maps syllable-like patterns to
 * mouth-open values so the avatar has basic mouth movement.
 *
 * @param {string} text - The text being spoken.
 * @param {number} [durationMs=3000] - Estimated speech duration in ms.
 * @returns {Array<{ timeMs: number, mouthOpen: number, viseme?: string }>}
 */
export function generateLipSyncFrames(text, durationMs = 3000) {
  if (!text) return [];

  // Simple heuristic: one frame per ~80ms, alternating open/close
  // weighted by vowel presence in the text slice.
  const frameInterval = 80;
  const frameCount = Math.max(1, Math.floor(durationMs / frameInterval));
  const vowels = /[aeiouAEIOU]/;
  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    const charIndex = Math.floor((i / frameCount) * text.length);
    const char = text[charIndex] || "";
    const isVowel = vowels.test(char);
    const isSilence = char === " " || char === "." || char === ",";

    let mouthOpen;
    if (isSilence) {
      mouthOpen = 0.1;
    } else if (isVowel) {
      mouthOpen = 0.6 + Math.random() * 0.3;
    } else {
      mouthOpen = 0.2 + Math.random() * 0.3;
    }

    frames.push({
      timeMs: i * frameInterval,
      mouthOpen: Math.round(mouthOpen * 100) / 100,
      viseme: isVowel ? "AA" : isSilence ? "sil" : "PP",
    });
  }

  return frames;
}

/**
 * Apply lip-sync frames to an avatar state (for the speaking state).
 *
 * @param {{ state: string, transitionState: string, expression: string, lipSyncFrames: Array, idleIntensity: number }} avatarState
 * @param {Array<{ timeMs: number, mouthOpen: number, viseme?: string }>} frames
 * @returns {{ state: string, transitionState: string, expression: string, lipSyncFrames: Array, idleIntensity: number }}
 */
export function applyLipSync(avatarState, frames) {
  return {
    ...avatarState,
    lipSyncFrames: frames || [],
  };
}

// ── Expression control ─────────────────────────────────────────────────────

/**
 * Update the avatar expression without changing state.
 *
 * @param {{ state: string, transitionState: string, expression: string, lipSyncFrames: Array, idleIntensity: number }} avatarState
 * @param {string} expression
 * @returns {{ state: string, transitionState: string, expression: string, lipSyncFrames: Array, idleIntensity: number }}
 */
export function setExpression(avatarState, expression) {
  return {
    ...avatarState,
    expression: expression || "neutral",
  };
}

/**
 * Check whether a given avatar transition is valid.
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isValidAvatarTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Force-reset the avatar to idle.
 *
 * @param {{ state: string }} current
 * @returns {{ state: string, transitionState: string, expression: string, lipSyncFrames: Array, idleIntensity: number }}
 */
export function resetAvatar(current) {
  return {
    state: "idle",
    transitionState: current.state !== "idle" ? `${current.state}-to-idle` : "idle",
    expression: "neutral",
    lipSyncFrames: [],
    idleIntensity: 0.5,
  };
}
