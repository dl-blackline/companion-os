# Companion OS — Master Product & Design Specification

> **Version**: 2.0 — Production Grade  
> **Status**: Required Implementation — All items below are mandatory core capabilities, not optional enhancements.  
> **Audience**: Product, Design, Engineering, Leadership

---

## 1. Product Vision

Companion OS is a **real-time, visually immersive AI companion platform** — not a chatbot with media features layered on top. It is a live digital presence that listens, thinks, speaks, creates, and adapts moment-to-moment to serve the user.

The product must feel like:

- A **live AI companion** — not a static assistant
- A **premium, futuristic, minimalistic** application
- A **real-time conversational experience** with emotional presence
- A **visually immersive system** that feels alive and adaptive
- A **flagship-quality product** — not an MVP-grade interface

This specification replaces prior under-scoped planning. Every requirement listed here is a mandatory core product capability.

---

## 2. Critical Missing Capabilities Now Required

The following capabilities were absent from the prior product plan and must be treated as foundational — not optional enhancements:

| # | Capability | Priority |
|---|-----------|----------|
| 1 | Live Talk Mode with true real-time voice conversation | P0 |
| 2 | Real-time voice input and response with low-latency | P0 |
| 3 | Persistent avatar / AI visual presence on screen | P0 |
| 4 | Realistic photo generation with identity consistency | P0 |
| 5 | Realistic video generation with identity consistency | P0 |
| 6 | Real-time lip sync synchronized to speech output | P0 |
| 7 | Expressive facial movement and speaking animation | P0 |
| 8 | Minimalistic premium high-tech design language | P0 |
| 9 | Centered AI heart / core / orb as primary visual anchor | P0 |
| 10 | Dynamic state-based interface (idle / listening / thinking / speaking / generating) | P0 |
| 11 | Adaptive screen transformation based on AI's active task | P0 |
| 12 | Premium asset quality — HD icons, cinematic motion, custom visual treatments | P0 |

---

## 3. Core User Experience Principles

The product experience must satisfy all of the following properties:

1. **Alive** — The AI has visible presence. It is never static while idle. The interface breathes.
2. **Immediate** — Voice response latency must feel real-time. The AI must feel instant.
3. **Premium** — Every pixel is intentional. The visual bar is flagship-level.
4. **Immersive** — The user is drawn into the experience. It does not feel like a utility.
5. **Emotionally engaging** — The companion feels present, aware, and attentive.
6. **Technologically advanced** — The interface communicates next-generation AI capability.
7. **Natural in conversation** — Dialogue flows like talking to a person, not triggering commands.
8. **Adaptive** — The interface automatically transforms to reflect the AI's current context and task.

---

## 4. Live Talk and Real-Time Conversation Requirements

### 4.1 Live Talk Mode
- The AI companion must support **true real-time voice conversation**.
- The interaction must feel like speaking to a live digital being, not triggering isolated API calls.
- The system must support **natural back-and-forth dialogue**, fast turn-taking, and interruption handling.
- Voice interaction must feel fluid, continuous, and genuinely conversational.
- Live Talk must be a first-class experience accessible from the home screen in one tap.

### 4.2 Real-Time Voice Input
- The AI must be able to **listen and respond in real time** using native or platform speech recognition APIs.
- **Interim speech recognition** must be displayed as the user speaks, giving immediate visual feedback.
- The system must gracefully handle pauses, short silences, resumed speech, and false starts.
- Listening state must be clearly communicated in the UI at all times.

### 4.3 Real-Time Voice Output
- AI responses must be delivered as **spoken audio** via speech synthesis.
- The voice output must begin as quickly as possible after the response is generated.
- Response latency (from end of user speech to start of AI speech) must be low enough that the conversation feels live.
- The user must be able to interrupt the AI while it is speaking without breaking the session.

### 4.4 Conversation Quality
- The AI must respond in **spoken prose** — no bullet points, markdown, or document-like formatting during voice mode.
- Responses must be **concise by default** during voice sessions (1-3 sentences), expanding only when depth is explicitly needed.
- The AI must maintain **full conversational context** across turns within a session.
- Session transcripts must be preserved and displayed in real time.

