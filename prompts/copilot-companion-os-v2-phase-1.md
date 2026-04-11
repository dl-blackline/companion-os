# Copilot Prompt - Companion OS v2 Phase 1 Rebuild

Use this prompt in GitHub Copilot Chat or Copilot coding agent when executing the first rebuild pass.

---

You are working inside the `dl-blackline/companion-os` repository.

Read these files first and treat them as the source of truth for this task:
- `docs/rebuild/companion-os-v2-rebuild-blueprint.md`
- `docs/rebuild/keep-cut-migrate.md`
- `docs/rebuild/implementation-roadmap.md`

## Objective

Execute **Phase 1 of the Companion OS v2 rebuild**.

This is a **product-surface rebuild with selective salvage**, not a random refactor.

The owner is not happy with the current product and is explicitly open to a full rebuild where needed. Your job is to start the rebuild in a disciplined way by replacing the active shell and route map with the new v2 information architecture.

## Product thesis

Companion OS v2 should be a focused operating system for:
- daily execution
- personal finance
- tasks and follow-up management
- investing and research
- AI-assisted planning and summaries

It should **not** remain a broad collection of unrelated surfaces.

## Phase 1 requirements

Replace the current active product shell so the app is centered on exactly these top-level sections:
- Today
- Finance
- Tasks
- Investments
- Assistant
- Settings

## What to change

### 1. Refactor the active app shell
Use the current shell infrastructure where useful, but change the active experience so the main navigation only contains the six v2 sections.

Likely files involved:
- `src/App.tsx`
- `src/components/AppSidebar.tsx`
- `src/app-shell/section-registry.tsx`
- any route helper files that currently map old sections

### 2. Remove non-core sections from active navigation
Do **not** delete all old views right away if that creates risk.
Instead:
- remove them from the active sidebar
- remove them from the active top-level section registry
- stop presenting them as the current product

Archive or sideline these from the main experience for now:
- Live Talk
- Chat as a standalone top-level section if Assistant becomes the new shell entry
- Media
- Memory
- Knowledge
- Goals
- Calendar
- Workflows
- Insights
- Careers
- Automotive Finance
- Agents
- Control Center
- Tarot
- Admin Console

If some of their logic is still needed later, leave the files in place but do not keep them in the active v2 nav.

### 3. Create v2 feature structure
Create the new feature folders and page entry files:
- `src/features/today/pages/TodayPage.tsx`
- `src/features/finance/pages/FinancePage.tsx`
- `src/features/tasks/pages/TasksPage.tsx`
- `src/features/investments/pages/InvestmentsPage.tsx`
- `src/features/assistant/pages/AssistantPage.tsx`
- `src/features/settings/pages/SettingsPage.tsx`

These do not all need to be fully implemented in this pass.
But they **must** exist, render cleanly, and establish the new architecture.

### 4. Finance page strategy
Do not throw away the current finance work.
For Phase 1, `FinancePage.tsx` can wrap or compose existing finance functionality as an interim step.
But do not continue the old structure as the long-term architecture. Add clear TODO comments marking modularization as the next phase.

### 5. Today, Tasks, Investments, and Assistant placeholders
Create premium placeholder pages that already reflect the product thesis.
Each page should:
- look polished
- match the dark premium visual direction already in the repo
- clearly state the purpose of the section
- avoid fake functionality
- establish the intended hierarchy and layout style for v2

### 6. Naming cleanup in the active shell
Pick a consistent active product label for the shell. Favor `Companion OS` unless there is an already-implemented stronger naming hierarchy.
Do not leave mixed `Vuk OS` and `Companion OS` branding visible in the active shell.

### 7. Preserve functionality where practical
Do not break auth, boot, or basic navigation.
Do not introduce dead routes that crash.
Do not remove finance functionality from the repo.

## Implementation constraints

- Favor small, clear modules over giant files.
- Keep the code production-minded.
- Preserve existing patterns where they are healthy.
- Avoid touching backend finance logic unless required for shell integration.
- Do not add unrelated features.
- Do not re-expand scope.

## Deliverables

By the end of this pass, I should be able to run the app and see:
- a clean v2 shell
- only the six core sections in navigation
- placeholder or partial implementations for Today, Tasks, Investments, Assistant, and Settings
- Finance still accessible from the new shell
- no active top-level clutter from legacy product surfaces

## Output requirements

When you finish:
1. summarize exactly what files you changed
2. explain any temporary wrappers or compromises
3. list the next best Phase 2 tasks for finance modularization
4. call out anything risky or incomplete

Make the changes directly in code, not just as a plan.