/**
 * FinancePage — Finance workspace entry for Companion OS v2.
 *
 * Phase 1 strategy: Wrap the existing FinanceView to preserve all current
 * finance functionality while establishing the new v2 feature structure.
 *
 * TODO: Phase 2 — Break FinanceView monolith into modular panels:
 *   - FinanceOverview
 *   - AccountsPanel
 *   - TransactionsPanel
 *   - LedgerPanel
 *   - ObligationsPanel
 *   - GoalsPanel
 *   - InsightsPanel
 *
 * TODO: Phase 2 — Isolate finance hooks and services by purpose.
 * TODO: Phase 2 — Standardize one banking provider path (Stripe Financial Connections).
 * TODO: Phase 2 — Normalize finance vocabulary across the UI.
 */

import { lazy, Suspense } from 'react';
import { SectionFallback } from '@/app-shell/section-registry';

const FinanceView = lazy(() =>
  import('@/components/views/FinanceView').then((m) => ({ default: m.FinanceView }))
);

export function FinancePage() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <FinanceView />
    </Suspense>
  );
}
