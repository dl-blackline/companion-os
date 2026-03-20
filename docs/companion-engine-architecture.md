# Core Companion Engine — Architecture

> Companion OS is a general-purpose AI assistant and personal companion, not just
> a CRM or sales tool. The **Core Companion Engine** sits above all existing
> modules and unifies them under a single user model, shared memory layer,
> context engine, and proactive initiative system.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Companion OS Client                        │
│  (React + TypeScript — src/services/companion-service.ts)       │
└────────────────────────────┬────────────────────────────────────┘
                             │  POST /.netlify/functions/companion-engine
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           Netlify Function — companion-engine.js                │
│  Routes actions: goals.*, constraints.*, initiatives.*,         │
│                  interactions.*, context.get                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Core Companion Engine (lib/)                        │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ Unified User      │  │ Memory System    │                     │
│  │ Model             │  │ (interaction_log)│                     │
│  │ • user_goals      │  │ Cross-module     │                     │
│  │ • user_constraints│  │ action log       │                     │
│  └────────┬─────────┘  └────────┬─────────┘                     │
│           │                     │                                │
│  ┌────────▼─────────────────────▼─────────┐                     │
│  │         Context Engine                  │                     │
│  │  buildCompanionContext(user_id)          │                     │
│  │  → goals + constraints + interactions   │                     │
│  │  → pending initiatives                  │                     │
│  │  formatCompanionContext(ctx)             │                     │
│  └────────┬────────────────────────────────┘                     │
│           │                                                      │
│  ┌────────▼────────────────────────────────┐                     │
│  │       Initiative Layer                   │                     │
│  │  generateInitiatives(user_id)            │                     │
│  │  → AI analyses goals/constraints/history │                     │
│  │  → creates pending suggestions           │                     │
│  └─────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Existing Modules                            │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │ Orchestrator│ │ Memory Mgr │ │ System     │ │ Personality  │ │
│  │ (chat, AI) │ │ (episodic, │ │ Prompt     │ │ Engine       │ │
│  │            │ │ relationship│ │ Builder    │ │              │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │ Media      │ │ Knowledge  │ │ Emotion    │ │ Relationship │ │
│  │ Engine     │ │ Graph      │ │ Detector   │ │ Manager      │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Supabase)                         │
│                                                                 │
│  Existing tables:                 New tables (013):              │
│  • messages                       • user_goals                  │
│  • episodic_memory                • user_constraints            │
│  • relationship_memory            • companion_initiatives       │
│  • memory_summaries               • interaction_log             │
│  • user_profiles                                                │
│  • knowledge_nodes / edges                                      │
│  • personality_profiles                                         │
│  • emotional_signals                                            │
│  • relationship_events                                          │
│  • uploaded_media / media_analysis                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Migration 013)

### `user_goals`

| Column       | Type          | Description                                 |
|-------------|---------------|---------------------------------------------|
| id          | uuid (PK)     | Auto-generated                              |
| user_id     | text          | Owner                                       |
| domain      | text          | business · health · personal · financial · education · creative |
| title       | text          | Short goal name                             |
| description | text          | Optional long description                   |
| status      | text          | active · completed · paused · archived      |
| priority    | text          | low · medium · high · critical              |
| target_date | timestamptz   | Optional deadline                           |
| progress    | float         | 0.0 – 1.0                                  |
| milestones  | jsonb         | Array of `{title, completed, completedAt}`  |
| metadata    | jsonb         | Extensible extra data                       |

### `user_constraints`

| Column    | Type      | Description                                   |
|----------|-----------|-----------------------------------------------|
| id       | uuid (PK) | Auto-generated                                |
| user_id  | text      | Owner                                         |
| domain   | text      | general · financial · time · health · dietary · work |
| label    | text      | Constraint name (e.g. "Monthly budget")       |
| value    | text      | Constraint value (e.g. "$5000")               |
| is_active| boolean   | Soft-delete flag                              |
| metadata | jsonb     | Extensible extra data                         |

### `companion_initiatives`

