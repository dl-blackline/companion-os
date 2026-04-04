/**
 * app-shell/runtime-banner.tsx — Runtime health status chip components.
 */

import type { CompanionState } from '@/types';
import { getStateDotClass } from './runtime-helpers';
import type { RuntimeDisplayInfo } from './runtime-helpers';

/* ── Status chips (used in mobile header) ─────────────────────────────────── */

interface StatusChipsProps {
  runtimeDisplay: RuntimeDisplayInfo;
  companionState: CompanionState;
  orbColor: string;
  orbMode: string;
}

export function StatusChips({ runtimeDisplay, companionState, orbColor, orbMode }: StatusChipsProps) {
  const stateLabel = companionState.replace('-', ' ');
  const stateDotClass = getStateDotClass(companionState);

  return (
    <>
      <span className="status-chip whitespace-nowrap">
        <span className={`status-dot ${runtimeDisplay.dotClass}`} />
        {runtimeDisplay.label}
      </span>
      <span className="status-chip status-chip-muted whitespace-nowrap">
        <span className={`status-dot ${stateDotClass}`} />
        {stateLabel}
      </span>
      <span className="status-chip status-chip-muted whitespace-nowrap">
        Orb {orbColor} {orbMode === 'emoji' ? 'emoji' : 'default'}
      </span>
    </>
  );
}
