/**
 * app-shell/section-registry.tsx — Lazy imports, section → component map,
 * fallback component, and globally-shared lazy overlays.
 *
 * v2: Only registers the six core sections plus utility routes.
 * Legacy views are preserved in src/components/views/ but removed from
 * the active section registry.
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
import type { CompanionState } from '@/types';

/* ── Lazy imports — v2 core pages ─────────────────────────────────────────── */

const TodayPage = lazy(() => import('@/features/today/pages/TodayPage').then((m) => ({ default: m.TodayPage })));
const FinancePage = lazy(() => import('@/features/finance/pages/FinancePage').then((m) => ({ default: m.FinancePage })));
const TasksPage = lazy(() => import('@/features/tasks/pages/TasksPage').then((m) => ({ default: m.TasksPage })));
const InvestmentsPage = lazy(() => import('@/features/investments/pages/InvestmentsPage').then((m) => ({ default: m.InvestmentsPage })));
const CatalogPage = lazy(() => import('@/features/catalog/pages/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const AssistantPage = lazy(() => import('@/features/assistant/pages/AssistantPage').then((m) => ({ default: m.AssistantPage })));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

/* ── Utility views (still needed for functional routes) ───────────────────── */

const StripeReturnView = lazy(() => import('@/components/views/StripeReturnView').then((m) => ({ default: m.StripeReturnView })));
const AdminConsoleView = lazy(() => import('@/components/views/AdminConsoleView').then((m) => ({ default: m.AdminConsoleView })));

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

/* ── Default factory (Today) ──────────────────────────────────────────────── */

function todayFactory(): ReactNode {
  return <TodayPage />;
}

/* ── Section registry map — v2 core sections ──────────────────────────────── */

export const SECTION_COMPONENTS: Record<NavSection, SectionFactory> = {
  'today': todayFactory,
  'finance': () => <FinancePage />,
  'tasks': () => <TasksPage />,
  'investments': () => <InvestmentsPage />,
  'catalog': () => <CatalogPage />,
  'assistant': () => <AssistantPage />,
  'settings': () => <SettingsPage />,

  'stripe-return': (ctx) => (
    <StripeReturnView onNavigateToFinance={() => ctx.setActiveSection('finance')} />
  ),

  'admin-console': (ctx) =>
    ctx.isAdmin ? <AdminConsoleView /> : todayFactory(),
};

/**
 * Resolve the component for a given section. Falls back to Today for unknown
 * sections. Admin-only sections (e.g. admin-console) also fall back to Today
 * for non-admin users via the section factory's own guard.
 */
export function renderSection(section: NavSection, ctx: SectionRenderContext): ReactNode {
  const factory = SECTION_COMPONENTS[section] ?? todayFactory;
  return factory(ctx);
}
