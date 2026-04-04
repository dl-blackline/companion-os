/**
 * app-shell/telemetry-rail.tsx — Persistent desktop telemetry status bar.
 *
 * Sits at the top of the main canvas on desktop. Shows runtime health,
 * companion state, active model, memory status, and active section breadcrumb.
 * Mirrors the mobile StatusChips but fully expanded for desktop real-estate.
 */

import type { CompanionState } from '@/types';
import type { RuntimeDisplayInfo } from './runtime-helpers';

interface TelemetryRailProps {
  runtimeDisplay: RuntimeDisplayInfo;
  companionState: CompanionState;
  activeSection: string;
  modelLabel?: string;
}

const STATE_DOT: Record<string, string> = {
  idle: 'text-zinc-400',
  listening: 'text-sky-300',
  speaking: 'text-rose-300',
  thinking: 'text-amber-200',
  'generating-image': 'text-violet-300',
  'generating-video': 'text-violet-300',
  writing: 'text-emerald-300',
  analyzing: 'text-amber-300',
};

const STATE_LABEL: Record<string, string> = {
  idle: 'Ready',
  listening: 'Listening',
  speaking: 'Speaking',
  thinking: 'Reasoning',
  'generating-image': 'Generating',
  'generating-video': 'Generating',
  writing: 'Writing',
  analyzing: 'Analyzing',
};

function formatSection(section: string): string {
  return section
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TelemetryRail({
  runtimeDisplay,
  companionState,
  activeSection,
  modelLabel,
}: TelemetryRailProps) {
  const dotClass = STATE_DOT[companionState] ?? 'text-zinc-400';
  const stateLabel = STATE_LABEL[companionState] ?? companionState;

  return (
    <div className="vuk-surface-telemetry telemetry-rail">
      {/* Runtime health */}
      <div className="telemetry-rail__section">
        <span className="telemetry-rail__label">SYS</span>
        <span className={`telemetry-rail__dot ${runtimeDisplay.dotClass}`} />
        <span className="telemetry-rail__value">{runtimeDisplay.label}</span>
      </div>

      <span className="telemetry-rail__divider" />

      {/* Companion state */}
      <div className="telemetry-rail__section">
        <span className="telemetry-rail__label">STATE</span>
        <span className={`telemetry-rail__dot ${dotClass}`} />
        <span className="telemetry-rail__value">{stateLabel}</span>
      </div>

      <span className="telemetry-rail__divider" />

      {/* Model */}
      {modelLabel && (
        <>
          <div className="telemetry-rail__section">
            <span className="telemetry-rail__label">MODEL</span>
            <span className="telemetry-rail__value">{modelLabel}</span>
          </div>
          <span className="telemetry-rail__divider" />
        </>
      )}

      {/* Active section breadcrumb */}
      <div className="telemetry-rail__section ml-auto">
        <span className="telemetry-rail__label">VIEW</span>
        <span className="telemetry-rail__value">{formatSection(activeSection)}</span>
      </div>
    </div>
  );
}
