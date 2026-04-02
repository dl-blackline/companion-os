# Vuk Experience Engine

> The **Vuk Experience Engine** unifies Vuk OS into a single,
> real-time AI companion system. It sits at the intersection of the AI
> orchestrator, context/memory layer, realtime streaming pipeline, avatar
> system, voice integration, and image generation — all wired together
> through one coherent architecture.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND  (React + TS)                            │
│                                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ companion-       │  │ realtime-session  │  │ realtime-voice-client.ts │ │
│  │ service.ts       │  │ -service.ts       │  │                          │ │
│  │                  │  │                   │  │ WebRTC connect/interrupt  │ │
│  │ Standard request │  │ SSE streaming     │  │ Speech ↔ AI              │ │
│  │ / response       │  │ Token-by-token    │  │                          │ │
│  └────────┬─────────┘  └────────┬──────────┘  └────────┬─────────────────┘ │
│           │                     │                       │                   │
│           ▼                     ▼                       ▼                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Avatar / Orb UI Component                           │ │
│  │  States: idle → listening → thinking → speaking                       │ │
│  │  Lip-sync: heuristic frames mapped to mouth-open values               │ │
│  │  Expressions: neutral | happy | curious | surprised | concerned | …   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└────────────┬─────────────────────┬──────────────────────┬──────────────────┘
             │                     │                      │
             ▼                     ▼                      ▼
  ┌────────────────────┐ ┌──────────────────┐  ┌──────────────────────────┐
  │ companion-brain.js │ │ companion-       │  │ ai.js (realtime_token)   │
  │ roleplay.js        │ │ stream.js (SSE)  │  │ → voice-engine.js        │
  │ daily-plan.js      │ │                  │  │ → OpenAI Realtime API    │
  │ chat.js            │ │ Events:          │  └──────────────────────────┘
  │                    │ │  state / token / │
  │ All → think()      │ │  image / done /  │
  └────────┬───────────┘ │  error           │
           │             └────────┬─────────┘
           │                      │
           ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    VUK BRAIN  (lib/companion-brain.js)                 │
│                                                                              │
│  ┌───────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ 1. Intent │→ │ 2. Context   │→ │ 3. Plan  │→ │ 4. Execute Tools      │  │
│  │ Detection │  │   Engine     │  │   Agent  │  │ (memory, web, media…) │  │
│  └───────────┘  └──────────────┘  └──────────┘  └───────────┬───────────┘  │
│                                                              │              │
│  ┌─────────────────────────────────────────────────────────┐ │              │
│  │ 5. Domain Router                                        │◀┘              │
│  │  chat │ roleplay │ planning │ research │ media_generation│               │
│  └─────────────────────────────┬───────────────────────────┘               │
│                                │                                            │
│  ┌──────────────┐    ┌────────▼──────┐                                     │
│  │ 6. Critic    │ →  │ 7. Memory     │                                     │
│  │    Review    │    │    Ingest     │                                     │
│  └──────────────┘    └───────────────┘                                     │
└──────────────────────────────────────────────────────────────────────────────┘
         │                    │                     │
         ▼                    ▼                     ▼
┌──────────────────┐ ┌──────────────────┐  ┌──────────────────────┐
│  AI CLIENT       │ │ CONTEXT ENGINE   │  │  MEMORY LAYER        │
│  ai-client.js    │ │ context-engine.js│  │  memory-layer.js     │
│  • chat()        │ │ • assembleCtx()  │  │  • storeShortTerm()  │
│  • chatStream()  │ │ • summarizeCtx() │  │  • ingest()          │
│  • chatJSON()    │ │ • formatBlock()  │  │  • searchAll()       │
│  • embed()       │ │                  │  │  • getRecentContext() │
└──────────────────┘ └──────────────────┘  └──────────────────────┘
```

---

## 1. Unified AI Orchestrator

**File:** `lib/companion-brain.js`  
**Entry point:** `think(params)`

All AI requests flow through `think()`. No module makes direct model calls
outside this orchestration layer. Capabilities are routed via domain handlers:

| Capability | Handler | Prompt Template |
|---|---|---|
| `chat` | Generic (context-aware) | `contextAwareChat` |
| `roleplay` | `domainHandlers.roleplay` | `roleplaySession` |
| `planning` | `domainHandlers.planning` | `dailyPlan` |
| `research` | `domainHandlers.research` | `researchTask` |
| `media_generation` | Tool execution → media router | N/A |

### Endpoints that route through the orchestrator

| Endpoint | Capability |
|---|---|
| `companion-brain.js` | Any (via `capability` param) |
| `roleplay.js` | `roleplay` (character + scenario) |
| `daily-plan.js` | `planning` |
| `chat.js` | Auto-detected intent |
| `ai.js` (handleChat) | Auto-detected intent |
| `companion-stream.js` | Streaming variant |

---

## 2. Context + Memory Layer

### Context Engine (`lib/context-engine.js`)

Assembles all context before every AI call:

```
assembleContext({ user_id, conversation_id, message, ... })
  → Parallel fetch:
      • User profile (name, preferences)
      • Episodic memory (life events)
      • Relationship memory (preferences, instructions)
      • Memory summaries
      • Knowledge graph entities
      • VUK ENGINE context (goals, constraints)
      • Personality profile
      • Recent conversation turns
      • Short-term session memory
  → Returns: combined context object + rendered system prompt
