# Companion OS v2 Implementation Roadmap

## Objective

This roadmap translates the rebuild blueprint into an execution sequence that can be implemented inside the existing repo.

The priority is to create a coherent product foundation first, then reintroduce capability with discipline.

---

## Phase 0 - Freeze and baseline

### Goal
Stop drift and create a stable starting point.

### Actions
- stop shipping unrelated new features into the active shell
- preserve current product behavior on a dedicated baseline branch if needed
- align the team around the v2 route map and rebuild thesis
- document keep, cut, and migrate decisions

### Deliverables
- rebuild blueprint committed
- keep, cut, migrate plan committed
- implementation roadmap committed
- Copilot execution prompt committed

### Exit criteria
- there is one agreed v2 scope
- no one is still treating the current product as the final target

---

## Phase 1 - Shell rebuild and route reset

### Goal
Replace the active product surface with the v2 information architecture.

### Required route map
- `/today`
- `/finance`
- `/tasks`
- `/investments`
- `/assistant`
- `/settings`

### Actions
- refactor `src/App.tsx` to route only to the v2 core sections
- replace current sidebar configuration with the v2 nav
- remove non-core sections from the active sidebar and route map
- align product naming in the shell
- create feature directories for each core domain
- add placeholder pages where necessary so the new shell is navigable immediately

### Suggested file work
- refactor `src/components/AppSidebar.tsx`
- refactor `src/app-shell/section-registry.tsx`
- add `src/features/today/pages/TodayPage.tsx`
- add `src/features/tasks/pages/TasksPage.tsx`
- add `src/features/investments/pages/InvestmentsPage.tsx`
- add `src/features/assistant/pages/AssistantPage.tsx`
- add `src/features/settings/pages/SettingsPage.tsx`
- point finance to a new page entry even if it temporarily wraps existing functionality

### Exit criteria
- app boots into a clean v2 shell
- navigation contains only the six core sections
- old sections are no longer active top-level product routes

---

## Phase 2 - Finance modularization

### Goal
Preserve the strongest subsystem while breaking the monolith.

### Actions
- introduce a new finance page entry under `src/features/finance/pages/FinancePage.tsx`
- split the current finance experience into smaller panels
- preserve Stripe Financial Connections path as primary linked-account path
- normalize one finance vocabulary across the UI
- isolate finance hooks and services by purpose

### Target panels
- Overview
- Accounts
- Transactions
- Ledger
- Obligations
- Goals
- Insights

### Suggested file work
- create `src/features/finance/components/FinanceOverview.tsx`
- create `src/features/finance/components/AccountsPanel.tsx`
- create `src/features/finance/components/TransactionsPanel.tsx`
- create `src/features/finance/components/LedgerPanel.tsx`
- create `src/features/finance/components/ObligationsPanel.tsx`
- create `src/features/finance/components/GoalsPanel.tsx`
- create `src/features/finance/components/InsightsPanel.tsx`
- reduce direct logic load inside legacy `FinanceView.tsx` until it can be retired

### Exit criteria
- finance no longer depends on one giant page for core rendering
- linked accounts, transactions, and ledger are still functional
- finance UI feels clearer and more intentional

---

## Phase 3 - Tasks foundation

### Goal
Introduce a first-class execution system.

### Actions
- create task domain types and basic persistence plan
- build inbox capture
- build task list and project grouping
- add follow-up list and recurring routine support
- connect assistant extraction into task creation flow

### Suggested MVP data model
- task
- project
- follow_up
- recurring_routine

### Suggested file work
- `src/features/tasks/components/InboxPanel.tsx`
- `src/features/tasks/components/TaskListPanel.tsx`
- `src/features/tasks/components/ProjectPanel.tsx`
- `src/features/tasks/components/FollowUpPanel.tsx`
- `src/features/tasks/components/RoutinesPanel.tsx`
- supporting hooks and service layer

### Exit criteria
- user can capture, organize, and review work inside the product
- Today page can consume task data
- assistant can convert raw notes into structured tasks

---

## Phase 4 - Investments foundation

### Goal
Create a focused investing workspace that matches the product thesis.

### Actions
- introduce holdings model
- introduce watchlist model
- introduce research notes and thesis records
- build review-oriented UI, not trading UI
- connect assistant research workflows

### Suggested MVP data model
- holding
- watchlist_item
- investment_note
- thesis_record

### Suggested file work
- `src/features/investments/components/HoldingsPanel.tsx`
- `src/features/investments/components/WatchlistPanel.tsx`
- `src/features/investments/components/ResearchPanel.tsx`
- `src/features/investments/components/ThesisPanel.tsx`
- `src/features/investments/components/RiskPanel.tsx`

### Exit criteria
- user can track holdings and watchlist items
- user can write and review thesis notes
- assistant can support research summaries and review prompts

---

## Phase 5 - Today and Assistant integration

### Goal
Make the product feel like one operating system.

### Actions
- build Today page as the command layer across modules
- surface top priorities, finance alerts, and review prompts
- add assistant action log
- make assistant outputs drive structure, not just chat text
- unify command entry and response style

### Today page sections
- daily brief
- top priorities
- due and overdue tasks
- cash snapshot
- investment review queue
- assistant recommendations

### Exit criteria
- Today page feels useful every day
- assistant actions have visible downstream effect
- product feels cohesive across domains

---

## Phase 6 - Hardening and cleanup

### Goal
Tighten trust, consistency, and maintainability.

### Actions
- merge or recreate missing CI and security hardening work
- resolve stale docs and naming drift
- archive legacy or inactive views from the core product path
- validate route contracts and active feature ownership
- reduce dead code in the active app shell

### Priority cleanup areas
- mixed Companion OS and Vuk OS naming
- stale Plaid-facing product references if Stripe is the chosen path
- unsupported automation and background messaging
- open security issues related to uploads and auth consistency

### Exit criteria
- docs match product reality
- core routes are stable
- product messaging aligns with real capabilities
- the codebase is more maintainable than the current baseline

---

## Suggested milestone order

### Milestone A
Phase 1 complete

### Milestone B
Phase 2 complete

### Milestone C
Phase 3 complete

### Milestone D
Phase 4 complete

### Milestone E
Phase 5 and Phase 6 complete

---

## Build priorities

If work must be narrowed further, prioritize in this order:
1. shell rebuild
2. finance modularization
3. tasks foundation
4. today page integration
5. investments foundation
6. hardening and cleanup

That order gives the product a usable core faster.

---

## Definition of success

The roadmap is working when the repo is clearly moving toward a product that is:
- smaller in scope
- sharper in information architecture
- stronger in execution utility
- stronger in finance utility
- newly credible in investing support
- more trustworthy in assistant behavior

That is the target state for Companion OS v2.