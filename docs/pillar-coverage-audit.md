# Product Pillar Coverage Audit

> Generated: 2026-03-24 · Repo: `companion-os`

---

## 1 — Feature Coverage Matrix

| # | Pillar | Coverage | Can Claim Publicly? | Key Evidence |
|---|--------|----------|---------------------|--------------|
| 1 | **Its Own Computer** | 🟡 Partially Covered | No | Job queue, agent tasks, workflow engine, and avatar state machine exist, but there is no sandboxed runtime, file system, or OS-level abstraction — it is a web app, not a "computer." |
| 2 | **Make It Yours** | 🟢 Fully Covered | Yes | Persona engine, personality profiles, custom system prompts, user identity (avatar/emojicon), goal & constraint tracking, appearance settings, and onboarding flow. |
| 3 | **Any Model** | 🟢 Fully Covered | Yes | Model registry with 40+ models across 6 providers (OpenAI, NoFilter, Gemini, PiAPI/Flux, Leonardo, ElevenLabs). Per-user model selection, model cache, provider-level AI router, and media-specific model routing. |
| 4 | **Multi-Channel** | 🟡 Partially Covered | No | Text chat (SSE streaming), voice (WebRTC + Whisper + ElevenLabs), image/video input supported. But no email channel, no SMS, no push notifications, no webhooks — channels are limited to in-app text + voice. |
| 5 | **Works in Background** | 🟡 Partially Covered | No | Job queue, job worker, autonomous scheduler, and 4 agent types exist. However the scheduler is client-side `setInterval` — no server-triggered cron. Background work only runs while the browser tab is open. |
| 6 | **Managed for You** | 🟡 Partially Covered | No | System health checks, structured error recovery, audit logging, security scanning, Dependabot, and feature flags. But no auto-update notification, no user-facing status page, and no rate-limiting middleware. |
| 7 | **Skills & Apps** | 🟡 Partially Covered | No | Skill engine, tool registry (10 tools), workflow engine, agent registry. But the tool registry is hard-coded — no plugin loader, no third-party marketplace, no user-installable skills. |
| 8 | **Always On** | 🟡 Partially Covered | No | Health endpoint, session persistence, reconnection logic (3 attempts + backoff), localStorage fallback. But no PWA/service worker, no offline queue, no push-based reconnect, and no multi-device sync — availability drops to zero when the browser tab closes. |
| 9 | **Persistent Memory** | 🟢 Fully Covered | Yes | 4-tier hierarchical memory (short-term → episodic → relationship → summaries), vector search (pgvector), knowledge graph, memory classification (8 types), recency decay, conflict resolution, media memory pipeline, and Memory View UI. |

### Legend

| Symbol | Meaning |
|--------|---------|
| 🟢 | **Fully Covered** — feature is implemented end-to-end and can be publicly claimed today |
| 🟡 | **Partially Covered** — core building blocks exist but significant gaps prevent an honest public claim |
| 🔴 | **Not Covered** — feature is absent or trivially stubbed |

---

## 2 — Pillar-by-Pillar Deep Dive

### Pillar 1 · Its Own Computer

**Current implementation**

| Layer | Files | What exists |
|-------|-------|-------------|
| Backend | `lib/job-queue.js`, `lib/job-worker.js`, `lib/agent-manager.js` | Async job queue (image, video, music, content_workflow, agent_task) with status lifecycle |
| Backend | `lib/workflow-engine.js` | Multi-step content production pipeline (create project → add steps → execute) |
| Backend | `lib/autonomous/agent-manager.js`, `lib/agent-registry.js` | 4 system agents (research, content, planner, memory) |
| Backend | `lib/realtime/companion-state.js` | State machine (idle → listening → thinking → speaking → generating) |
| Frontend | `src/components/CompanionOrb.tsx`, `src/components/FloatingLiveOrb.tsx` | Visual presence / avatar |
| DB | `supabase/migrations/007_job_queue.sql`, `008_agent_tasks.sql` | Persistence for jobs and tasks |

**Missing pieces**