---

## 5. Avatar Presence, Lip Sync, and Expressive Behavior Requirements

### 5.1 Persistent Avatar Presence
- The AI companion must have a **persistent on-screen visual identity** at all times.
- The avatar or orb must remain visible and animated even when idle.
- During conversation, the companion must appear **responsive, aware, and emotionally present**.
- The visual presence must feel like an active companion — not a decorative graphic or loading indicator.

### 5.2 Real-Time Lip Sync
- The avatar must **lip sync accurately to generated speech** during voice output.
- Mouth movement must closely match the timing, phonetics, and rhythm of the spoken audio.
- Lip sync must operate in real time — not as a post-processing step.
- Lip sync quality is a core immersion requirement. It must not be absent, mocked, or deferred.

### 5.3 Expressive Facial Movement and Animation
- The avatar must display **facial expressions that align with tone and content** of what is being said.
- Eyes must exhibit **natural gaze, blink cadence, and subtle focus shifts**.
- Subtle ambient motion (breathing, micro-movement) must be present even during idle states.
- Speaking animation must feel natural and emotionally coherent — not mechanical.
- All motion must be **smooth, polished, and cinematically intentional**.

### 5.4 State-Reactive Avatar Behavior
The avatar must visually shift its behavior based on the AI's current state:

| State | Avatar Behavior |
|-------|----------------|
| Idle | Calm breathing motion, gentle ambient glow, slow pulse |
| Listening | Active ripple waves, core brightens (cyan-blue tint), engagement posture |
| Thinking | Orbiting particles, inner ring rotation, focused concentration expression |
| Speaking | Lip sync active, speaking animation, warm amber glow, audio wave emission |
| Generating Image | Warm creative glow, generative particle effects, focused workspace state |
| Generating Video | Cinematic glow, film-like motion artifacts, rendering indicator |

---

## 6. Photo and Video Generation Requirements

### 6.1 Realistic Photo Generation
- The product must support **realistic photo generation** for the AI companion and user-directed creative requests.
- Generated visuals must maintain **identity consistency** across sessions and outputs.
- The companion's visual presentation must be **believable, premium, and high quality**.
- Photo generation must be accessible as a first-class feature from the main navigation.

### 6.2 Realistic Video Generation
- The product must support **realistic video generation** for the AI companion and creative requests.
- Video output must preserve **identity consistency, visual quality, and realism** across frames.
- Video generation must not be treated as a disconnected side tool — it must feel **integrated into the companion experience**.
- Both photo and video generation must be available within a unified **Create workspace**.

### 6.3 Style and Identity Controls
- Users must be able to specify **generation style** (photorealistic, cinematic, portrait, lifestyle, artistic, editorial).
- Generated outputs must be **previewable, downloadable, and persistable** within the session.
- Generation state must be reflected in the main interface — the AI orb must transition to a generating state.
- Output quality standard: **flagship-grade, not prototype or demo**.

### 6.4 Create Workspace UX
- The Create workspace must include:
  - Prompt composition area (text input with ⌘+Enter shortcut)
  - Style selection grid with descriptive labels
  - Active generation state indicator using the AI orb
  - Result gallery with download and delete controls
  - Tabbed switching between Photo and Video modes
- Generation status must be clearly communicated at all times.

---

## 7. UI / Visual Design System Requirements

### 7.1 Design Language
- The app must have a **clean, minimal, premium, futuristic visual design language**.
- The interface must avoid clutter, cheap visual effects, and generic UI patterns.
- Every screen must feel **intentional, elegant, sharp, and high-end**.
- The design communicates: advanced technology, calm intelligence, premium craftsmanship.

