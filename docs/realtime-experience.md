# Realtime Companion Experience Layer

## Overview

The Realtime Companion Experience Layer adds immersive, low-latency AI
interaction to Companion OS.  It layers on top of the existing Companion Brain
architecture without modifying existing endpoints.

**Key capabilities:**

| Feature | Implementation |
|---------|---------------|
| Token-by-token streaming | SSE via `companion-stream` endpoint |
| Avatar state machine | `avatar-controller.js` (idle → listening → thinking → speaking) |
| Voice integration | `realtime-voice-client.ts` + `voice-engine.js` (WebRTC + ElevenLabs) |
| Image generation in conversation | `realtime-session-service.ts` → `generate-media` endpoint |
| Companion state engine | `companion-state.js` (idle → listening → thinking → responding) |
| Interruption support | Abort signal in SSE stream + WebRTC `response.cancel` |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                                    │
│                                                                            │
│  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────┐   │
│  │ realtime-session  │  │ realtime-voice     │  │ voice-context.tsx    │   │
│  │ -service.ts       │  │ -client.ts         │  │                      │   │
│  │                   │  │                    │  │ Manages VoiceStatus  │   │
│  │ • streamMessage() │  │ • WebRTC connect() │  │ (idle/connecting/    │   │
│  │ • parseSSE()      │  │ • interrupt()      │  │  listening/speaking/ │   │
│  │ • generateImage() │  │ • submitToolResult │  │  thinking/error)     │   │
│  └────────┬──────────┘  └─────────┬──────────┘  └──────────┬───────────┘   │
│           │                       │                         │              │
│           │     ┌─────────────────┴─────────────────┐       │              │
│           │     │     Avatar / Orb UI Component      │      │              │
│           │     │                                    │      │              │
│           │     │  State:   idle → listening →       │      │              │
│           │     │           thinking → speaking      │      │              │
│           │     │  Lip-sync: heuristic frames        │      │              │
│           │     │  Expression: neutral/happy/curious  │      │              │
│           │     └────────────────────────────────────┘       │              │
│           │                                                  │              │
└───────────┼──────────────────────────────────────────────────┼──────────────┘
            │                                                  │
            ▼                                                  ▼
┌──────────────────────────┐                    ┌──────────────────────────┐
│  companion-stream.js     │                    │  ai.js (realtime_token)  │
│  (SSE endpoint)          │                    │  → voice-engine          │
│                          │                    │  → WebRTC ephemeral key  │
│  POST → SSE response:    │                    └──────────┬───────────────┘
│   event: state           │                               │
│   event: token           │                               ▼
│   event: image           │                    ┌──────────────────────────┐
│   event: done            │                    │  OpenAI Realtime API     │
│   event: error           │                    │  (WebRTC bidirectional)  │
│   event: interrupted     │                    └──────────────────────────┘
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   REALTIME LAYER  (lib/realtime/)                        │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │ companion-state   │  │ avatar-controller │  │ stream-handler      │   │
│  │                   │  │                   │  │                      │   │
│  │ States:           │  │ States:           │  │ • formatSSE()        │   │
│  │  idle             │  │  idle             │  │ • streamCompanion    │   │
│  │  listening        │  │  listening        │  │   Response()         │   │
│  │  thinking         │  │  thinking         │  │                      │   │
│  │  responding       │  │  speaking         │  │ Wraps chatStream()   │   │
│  │                   │  │                   │  │ with state events    │   │
│  │ Validated         │  │ Lip-sync frames   │  │                      │   │
│  │ transitions       │  │ Expression control│  │                      │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘   │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │ session-manager   │  │ event-stream      │  │ voice-stream         │   │
│  │ (existing)        │  │ (existing)        │  │ (existing)           │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘   │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     COMPANION BRAIN  (lib/companion-brain.js)            │
│                     AI CLIENT        (lib/ai-client.js)                  │
│                     VOICE ENGINE     (lib/voice-engine.js)               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Realtime Flow (Step-by-Step)

### Text Input → Streamed Response

```
1. USER TYPES MESSAGE
   └─▶ realtime-session-service.streamCompanionMessage()

2. HTTP POST → /.netlify/functions/companion-stream
   └─▶ SSE response begins

3. COMPANION STATE: idle → listening
   └─▶ event: state  { companionState: "listening", avatarState: "listening" }
   └─▶ Frontend: Avatar transitions to listening animation

4. COMPANION STATE: listening → thinking
   └─▶ event: state  { companionState: "thinking", avatarState: "thinking" }
   └─▶ Frontend: Avatar shows thinking animation

5. AI PROCESSING (companion-brain.think())
   └─▶ Intent detection → Context assembly → Tool execution → Domain routing

6. COMPANION STATE: thinking → responding
   └─▶ event: state  { companionState: "responding", avatarState: "speaking" }
   └─▶ Frontend: Avatar begins speaking animation with lip-sync frames

7. TOKEN STREAMING
   └─▶ event: token  { content: "Hello", accumulated: "Hello" }
   └─▶ event: token  { content: " world", accumulated: "Hello world" }
   └─▶ Frontend: Text appears word-by-word

8. IMAGE GENERATION (if applicable)
   └─▶ event: image  { imageUrl: "...", prompt: "..." }
   └─▶ Frontend: Image fades in inline

9. STREAM COMPLETE
   └─▶ event: done   { fullText: "Hello world", intent: "chat" }
   └─▶ COMPANION STATE: responding → idle
   └─▶ event: state  { companionState: "idle", avatarState: "idle" }
   └─▶ Frontend: Avatar returns to idle
```