| Area | Gap |
|------|-----|
| Backend | No sandboxed code execution environment — the "computer" is Netlify functions, not an isolated runtime the user owns |
| Backend | No user-scoped file system or storage workspace (media is stored in Supabase buckets, but there is no file-manager abstraction) |
| Frontend | No desktop/workspace metaphor — the UI is view-based (Chat, Media, Memory, Settings), not an OS shell |
| Infra | No container or VM per user; all users share the same serverless backend |
| UX | No "my files", "my processes", or "task manager" view |

**Minimum work to claim**

1. Ship a **Workspace / Files view** exposing Supabase storage as a personal file browser.
2. Add a **Running Tasks panel** showing active jobs (from `job_queue` table) with cancel/retry.
3. Position these as "your companion's workspace" — the metaphor is that the AI has its own scratch space.

---

### Pillar 2 · Make It Yours

**Current implementation**

| Layer | Files | What exists |
|-------|-------|-------------|
| Backend | `lib/personality-engine.js`, `lib/system-prompt.js`, `lib/context-builder.js` | Personality profiles injected into every AI call |
| Backend | `netlify/functions/user-preferences.js`, `netlify/functions/user-identity.js` | Preference and identity CRUD |
| Frontend | `src/context/settings-context.tsx`, `src/components/views/SettingsView.tsx` | Full settings UI (model, tone, memory, privacy, identity) |
| Frontend | `src/components/views/ControlCenterView.tsx` | Quick-access model + tone controls |
| Frontend | `src/components/EmojiOrbCustomizer.tsx`, `src/services/user-identity-service.ts` | Avatar / emojicon generation from selfie |
| DB | `supabase/migrations/005_personality_relationship.sql`, `013_companion_engine.sql`, `015_ai_control_settings.sql`, `016_user_identity_profiles.sql` | Personality, goals, constraints, AI settings, identity profiles |
| Types | `src/types/index.ts` (UserPreferences, Persona, ConversationMode), `src/types/companion.ts` | Rich type system for personalization |

**Missing pieces**

| Area | Gap |
|------|-----|
| UX | No guided onboarding wizard — setup is manual in Settings |
| Frontend | No "share your companion config" or export/import of persona |

**Minimum work to claim** — Already claimable. Optional: add a 3-step onboarding wizard on first login.

---

### Pillar 3 · Any Model

**Current implementation**

| Layer | Files | What exists |
|-------|-------|-------------|
| Backend | `lib/model-registry.js` | 40+ models: chat (GPT-5.x, GPT-4.x, NoFilter), image (OpenAI, Flux, Leonardo), video (Sora, Runway, Kling, Hailuo), music (Suno), voice (ElevenLabs, OpenAI) |
| Backend | `lib/ai-router.js`, `lib/openai-client.js`, `lib/nofilter-client.js`, `lib/gemini-client.js` | Provider abstraction with `resolveProvider()` + `runAI()` |
| Backend | `lib/model-config.js` | Env-driven model defaults with lazy getters |
| Backend | `lib/media-router.js`, `lib/media-engine.js` | Media-specific provider routing |
| Frontend | `src/context/settings-context.tsx`, `src/utils/model-cache.js` | Per-user model selection, persisted |
| Frontend | `src/components/views/SettingsView.tsx`, `src/components/views/ControlCenterView.tsx` | Model picker UI |
| DB | `supabase/migrations/015_ai_control_settings.sql` | Per-user model + temperature + max_tokens |

**Missing pieces**

| Area | Gap |
|------|-----|
| Backend | No Anthropic Claude client — `lib/gemini-client.js` exists but no `lib/anthropic-client.js` |
| Backend | No open-source / local model support (Ollama, llama.cpp) |
| Frontend | `ControlCenterView` only shows 2 hard-coded models (`gpt-4o`, `gpt-4o-mini`) — does not reflect the full registry |

**Minimum work to claim** — Already claimable for cloud models. To strengthen: wire `ControlCenterView` dropdown to full `MODEL_REGISTRY` and add Anthropic provider.

