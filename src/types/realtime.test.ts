import { describe, it, expect } from 'vitest';
import type {
  AvatarState,
  AvatarTransitionState,
  AvatarExpression,
  LipSyncFrame,
  AvatarConfig,
  CompanionState,
  CompanionStateSnapshot,
  CompanionStateTransition,
  StreamTokenEvent,
  StreamLifecycleEvent,
  StreamInterruptEvent,
  StreamImageEvent,
  StreamVoiceEvent,
  StreamStateEvent,
  RealtimeStreamEvent,
  SSEMessage,
  SSEEventName,
  ConversationImageRequest,
  ConversationImageResult,
  RealtimeSession,
} from '@/types/realtime';
import {
  VALID_COMPANION_TRANSITIONS,
  VALID_AVATAR_TRANSITIONS,
  COMPANION_TO_AVATAR_STATE,
} from '@/types/realtime';

// ─── Avatar States ───────────────────────────────────────────────────────────

describe('AvatarState type', () => {
  it('accepts all valid avatar states', () => {
    const states: AvatarState[] = ['idle', 'listening', 'thinking', 'speaking'];
    expect(states).toHaveLength(4);
    states.forEach((s) => expect(typeof s).toBe('string'));
  });
});

describe('AvatarTransitionState type', () => {
  it('includes base states and transition states', () => {
    const transitions: AvatarTransitionState[] = [
      'idle',
      'listening',
      'thinking',
      'speaking',
      'idle-to-listening',
      'listening-to-thinking',
      'thinking-to-speaking',
      'speaking-to-idle',
      'interrupted',
    ];
    expect(transitions).toHaveLength(9);
  });
});

describe('AvatarExpression type', () => {
  it('accepts all valid expressions', () => {
    const expressions: AvatarExpression[] = [
      'neutral',
      'happy',
      'curious',
      'surprised',
      'concerned',
      'thinking',
      'excited',
    ];
    expect(expressions).toHaveLength(7);
  });
});

describe('LipSyncFrame type', () => {
  it('has required timeMs and mouthOpen fields', () => {
    const frame: LipSyncFrame = { timeMs: 100, mouthOpen: 0.5 };
    expect(frame.timeMs).toBe(100);
    expect(frame.mouthOpen).toBe(0.5);
  });

  it('supports optional viseme field', () => {
    const frame: LipSyncFrame = { timeMs: 200, mouthOpen: 0.8, viseme: 'AA' };
    expect(frame.viseme).toBe('AA');
  });
});

describe('AvatarConfig type', () => {
  it('contains all required fields', () => {
    const config: AvatarConfig = {
      state: 'idle',
      transitionState: 'idle',
      lipSyncFrames: [],
      idleIntensity: 0.5,
      expression: 'neutral',
    };
    expect(config.state).toBe('idle');
    expect(config.transitionState).toBe('idle');
    expect(config.lipSyncFrames).toHaveLength(0);
    expect(config.idleIntensity).toBe(0.5);
    expect(config.expression).toBe('neutral');
  });
});

// ─── Companion States ────────────────────────────────────────────────────────

describe('CompanionState type', () => {
  it('accepts all valid companion states', () => {
    const states: CompanionState[] = ['idle', 'listening', 'thinking', 'responding'];
    expect(states).toHaveLength(4);
  });
});

describe('CompanionStateSnapshot type', () => {
  it('contains all required fields', () => {
    const snapshot: CompanionStateSnapshot = {
      state: 'thinking',
      enteredAt: '2026-01-01T00:00:00Z',
      durationMs: 500,
      interruptible: true,
    };
    expect(snapshot.state).toBe('thinking');
    expect(snapshot.interruptible).toBe(true);
  });

  it('supports optional subState', () => {
    const snapshot: CompanionStateSnapshot = {
      state: 'thinking',
      enteredAt: '2026-01-01T00:00:00Z',
      durationMs: 200,
      interruptible: true,
      subState: 'searching memories',
    };
    expect(snapshot.subState).toBe('searching memories');
  });
});