```

### Memory Layer (`lib/memory-layer.js`)

Stores and retrieves:
- **Recent interactions** — `storeShortTerm()` / `getShortTerm()` (session-scoped, TTL)
- **User preferences** — `storeLongTerm()` with category `preference` / `instruction`
- **Important facts** — `storeLongTerm()` with category `fact` + importance score
- **Unified search** — `searchAll()` with vector similarity across all memory types

Context is injected into every AI call via `formatContextBlock(context)` which
renders all memory layers into the system prompt.

---

## 3. Realtime Streaming Layer

**SSE endpoint:** `netlify/functions/companion-stream.js`  
**Stream handler:** `lib/realtime/stream-handler.js`

### Event types

| Event | Payload | Description |
|---|---|---|
| `state` | `{ state, avatarState, timestamp }` | Companion + avatar state transition |
| `token` | `{ content, accumulated }` | Individual token delta |
| `image` | `{ imageUrl, prompt }` | Generated image |
| `done` | `{ fullText, durationMs }` | Stream complete |
| `error` | `{ error }` | Error during stream |
| `interrupted` | `{ partialText }` | User interrupted the stream |

### Streaming flow

```
1. Client POSTs to companion-stream.js
2. Endpoint emits SSE: state → { state: "listening", avatarState: "listening" }
3. Context assembly + planning
4. Emit SSE: state → { state: "thinking", avatarState: "thinking" }
5. chatStream() begins token generation
6. Emit SSE: state → { state: "responding", avatarState: "speaking" }
7. For each token: emit SSE: token → { content, accumulated }
8. If image generated: emit SSE: image → { imageUrl, prompt }
9. Generate lip-sync frames from accumulated text
10. Emit SSE: done → { fullText, intent, isMedia, timestamp }
11. Emit SSE: state → { state: "idle", avatarState: "idle" }
```

### Interruption

The stream accepts an `AbortSignal`. When the user interrupts:
1. Signal fires → token generation stops
2. Emit `interrupted` event with partial text
3. Transition avatar: speaking → listening (ready for new input)

---

## 4. Avatar State Machine

**State engine:** `lib/realtime/companion-state.js`  
**Avatar controller:** `lib/realtime/avatar-controller.js`

### VUK STATE machine

```
                  ┌─────────┐
                  │  idle    │
                  └────┬────┘
                       │ user_spoke
                       ▼
                  ┌─────────┐
         ┌────── │listening │ ──────┐
         │       └────┬────┘       │
     cancel           │ end_of_turn │ cancel
         │            ▼             │
         │       ┌─────────┐       │
         │       │thinking │ ──────┘
         │       └────┬────┘
         │            │ generation_started
         │            ▼
         │    ┌────────────┐
         └─── │ responding │ ───► listening (interrupt)
              └──────┬─────┘
                     │ stream_complete
                     ▼
               ┌──────────┐
               │   idle   │
               └──────────┘
```

Valid transitions:

| From | To | Trigger |
|---|---|---|
| `idle` | `listening` | User starts speaking / typing |
| `listening` | `thinking` | End of user turn |
| `listening` | `idle` | Cancel / timeout |
| `thinking` | `responding` | AI generation begins |
| `thinking` | `idle` | Cancel / error |
| `responding` | `idle` | Stream complete |
| `responding` | `listening` | User interrupts |

### Avatar states

The avatar mirrors the VUK STATE with visual-specific mappings:

| VUK STATE | Avatar State | Expression | Idle Intensity |
|---|---|---|---|
| `idle` | `idle` | neutral | 0.5 |
| `listening` | `listening` | curious | 0.8 |
| `thinking` | `thinking` | thinking | 0.3 |
| `responding` | `speaking` | (varies) | 0.2 |

Transition states (for animation blending):  
`idle-to-listening`, `listening-to-thinking`, `thinking-to-speaking`,
`speaking-to-idle`, `interrupted`

### Lip-sync

Heuristic lip-sync from text (preparing for voice + lip-sync integration):

```js
generateLipSyncFrames(text, durationMs)
// → [{ timeMs: 0, mouthOpen: 0.6, viseme: 'AA' }, ...]
// Vowels → mouthOpen 0.6, consonants → 0.2
// Frame interval: 80ms
```

---

## 5. Voice Integration

**Voice engine:** `lib/voice-engine.js`  
**Voice streaming:** `lib/realtime/voice-stream.js`

### Speech-to-text (real-time transcription)

```
processVoiceTurn({ audio, user_id, conversation_id, model })
  1. Transcribe audio → text (OpenAI Whisper)
  2. Route transcription through think() orchestrator
  3. Return AI response text

