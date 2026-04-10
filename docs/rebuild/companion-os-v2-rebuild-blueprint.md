# Companion OS v2 Rebuild Blueprint

## Purpose

This document defines the rebuild direction for `companion-os`.

The current product contains valuable infrastructure and several strong subsystems, but it is too broad, too fragmented, and too inconsistent to ship confidently as a focused Companion OS product. The rebuild should preserve the strongest technical foundations while replacing the current product surface with a tighter operating system centered on execution, money, investing, and AI assistance.

This is a product-level rebuild, not a blind full rewrite.

---

## Core product thesis

Companion OS v2 should feel like a private executive operating layer for:

- daily execution
- personal finance clarity
- investing research and portfolio discipline
- AI-assisted planning, summarization, and action support

The product should not try to be everything.

It should be opinionated, premium, and narrow enough to become excellent.

---

## Primary product pillars

### 1. Today
A single command view for what matters right now.

Should answer:
- What matters most today?
- What must be done next?
- What money or follow-up issues need attention?
- What did the assistant surface as high-value?

### 2. Finance
A disciplined personal finance workspace.

Should include:
- linked accounts
- balances
- transactions
- future ledger
- cash flow
- obligations
- goals
- financial insights
- document ingestion where useful

### 3. Tasks
A real execution system, not a dumping ground.

Should include:
- inbox capture
- task list
- projects
- follow-ups
- recurring routines
- daily planning

### 4. Investments
An investing workspace for research and portfolio management.

Should include:
- holdings
- watchlist
- research notes
- thesis tracker
- review queue
- risk flags

### 5. Assistant
A high-trust AI command surface.

Should include:
- natural language commands
- summaries
- note-to-task extraction
- financial review summaries
- investment research support
- explicit action logging

### 6. Settings
A clean control surface for identity, appearance, model, privacy, and integrations.

---

## Non-goals

The rebuild should explicitly avoid product drift.

Do not carry forward unrelated or weakly aligned surfaces such as:
- tarot
- careers
- novelty experiences
- overlapping control panels
- redundant navigation sections
- vague OS metaphors without real utility

---

## Information architecture

### Top-level navigation
- Today
- Finance
- Tasks
- Investments
- Assistant
- Settings

### Optional later navigation
Only add these after the six core sections are strong:
- Documents
- Memory
- Automations
- Admin

---

## Product principles

### Focus over breadth
If a feature does not directly strengthen execution, finance, investing, or assistant utility, it should not be in v2.

### One source of truth
Avoid duplicate data surfaces. The same account, task, note, or holding should not be represented by conflicting models in different modules.

### Executive clarity
Every screen should drive action. Avoid dashboards that only look impressive.

### High-trust AI
AI should explain what it is doing, preserve user control, and log high-impact actions.

### Premium visual discipline
Design language should remain dark, sharp, cinematic, matte, restrained, and high-end.

---

## Experience goals

Companion OS v2 should feel:
- premium
- decisive
- quiet
- fast
- intelligent
- trustworthy
- useful in under 30 seconds

It should not feel:
- noisy
- experimental
- bloated
- gimmicky
- fragmented

---

## UX direction

### Visual system
Use the strongest visual work already present in the repo, but apply it with more restraint.

Direction:
- matte black and charcoal foundation
- gunmetal and silver support tones
- white for key text
- restrained neon accent only where state or action matters
- layered glass or metal surfaces only when they improve hierarchy
- fewer widgets, more confident spacing
- clear contrast and typography

### Layout style
- desktop-first command center
- strong hierarchy with one dominant primary panel per screen
- secondary telemetry presented as support, not clutter
- avoid walls of equally weighted cards

---

## MVP scope

### Included in MVP

#### Today
- daily brief
- top priorities
- due and overdue items
- cash snapshot
- assistant summary

#### Finance
- linked accounts
- transactions
- balances
- future ledger
- obligations
- savings goals
- cash flow summary
- financial insights

#### Tasks
- inbox capture
- tasks
- projects
- due dates
- recurring routines
- follow-up list

#### Investments
- holdings
- watchlist
- research notes
- thesis summaries
- review status

#### Assistant
- command input
- summary generation
- note-to-task extraction
- daily brief generation
- financial summary generation
- investment research templating

#### Settings
- appearance
- model selection
- profile and identity
- integration status
- privacy preferences

### Excluded from MVP
- public app marketplace
- advanced plugin system
- always-on marketing claims
- broad multi-channel promise
- unsupported automation claims
- unrelated novelty features

---

## Recommended app structure

### Frontend route map
- `/today`
- `/finance`
- `/tasks`
- `/investments`
- `/assistant`
- `/settings`

Optional later:
- `/documents`
- `/memory`
- `/automations`
- `/admin`

### Frontend modules
- `src/features/today/`
- `src/features/finance/`
- `src/features/tasks/`
- `src/features/investments/`
- `src/features/assistant/`
- `src/features/settings/`
- `src/shared/`
- `src/app-shell/`