---

### Pillar 4 · Multi-Channel

**Current implementation**

| Layer | Files | What exists |
|-------|-------|-------------|
| Backend | `netlify/functions/chat.js`, `netlify/functions/companion-stream.js`, `netlify/functions/ai-stream.js` | Text chat + SSE streaming |
| Backend | `lib/voice-engine.js`, `lib/media/voice-generator.js`, `lib/realtime/voice-stream.js` | Voice I/O (Whisper STT, ElevenLabs TTS, OpenAI Realtime WebRTC) |
| Backend | `lib/multimodal-engine.js`, `lib/vision-analyzer.js` | Image/video input analysis |
| Frontend | `src/components/views/ChatView.tsx` | Text chat UI |
| Frontend | `src/components/views/LiveTalkView.tsx` | Voice conversation UI |
| Frontend | `src/lib/realtime-voice-client.ts` | WebRTC voice client |
| Types | `src/types/realtime.ts` | SSE event types including voice events |

**Missing pieces**

| Area | Gap |
|------|-----|
| Backend | No email send/receive channel (SendGrid, SES, or similar) |
| Backend | No SMS channel (Twilio or similar) |
| Backend | No webhook inbound/outbound system |
| Backend | No push notification service (Web Push API, Firebase) |
| Frontend | No notification permission flow or push subscription |
| UX | "Email Notifications" toggle is disabled with "Coming soon" in SettingsView |

**Minimum work to claim**

1. Add **Web Push** via `web-push` + a Netlify function — lets the companion reach the user when the tab is closed.
2. Add an **email digest** via SendGrid — summarize the day and email the user.
3. These two channels + existing text + voice = legitimate "multi-channel."

---

### Pillar 5 · Works in Background

**Current implementation**

| Layer | Files | What exists |
|-------|-------|-------------|
| Backend | `lib/job-queue.js`, `lib/job-worker.js` | Async job queue with worker processing |
| Backend | `lib/autonomous/scheduler.js` | Scheduler with 5 recurring tasks (memory consolidation, knowledge graph, goal analysis, project monitoring, content advisor) |
| Backend | `lib/agent-registry.js`, `lib/agent-manager.js`, `netlify/functions/agent-task.js` | Agent task creation + management |
| DB | `supabase/migrations/007_job_queue.sql`, `008_agent_tasks.sql` | Job and agent task persistence |

**Missing pieces**

| Area | Gap |
|------|-----|
| Infra | `scheduler.js` uses `setInterval()` — runs only while a browser tab or Node process is alive. **No server-side cron trigger.** |
| Infra | No Netlify Scheduled Function (`schedule` property in `netlify.toml`) |
| Infra | No external cron service (GitHub Actions schedule, AWS EventBridge, etc.) |
| Frontend | No service worker for background sync |
| UX | No "background activity" indicator or history in the UI |

**Minimum work to claim**

1. Convert `scheduler.js` to a **Netlify Scheduled Function** (`@netlify/functions` with `schedule` config) — runs server-side on a cron.
2. Add a **Background Activity panel** in the UI showing recent agent tasks and their status.
3. These two changes make background processing real and visible.

---

### Pillar 6 · Managed for You

**Current implementation**

| Layer | Files | What exists |
|-------|-------|-------------|
| Backend | `netlify/functions/system-health.js` | 5-service health check (Supabase, OpenAI, Vector, PiAPI, Leonardo) |
| Backend | `netlify/functions/audit-log.js` | Action audit logging |
| Backend | `netlify/functions/feature-flags.js` | Feature flag management |
| Backend | `lib/_security.js` | Payload validation, sanitization, UUID checks |
| Scripts | `scripts/scan-source-secrets.mjs`, `scripts/check-dist-secrets.mjs` | Pre/post-build secret scanning |
| Infra | `.github/dependabot.yml` | Automated dependency updates |
| Infra | `netlify.toml` | Auto-deploy on push |
| Types | `src/types/async.ts` | Structured error categories with `retryable` flag |

**Missing pieces**