describe('CompanionStateTransition type', () => {
  it('contains from, to, and timestamp', () => {
    const transition: CompanionStateTransition = {
      from: 'idle',
      to: 'listening',
      timestamp: '2026-01-01T00:00:00Z',
    };
    expect(transition.from).toBe('idle');
    expect(transition.to).toBe('listening');
  });

  it('supports optional reason', () => {
    const transition: CompanionStateTransition = {
      from: 'listening',
      to: 'thinking',
      timestamp: '2026-01-01T00:00:00Z',
      reason: 'user_stopped_speaking',
    };
    expect(transition.reason).toBe('user_stopped_speaking');
  });
});

// ─── Streaming Events ────────────────────────────────────────────────────────

describe('RealtimeStreamEvent union type', () => {
  it('accepts StreamTokenEvent', () => {
    const event: RealtimeStreamEvent = {
      type: 'token',
      content: 'Hello',
      accumulated: 'Hello',
    };
    expect(event.type).toBe('token');
  });

  it('accepts StreamLifecycleEvent', () => {
    const events: RealtimeStreamEvent[] = [
      { type: 'stream_start', timestamp: '2026-01-01T00:00:00Z' },
      { type: 'stream_end', timestamp: '2026-01-01T00:00:00Z' },
      { type: 'stream_error', timestamp: '2026-01-01T00:00:00Z', error: 'fail' },
    ];
    expect(events).toHaveLength(3);
  });

  it('accepts StreamInterruptEvent', () => {
    const event: RealtimeStreamEvent = {
      type: 'stream_interrupt',
      timestamp: '2026-01-01T00:00:00Z',
      partialText: 'Hello wor',
    };
    expect(event.type).toBe('stream_interrupt');
  });

  it('accepts StreamImageEvent', () => {
    const event: RealtimeStreamEvent = {
      type: 'image_generated',
      imageUrl: 'https://example.com/img.png',
      prompt: 'a cat',
      timestamp: '2026-01-01T00:00:00Z',
    };
    expect(event.type).toBe('image_generated');
  });

  it('accepts StreamVoiceEvent', () => {
    const event: RealtimeStreamEvent = {
      type: 'voice_generated',
      audioUrl: 'data:audio/mpeg;base64,abc123',
      durationMs: 5000,
      timestamp: '2026-01-01T00:00:00Z',
    };
    expect(event.type).toBe('voice_generated');
  });

  it('accepts StreamStateEvent', () => {
    const event: RealtimeStreamEvent = {
      type: 'state_change',
      state: 'thinking',
      avatarState: 'thinking',
      timestamp: '2026-01-01T00:00:00Z',
    };
    expect(event.type).toBe('state_change');
  });
});

// ─── SSE Types ───────────────────────────────────────────────────────────────

describe('SSEMessage type', () => {
  it('contains event and data fields', () => {
    const msg: SSEMessage = {
      event: 'token',
      data: { content: 'hello' },
    };
    expect(msg.event).toBe('token');
    expect(msg.data.content).toBe('hello');
  });
});

describe('SSEEventName type', () => {
  it('accepts all valid event names', () => {
    const names: SSEEventName[] = ['token', 'state', 'image', 'voice', 'done', 'error', 'interrupted'];
    expect(names).toHaveLength(7);
  });
});

// ─── Image Generation Types ──────────────────────────────────────────────────

describe('ConversationImageRequest type', () => {
  it('requires prompt, userId, and conversationId', () => {
    const req: ConversationImageRequest = {
      prompt: 'a sunset over the ocean',
      userId: 'user-1',
      conversationId: 'conv-1',
    };
    expect(req.prompt).toBe('a sunset over the ocean');
  });

  it('supports optional style', () => {
    const req: ConversationImageRequest = {
      prompt: 'a cat',
      userId: 'user-1',
      conversationId: 'conv-1',
      style: 'photorealistic',
    };
    expect(req.style).toBe('photorealistic');
  });
});

