/**
 * AssistantPage — AI command surface for Companion OS v2.
 *
 * Purpose: High-trust AI copilot for summaries, task extraction,
 * financial review, investment research, and action logging.
 *
 * Phase 1: Premium placeholder establishing layout hierarchy.
 * Phase 5: Full command integration across Today, Finance, Tasks, and Investments.
 */

import { ChatCircle } from '@phosphor-icons/react/ChatCircle';
import { ListChecks } from '@phosphor-icons/react/ListChecks';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { CurrencyDollar } from '@phosphor-icons/react/CurrencyDollar';
import { ClockCounterClockwise } from '@phosphor-icons/react/ClockCounterClockwise';

interface CapabilityRowProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function CapabilityRow({ icon: Icon, title, description }: CapabilityRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/30 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={18} weight="duotone" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function AssistantPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Intelligence</p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Your AI copilot — summarize, extract, research, and act with confidence.
          </p>
        </div>

        {/* Command area placeholder */}
        <div className="mb-8 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/40 px-4 py-3">
            <ChatCircle size={18} className="text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">Ask anything, give a command, or paste content to process…</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Natural language commands will drive structured actions across all modules.
          </p>
        </div>

        {/* Capabilities */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-semibold px-1 mb-2">Capabilities</p>

          <CapabilityRow
            icon={ChatCircle}
            title="Summarize & Brief"
            description="Generate daily briefs, meeting summaries, and content digests."
          />
          <CapabilityRow
            icon={ListChecks}
            title="Note → Task Extraction"
            description="Convert raw notes and messages into structured tasks and follow-ups."
          />
          <CapabilityRow
            icon={CurrencyDollar}
            title="Financial Review"
            description="Summarize spending patterns, flag anomalies, and review cash position."
          />
          <CapabilityRow
            icon={ChartLineUp}
            title="Investment Research"
            description="Research companies, summarize earnings, and support thesis development."
          />
          <CapabilityRow
            icon={ClockCounterClockwise}
            title="Action Log"
            description="Every high-impact assistant action is logged for review and accountability."
          />
        </div>

        {/* Phase indicator */}
        <div className="mt-12 rounded-xl border border-border/40 bg-muted/30 px-5 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Assistant is scaffolded for Phase 5 integration. Full command flows, action logging, and cross-module intelligence coming next.
          </p>
        </div>
      </div>
    </div>
  );
}