| Area | Gap |
|------|-----|
| Backend | No rate-limiting middleware (relies on provider limits) |
| Frontend | No user-facing status page or health dashboard |
| Frontend | No auto-update notification ("new version available") |
| Infra | No uptime monitoring (Pingdom, UptimeRobot, etc.) |
| UX | Users have no visibility into system health or maintenance |

**Minimum work to claim**

1. Add **rate limiting** to the AI orchestrator (token bucket per user, stored in Supabase).
2. Add a **Status indicator** in the UI (green/yellow/red dot) calling `system-health.js`.
3. Add a **version check** — compare `package.json` version against a deployed manifest and show "update available" toast.

---

### Pillar 7 · Skills & Apps

**Current implementation**

| Layer | Files | What exists |
|-------|-------|-------------|
| Backend | `lib/skill-engine.js` | Skill CRUD, usage tracking, AI-generated suggestions |
| Backend | `lib/tool-registry.js` | 10 static tools (memory_search, knowledge_graph, image/video/music gen, web_search, maps, goals, content_workflow, voice) |
| Backend | `lib/workflow-engine.js` | Multi-step content production workflows |
| Backend | `lib/capability-router.js` | Route tasks to capability handlers |
| Backend | `lib/agent-registry.js` | 4 system agents |
| Frontend | `src/lib/realtime-voice-client.ts` | 5 function-calling tools in voice mode |
| DB | `supabase/migrations/006_content_workflow_skills.sql` | Skills, workflows, agents tables |

**Missing pieces**

| Area | Gap |
|------|-----|
| Backend | Tool registry is **hard-coded** — no `registerTool()` or dynamic plugin loading |
| Backend | No skill/app packaging format or manifest schema |
| Frontend | No Skills Marketplace or App Store UI |
| Frontend | No "install skill" or "enable/disable skill" UX |
| UX | Users cannot add their own integrations or custom tools |

**Minimum work to claim**

1. Add `registerTool(definition)` and `unregisterTool(name)` to `tool-registry.js` — dynamic tool registration.
2. Add a **Skills view** in the frontend listing available tools with enable/disable toggles.
3. This makes the system extensible without requiring a full marketplace.

---

### Pillar 8 · Always On

**Current implementation**

| Layer | Files | What exists |
|-------|-------|-------------|
| Backend | `netlify/functions/system-health.js` | Health endpoint |
| Backend | `netlify/functions/start-session.js`, `end-session.js` | Session lifecycle management |
| Frontend | `src/components/views/LiveTalkView.tsx` | Reconnection (3 attempts, exponential backoff) |
| Frontend | `src/services/realtime-session-service.ts` | SSE streaming with fallback |
| Frontend | `src/hooks/use-local-storage.ts` | localStorage persistence |
| Frontend | `src/lib/realtime-voice-client.ts` | 5-state connection machine |
| DB | `supabase/migrations/002_realtime_sessions.sql` | Session persistence |

**Missing pieces**

| Area | Gap |
|------|-----|
| Frontend | No PWA manifest or service worker — cannot be installed as app, no offline shell |
| Frontend | No offline request queue (messages typed offline are lost) |
| Infra | No push notification channel to re-engage user |
| Infra | No uptime monitoring or external health probe |
| UX | No "offline mode" indicator or graceful degradation |

**Minimum work to claim**

1. Add **PWA support** via `vite-plugin-pwa` — manifest, service worker, installability, offline shell.
2. Add an **offline message queue** in IndexedDB — sync when reconnected.
3. These make the companion meaningfully "always on" even when connectivity drops.

---

### Pillar 9 · Persistent Memory

**Current implementation**

