/**
 * app-shell/runtime-helpers.ts — Pure helper functions for runtime display.
 *
 * Separated from runtime-banner.tsx so React Fast Refresh works
 * (HMR requires .tsx files to export only components).
 */

import type { CompanionState } from '@/types';
import type { RuntimeHealthState } from '@/hooks/use-runtime-health';

/* ── Companion state display ──────────────────────────────────────────────── */

export function getStateDotClass(state: CompanionState): string {
  switch (state) {
    case 'listening': return 'bg-sky-300';
    case 'speaking': return 'bg-rose-300';
    case 'thinking': return 'bg-amber-200';
    case 'idle': return 'bg-zinc-400';
    default: return 'bg-zinc-200';
  }
}

/* ── Runtime health display ───────────────────────────────────────────────── */

export interface RuntimeDisplayInfo {
  label: string;
  dotClass: string;
}

export function getRuntimeDisplay(
  healthState: RuntimeHealthState,
  disabledCapabilities: string[],
): RuntimeDisplayInfo {
  const healthy = healthState === 'healthy' && disabledCapabilities.length === 0;

  if (healthState === 'checking') {
    return { label: 'Runtime Check', dotClass: 'bg-zinc-500' };
  }
  if (healthy) {
    return { label: 'Runtime', dotClass: 'bg-zinc-100' };
  }
  return { label: 'Runtime Partial', dotClass: 'bg-zinc-400' };
}