describe('ConversationImageResult type', () => {
  it('represents a successful result', () => {
    const result: ConversationImageResult = {
      success: true,
      imageUrl: 'https://example.com/img.png',
      durationMs: 2500,
    };
    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeDefined();
  });

  it('represents a failed result', () => {
    const result: ConversationImageResult = {
      success: false,
      error: 'Provider error',
      durationMs: 1000,
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe('Provider error');
  });
});

// ─── Realtime Session Type ───────────────────────────────────────────────────

describe('RealtimeSession type', () => {
  it('contains all required fields', () => {
    const session: RealtimeSession = {
      sessionId: 'sess-1',
      userId: 'user-1',
      sessionType: 'live_assistant',
      status: 'active',
      companionState: 'idle',
      avatarState: 'idle',
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(session.sessionId).toBe('sess-1');
    expect(session.status).toBe('active');
  });

  it('accepts all valid session types', () => {
    const types: RealtimeSession['sessionType'][] = [
      'voice_call',
      'live_assistant',
      'creative_session',
      'screen_assist',
    ];
    expect(types).toHaveLength(4);
  });
});

// ─── State Transition Maps ───────────────────────────────────────────────────

describe('VALID_COMPANION_TRANSITIONS', () => {
  it('defines transitions for all companion states', () => {
    expect(VALID_COMPANION_TRANSITIONS.has('idle')).toBe(true);
    expect(VALID_COMPANION_TRANSITIONS.has('listening')).toBe(true);
    expect(VALID_COMPANION_TRANSITIONS.has('thinking')).toBe(true);
    expect(VALID_COMPANION_TRANSITIONS.has('responding')).toBe(true);
  });

  it('idle can transition to listening', () => {
    expect(VALID_COMPANION_TRANSITIONS.get('idle')).toContain('listening');
  });

  it('listening can transition to thinking or idle', () => {
    const targets = VALID_COMPANION_TRANSITIONS.get('listening')!;
    expect(targets).toContain('thinking');
    expect(targets).toContain('idle');
  });

  it('thinking can transition to responding or idle', () => {
    const targets = VALID_COMPANION_TRANSITIONS.get('thinking')!;
    expect(targets).toContain('responding');
    expect(targets).toContain('idle');
  });

  it('responding can transition to idle or listening', () => {
    const targets = VALID_COMPANION_TRANSITIONS.get('responding')!;
    expect(targets).toContain('idle');
    expect(targets).toContain('listening');
  });
});

describe('VALID_AVATAR_TRANSITIONS', () => {
  it('defines transitions for all avatar states', () => {
    expect(VALID_AVATAR_TRANSITIONS.has('idle')).toBe(true);
    expect(VALID_AVATAR_TRANSITIONS.has('listening')).toBe(true);
    expect(VALID_AVATAR_TRANSITIONS.has('thinking')).toBe(true);
    expect(VALID_AVATAR_TRANSITIONS.has('speaking')).toBe(true);
  });

  it('speaking can transition to idle or listening (interruption)', () => {
    const targets = VALID_AVATAR_TRANSITIONS.get('speaking')!;
    expect(targets).toContain('idle');
    expect(targets).toContain('listening');
  });
});

describe('COMPANION_TO_AVATAR_STATE', () => {
  it('maps all companion states to avatar states', () => {
    expect(COMPANION_TO_AVATAR_STATE.idle).toBe('idle');
    expect(COMPANION_TO_AVATAR_STATE.listening).toBe('listening');
    expect(COMPANION_TO_AVATAR_STATE.thinking).toBe('thinking');
    expect(COMPANION_TO_AVATAR_STATE.responding).toBe('speaking');
  });
});