| Layer | Files | What exists |
|-------|-------|-------------|
| Backend | `lib/memory-manager.js`, `services/memory/memoryService.js` | Memory classification, ingestion, retrieval |
| Backend | `lib/knowledge-graph.js` | Entity/relationship extraction |
| Backend | `netlify/functions/search-memory.js`, `netlify/functions/media-memory.js` | Memory search and media memory pipeline |
| Backend | `lib/context-engine.js`, `services/ai/orchestrator.js` | Context injection from memory into prompts |
| Frontend | `src/components/views/MemoryView.tsx` | 8-category memory management UI |
| Frontend | `src/hooks/use-memory.ts` | React hook for save/search/classify/inject |
| Frontend | `src/services/memory-service.ts` | Typed memory service with 8 types, priorities, conflict resolution, recency decay |
| DB | `supabase/migrations/001_hierarchical_memory.sql`, `014_companion_brain.sql` | 4-tier memory, vector indexes, RPC functions, unified brain_memory |
| Types | `src/types/memory.ts` | Complete type system (MemoryType, MemoryPriority, MemorySource, ScoredMemory, InjectionLayer, ConflictResolution) |

**Missing pieces**

| Area | Gap |
|------|-----|
| UX | No memory usage stats or "what the AI remembers about you" summary view |
| Backend | No memory export/import (GDPR data portability) |

**Minimum work to claim** — Already claimable. Memory system is comprehensive and production-ready.

---

## 3 — Top 5 Gaps

| Rank | Gap | Pillars Affected | Impact |
|------|-----|------------------|--------|
| **1** | **No server-side background execution** — scheduler is client-side `setInterval`, no Netlify Scheduled Functions or external cron | 5 (Works in Background), 1 (Its Own Computer) | The companion cannot act autonomously when the user closes the tab. Undermines both "works in background" and "its own computer" claims. |
| **2** | **No PWA / service worker / offline support** — no installability, no offline shell, no push notifications | 8 (Always On), 4 (Multi-Channel) | The companion ceases to exist when the browser tab closes. Cannot push-notify the user. "Always on" is false without this. |
| **3** | **No outbound communication channels beyond in-app** — no email digest, no SMS, no push, no webhooks | 4 (Multi-Channel), 5 (Works in Background) | "Multi-channel" is currently "two channels" (text + voice), both requiring the app to be open. |
| **4** | **No dynamic skill/plugin system** — tool registry is hard-coded, no user-installable extensions | 7 (Skills & Apps) | Users cannot extend the companion's capabilities. "Skills & Apps" implies an ecosystem that does not exist. |
| **5** | **No user-visible system management** — no status indicator, no version updates, no rate limiting | 6 (Managed for You), 8 (Always On) | Users have zero visibility into system health. "Managed for you" has strong backend foundations but is invisible to the user. |

---

## 4 — Implementation Sequence

The following sequence addresses the top 5 gaps in dependency order — each step unlocks the next.

### Phase 1 — Server-Side Background Execution (1–2 weeks)

**Goal:** The companion can act when the browser is closed.

| Step | Task | Files / Systems |
|------|------|-----------------|
| 1a | Create a Netlify Scheduled Function that invokes `scheduler.js` tasks on a cron | `netlify/functions/scheduled-worker.js` (new), `netlify.toml` (add schedule config), `lib/autonomous/scheduler.js` (refactor to export task runners) |
| 1b | Add a `background_activity` table for user-visible task history | `supabase/migrations/017_background_activity.sql` (new) |
| 1c | Add a Background Activity panel to the UI | `src/components/views/BackgroundActivityView.tsx` (new), `src/App.tsx` (route) |

### Phase 2 — PWA & Offline Support (1–2 weeks)

**Goal:** The companion is installable and survives connectivity loss.

| Step | Task | Files / Systems |
|------|------|-----------------|
| 2a | Add `vite-plugin-pwa` with manifest, icons, and service worker | `vite.config.ts`, `public/manifest.webmanifest` (new), `public/icons/` (new) |
| 2b | Add offline message queue in IndexedDB, sync on reconnect | `src/lib/offline-queue.ts` (new), `src/hooks/use-companion-stream.ts` (integrate) |
| 2c | Add offline indicator in the UI | `src/components/OfflineIndicator.tsx` (new), `src/App.tsx` |

### Phase 3 — Push Notifications & Email Digest (1–2 weeks)

