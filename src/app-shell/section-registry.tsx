/**
 * app-shell/section-registry.tsx — Lazy imports, section → component map,
 * fallback component, and globally-shared lazy overlays.
 *
 * To add a new section:
 *   1. Add a lazy import below
 *   2. Add an entry to SECTION_COMPONENTS
 *   3. Add the NavSection variant in AppSidebar
 *   4. (Optional) Add route mapping in app-shell/router.ts
 *
 * NOTE: This file intentionally mixes component and non-component exports.
 * The eslint-plugin-react-refresh warning is suppressed because all exported
 * values are consumed at the top level (App.tsx composition root) and never
 * used inside hot-reloaded component bodies.
 */

/* eslint-disable react-refresh/only-export-components */

import { lazy, type ReactNode } from 'react';
import type { NavSection } from '@/components/AppSidebar';
import { HomeDashboard } from '@/components/views/HomeDashboard';
import type { CompanionState } from '@/types';

/* ── Lazy imports ─────────────────────────────────────────────────────────── */

const ChatView = lazy(() => import('@/components/views/ChatView').then((m) => ({ default: m.ChatView })));
const LiveTalkView = lazy(() => import('@/components/views/LiveTalkView').then((m) => ({ default: m.LiveTalkView })));
const MediaView = lazy(() => import('@/components/views/MediaView').then((m) => ({ default: m.MediaView })));
const MemoryView = lazy(() => import('@/components/views/MemoryView').then((m) => ({ default: m.MemoryView })));
const KnowledgeView = lazy(() => import('@/components/views/KnowledgeView').then((m) => ({ default: m.KnowledgeView })));
const GoalsView = lazy(() => import('@/components/views/GoalsView').then((m) => ({ default: m.GoalsView })));
const CalendarView = lazy(() => import('@/components/views/CalendarView').then((m) => ({ default: m.CalendarView })));
const InsightsView = lazy(() => import('@/components/views/InsightsView').then((m) => ({ default: m.InsightsView })));
const CareersView = lazy(() => import('@/components/views/CareersView').then((m) => ({ default: m.CareersView })));
const FinanceView = lazy(() => import('@/components/views/FinanceView').then((m) => ({ default: m.FinanceView })));
const AutomotiveFinanceView = lazy(() => import('@/components/views/AutomotiveFinanceView').then((m) => ({ default: m.AutomotiveFinanceView })));
const WorkflowsView = lazy(() => import('@/components/views/WorkflowsView').then((m) => ({ default: m.WorkflowsView })));
const SettingsView = lazy(() => import('@/components/views/SettingsView').then((m) => ({ default: m.SettingsView })));
const ControlCenterView = lazy(() => import('@/components/views/ControlCenterView').then((m) => ({ default: m.ControlCenterView })));
const AgentsView = lazy(() => import('@/components/views/AgentsView').then((m) => ({ default: m.AgentsView })));
const AdminConsoleView = lazy(() => import('@/components/views/AdminConsoleView').then((m) => ({ default: m.AdminConsoleView })));
const TarotView = lazy(() => import('@/components/views/TarotView').then((m) => ({ default: m.TarotView })));
const StripeReturnView = lazy(() => import('@/components/views/StripeReturnView').then((m) => ({ default: m.StripeReturnView })));

/* ── Global overlays (not section-routed) ─────────────────────────────────── */

export const FloatingLiveOrb = lazy(() => import('@/components/FloatingLiveOrb').then((m) => ({ default: m.FloatingLiveOrb })));
export const CommandPalette = lazy(() => import('@/components/CommandPalette').then((m) => ({ default: m.CommandPalette })));

/* ── Section loading fallback ─────────────────────────────────────────────── */

export function SectionFallback() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="glass-card flex min-w-[240px] items-center gap-3 rounded-2xl px-5 py-4 text-sm text-muted-foreground">
        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
        Loading workspace…
      </div>
    </div>
  );
}

/* ── Render context passed to section factories ───────────────────────────── */

export interface SectionRenderContext {
  companionState: CompanionState;
  setCompanionState: (state: CompanionState) => void;
  aiName: string;
  isAdmin: boolean;
  onNavigate: (section: string) => void;
  onBack: () => void;
  setActiveSection: (section: NavSection) => void;
}

type SectionFactory = (ctx: SectionRenderContext) => ReactNode;

/* ── Section registry map ─────────────────────────────────────────────────── */

function homeFactory(ctx: SectionRenderContext): ReactNode {
  return (
    <HomeDashboard
      companionState={ctx.companionState}
      aiName={ctx.aiName}
      onNavigate={ctx.onNavigate}
    />
  );
}

export const SECTION_COMPONENTS: Record<NavSection, SectionFactory> = {
  'home': homeFactory,

  'live-talk': (ctx) => (
    <LiveTalkView
      companionState={ctx.companionState}
      setCompanionState={ctx.setCompanionState}
      aiName={ctx.aiName}
      onBack={ctx.onBack}
    />
  ),

  'chat': () => <ChatView />,
  'media': (ctx) => (
    <MediaView
      companionState={ctx.companionState}
      setCompanionState={ctx.setCompanionState}
      aiName={ctx.aiName}
    />
  ),
  'memory': () => <MemoryView />,
  'knowledge': () => <KnowledgeView />,
  'goals': () => <GoalsView />,
  'calendar': () => <CalendarView />,
  'workflows': () => <WorkflowsView />,
  'insights': () => <InsightsView />,
  'careers': () => <CareersView />,
  'finance': () => <FinanceView />,
  'stripe-return': (ctx) => (
    <StripeReturnView onNavigateToFinance={() => ctx.setActiveSection('finance')} />
  ),
  'automotive-finance': () => <AutomotiveFinanceView />,
  'agents': () => <AgentsView />,
  'control-center': () => <ControlCenterView />,
  'settings': () => <SettingsView />,
  'tarot': () => <TarotView />,

  'admin-console': (ctx) =>
    ctx.isAdmin ? <AdminConsoleView /> : homeFactory(ctx),
};

/**
 * Resolve the component for a given section. Falls back to Home for unknown sections.
 */
export function renderSection(section: NavSection, ctx: SectionRenderContext): ReactNode {
  const factory = SECTION_COMPONENTS[section] ?? homeFactory;
  return factory(ctx);
}