### Voice Input → Voice Response (WebRTC)

```
1. USER SPEAKS (microphone audio via WebRTC)
   └─▶ RealtimeVoiceClient sends audio track to OpenAI

2. SPEECH DETECTED
   └─▶ input_audio_buffer.speech_started
   └─▶ VoiceContext: status = "listening"
   └─▶ Avatar: listening state

3. SPEECH ENDED
   └─▶ input_audio_buffer.speech_stopped
   └─▶ VoiceContext: status = "thinking"
   └─▶ Avatar: thinking state

4. AI AUDIO STREAMING
   └─▶ response.audio.delta (audio chunks)
   └─▶ VoiceContext: status = "speaking"
   └─▶ Avatar: speaking state with lip-sync

5. TRANSCRIPTION
   └─▶ response.audio_transcript.delta (partial)
   └─▶ response.audio_transcript.done (final)
   └─▶ UI updates with transcript text

6. USER INTERRUPTION (speaks while AI is talking)
   └─▶ input_audio_buffer.speech_started during speaking state
   └─▶ RealtimeVoiceClient.interrupt() → response.cancel
   └─▶ Audio output cleared
   └─▶ Avatar: listening state
   └─▶ New turn begins
```

---

## Avatar State Machine

```
                    ┌─────────┐
           ┌───────│  IDLE    │◀──────────────┐
           │       └────┬─────┘               │
           │            │                     │
           │      user input             completion
           │      detected              or interrupt
           │            │                     │
           │            ▼                     │
           │       ┌──────────┐               │
     interrupt     │LISTENING │               │
   (force reset)   └────┬─────┘               │
           │            │                     │
           │      input complete              │
           │            │                     │
           │            ▼                     │
           │       ┌──────────┐               │
           ├───────│THINKING  │               │
           │       └────┬─────┘               │
           │            │                     │
           │      response ready              │
           │            │                     │
           │            ▼                     │
           │       ┌──────────┐               │
           └───────│SPEAKING  │───────────────┘
                   └──────────┘
                        │
                   user speaks
                   (interruption)
                        │
                        ▼
                   ┌──────────┐
                   │LISTENING │  (new turn)
                   └──────────┘

State Details:
  IDLE      — Default animation (breathing, floating orb)
              Expression: neutral
              Idle intensity: 0.5

  LISTENING — Active input visualization
              Expression: curious
              Idle intensity: 0.8 (responsive)

  THINKING  — Processing indicator
              Expression: thinking
              Idle intensity: 0.3 (subdued)

  SPEAKING  — Lip-sync animation + expression changes
              Expression: varies (neutral, happy, excited)
              Lip-sync: heuristic frames or TTS viseme data
```

### Transition States (for smooth animation)

When moving between states, the avatar passes through a named transition
state that the frontend can use to trigger blended animations:

| From → To | Transition State | Duration (suggested) |
|-----------|-----------------|---------------------|
| idle → listening | `idle-to-listening` | 200ms |
| listening → thinking | `listening-to-thinking` | 300ms |
| thinking → speaking | `thinking-to-speaking` | 200ms |
| speaking → idle | `speaking-to-idle` | 400ms |
| * → idle (interrupt) | `interrupted` | 150ms |

---

## Example: SSE Streaming Implementation

### Server (Netlify Function)

