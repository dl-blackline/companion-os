# Companion OS v2 Keep, Cut, Migrate Plan

## Purpose

This document turns the rebuild recommendation into concrete repo decisions.

The goal is to preserve what is valuable, remove what is misaligned, and migrate only what strengthens the v2 product thesis.

---

## Decision legend

- **Keep** = preserve with minimal change
- **Refactor** = preserve the intent but significantly restructure it
- **Migrate** = move into a new v2 feature area or architecture
- **Archive** = remove from active product surface but keep in repo history or separate branch if needed
- **Cut** = remove from the active product and do not rebuild in v2

---

## App shell and navigation

### Keep
- `src/app-shell/animated-section.tsx`
- routing and shell patterns that are genuinely reusable
- mobile shell utilities where still useful

### Refactor
- `src/App.tsx`
- `src/app-shell/section-registry.tsx`
- `src/components/AppSidebar.tsx`

### Why
The current shell is technically improved versus older iterations, but the active navigation still reflects a feature-accumulation product rather than a focused operating system.

### Target
Replace the active shell with:
- Today
- Finance
- Tasks
- Investments
- Assistant
- Settings

### Archive from active nav
- live-talk
- media
- memory
- knowledge
- goals
- calendar
- workflows
- insights
- careers
- automotive-finance
- agents
- control-center
- tarot
- admin-console

These may later return in reduced or re-homed form, but they should not remain active top-level surfaces during the rebuild.

---

## Branding and naming

### Refactor
- `README.md`
- `package.json`
- visible product labels in sidebar and settings
- app metadata and landing language

### Why
The product currently mixes `Companion OS` and `Vuk OS`. v2 needs one consistent identity.

### Target
Choose one:
- Companion OS as product brand
- or a clear hierarchy such as `Companion OS by Vuk`

Do not leave mixed naming in active experience.

---

## AI gateway and backend orchestration

### Keep
- `netlify/functions/ai-orchestrator.js`
- `netlify/functions/gateway/*`
- the concept of a thin gateway with domain handlers
- model registry pattern

### Refactor
- domain boundaries around assistant, finance, tasks, investments, settings
- stale or overlapping AI-specific helper paths

### Why
The gateway pattern is right. The product layering around it needs to become narrower and more explicit.

### Target
The assistant becomes a shared service layer for v2, not a catch-all product category for unrelated features.

---

## Finance subsystem

### Keep
- `netlify/functions/stripe-financial-connections.js`
- transaction and balance persistence concepts
- ledger entry functionality
- financial analysis concepts
- financial intelligence concepts
- scorecard concepts

### Refactor heavily
- `src/components/views/FinanceView.tsx`
- supporting frontend hooks where they are too tightly coupled to one giant page
- active copy and navigation inside finance

### Archive or phase out
- Plaid-era user-facing paths
- stale references suggesting mixed provider direction

### Why
Finance is the strongest current subsystem, but it is implemented as a monolith and carries legacy complexity.

### Target finance feature map
- Finance Overview
- Accounts
- Transactions
- Ledger
- Obligations
- Goals
- Insights

### Suggested new file structure
- `src/features/finance/pages/FinancePage.tsx`
- `src/features/finance/components/FinanceOverview.tsx`
- `src/features/finance/components/AccountsPanel.tsx`
- `src/features/finance/components/TransactionsPanel.tsx`
- `src/features/finance/components/LedgerPanel.tsx`
- `src/features/finance/components/ObligationsPanel.tsx`
- `src/features/finance/components/GoalsPanel.tsx`
- `src/features/finance/components/InsightsPanel.tsx`

---

## Tasks subsystem

### Migrate from scattered concepts
- goals
- workflows
- portions of daily plan logic
- assistant extraction patterns that can create tasks

### Build new
There is no clean first-class tasks workspace today. v2 should introduce it as a core domain.

### New v2 surface
- inbox
- tasks
- projects
- follow-ups
- routines
- daily planning

