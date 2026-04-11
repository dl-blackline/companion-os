/**
 * SettingsPage — Settings entry for Companion OS v2.
 *
 * Phase 1 strategy: Wrap the existing SettingsView to preserve all current
 * settings functionality while establishing the new v2 feature structure.
 *
 * TODO: Phase 6 — Consolidate overlapping control surfaces into one
 *   coherent settings experience (merge Control Center concepts here).
 * TODO: Phase 6 — Clean up mixed naming and stale references.
 */

import { lazy, Suspense } from 'react';
import { SectionFallback } from '@/app-shell/section-registry';

const SettingsView = lazy(() =>
  import('@/components/views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

export function SettingsPage() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <SettingsView />
    </Suspense>
  );
}