```javascript
// netlify/functions/companion-stream.js
// POST body: { message, user_id, conversation_id, ... }
// Response: text/event-stream

import { think } from "../../lib/companion-brain.js";
import { formatSSE } from "../../lib/realtime/stream-handler.js";
import { createCompanionState, transitionState } from "../../lib/realtime/companion-state.js";
import { createAvatarState, transitionAvatar } from "../../lib/realtime/avatar-controller.js";

export async function handler(event) {
  const body = JSON.parse(event.body);
  let companionState = createCompanionState();
  let avatarState = createAvatarState();
  let sseBody = "";

  // State: listening
  companionState = transitionState(companionState, "listening");
  avatarState = transitionAvatar(avatarState, "listening");
  sseBody += formatSSE("state", { companionState, avatarState });

  // State: thinking
  companionState = transitionState(companionState, "thinking");
  avatarState = transitionAvatar(avatarState, "thinking");
  sseBody += formatSSE("state", { companionState, avatarState });

  // Process through brain
  const result = await think({ message: body.message, ... });

  // State: responding
  companionState = transitionState(companionState, "responding");
  avatarState = transitionAvatar(avatarState, "speaking");
  sseBody += formatSSE("state", { companionState, avatarState });

  // Emit tokens
  for (const word of result.response.split(/(\s+)/)) {
    sseBody += formatSSE("token", { content: word });
  }

  // Done
  sseBody += formatSSE("done", { fullText: result.response });

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/event-stream" },
    body: sseBody,
  };
}
```

### Client (React)

```typescript
import { streamCompanionMessage } from '@/services/realtime-session-service';

async function handleSend(message: string) {
  let responseText = '';

  await streamCompanionMessage(
    {
      message,
      userId: user.id,
      conversationId: currentConversation.id,
    },
    (event) => {
      switch (event.type) {
        case 'token':
          responseText = event.accumulated;
          setDisplayText(responseText);
          break;
        case 'state_change':
          setAvatarState(event.avatarState);
          setCompanionState(event.state);
          break;
        case 'image_generated':
          addInlineImage(event.imageUrl);
          break;
        case 'stream_end':
          finalizeMessage(responseText);
          break;
      }
    },
  );
}
```

---

## Example: UI Interaction Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Companion Chat UI                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │   [User]: Tell me about the solar system and show me    │ │
│  │           a picture of Saturn                           │ │
│  │                                                         │ │
│  │   ╭──────────╮                                          │ │
│  │   │  🌀      │  ← Avatar (thinking animation)          │ │
│  │   │ thinking │                                          │ │
│  │   ╰──────────╯                                          │ │
│  │                                                         │ │
│  │   [AI]: The solar system is a vast...  ← streaming      │ │
│  │         ...collection of planets...    ← token by token  │ │
│  │                                                         │ │
│  │   ╭──────────╮                                          │ │
│  │   │  😊      │  ← Avatar (speaking animation)          │ │
│  │   │ speaking │                                          │ │
│  │   ╰──────────╯                                          │ │
│  │                                                         │ │
│  │   ┌─────────────────────┐                               │ │
│  │   │   🪐 Saturn         │  ← Inline image (fade-in)    │ │
│  │   │   [generated image] │                               │ │
│  │   └─────────────────────┘                               │ │
│  │                                                         │ │
│  │   [AI]: ...Here's Saturn with its beautiful rings!      │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────┐             │
│  │ Type a message... or 🎤 start voice        │             │
│  └─────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

### Voice Mode UI Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Live Talk Mode                             │
│                                                              │
│                  ╭──────────────╮                             │
│                  │              │                             │
│                  │   🎙️ Orb    │  ← Pulsing = listening     │
│                  │   (active)   │  ← Spinning = thinking     │
│                  │              │  ← Glowing = speaking       │
│                  ╰──────────────╯                             │
│                                                              │
│              "I hear you saying..."  ← Live transcript       │
│                                                              │
│              ┌─────────────────────┐                         │
│              │ 🔇 Mute  │ 🔴 End │                          │
│              └─────────────────────┘                         │
│                                                              │
│  Latency target: < 500ms perceived                          │
│  • WebRTC: ~200ms speech-to-speech                          │
│  • SSE text: ~300ms first token                             │
└──────────────────────────────────────────────────────────────┘
```

---

## Integration Notes

- All AI calls route through `lib/ai-client.js` (`chat()`, `chatStream()`)
- Existing endpoints (`companion-brain`, `ai.js`, `chat.js`) are unchanged
- The new `companion-stream` endpoint is additive — no breaking changes
- Avatar state machine is pure (no side effects) — safe for SSR and testing
- Lip-sync frames are heuristic; can be upgraded to real viseme data from TTS
- Image generation uses the existing `generate-media` Netlify function

---

## Files Added

| File | Purpose |
|------|---------|
| `src/types/realtime.ts` | TypeScript types for the realtime experience layer |
| `lib/realtime/companion-state.js` | Companion state engine (validated transitions) |
| `lib/realtime/avatar-controller.js` | Avatar state machine with lip-sync support |
| `lib/realtime/stream-handler.js` | SSE formatting and streaming pipeline |
| `netlify/functions/companion-stream.js` | SSE endpoint for streaming AI responses |
| `src/services/realtime-session-service.ts` | Frontend service for sessions, streaming, images |
| `src/types/realtime.test.ts` | Type safety tests |
| `src/services/realtime-session-service.test.ts` | Unit tests for state machines and SSE parsing |
| `docs/realtime-experience.md` | This architecture document |