### Suggested new file structure
- `src/features/tasks/pages/TasksPage.tsx`
- `src/features/tasks/components/InboxPanel.tsx`
- `src/features/tasks/components/TaskListPanel.tsx`
- `src/features/tasks/components/ProjectPanel.tsx`
- `src/features/tasks/components/FollowUpPanel.tsx`
- `src/features/tasks/components/RoutinesPanel.tsx`

---

## Investments subsystem

### Build new
There is not yet a focused investments workspace appropriate for v2.

### New v2 surface
- holdings
- watchlist
- investment notes
- thesis tracker
- review queue
- risk summary

### Suggested new file structure
- `src/features/investments/pages/InvestmentsPage.tsx`
- `src/features/investments/components/HoldingsPanel.tsx`
- `src/features/investments/components/WatchlistPanel.tsx`
- `src/features/investments/components/ResearchPanel.tsx`
- `src/features/investments/components/ThesisPanel.tsx`
- `src/features/investments/components/RiskPanel.tsx`

---

## Assistant subsystem

### Keep
- command palette concepts
- conversational and summary infrastructure
- shared AI invocation patterns

### Refactor
- assistant surface and copy
- how AI actions map into product modules
- logging and explanation layer

### Why
The assistant should be the operational intelligence layer for v2, not an excuse to keep every unrelated feature alive.

### Target assistant jobs
- daily brief generation
- task extraction
- finance summaries
- investment research support
- action recommendation
- action logs

---

## Settings and control surfaces

### Keep
- useful settings infrastructure
- model selection logic
- appearance preferences
- identity preferences

### Refactor
- reduce overlapping control surfaces
- merge redundant runtime/control ideas into one coherent settings experience

### Archive or cut
- separate control surfaces that duplicate settings without clear value

---

## Surfaces to archive from v2 product

Archive these from the active product shell even if code remains temporarily:
- `src/components/views/TarotView.tsx`
- `src/components/views/CareersView.tsx`
- `src/components/views/MediaView.tsx`
- `src/components/views/AutomotiveFinanceView.tsx`
- `src/components/views/AgentsView.tsx`
- `src/components/views/ControlCenterView.tsx`
- any routes whose purpose does not directly serve the v2 product thesis

Archiving means:
- remove from active navigation
- remove from core route map
- stop marketing them as part of Companion OS v2

---

## Legacy and stale paths

### Plaid-era finance
`netlify/functions/financial-management.js` should be treated as legacy unless a deliberate dual-provider strategy is chosen.

Current direction should favor one primary bank-link path. If Stripe Financial Connections is the chosen path, the rebuild should:
- remove stale user-facing Plaid references from active UX
- update docs to reflect current truth
- avoid maintaining two overlapping product narratives

---

## Background jobs and automation claims

### Refactor
- `lib/autonomous/scheduler.js`

### Why
A `setInterval` scheduler is not enough to support serious “always on” or real autonomous claims.

### Target
Either:
- move background jobs to real scheduled infrastructure
- or reduce product claims until that infrastructure exists

Do not market unsupported behavior.

---

## Security, CI, and hardening

### Migrate and prioritize
- open hardening work
- lint, test, CI, and contract verification improvements
- outstanding security issues related to uploads and auth consistency

### Why
v2 should not just look better. It should be more trustworthy.

---

## Final summary

### Strongest areas to salvage
1. app shell patterns
2. AI gateway architecture
3. finance backend concepts
4. Stripe Financial Connections path
5. premium dark visual language

### Areas to rebuild from scratch or near-scratch
1. top-level product surface
2. navigation and information architecture
3. tasks workspace
4. investments workspace
5. assistant experience framing
6. finance frontend composition

### Areas to archive or cut immediately from active product
1. tarot
2. careers
3. novelty or misaligned surfaces
4. duplicate control surfaces
5. stale or contradictory product narratives

The v2 rebuild should preserve the best technical value while deliberately narrowing the product into a cohesive operating system.