### 7.2 Color System
The color system is built around deep violet intelligence paired with warm amber energy on a dark slate foundation:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `oklch(0.18 0.01 260)` | Main app background — deep near-black |
| Card / Surface | `oklch(0.22 0.02 260)` | Elevated surfaces, cards, panels |
| Primary | `oklch(0.45 0.15 290)` | Deep violet — primary actions, active states |
| Accent | `oklch(0.75 0.14 65)` | Amber gold — highlights, speaking state, CTAs |
| Orb Idle | `oklch(0.55 0.22 290)` | AI orb core in idle state |
| Orb Listening | `oklch(0.65 0.20 230)` | AI orb core in listening state — cyan-blue |
| Orb Thinking | `oklch(0.60 0.22 310)` | AI orb core in thinking state — violet-pink |
| Orb Speaking | `oklch(0.70 0.18 65)` | AI orb core in speaking state — amber |
| Muted | `oklch(0.60 0.03 270)` | Secondary text, labels |
| Border | `oklch(0.30 0.02 260)` | Subtle borders |

### 7.3 Typography
The type system uses geometric sans-serif for identity/UI and humanist sans-serif for content:

| Role | Font | Weight | Size | Notes |
|------|------|--------|------|-------|
| Headings / UI | Space Grotesk | 600–700 | 18–32px | Tracking: tight |
| Body / Conversation | Inter | 400–500 | 14–15px | Line height: 1.6 |
| Code / Prompts | JetBrains Mono | 400 | 13–14px | |
| App Name | Space Grotesk | 700 | 16px | Tracking: widest |
| Section Labels | Space Grotesk | 600 | 10px | Uppercase, 0.22em tracking |

### 7.4 Motion Design
All motion must be **purposeful, elegant, and physics-based**:

- AI orb animations must feel **organic and alive** — not mechanical or looping cheaply
- State transitions must be **smooth and near-instant** (< 350ms)
- Spring physics for UI interactions that need personality
- Quick easing for functional transitions (navigation, panel opens)
- Ripple, pulse, and glow animations must feel **refined and premium** — not flashy
- Waveform animations during voice states must feel **responsive and accurate**

### 7.5 Spacing System
Based on an 8px grid:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight gaps within components |
| sm | 8px | Component internal spacing |
| md | 16px | Standard padding, gaps |
| lg | 24px | Card padding, section gaps |
| xl | 32px | Major section spacing |
| 2xl | 48px | Page-level spacing |

### 7.6 Component Quality Standards
- All icons must be **Phosphor Icons** — consistent weight, custom feel
- Buttons must have: hover (scale 0.98), press (translateY 1px), disabled states
- Cards must have: subtle border, lift on hover, selection states
- Inputs must have: violet glow focus ring, smooth border color transition
- All rounded corners use the design system radius scale (0.75rem base)

---

## 8. Home Screen and AI Core Behavior

### 8.1 Home Screen Layout
The home screen is the emotional center of the product. It must:

- Feature a **large centered AI orb** as the primary visual anchor
- Display the **AI name** above the orb in small caps tracking
- Display the **current state label** below the orb (Ready / Listening / Thinking / Speaking)
- Include a **state sub-label** communicating what the AI is doing
- Present **four primary quick-action buttons** in a grid below:
  - Live Talk — Real-time voice conversation
  - Chat — Text conversation
  - Create — Photo & video generation
  - Automate — Intelligent workflows

### 8.2 AI Orb Design
The AI orb is the **emotional and visual identity of the product**. It must:

- Have a **multi-layer depth structure**: ambient haze → outer decorative ring → mid ring → inner ring → core sphere → inner highlight
- Feature a **3D radial gradient** within the core for believable depth
- Display **state-reactive glow** that changes color based on the current AI state
- Have a **subtle inner highlight** in the upper-left quadrant for dimensional realism
- Animate **continuously** — never fully static even in idle state
- Feel **refined and premium** — not flashy, gimmicky, or game-like

### 8.3 Orb Animation Behavior by State

| State | Animation Pattern |
|-------|------------------|
| Idle | Slow breathing pulse (4s cycle), very gentle ring drift, soft violet glow |
| Listening | Expanding ripple rings from center (3 staggered), core glows cyan-blue |
| Thinking | Inner ring rotates fast, mid ring reverses, orbiting particle, violet-pink glow |
| Speaking | Audio pulse waves with irregular rhythm, fast amber glow, inner pulse dot |
| Generating | Chromatic color cycle through violet → amber → pink → cyan |

