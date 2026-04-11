/**
 * app-shell/navigation.ts — Navigation metadata and visibility helpers.
 *
 * v2: Hidden sections are utility-only routes not shown in sidebar.
 * The active nav is defined by AppSidebar's navItems array.
 */

export type { NavSection } from '@/components/AppSidebar';

import type { NavSection } from '@/components/AppSidebar';

/** Sections that are hidden from the sidebar nav (utility routes only) */
export const HIDDEN_NAV_SECTIONS: ReadonlySet<NavSection> = new Set([
  'stripe-return',
  'admin-console',
]);

/** Check if a section should appear in the main navigation */
export function isVisibleNavSection(section: NavSection): boolean {
  return !HIDDEN_NAV_SECTIONS.has(section);
}

/** Sections that require admin privileges */
export const ADMIN_ONLY_SECTIONS: ReadonlySet<NavSection> = new Set([
  'admin-console',
]);

export function isAdminSection(section: NavSection): boolean {
  return ADMIN_ONLY_SECTIONS.has(section);
}