**Goal:** The companion can reach the user outside the app.

| Step | Task | Files / Systems |
|------|------|-----------------|
| 3a | Implement Web Push subscription + Netlify function to send push | `netlify/functions/push-subscribe.js` (new), `netlify/functions/push-send.js` (new), `src/lib/push-client.ts` (new) |
| 3b | Add email digest via SendGrid — daily summary of companion activity | `netlify/functions/email-digest.js` (new), `lib/email-service.js` (new) |
| 3c | Enable the "Email Notifications" toggle in SettingsView | `src/components/views/SettingsView.tsx` (remove disabled flag) |

### Phase 4 — Dynamic Skill Registry (1 week)

**Goal:** Users and developers can add new tools to the companion.

| Step | Task | Files / Systems |
|------|------|-----------------|
| 4a | Add `registerTool()` / `unregisterTool()` to `tool-registry.js` | `lib/tool-registry.js` |
| 4b | Add `user_skills` table for per-user tool configurations | `supabase/migrations/018_user_skills.sql` (new) |
| 4c | Add a Skills Management view (list, enable/disable, configure) | `src/components/views/SkillsView.tsx` (new), `src/App.tsx` (route) |

### Phase 5 — User-Visible System Management (1 week)

**Goal:** Users see that the system is managed and healthy.

| Step | Task | Files / Systems |
|------|------|-----------------|
| 5a | Add status indicator component calling `system-health.js` | `src/components/StatusIndicator.tsx` (new) |
| 5b | Add rate-limiting middleware for AI endpoints | `lib/rate-limiter.js` (new), `netlify/functions/ai-orchestrator.js` (integrate) |
| 5c | Add version check against deployed manifest | `public/version.json` (new, auto-generated at build), `src/hooks/use-version-check.ts` (new) |

---

## 5 — Files & Systems Most Likely Involved

| System | Key Files | Role |
|--------|-----------|------|
| **Scheduler / Background** | `lib/autonomous/scheduler.js`, `netlify.toml`, `netlify/functions/` | Server-side cron, job execution |
| **PWA / Offline** | `vite.config.ts`, `public/`, `src/lib/`, `src/hooks/` | Service worker, offline queue, installability |
| **Push / Email** | `netlify/functions/` (new), `lib/` (new), `src/lib/` | Web Push, SendGrid email, subscription management |
| **Tool Registry** | `lib/tool-registry.js`, `supabase/migrations/` | Dynamic skill registration |
| **System Health UI** | `src/components/`, `netlify/functions/system-health.js` | Status indicator, rate limiter, version check |
| **Settings** | `src/components/views/SettingsView.tsx` | Enable email notifications toggle |
| **App Shell** | `src/App.tsx` | Route new views (Background Activity, Skills) |
| **AI Orchestrator** | `netlify/functions/ai-orchestrator.js` | Rate limiting integration |
| **Supabase** | `supabase/migrations/` | New tables for background activity, user skills |

---

## 6 — Landing Page Claim Recommendations

### ✅ Safe to claim NOW

| Pillar | Claim | Rationale |
|--------|-------|-----------|
| **Make It Yours** | "Fully customizable personality, appearance, and behavior" | End-to-end: persona engine → settings UI → DB persistence. Includes avatar generation from selfie. |
| **Any Model** | "Works with 40+ AI models across 6 providers" | Model registry, provider routing, per-user selection — all wired. |
| **Persistent Memory** | "Remembers everything — 4-tier memory with semantic search" | Hierarchical memory, vector search, knowledge graph, memory UI — production-ready. |

### ⚠️ Claim with qualifier (ship within 1–2 sprints)

| Pillar | Suggested Claim | Qualifier | What to Ship First |
|--------|----------------|-----------|-------------------|
| **Its Own Computer** | "Your AI's own workspace" | Add "(workspace features coming soon)" | Files view + Running Tasks panel |
| **Multi-Channel** | "Talk, type, and more" | Avoid "multi-channel" label until push/email land | Web Push + email digest |
| **Managed for You** | "Built-in health monitoring and security" | Add "(status dashboard coming soon)" | Status indicator + rate limiter |

