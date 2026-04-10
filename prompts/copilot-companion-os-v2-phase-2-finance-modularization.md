# Copilot Prompt - Companion OS v2 Phase 2 Finance Modularization

Use this prompt in GitHub Copilot Chat or Copilot coding agent after Phase 1 is complete.

---

You are working inside the `dl-blackline/companion-os` repository.

Read these files first and treat them as the source of truth for this task:
- `docs/rebuild/companion-os-v2-rebuild-blueprint.md`
- `docs/rebuild/keep-cut-migrate.md`
- `docs/rebuild/implementation-roadmap.md`
- `prompts/copilot-companion-os-v2-phase-1.md`

## Objective

Execute **Phase 2 of the Companion OS v2 rebuild: Finance modularization**.

Phase 1 already reset the active shell and route map to the v2 product surface. Your job now is to preserve the strongest finance functionality while breaking the current finance experience out of any monolithic or legacy-heavy structure.

This is **not** a finance feature expansion pass. It is a **modularization and product-hardening pass**.

## Product thesis for Finance in v2

Finance should be one of the strongest modules in Companion OS v2.
It should feel like a premium personal financial command center for:
- linked accounts
- balances
- transactions
- future ledger
- obligations
- goals
- cash flow visibility
- financial insights

It should be:
- clean
- modular
- trustworthy
- high-signal
- visually premium

It should **not** feel like a giant mixed workspace that keeps absorbing unrelated ideas.

## Main goals for Phase 2

1. **Break the finance experience into smaller modules**
2. **Preserve working Stripe Financial Connections functionality**
3. **Reduce dependency on one giant page file**
4. **Standardize the finance information hierarchy**
5. **Prepare the finance module for later assistant integration and task creation**

## Required target structure

Create or refine this structure under `src/features/finance/`:

- `src/features/finance/pages/FinancePage.tsx`
- `src/features/finance/components/FinanceOverview.tsx`
- `src/features/finance/components/AccountsPanel.tsx`
- `src/features/finance/components/TransactionsPanel.tsx`
- `src/features/finance/components/LedgerPanel.tsx`
- `src/features/finance/components/ObligationsPanel.tsx`
- `src/features/finance/components/GoalsPanel.tsx`
- `src/features/finance/components/InsightsPanel.tsx`

If additional small support components are useful, add them.

## Current-state strategy

The repo likely still contains a large legacy finance view and multiple finance-related hooks.
You should **salvage working logic** but **move the active finance experience toward the new modular structure**.

Do not do a blind rewrite of backend finance logic.
Do not break working account linking, balances, transactions, or ledger behavior.

## Functional requirements

### 1. FinancePage should become the active orchestrator
`FinancePage.tsx` should own the v2 finance experience and compose the new modular panels.

It should establish a clear information hierarchy such as:
- Overview first
- then accounts / transactions / ledger / obligations / goals / insights

Use a polished desktop-first command-center layout aligned with the repo’s premium dark design language.

### 2. Split responsibilities cleanly
Move rendering and view logic out of any giant legacy finance page wherever practical.

Each panel should have a clear job:
- `FinanceOverview` = top-level summaries and key metrics
- `AccountsPanel` = linked accounts and account-level actions
- `TransactionsPanel` = feed, filters, transaction editing or notes if already supported
- `LedgerPanel` = future money tracking
- `ObligationsPanel` = bills and obligations
- `GoalsPanel` = savings goals and progress
- `InsightsPanel` = financial insights, warnings, and suggested actions

### 3. Preserve Stripe path as active linked-account path
Do not reintroduce mixed product messaging around banking providers.
If Stripe Financial Connections is the active product direction, keep the UI aligned with that path.

Do not spend this pass reviving Plaid UX.
If stale references appear in the active finance experience, remove or minimize them.

### 4. Keep finance hooks/service logic stable where possible
If existing hooks are healthy, keep using them.
If they are too coupled to the old monolith, wrap them with clearer feature-local composition.

Avoid unnecessary backend rewrites in this phase.

### 5. Keep the UI premium and restrained
The finance module should feel:
- cleaner than the legacy page
- more structured
- less overwhelming
- more obviously useful

Avoid a wall of equally weighted cards.
Use strong hierarchy.

### 6. Add TODO markers where needed
If a piece must temporarily wrap legacy code, that is acceptable.
But add explicit TODO notes explaining the next modularization step.

## Constraints

- Do not add unrelated new finance features just because you can.
- Do not break current auth or routing.
- Do not touch backend logic unless required for composition, imports, or clear bug prevention.
- Favor smaller components and readable boundaries.
- Keep types coherent.
- Keep the current product operational.

## Desired outcome

When this pass is done, the finance module should:
- render from `src/features/finance/pages/FinancePage.tsx`
- be composed from modular finance panels
- still support linked accounts, transactions, balances, and ledger behavior where already working
- feel more premium, focused, and maintainable than the old implementation

## Output requirements

When you finish:
1. summarize exactly what files you changed
2. explain what legacy finance code was wrapped vs fully modularized
3. identify any backend dependencies that still need cleanup later
4. list the best Phase 3 tasks to build the Tasks module cleanly
5. call out any risk areas or incomplete migration points

Make the changes directly in code, not just as a plan.