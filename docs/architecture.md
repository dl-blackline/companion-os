# Companion Brain Architecture

## Overview

The **Companion Brain** is a unified AI orchestration layer that replaces the
previous pattern of fragmented, independent AI endpoints with a single, coherent
pipeline.  All AI interactions — chat, roleplay, planning, research, media
generation, etc. — flow through one entry point (`companion-brain`) which routes
to domain-specific sub-capabilities.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (React)                                 │
│  companion-service.ts  ──▶  POST /.netlify/functions/companion-brain      │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  NETLIFY FUNCTION: companion-brain.js                      │
│  Validates request  →  calls think()                                      │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     COMPANION BRAIN  (lib/companion-brain.js)              │
│                                                                           │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────────┐   │
│  │ 1. Intent   │──▶│ 2. Context   │──▶│ 3. Plan  │──▶│ 4. Execute   │   │
│  │  Detection  │   │   Engine     │   │  Agent   │   │   Tools      │   │
│  └─────────────┘   └──────────────┘   └──────────┘   └──────┬───────┘   │
│                                                              │           │
│  ┌──────────────────────────────────────────────────────────▼───────┐   │
│  │ 5. Domain Router                                                 │   │
│  │  ┌──────────┬───────────┬──────────┬───────────┬──────────────┐ │   │
│  │  │ Chat     │ Roleplay  │ Planning │ Research  │ Media Gen    │ │   │
│  │  └──────────┴───────────┴──────────┴───────────┴──────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                            │
│                            ▼                                            │
│  ┌─────────────┐   ┌──────────────┐                                    │
│  │ 6. Critic   │──▶│ 7. Memory    │                                    │
│  │   Review    │   │   Ingest     │                                    │
│  └─────────────┘   └──────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
                    │                 │                │
                    ▼                 ▼                ▼
┌──────────────────────┐ ┌──────────────────┐ ┌───────────────────────┐
│    AI CLIENT         │ │  CONTEXT ENGINE  │ │    MEMORY LAYER       │
│ (lib/ai-client.js)   │ │ (context-engine) │ │ (lib/memory-layer.js) │
│                      │ │                  │ │                       │
│ • chat()             │ │ • assembleCtx()  │ │ • storeShortTerm()    │
│ • chatJSON()         │ │ • summarizeCtx() │ │ • storeLongTerm()     │
│ • chatStream()       │ │ • formatBlock()  │ │ • searchAll()         │
│ • embed()            │ │                  │ │ • ingest()            │
│ • onCost() / offCost │ │                  │ │ • saveInteraction()   │
│ • retry + timeout    │ │                  │ │ • getRecentContext()  │
│                      │ │                  │ │ • summarizeMemory()   │
└─────────┬────────────┘ └────────┬─────────┘ └───────────┬───────────┘
          │                       │                        │
          ▼                       ▼                        ▼
┌──────────────────────┐ ┌──────────────────┐ ┌───────────────────────┐
│   AI ROUTER          │ │ CONTEXT BUILDER  │ │   MEMORY MANAGER      │
│ (lib/ai-router.js)   │ │ (context-builder)│ │ (memory-manager.js)   │
│                      │ │                  │ │                       │
│ OpenAI / NoFilter /  │ │ Hierarchical     │ │ Episodic / Relation-  │
│ Gemini providers     │ │ memory + KG +    │ │ ship / Summaries +    │
│                      │ │ personality +    │ │ Instructions          │
│                      │ │ companion engine │ │                       │
└──────────────────────┘ └──────────────────┘ └───────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE / POSTGRESQL                              │
│                                                                       │
│  brain_memory          │ episodic_memory     │ relationship_memory    │
│  memory_summaries      │ user_profiles       │ knowledge_nodes/edges  │
│  orchestrator_actions  │ personality_profiles │ user_goals/constraints │
│  interaction_log       │ media_memories       │ companion_initiatives  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
companion-os/
├── lib/                              # Core backend logic
│   ├── companion-brain.js            # ★ Unified orchestrator — think()
│   ├── ai-client.js                  # ★ Centralized AI client (retry, timeout, cost hooks)
│   ├── context-engine.js             # ★ Context aggregation engine
│   ├── memory-layer.js               # ★ Unified memory (short-term + long-term)
│   ├── prompt-templates.js           # ★ Centralized prompt templates (incl. live-talk)
│   ├── _responses.js                 # ★ Unified response contract helpers
│   ├── orchestrator.js               # Legacy orchestrator (still works)
│   ├── context-builder.js            # Hierarchical context assembly
│   ├── system-prompt.js              # System prompt construction
│   ├── memory-manager.js             # Core memory classification & storage
│   ├── ai-router.js                  # Provider routing (OpenAI/NoFilter)
│   ├── openai-client.js              # OpenAI API wrapper
│   ├── nofilter-client.js            # NoFilter GPT provider
│   ├── intent-detector.js            # Intent classification
│   ├── companion-engine.js           # Goals, constraints, initiatives
│   ├── personality-engine.js         # Personality profiles
│   ├── emotion-detector.js           # Emotional signals
│   ├── relationship-manager.js       # Relationship events
│   ├── knowledge-graph.js            # Entity/relationship extraction
│   ├── media-engine.js               # Media orchestration
│   ├── media-router.js               # Media type routing
│   ├── tool-registry.js              # Tool registration
│   ├── capability-router.js          # Capability routing
│   ├── skill-engine.js               # Skill management
│   └── ...                           # Other engines & providers
│
├── netlify/functions/                # Serverless API
│   ├── companion-brain.js            # ★ Unified AI endpoint (response contract)
│   ├── ai.js                         # Legacy AI gateway (uses think() + ai-client)
│   ├── chat.js                       # Legacy chat endpoint (uses think())
│   └── ...                           # Other endpoints
│
├── src/services/                     # Frontend services
│   ├── companion-service.ts          # Companion interaction client
│   ├── memory-service.ts             # Memory layer client
│   └── ...
│
├── supabase/migrations/
│   ├── 001_hierarchical_memory.sql   # Episodic, relationship, summaries, profiles
│   ├── 004_orchestrator.sql          # Orchestrator action logging
│   ├── 013_companion_engine.sql      # Goals, constraints, initiatives
│   ├── 014_companion_brain.sql       # ★ brain_memory table + vector search
│   └── ...
│
└── docs/
    └── architecture.md               # ★ This document