### 🚫 Do NOT claim yet

| Pillar | Why Not | When It Becomes True |
|--------|---------|---------------------|
| **Works in Background** | Scheduler is client-side only — background work stops when the tab closes | After Phase 1 (server-side cron) |
| **Skills & Apps** | Tool registry is hard-coded — users cannot install skills | After Phase 4 (dynamic registry + Skills view) |
| **Always On** | No PWA, no service worker, no push — "always on" is false when the tab closes | After Phase 2 (PWA) + Phase 3 (push) |

---

## Appendix: Full File Evidence Index

<details>
<summary>Pillar 1 — Its Own Computer</summary>

- `lib/job-queue.js` — job queue (image, video, music, content_workflow)
- `lib/job-worker.js` — job processor with parallel execution
- `lib/agent-manager.js` — agent task CRUD
- `lib/agent-registry.js` — 4 system agents
- `lib/workflow-engine.js` — multi-step workflow execution
- `lib/realtime/companion-state.js` — VUK STATE machine
- `lib/realtime/session-manager.js` — session management
- `src/components/CompanionOrb.tsx` — avatar orb
- `src/components/FloatingLiveOrb.tsx` — floating live orb
- `supabase/migrations/007_job_queue.sql` — job queue table
- `supabase/migrations/008_agent_tasks.sql` — agent tasks table

</details>

<details>
<summary>Pillar 2 — Make It Yours</summary>

- `lib/personality-engine.js` — personality profile + style instructions
- `lib/system-prompt.js` — system prompt with personality injection
- `lib/context-builder.js` — hierarchical context assembly
- `netlify/functions/user-preferences.js` — preference CRUD
- `netlify/functions/user-identity.js` — identity generation (avatar/emojicon)
- `src/context/settings-context.tsx` — settings context (model, tone, memory, privacy)
- `src/context/ai-control-context.tsx` — AI control context
- `src/components/views/SettingsView.tsx` — settings UI
- `src/components/views/ControlCenterView.tsx` — quick controls
- `src/components/EmojiOrbCustomizer.tsx` — orb customizer
- `src/services/user-identity-service.ts` — identity service
- `src/services/ai-control-center-service.ts` — AI control service
- `src/types/index.ts` — UserPreferences, Persona, ConversationMode
- `src/types/companion.ts` — goals, constraints, initiatives
- `src/types/emoji-orb.ts` — emoji orb types
- `supabase/migrations/005_personality_relationship.sql`
- `supabase/migrations/013_companion_engine.sql`
- `supabase/migrations/015_ai_control_settings.sql`
- `supabase/migrations/016_user_identity_profiles.sql`

</details>

<details>
<summary>Pillar 3 — Any Model</summary>

- `lib/model-registry.js` — 40+ models across 6 providers
- `lib/ai-router.js` — provider routing (resolveProvider, runAI, streamAI)
- `lib/openai-client.js` — OpenAI client
- `lib/nofilter-client.js` — NoFilter client
- `lib/gemini-client.js` — Gemini client
- `lib/model-config.js` — env-driven model config
- `lib/media-router.js` — media provider routing
- `lib/media-engine.js` — media orchestration
- `lib/media/image-generator.js` — Flux/PiAPI image gen
- `lib/media/openai-image-generator.js` — OpenAI image gen
- `lib/media/leonardo-image-generator.js` — Leonardo image gen
- `lib/media/veo-video-generator.js` — Veo video gen
- `lib/media/kling-video-generator.js` — Kling video gen
- `lib/media/hailuo-video-generator.js` — Hailuo video gen
- `lib/media/voice-generator.js` — ElevenLabs voice gen
- `src/context/settings-context.tsx` — model settings
- `src/utils/model-cache.js` — model cache
- `src/components/views/SettingsView.tsx` — model picker
- `netlify/functions/models.js` — model list endpoint
- `supabase/migrations/015_ai_control_settings.sql`

</details>