### Suggested pattern
Each feature should own:
- page entry
- local components
- hooks
- service layer
- typed contracts

Avoid massive single-file views.

---

## Domain model

### Shared entities
- user_profile
- task
- project
- follow_up
- recurring_routine
- financial_connection
- balance_snapshot
- transaction
- ledger_entry
- obligation
- savings_goal
- holding
- watchlist_item
- investment_note
- thesis_record
- assistant_action_log

### Key rule
The data model should be unified enough that the assistant can reason across modules.

Examples:
- a finance insight can create a task
- a task can be linked to a project
- an investment review can create a follow-up
- an assistant action can reference any of the above

---

## Technical architecture

### Keep as foundation
- React and Vite frontend foundation
- Supabase auth and database
- Netlify functions pattern
- unified AI gateway pattern
- model registry pattern
- selected UI primitives and shell utilities

### Rebuild or refactor heavily
- navigation and section registry
- feature boundaries
- giant monolithic views
- stale or conflicting backend paths
- product surface and naming

### Backend direction
Keep the gateway idea, but align around explicit domains:
- assistant
- finance
- tasks
- investments
- settings

Avoid endpoint sprawl and overlapping legacy behavior.

---

## Finance direction

Finance is the strongest current subsystem and should be treated as salvageable but in need of restructuring.

### Keep
- Stripe Financial Connections approach
- balances and transaction persistence
- ledger concepts
- financial planning concepts
- document intelligence concepts where useful

### Change
- split the current giant finance view into smaller modules
- standardize one banking provider path
- remove or archive stale Plaid-era product paths from active UX
- tighten copy and hierarchy

### Finance subareas in v2
- Overview
- Accounts
- Transactions
- Ledger
- Obligations
- Goals
- Insights

---

## Tasks direction

This is currently underpowered relative to the desired product.

V2 should introduce a first-class tasks module with:
- inbox capture
- structured tasks
- projects
- routines
- follow-up engine
- assistant extraction from notes

This should become one of the product's core differentiators.

---

## Investments direction

This is also largely absent as a focused workspace today.

V2 should add:
- holdings tracker
- watchlist
- research notes
- thesis tracker
- review cadence
- position and risk summary

Do not overcomplicate with live trading or brokerage execution in MVP.

---

## Assistant direction

The assistant should stop being a generic umbrella for everything.

In v2 it should behave like a high-trust executive copilot:
- summarize
- recommend next actions
- convert input into structure
- support research
- explain why
- log actions taken

It should not pretend to be fully autonomous where infrastructure does not support that.

---

## Naming and branding

Pick one brand and apply it consistently.

If the product remains `Companion OS`, then:
- repo docs
- package identity
- sidebar labels
- settings copy
- site metadata
- assistant naming
must be aligned.

Do not mix Companion OS and Vuk OS in the active product unless there is a deliberate brand hierarchy.

---

## Rebuild strategy

### Strategy type
Selective salvage plus surface rebuild.

### Phase 0: freeze and map
- stop adding unrelated features
- document current keep, cut, and migrate decisions
- define target information architecture and route map

### Phase 1: shell rebuild
- replace current nav with v2 route map
- remove non-core sections from active shell
- align naming and layout hierarchy

### Phase 2: finance refactor
- break finance monolith into smaller modules
- standardize provider path
- preserve strongest functionality

### Phase 3: tasks module
- introduce first-class tasks and projects
- add assistant extraction into task creation

### Phase 4: investments module
- add holdings, watchlist, research, and thesis system

### Phase 5: assistant refinement
- unify command flows across Today, Finance, Tasks, and Investments
- add action log and explanation layer

### Phase 6: hardening
- merge CI, security, and test work
- eliminate stale docs and routes
- validate migrations and contracts

---

## Acceptance criteria for v2 foundation

The rebuild is on track when the following are true:

### Product
- navigation contains only core sections
- naming is consistent
- today, finance, tasks, investments, assistant, and settings are clear and coherent

### Codebase
- no major monolithic page remains in active core features
- feature folders own their own logic
- stale and duplicate product paths are archived or removed from active shell

### UX
- primary actions are obvious in under 10 seconds
- screens feel premium and restrained
- the product feels like one system, not many experiments

### Trust
- banking path is coherent
- assistant actions are logged
- background and automation claims match actual infrastructure

---

## Success definition

Companion OS v2 succeeds if it becomes:
- a real daily operating system for work and life execution
- a real finance command center
- a real investing research workspace
- a real assistant layer that saves time and drives action

It fails if it returns to being a broad collection of cool surfaces.

---

## Immediate execution target

The first implementation pass should focus on:
1. replacing the active shell
2. removing non-core active routes from the main experience
3. scaffolding new feature domains
4. preserving salvageable backend infrastructure
5. preparing finance for modular refactor

That is the foundation for the rest of the rebuild.