```

---

## Data Schema — brain_memory

The `brain_memory` table provides unified short-term + long-term memory storage
with vector search capabilities.

```sql
brain_memory
├── id            uuid (PK)
├── user_id       uuid (not null)
├── session_id    uuid (nullable)       -- null for long-term entries
├── memory_type   text                  -- 'short_term' | 'long_term'
├── role          text                  -- 'user' | 'assistant' | null
├── category      text                  -- fact | instruction | preference | ...
├── content       text (not null)
├── embedding     vector(1536)          -- OpenAI embeddings
├── importance    real (0.0–1.0)
├── metadata      jsonb                 -- arbitrary structured data
├── expires_at    timestamptz           -- optional TTL for short-term
├── created_at    timestamptz
└── updated_at    timestamptz
```

### Existing Memory Tables (preserved)

| Table | Purpose |
|-------|---------|
| `episodic_memory` | Life events, milestones, major changes |
| `relationship_memory` | Preferences, instructions, relationship insights |
| `memory_summaries` | AI-generated conversation summaries |
| `user_profiles` | User name, communication style, interests |
| `knowledge_nodes` / `knowledge_edges` | Knowledge graph entities & relationships |
| `personality_profiles` | Personality traits & adaptive style |
| `user_goals` | User goals by domain |
| `user_constraints` | Budget, time, dietary constraints |
| `companion_initiatives` | Proactive companion suggestions |
| `interaction_log` | Cross-module interaction log |
| `media_memories` | Memories from uploaded photos/videos |

---

## Example Orchestrator Flow

```
User: "Help me plan my workout for this week based on my fitness goals"

1. INTENT DETECTION
   → { intent: "planning", confidence: 0.92, domain: "fitness" }

2. CONTEXT ASSEMBLY (context-engine)
   → Parallel fetch:
     - User profile (name, preferences, goals)
     - Episodic memory (past workout events)
     - Relationship memory (fitness preferences)
     - Companion engine (active fitness goals, constraints)
     - Short-term memory (recent session turns)
     - Knowledge graph (workout entities)
   → Build system prompt with all 14 context layers

3. PLANNING
   → { steps: [{ tool: "memory_search", action: "recall fitness preferences" }] }

4. TOOL EXECUTION
   → memory_search returns relevant fitness memories

5. DOMAIN ROUTING → planning handler
   → Uses dailyPlan prompt template with:
     - Full context block (profile, goals, constraints, memories)
     - Tool results (fitness memories)

6. AI GENERATION
   → Model generates personalized weekly workout plan

7. CRITIC REVIEW
   → Validates plan accuracy and helpfulness

8. MEMORY INGESTION (async)
   → Stores key facts: "User requested weekly workout plan"
   → Stores in short-term memory for session continuity

9. RESPONSE
   → Returns structured workout plan to user
```

---

## Example Prompt with Full Context Injection

```
SYSTEM PROMPT:
═══════════════

You are a mature, emotionally intelligent companion assistant...

MOOD / TONE
Supportive and motivating