<details>
<summary>Pillar 4 — Multi-Channel</summary>

- `netlify/functions/chat.js` — text chat endpoint
- `netlify/functions/companion-stream.js` — SSE streaming
- `netlify/functions/ai-stream.js` — AI streaming with voice
- `lib/voice-engine.js` — voice synthesis
- `lib/media/voice-generator.js` — ElevenLabs TTS
- `lib/realtime/voice-stream.js` — Whisper STT
- `lib/multimodal-engine.js` — multimodal dispatch
- `lib/vision-analyzer.js` — image analysis
- `src/components/views/ChatView.tsx` — chat UI
- `src/components/views/LiveTalkView.tsx` — voice UI
- `src/lib/realtime-voice-client.ts` — WebRTC client
- `src/services/realtime-session-service.ts` — SSE service
- `src/types/realtime.ts` — SSE event types

</details>

<details>
<summary>Pillar 5 — Works in Background</summary>

- `lib/job-queue.js` — job queue
- `lib/job-worker.js` — job processor
- `lib/autonomous/scheduler.js` — scheduler (client-side setInterval)
- `lib/agent-registry.js` — agent definitions
- `lib/agent-manager.js` — agent task CRUD
- `netlify/functions/agent-task.js` — agent task endpoint
- `supabase/migrations/007_job_queue.sql`
- `supabase/migrations/008_agent_tasks.sql`

</details>

<details>
<summary>Pillar 6 — Managed for You</summary>

- `netlify/functions/system-health.js` — 5-service health check
- `netlify/functions/audit-log.js` — audit logging
- `netlify/functions/feature-flags.js` — feature flags
- `lib/_security.js` — payload validation, sanitization
- `scripts/scan-source-secrets.mjs` — pre-build secret scan
- `scripts/check-dist-secrets.mjs` — post-build secret scan
- `.github/dependabot.yml` — automated dependency updates
- `netlify.toml` — auto-deploy config
- `src/types/async.ts` — error categories with retryable flag

</details>

<details>
<summary>Pillar 7 — Skills & Apps</summary>

- `lib/skill-engine.js` — skill CRUD + suggestions
- `lib/tool-registry.js` — 10 static tools
- `lib/workflow-engine.js` — multi-step workflows
- `lib/capability-router.js` — capability routing
- `lib/agent-registry.js` — 4 system agents
- `lib/knowledge-graph.js` — entity extraction
- `src/lib/realtime-voice-client.ts` — 5 voice function tools
- `src/services/knowledge-service.ts` — knowledge analysis
- `supabase/migrations/006_content_workflow_skills.sql`

</details>

<details>
<summary>Pillar 8 — Always On</summary>

- `netlify/functions/system-health.js` — health endpoint
- `netlify/functions/start-session.js` — session creation
- `netlify/functions/end-session.js` — session termination
- `src/components/views/LiveTalkView.tsx` — reconnection (3 attempts + backoff)
- `src/services/realtime-session-service.ts` — SSE with fallback
- `src/hooks/use-local-storage.ts` — localStorage persistence
- `src/lib/realtime-voice-client.ts` — connection state machine
- `supabase/migrations/002_realtime_sessions.sql`

</details>

<details>
<summary>Pillar 9 — Persistent Memory</summary>

- `lib/memory-manager.js` — memory classification + ingestion
- `lib/knowledge-graph.js` — entity/relationship extraction
- `lib/context-engine.js` — context assembly from memory
- `services/memory/memoryService.js` — memory CRUD + long-term ingestion
- `services/ai/orchestrator.js` — context injection from memory
- `netlify/functions/search-memory.js` — memory search endpoint
- `netlify/functions/media-memory.js` — media memory pipeline
- `src/components/views/MemoryView.tsx` — 8-category memory UI
- `src/hooks/use-memory.ts` — memory React hook
- `src/services/memory-service.ts` — typed memory service
- `src/types/memory.ts` — memory type system
- `supabase/migrations/001_hierarchical_memory.sql`
- `supabase/migrations/014_companion_brain.sql`

</details>
