/**
 * TasksPage — Execution workspace for Companion OS v2.
 *
 * Purpose: First-class task management — inbox capture, task lists,
 * projects, follow-ups, recurring routines, and daily planning.
 *
 * Phase 1: Premium placeholder establishing layout hierarchy.
 * Phase 3: Full task domain with persistence, projects, and assistant extraction.
 */

import { Tray } from '@phosphor-icons/react/Tray';
import { ListChecks } from '@phosphor-icons/react/ListChecks';
import { Kanban } from '@phosphor-icons/react/Kanban';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { CalendarCheck } from '@phosphor-icons/react/CalendarCheck';

interface CapabilityCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function CapabilityCard({ icon: Icon, title, description }: CapabilityCardProps) {
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

export function TasksPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Execution</p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">Tasks</h1>
          <p className="text-sm text-muted-foreground">Capture, organize, and execute work with discipline.</p>
        </div>

        {/* Capability preview */}
        <div className="grid gap-4 md:grid-cols-2">
          <CapabilityCard
            icon={Tray}
            title="Inbox Capture"
            description="Quick-capture anything. Process later into structured tasks, projects, or follow-ups."
          />
          <CapabilityCard
            icon={ListChecks}
            title="Task List"
            description="Structured tasks with priorities, due dates, and status tracking."
          />
          <CapabilityCard
            icon={Kanban}
            title="Projects"
            description="Group related tasks under projects for longer-running initiatives."
          />
          <CapabilityCard
            icon={ArrowsClockwise}
            title="Recurring Routines"
            description="Define repeating tasks for habits, reviews, and maintenance."
          />
          <CapabilityCard
            icon={CalendarCheck}
            title="Follow-ups"
            description="Track items waiting on others with automatic reminders and escalation."
          />
        </div>

        {/* Phase indicator */}
        <div className="mt-12 rounded-xl border border-border/40 bg-muted/30 px-5 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Tasks module is scaffolded for Phase 3 implementation. Full inbox, projects, routines, and assistant extraction coming next.
          </p>
        </div>
      </div>
    </div>
  );
}