USER-DEFINED INSTRUCTIONS (MUST FOLLOW)
Always use metric units. Keep responses under 500 words.

PERSONALITY PROFILE
Communication style: direct, encouraging. Adapts energy to user's mood.

USER PROFILE
Name: Alex
Communication style: casual
Goals: ["Build muscle", "Run 5K in under 25 minutes"]
Interests: ["fitness", "nutrition", "productivity"]

COMPANION ENGINE — USER MODEL
Active Goals:
- Build muscle mass (domain: health, priority: high)
- Complete marathon training (domain: health, priority: medium)
Constraints:
- Time: 1 hour max per workout session
- Equipment: Home gym only

RELEVANT EPISODIC MEMORY
- Completed first 10K run last month
- Started new workout routine 2 weeks ago

IMPORTANT RELATIONSHIP MEMORY
- Prefers morning workouts before 8am
- Recovering from minor knee strain — avoid high-impact exercises

LONG-TERM MEMORY SUMMARIES
- Has been consistently working out 4x/week for 3 months

KNOWLEDGE GRAPH
Entity: "Morning Workout Routine" → linked to "Muscle Building", "Cardio"

RECENT SESSION
[user]: I want to step up my training this week
[assistant]: Sure! What areas do you want to focus on?

═══════════════

USER MESSAGE:
Help me plan my workout for this week based on my fitness goals

[Tool context]:
[memory_search]: Episodic: completed first 10K, started new routine. Relationship: prefers morning workouts, knee recovery.
```

---

## Migration Path (Backward Compatibility)

The new architecture is **additive** — it does not remove or modify existing
endpoints. The migration path is:

1. **Phase 1 (Current):** New `companion-brain` endpoint added alongside
   existing `ai.js` and `chat.js` endpoints. All existing endpoints continue
   to work unchanged. The legacy `ai.js` (handleChat) and `chat.js` endpoints
   now route through `think()` from the Companion Brain instead of calling the
   old `orchestrate()` pipeline directly, ensuring consistent behavior across
   all entry points. All AI calls in `ai.js` (including live-talk) now go
   through the centralized `ai-client.js` instead of direct `runAI()` calls.

2. **Phase 2 (Future):** Frontend services (`companion-service.ts`) updated to
   call `companion-brain` instead of `ai.js`. The old `ai.js` endpoint can add
   a deprecation header.

3. **Phase 3 (Future):** Legacy endpoints removed once all clients have migrated.

### Function Collapse Map

| Old Endpoint(s) | New Entry Point | Sub-capability |
|-----------------|----------------|----------------|
| `ai.js` (type=chat) | `companion-brain` | `chat` |
| `ai.js` (type=media) | `companion-brain` | `media_generation` |
| `ai.js` (type=voice) | `companion-brain` | handled by tool |
| `ai.js` (type=realtime) | `companion-brain` | handled by tool |
| `chat.js` | `companion-brain` | `chat` |
| Future: roleplay | `companion-brain` | `roleplay` |
| Future: daily_plan | `companion-brain` | `planning` |
| Future: research | `companion-brain` | `research` |

---

## Key Design Decisions

1. **Single AI Client** (`ai-client.js`): All modules call `chat()`, `chatJSON()`,
   `embed()` instead of importing OpenAI directly. This gives a single
   chokepoint for logging, rate-limiting, and provider switching. Includes
   automatic retry with exponential back-off, per-request timeout, and
   pluggable cost-tracking hooks (`onCost()` / `offCost()`).

2. **Prompt Templates** (`prompt-templates.js`): All prompts are centralized,
   composable functions. Each template accepts a context object and returns a
   `{ system, user }` pair. Includes templates for live-talk voice interactions
   (`liveTalkSystem`, `liveTalkIntentClassification`, `liveTalkRoleplay`,
   `liveTalkTask`, `liveTalkMediaAck`).

3. **Context Engine** (`context-engine.js`): Aggregates all context layers
   (profile, memory, goals, session) before every AI call. Returns both raw
   context and a rendered system prompt.

4. **Memory Layer** (`memory-layer.js`): Unified short-term + long-term memory
   via the `brain_memory` table. Wraps and extends the existing memory-manager.
   Convenience wrappers: `saveInteraction()`, `getRecentContext()`,
   `summarizeMemory()`.

5. **Response Contract** (`_responses.js`): All endpoints use a unified response
   envelope — `ok(data)` returns `{ success: true, data }` and `fail(error, code)`
   returns `{ success: false, error, code }`. The `preflight()` helper handles
   CORS OPTIONS requests consistently.

6. **Domain Handlers**: Intent-specific handlers (roleplay, planning, research)
   use purpose-built prompt templates with full context injection. New
   capabilities are added by registering a handler + template.
