// ─── Realtime Companion Experience Types ─────────────────────────────────────
// Types for the real-time companion experience layer including avatar states,
// companion state engine, streaming events, and image generation integration.

// ─── Avatar States ───────────────────────────────────────────────────────────

/** Core avatar visual states. */
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** Extended avatar states for transition animations. */
export type AvatarTransitionState =
  | AvatarState
  | 'idle-to-listening'
  | 'listening-to-thinking'
  | 'thinking-to-speaking'
  | 'speaking-to-idle'
  | 'interrupted';

/** Lip-sync timing data for voice-to-animation mapping. */
export interface LipSyncFrame {
  /** Timestamp offset in milliseconds from the start of the audio clip. */
  readonly timeMs: number;
  /** Mouth openness value (0 = closed, 1 = fully open). */
  readonly mouthOpen: number;
  /** Optional viseme identifier (e.g. 'AA', 'EE', 'OO'). */
  readonly viseme?: string;
}

/** Full avatar configuration exposed to the frontend. */
export interface AvatarConfig {
  /** Current visual state of the avatar. */
  readonly state: AvatarState;
  /** Transition state for animation (may differ during animations). */
  readonly transitionState: AvatarTransitionState;
  /** Lip-sync frames for the current speech segment (empty when not speaking). */
  readonly lipSyncFrames: readonly LipSyncFrame[];
  /** Intensity multiplier for idle animation (0–1). */
  readonly idleIntensity: number;
  /** Emotion expression overlay (e.g. 'neutral', 'happy', 'curious'). */
  readonly expression: AvatarExpression;
}

/** Supported avatar emotion expressions. */
export type AvatarExpression =
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'surprised'
  | 'concerned'
  | 'thinking'
  | 'excited';

// ─── Companion State Engine ──────────────────────────────────────────────────

/** Top-level companion processing states. */
export type CompanionState = 'idle' | 'listening' | 'thinking' | 'responding';

/** Detailed companion state with metadata. */
export interface CompanionStateSnapshot {
  /** Current processing state. */
  readonly state: CompanionState;
  /** Timestamp when this state was entered (ISO-8601). */
  readonly enteredAt: string;
  /** Duration in the current state (ms, updated on read). */
  readonly durationMs: number;
  /** Whether the companion is interruptible in this state. */
  readonly interruptible: boolean;
  /** Optional sub-state description (e.g. 'searching memories', 'generating image'). */
  readonly subState?: string;
}

/** State transition event emitted when the companion changes state. */
export interface CompanionStateTransition {
  readonly from: CompanionState;
  readonly to: CompanionState;
  readonly timestamp: string;
  readonly reason?: string;
}

// ─── Streaming Events ────────────────────────────────────────────────────────

/** Token delta from the AI streaming response. */
export interface StreamTokenEvent {
  readonly type: 'token';
  /** The text token content. */
  readonly content: string;
  /** Cumulative text so far. */
  readonly accumulated: string;
}

/** Stream lifecycle events. */
export interface StreamLifecycleEvent {
  readonly type: 'stream_start' | 'stream_end' | 'stream_error';
  readonly timestamp: string;
  readonly error?: string;
}

/** Stream interruption event. */
export interface StreamInterruptEvent {
  readonly type: 'stream_interrupt';
  readonly timestamp: string;
  /** Partial text accumulated before interruption. */
  readonly partialText: string;
}

/** Image generated during conversation. */
export interface StreamImageEvent {
  readonly type: 'image_generated';
  readonly imageUrl: string;
  readonly prompt: string;
  readonly timestamp: string;
}

/** Companion state change during streaming. */
export interface StreamStateEvent {
  readonly type: 'state_change';
  readonly state: CompanionState;
  readonly avatarState: AvatarState;
  readonly timestamp: string;
}

/** Union of all stream event types. */
export type RealtimeStreamEvent =
  | StreamTokenEvent
  | StreamLifecycleEvent
  | StreamInterruptEvent
  | StreamImageEvent
  | StreamStateEvent;

// ─── SSE Protocol ────────────────────────────────────────────────────────────

/** Shape of server-sent event data for the companion-stream endpoint. */
export interface SSEMessage {
  /** SSE event name. */
  readonly event: string;
  /** JSON-serializable data payload. */
  readonly data: Record<string, unknown>;
}

/** SSE event names used by the companion-stream endpoint. */
export type SSEEventName =
  | 'token'
  | 'state'
  | 'image'
  | 'done'
  | 'error'
  | 'interrupted';

// ─── Image Generation Integration ────────────────────────────────────────────

/** Request to generate an image during conversation. */
export interface ConversationImageRequest {
  readonly prompt: string;
  readonly style?: 'photorealistic' | 'artistic' | 'cinematic' | 'cartoon' | 'abstract';
  readonly userId: string;
  readonly conversationId: string;
}

/** Result of an inline image generation. */
export interface ConversationImageResult {
  readonly success: boolean;
  readonly imageUrl?: string;
  readonly error?: string;
  readonly durationMs: number;
}

// ─── Realtime Session ────────────────────────────────────────────────────────

/** Client-side realtime session descriptor. */
export interface RealtimeSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly sessionType: 'voice_call' | 'live_assistant' | 'creative_session' | 'screen_assist';
  readonly status: 'active' | 'completed' | 'error';
  readonly companionState: CompanionState;
  readonly avatarState: AvatarState;
  readonly createdAt: string;
}

// ─── Valid state transitions ─────────────────────────────────────────────────

/**
 * Valid companion state transitions:
 *   idle       → listening
 *   listening  → thinking | idle
 *   thinking   → responding | idle (interrupted)
 *   responding → idle | listening (interrupted by user)
 */
export const VALID_COMPANION_TRANSITIONS: ReadonlyMap<CompanionState, readonly CompanionState[]> =
  new Map([
    ['idle', ['listening']],
    ['listening', ['thinking', 'idle']],
    ['thinking', ['responding', 'idle']],
    ['responding', ['idle', 'listening']],
  ]);

/**
 * Valid avatar state transitions:
 *   idle      → listening
 *   listening → thinking | idle
 *   thinking  → speaking | idle (interrupted)
 *   speaking  → idle | listening (interrupted by user)
 */
export const VALID_AVATAR_TRANSITIONS: ReadonlyMap<AvatarState, readonly AvatarState[]> =
  new Map([
    ['idle', ['listening']],
    ['listening', ['thinking', 'idle']],
    ['thinking', ['speaking', 'idle']],
    ['speaking', ['idle', 'listening']],
  ]);

/**
 * Map companion states to their corresponding avatar states.
 * This ensures the avatar always reflects the companion's processing phase.
 */
export const COMPANION_TO_AVATAR_STATE: Readonly<Record<CompanionState, AvatarState>> = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  responding: 'speaking',
};