processRealtimeVoice({ model })
  → Low-latency speech-to-speech via OpenAI Realtime API
  → Returns ephemeral session key for WebRTC connection
```

### Text-to-speech output

```
synthesizeSpeech({ text, voice, model_id })
  → ElevenLabs TTS generation
  → Returns audio buffer

streamVoiceResponse({ message, user_id, conversation_id, voice })
  → text → AI response → audio stream
```

### Sync with avatar speaking state

The voice pipeline coordinates with the avatar:
1. Audio input triggers `listening` state
2. Transcription complete → `thinking` state
3. AI response begins → `speaking` state + lip-sync frames
4. Audio playback complete → `idle` state

---

## 6. Image Generation Integration

**Image engine:** `lib/image-engine.js`  
**Media router:** `lib/media-router.js`

### Image generation via AI client

```
generateImage({ prompt, size, orientation })
  → Routes to OpenAI gpt-image-1 (or NoFilter for unfiltered)
  → Portrait orientation auto-detected for face prompts
  → Returns { type: "image", url: string }
```

### Images during conversation

When the AI intent detects `media_generation` with high confidence:
1. `think()` executes the `image_generation` tool step
2. Media router dispatches to the image engine
3. Result short-circuits the pipeline (no chat response needed)
4. In streaming mode: emitted as `image` SSE event for inline rendering

### Inline rendering in UI

The frontend `realtime-session-service.ts` handles `image_generated` events:

```ts
streamCompanionMessage(options, (event) => {
  if (event.type === 'image_generated') {
    // Render image inline in conversation
    renderImage(event.imageUrl, event.prompt);
  }
});
```

---

## 7. Integration — Endpoint Routing

All existing endpoints route through the unified orchestrator:

| Endpoint | Import | Orchestrator call |
|---|---|---|
| `companion-brain.js` | `think()` | `think({ capability })` |
| `roleplay.js` | `think()` | `think({ capability: "roleplay", extra: { character, scenario } })` |
| `daily-plan.js` | `think()` | `think({ capability: "planning" })` |
| `chat.js` | `think()` | `think({ message, user_id, conversation_id })` |
| `ai.js` (handleChat) | `think()` | `think({ message, user_id, model })` |
| `companion-stream.js` | `chatStream()` | SSE wrapper around AI client |

Backward compatibility is maintained — legacy endpoints (`ai.js`, `chat.js`)
continue to work with the same request/response contract while routing through
the unified `think()` pipeline internally.

---

## Example: Orchestrator + Context Usage

```js
import { think } from "./lib/companion-brain.js";

// All AI interactions go through think()
const result = await think({
  message: "Let's continue our space adventure roleplay",
  user_id: "user-123",
  conversation_id: "conv-456",
  model: "gpt-4o",
  capability: "roleplay",          // explicit capability routing
  extra: {
    roleplayCharacter: "Captain Nova",
    roleplayScenario: "deep space exploration",
  },
});

// result.response  → AI-generated roleplay response
// result.intent    → { intent: "roleplay", confidence: 1.0 }
// result.context   → assembled context (profile, memory, goals…)
// result.isMedia   → false
```

## Example: Streaming Implementation

```js
// Server-side SSE (companion-stream.js pattern)
import { formatSSE } from "./lib/realtime/stream-handler.js";
import { createCompanionState, transitionState } from "./lib/realtime/companion-state.js";
import { createAvatarState, avatarStateFromCompanion, transitionAvatar } from "./lib/realtime/avatar-controller.js";

let companionState = createCompanionState();              // idle
let avatarState = createAvatarState();                    // idle

// 1. User message received
companionState = transitionState(companionState, "listening");
avatarState = transitionAvatar(avatarState, "listening");
yield formatSSE("state", { state: "listening", avatarState: "listening" });

// 2. Processing
companionState = transitionState(companionState, "thinking");
avatarState = transitionAvatar(avatarState, "thinking");
yield formatSSE("state", { state: "thinking", avatarState: "thinking" });

// 3. Streaming response
companionState = transitionState(companionState, "responding");
avatarState = transitionAvatar(avatarState, "speaking");
yield formatSSE("state", { state: "responding", avatarState: "speaking" });

for await (const token of chatStream({ prompt, model })) {
  accumulated += token;
  yield formatSSE("token", { content: token, accumulated });
}

// 4. Complete
companionState = transitionState(companionState, "idle");
avatarState = transitionAvatar(avatarState, "idle", { force: true });
yield formatSSE("done", { fullText: accumulated });
yield formatSSE("state", { state: "idle", avatarState: "idle" });
```

---

## Related Documentation

- [VUK BRAIN Architecture](./architecture.md) — orchestrator pipeline details
- [Realtime Experience Layer](./realtime-experience.md) — streaming, avatar, voice deep-dive
- [VUK ENGINE Architecture](./companion-engine-architecture.md) — goals, constraints, initiatives