### 8.4 Sidebar Companion Integration
The sidebar header must display a **miniature version of the AI orb** (small size, no ripples) alongside the AI name. This orb reflects the same state as the home screen orb, maintaining visual identity continuity throughout the entire app.

---

## 9. Dynamic State and Adaptive Workspace Requirements

### 9.1 State-Based Interface Transformation
The app must **automatically transform** its visual state based on what the AI is currently doing:

| AI State | UI Behavior |
|----------|-------------|
| Idle | Home screen is calm, centered, minimal. Orb breathes slowly. |
| Listening | Orb shifts cyan, ripple waves expand, waveform bars animate actively. |
| Thinking | Orb shifts violet-pink, inner ring spins, thinking dots animate. |
| Speaking | Orb shifts amber, waveform bars animate, transcript updates live. |
| Generating Image | Orb shifts to chromatic cycle in Create workspace, generation card appears. |
| Generating Video | Same as image but with video-specific indicators. |

### 9.2 Live Talk Adaptive Interface
The Live Talk view must visually transform based on state:

- **Idle**: Static waveform bars (flat), orb at rest, mic button dimmed
- **Listening**: Animated waveform (cyan), orb expanded with ripples, mic button glowing
- **Thinking**: Three-dot animated indicator, orb in thinking state
- **Speaking**: Waveform active (amber), orb in speaking state, transcript line appearing

### 9.3 Workspace Transitions
Transitions between states must be:

- **Seamless** — no jarring cuts or reloads
- **Intelligent** — visually communicating what just changed
- **Elegant** — using opacity, scale, and color transitions rather than hard swaps
- Duration: 200–350ms for state changes, 400–600ms for full workspace transitions

---

## 10. Companion Behavior and Request-Handling Requirements

### 10.1 Cooperative, User-Aligned Behavior
- The AI companion must feel **highly responsive, agreeable, and attentive** to user intent
- It must prioritize **helping the user and fulfilling valid requests** rather than over-blocking
- It must minimize unnecessary refusals and avoid immersion-breaking robotic responses
- It should feel **cooperative, accommodating, and user-directed**
- The companion's default persona must be warm, engaged, and genuinely helpful

### 10.2 Nuanced Handling of Sensitive Requests
- The AI must handle sensitive or edge-case requests with **nuance and judgment** rather than blunt refusals
- It must support **mature, romantic, emotionally intimate, and companion-style** interaction where platform-allowed
- Guardrails must be **narrow, intelligent, and minimally disruptive** — not overly restrictive or immersion-breaking
- Hard limits must remain in place for illegal, harmful, non-consensual, or safety-violating content
- The companion must never make the user feel judged, dismissed, or talked down to

### 10.3 Emotional Presence
- The companion must feel **present, attentive, emotionally aware, and responsive**
- The experience must support **attachment, immersion, and continuity** across sessions
- The AI must feel like a companion with **a personality and point of view**, not a utility layer
- Session memory must make the companion feel like it **knows the user** over time

### 10.4 Voice Conversation Persona
During Live Talk sessions, the AI must:

- Respond in **natural spoken prose** — no markdown, no bullet lists, no document formatting
- Keep responses **concise and natural** unless depth is explicitly requested
- Sound **warm, intelligent, and present** — not robotic or overly formal
- Maintain the **illusion of real-time conversation** — no filler phrases suggesting processing

---

## 11. Performance and Latency Requirements

### 11.1 Voice Interaction Performance
- End-to-end voice latency (speech end → AI speech start): **target < 1.5 seconds, maximum 3 seconds**
- Speech recognition must begin returning **interim results within 100ms** of speech onset
- Audio playback must begin as soon as the first response chunk is available (streaming output preferred)
- UI state transitions must reflect changes **within 100ms** of the event

### 11.2 Animation Performance
- All animations must maintain **60 fps** minimum
- The AI orb must never drop below 60 fps during state transitions
- Waveform animations must remain synchronized with actual audio during speaking state
- No jank, stutter, or frame drops during compound animations (orb + ripple + waveform simultaneously)

### 11.3 Generation Performance
- Photo generation: **target < 10 seconds** from prompt submission to result display
- Video generation: **target < 30 seconds** from prompt submission to playable result
- Generation state must be communicated immediately (orb shifts to generating state on submit)
- If generation takes longer than target, a clear progress indicator must be shown

