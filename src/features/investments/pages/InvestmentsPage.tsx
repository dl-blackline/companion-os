/**
 * InvestmentsPage — Investing research workspace for Companion OS v2.
 *
 * Purpose: Track holdings, manage a watchlist, write research notes,
 * maintain investment theses, and review portfolio discipline.
 *
 * Phase 1: Premium placeholder establishing layout hierarchy.
 * Phase 4: Full holdings, watchlist, thesis tracker, and AI research support.
 */

import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { Binoculars } from '@phosphor-icons/react/Binoculars';
import { NotePencil } from '@phosphor-icons/react/NotePencil';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { Scales } from '@phosphor-icons/react/Scales';

interface WorkspaceCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function WorkspaceCard({ icon: Icon, title, description }: WorkspaceCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border/50 bg-card/30 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={20} weight="duotone" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function InvestmentsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Research & Portfolio</p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">Investments</h1>
          <p className="text-sm text-muted-foreground">Track holdings, research opportunities, and maintain investment discipline.</p>
        </div>

        {/* Workspace preview */}
        <div className="grid gap-4 md:grid-cols-2">
          <WorkspaceCard
            icon={ChartLineUp}
            title="Holdings"
            description="Track current positions, cost basis, and performance across your portfolio."
          />
          <WorkspaceCard
            icon={Binoculars}
            title="Watchlist"
            description="Monitor securities and opportunities you're evaluating before committing capital."
          />
          <WorkspaceCard
            icon={NotePencil}
            title="Research Notes"
            description="Write and organize research on companies, sectors, or investment themes."
          />
          <WorkspaceCard
            icon={ShieldCheck}
            title="Thesis Tracker"
            description="Document your investment theses. Review them periodically to stay disciplined."
          />
          <WorkspaceCard
            icon={Scales}
            title="Risk Summary"
            description="Concentration, exposure, and risk flags across your portfolio at a glance."
          />
        </div>

        {/* Phase indicator */}
        <div className="mt-12 rounded-xl border border-border/40 bg-muted/30 px-5 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Investments module is scaffolded for Phase 4 implementation. Holdings, watchlist, thesis tracking, and AI research support coming next.
          </p>
        </div>
      </div>
    </div>
  );
}
