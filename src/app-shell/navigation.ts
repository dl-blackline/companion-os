/**
 * app-shell/navigation.ts — Navigation metadata and visibility helpers.
 *
 * Re-exports the NavSection type and provides helpers for navigation
 * visibility, grouping, and section ordering. The actual nav item list
 * (labels, icons, groups) lives in AppSidebar to stay close to its
 * rendering context; this module provides programmatic helpers.
 */

export type { NavSection } from '@/components/AppSidebar';

import type { NavSection } from '@/components/AppSidebar';

/** Sections that are hidden from the sidebar nav */
export const HIDDEN_NAV_SECTIONS: ReadonlySet<NavSection> = new Set([
  'stripe-return',
  'admin-console',
  'tarot',
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