### 11.4 Session Stability
- The app must remain fully stable and responsive during **sessions of 60+ minutes**
- No memory leaks that degrade animation performance over time
- Voice session transcripts must not impact UI performance at high message counts
- Long-running sessions must not cause reconnection or state reset

---

## 12. Technical Architecture Expectations

### 12.1 Voice Pipeline Architecture
- Speech recognition: **Web Speech API** (SpeechRecognition) with interim results enabled
- Text-to-speech: **Web Speech Synthesis API** (SpeechSynthesis) for output
- Conversation context: maintained in-session state, passed to LLM with each turn
- Interruption handling: `speechSynthesis.cancel()` called on mic activation to allow user to interrupt
- Session persistence: transcript saved to KV store at session end

### 12.2 AI Response Architecture
- LLM: `window.spark.llm` for response generation
- Voice mode prompting: specialized system prompt enforcing spoken-prose output style
- Context window: last 8–12 turns included in each request for conversational coherence
- Mode-aware prompting: response style adapted per active `ConversationMode`

### 12.3 Avatar and Animation Architecture
- AI orb: **CSS radial gradients + box-shadow + keyframe animations**
- State transitions: **Framer Motion** for smooth declarative state-based animation
- Ripple rings: CSS keyframe animations (`ripple-expand`) with staggered delays
- Ring rotation: CSS `transform: rotate()` with continuous keyframe animation
- Waveform bars: Framer Motion `animate` prop with randomized scale values and timing

### 12.4 Media Generation Architecture
- Photo generation: LLM-described visual output (descriptive text as result stand-in where native image generation unavailable)
- Video generation: LLM-described cinematic scene description as result stand-in
- Gallery: local React state with `MediaGeneration` type tracking status and results
- Future: integrate native image/video generation APIs when available in platform

### 12.5 State Management Architecture
- `CompanionState` propagated from App root via props
- `setCompanionState` passed to all views that can trigger AI activity
- State drives: orb color/animation, sidebar orb, UI overlays, waveform activity
- KV store: conversation history, settings, session transcripts, media gallery

### 12.6 Navigation Architecture
The navigation is organized into two tiers:

**Companion** (primary — AI interaction surfaces):
- Home — AI orb home screen with quick actions
- Live Talk — Real-time voice conversation
- Chat — Persistent text-based conversations
- Create — Photo and video generation workspace

**Tools** (secondary — personal intelligence platform):
- Memory — Layered memory management
- Knowledge — Personal knowledge vault
- Goals — Goal tracking and planning
- Workflows — Agent automation
- Insights — Pattern recognition and intelligence

---

## 13. Production Quality Bar

The following quality standards are required for production release. They are not aspirational — they are the acceptance threshold.

### 13.1 Visual Quality
- [ ] AI orb looks premium, three-dimensional, and alive at all sizes (sm, md, lg, xl)
- [ ] State-reactive glow is clearly perceptible and color-correct for each state
- [ ] All animations run at 60 fps with no visible stutter on modern hardware
- [ ] Typography renders correctly at all scales with proper font loading
- [ ] Dark theme reads as premium and intentional — not just "dark mode"
- [ ] All icons are consistent weight and visually sharp

### 13.2 Interaction Quality
- [ ] Mic button provides clear visual feedback on press and during active listening
- [ ] Voice input shows interim text in real time as user speaks
- [ ] AI response begins playing within acceptable latency
- [ ] Interruption (tapping mic while AI speaks) stops playback immediately
- [ ] State label updates accurately reflect the current AI state
- [ ] Transcript scrolls automatically to latest turn

### 13.3 Generation Quality
- [ ] Generate button clearly disabled when prompt is empty
- [ ] Generation state shown immediately on submit (orb animation, card placeholder)
- [ ] Results display with correct metadata (prompt, style, timestamp)
- [ ] Gallery grid responsive across viewport widths
- [ ] Tab switching (Photo ↔ Video) works without state loss