| Column          | Type      | Description                                |
|----------------|-----------|--------------------------------------------|
| id             | uuid (PK) | Auto-generated                             |
| user_id        | text      | Owner                                      |
| type           | text      | suggestion · reminder · daily_plan · follow_up · optimisation |
| title          | text      | Short initiative title                     |
| body           | text      | Actionable description                     |
| priority       | text      | low · medium · high · critical             |
| status         | text      | pending · accepted · dismissed · completed · expired |
| related_goal_id| uuid (FK) | Optional link to a user_goal               |
| scheduled_for  | timestamptz | When to surface this initiative           |
| metadata       | jsonb     | Extensible extra data                      |

### `interaction_log`

| Column   | Type      | Description                                   |
|---------|-----------|-----------------------------------------------|
| id      | uuid (PK) | Auto-generated                                |
| user_id | text      | Owner                                         |
| module  | text      | chat · crm · email · roleplay · planning · media · companion_engine |
| action  | text      | Action name (e.g. "sent_email")               |
| summary | text      | Human-readable summary                        |
| outcome | text      | Result of the action                          |
| metadata| jsonb     | Extensible extra data                         |

---

## Example Prompts — Context Injection

### Before (reactive — no companion context)

```
You are a companion assistant.

USER PROFILE
Name: Alex
Goals: ["grow business"]

RECENT CONVERSATION
[user]: How's my week looking?
```

### After (companion engine injects full context)

```
You are a companion assistant.

USER PROFILE
Name: Alex

COMPANION ENGINE — USER MODEL
USER GOALS
Business:
  - Launch MVP by March 30 [high] (65% done)
  - Close Series A [critical]
Personal:
  - Run a half-marathon [medium] (30% done)
Health:
  - Meditate daily [medium] (80% done)

USER CONSTRAINTS & BOUNDARIES
- [financial] Monthly runway: $12,000
- [time] Available work hours: 50h/week
- [health] No meetings before 9am

RECENT ACTIVITY
- [email] sent_email: Follow-up to investor deck
- [planning] completed_goal: Finalized pitch deck
- [chat] asked_question: Revenue projections

PENDING PROACTIVE SUGGESTIONS
- [follow_up] Check in on Series A lead: No response in 3 days
- [daily_plan] Today's focus: MVP bug fixes + investor call at 2pm

RECENT CONVERSATION
[user]: How's my week looking?
```

The AI now has full awareness of all active goals across domains, knows the
user's constraints (budget, time, health), sees recent activity across modules,
and even has pending proactive suggestions it can surface.

---

## Evolving from Reactive AI to Proactive Companion

### Phase 1 — Foundation (this PR)
- ✅ Unified User Model (goals + constraints stored in Postgres)
- ✅ Cross-module interaction log
- ✅ Context Engine assembles full user model before every AI call
- ✅ Initiative Layer generates proactive suggestions via AI
- ✅ System prompt injects goals/constraints/initiatives alongside memory

### Phase 2 — Scheduled Initiatives
- Add a cron-triggered Netlify function that runs `generateInitiatives()` for
  each active user daily
- Surface pending initiatives in the dashboard UI
- Track acceptance/dismissal rates to improve suggestion quality

### Phase 3 — Deep Module Integration
- Every module (CRM, email, roleplay, planning) writes to `interaction_log`
  after significant actions
- Context Engine uses interaction patterns to detect stalled goals, missed
  deadlines, and opportunities
- AI proactively offers help when it detects patterns (e.g. "You haven't
  worked on your health goals this week")

### Phase 4 — Learning Loop
- Track which initiatives the user accepts vs dismisses
- Feed acceptance patterns back into the AI prompt to improve suggestions
- Auto-adjust goal priorities based on user behavior
- Memory summaries include goal progress and initiative outcomes

### Phase 5 — Ambient Companion
- Push notifications for time-sensitive initiatives
- Daily morning briefing (generated daily plan)
- Weekly review with goal progress charts
- The companion evolves from "responds to input" to "actively manages your life"
