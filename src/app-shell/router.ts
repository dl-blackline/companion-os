/**
 * app-shell/router.ts — Section ↔ path mapping and route helpers.
 *
 * Canonical source for mapping between NavSection identifiers and URL
 * pathnames. All navigation code should go through these helpers instead
 * of hardcoding paths.
 *
 * v2: Routes only the six core sections plus utility routes (stripe-return, admin-console).
 */

import type { NavSection } from '@/components/AppSidebar';

/* ── Section → Path (v2 core sections) ────────────────────────────────────── */

const SECTION_PATHS: Record<NavSection, string> = {
  'today': '/',
  'finance': '/finance',
  'tasks': '/tasks',
  'investments': '/investments',
  'assistant': '/assistant',
  'settings': '/settings',
  'stripe-return': '/finance/stripe/return',
  'admin-console': '/admin-console',
};

export function pathnameFromSection(section: NavSection): string {
  return SECTION_PATHS[section] ?? '/';
}

/* ── Path → Section ───────────────────────────────────────────────────────── */

// Ordered so more-specific prefixes match first
const PATH_MATCHERS: Array<{ test: (p: string) => boolean; section: NavSection }> = [
  { test: (p) => p.startsWith('/finance/stripe/return'), section: 'stripe-return' },
  { test: (p) => p === '/finance', section: 'finance' },
  { test: (p) => p === '/tasks', section: 'tasks' },
  { test: (p) => p === '/investments', section: 'investments' },
  { test: (p) => p === '/assistant', section: 'assistant' },
  { test: (p) => p === '/settings', section: 'settings' },
  { test: (p) => p === '/admin-console', section: 'admin-console' },
];

const DEFAULT_SECTION: NavSection = 'today';

export function sectionFromPathname(pathname: string): NavSection {
  for (const { test, section } of PATH_MATCHERS) {
    if (test(pathname)) return section;
  }
  return DEFAULT_SECTION;
}

/**
 * Push a new pathname to the browser history if it differs from the current.
 *
 * @deprecated Prefer using navigate() from react-router's useNavigate() hook.
 * This function is retained for non-component code that cannot use hooks.
 */
export function pushSectionPath(section: NavSection): void {
  const targetPath = pathnameFromSection(section);
  if (window.location.pathname !== targetPath) {
    window.history.pushState({}, '', targetPath);
  }
}
