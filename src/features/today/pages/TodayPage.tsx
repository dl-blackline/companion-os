/**
 * TodayPage — Daily command view for Companion OS v2.
 *
 * Purpose: Surface what matters most right now — priorities, due items,
 * cash snapshot, and assistant-generated insights in one glanceable view.
 *
 * Phase 1: Premium placeholder establishing layout hierarchy.
 * Phase 5: Full integration with Tasks, Finance, and Investments modules.
 */

import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { CurrencyDollar } from '@phosphor-icons/react/CurrencyDollar';
import { ChatCircle } from '@phosphor-icons/react/ChatCircle';

function SectionShell({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={20} weight="duotone" />
        </div>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export function TodayPage() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">{today}</p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">Today</h1>
          <p className="text-sm text-muted-foreground">Your daily command view — priorities, money, and next actions.</p>
        </div>

        {/* Primary section grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <SectionShell
            icon={Lightning}
            title="Top Priorities"
            description="Your highest-priority tasks and follow-ups surface here. Connected to the Tasks module once active."
          />
          <SectionShell
            icon={CalendarBlank}
            title="Due & Overdue"
            description="Items approaching or past deadline. Drawn from tasks, obligations, and scheduled reviews."
          />
          <SectionShell
            icon={CurrencyDollar}
            title="Cash Snapshot"
            description="Quick view of account balances and upcoming obligations. Fed by the Finance module."
          />
          <SectionShell
            icon={ChatCircle}
            title="Assistant Brief"
            description="AI-generated summary of what matters today — insights, recommendations, and action items."
          />
        </div>

        {/* Phase indicator */}
        <div className="mt-12 rounded-xl border border-border/40 bg-muted/30 px-5 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Today view is scaffolded for Phase 5 integration. Core data will flow from Tasks, Finance, and Investments.
          </p>
        </div>
      </div>
    </div>
  );
}