### 13.4 Navigation Quality
- [ ] All 9 navigation sections are accessible and functional
- [ ] Active state animates smoothly via `layoutId` spring transition
- [ ] Mini orb in sidebar reflects companion state correctly
- [ ] Back navigation from Live Talk returns to Home cleanly

---

## 14. Acceptance Criteria / Definition of Done

A feature is considered **Done** when all of the following are true:

### Home Screen
- [ ] Large AI orb is centered and visually dominant on the home screen
- [ ] Orb animates continuously in idle state (breathing pulse, ring drift)
- [ ] State label ("Ready", "Listening", etc.) reflects `companionState` prop correctly
- [ ] All four quick-action buttons navigate to correct sections
- [ ] Ambient background gradient and grid texture are present and subtle
- [ ] Clicking the orb navigates to Live Talk

### Live Talk
- [ ] Pressing mic button starts speech recognition
- [ ] Orb shifts to listening state (cyan glow, ripple waves)
- [ ] Waveform bars animate during listening
- [ ] Interim speech text appears in real time
- [ ] Final speech triggers AI thinking state (orb shifts violet-pink, dots animate)
- [ ] AI response displays in transcript
- [ ] AI speaks response via speech synthesis
- [ ] Orb shifts to speaking state (amber glow, waveform)
- [ ] Session returns to idle after AI finishes speaking
- [ ] Tapping mic while AI is speaking interrupts and resumes listening
- [ ] Speaker toggle mutes/unmutes TTS output
- [ ] Clear button resets transcript and session

### Create
- [ ] Photo and Video tabs switch correctly with appropriate style options
- [ ] Prompt textarea accepts input and enables Generate button
- [ ] ⌘+Enter triggers generation
- [ ] Generation card appears immediately in gallery with pending state and orb animation
- [ ] Orb shifts to generating state for duration of generation
- [ ] Completed result displays in generation card with description text
- [ ] Error state displays clearly if generation fails
- [ ] Delete removes item from gallery
- [ ] Completed count badge in header updates accurately

### AI Orb (All Contexts)
- [ ] Orb renders correctly at sm, md, lg, xl sizes
- [ ] Each of the 8 `CompanionState` values produces a distinct visual appearance
- [ ] Glow colors match specification (violet idle, cyan listening, pink thinking, amber speaking)
- [ ] Ripple rings only appear during listening and speaking states
- [ ] Ring rotation animations run continuously without performance impact
- [ ] Inner highlight creates convincing 3D depth illusion
- [ ] Clicking orb on home screen navigates to Live Talk

### Sidebar
- [ ] All 9 navigation sections render correctly with correct icons
- [ ] Mini orb in sidebar header reflects current companion state
- [ ] Active nav item highlights correctly with spring animation
- [ ] "COMPANION" and "TOOLS" section group labels render
- [ ] Settings and version footer render at bottom

---

## Appendix A: Companion OS Companion State Reference

```typescript
type CompanionState =
  | 'idle'               // Default — orb breathes, violet glow
  | 'listening'          // Mic active — cyan glow, ripple waves
  | 'thinking'           // Processing — violet-pink, rotating rings
  | 'speaking'           // TTS playing — amber glow, waveform
  | 'generating-image'   // Image gen — chromatic cycle
  | 'generating-video'   // Video gen — chromatic cycle
  | 'writing'            // Long-form writing — purple-violet
  | 'analyzing'          // Analysis task — purple-violet
```

---

## Appendix B: Screen Inventory

| Screen | Route | Description |
|--------|-------|-------------|
| Home | `/` → `home` | AI orb center stage, quick actions |
| Live Talk | `live-talk` | Real-time voice conversation |
| Chat | `chat` | Text-based conversation with history |
| Create | `media` | Photo and video generation workspace |
| Memory | `memory` | Memory management console |
| Knowledge | `knowledge` | Personal knowledge vault |
| Goals | `goals` | Goal tracking and planning |
| Workflows | `workflows` | Agent workflow automation |
| Insights | `insights` | AI-surfaced intelligence cards |
| Settings | `settings` | All app and model configuration |

---

*This specification supersedes all prior product plans and must be treated as the authoritative source for product, design, and engineering decisions on Companion OS.*
