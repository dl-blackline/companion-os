/**
 * app-shell/router.ts — Section ↔ path mapping and route helpers.
 *
 * Canonical source for mapping between NavSection identifiers and URL
 * pathnames. All navigation code should go through these helpers instead
 * of hardcoding paths.
 *
 * Now backed by react-router-dom for proper browser history integration.
 */

import type { NavSection } from '@/components/AppSidebar';

/* ── Section → Path (every section gets a unique URL) ─────────────────────── */

const SECTION_PATHS: Record<NavSection, string> = {
  'home': '/',
  'chat': '/chat',
  'live-talk': '/live-talk',
  'media': '/media',
  'memory': '/memory',
  'knowledge': '/knowledge',
  'goals': '/goals',
  'calendar': '/calendar',
  'workflows': '/workflows',
  'insights': '/insights',
  'careers': '/careers',
  'finance': '/finance',
  'stripe-return': '/finance/stripe/return',
  'automotive-finance': '/automotive-finance',
  'agents': '/agents',
  'control-center': '/control-center',
  'settings': '/settings',
  'tarot': '/tarot',
  'admin-console': '/admin-console',
};

export function pathnameFromSection(section: NavSection): string {
  return SECTION_PATHS[section] ?? '/';
}

/* ── Path → Section ───────────────────────────────────────────────────────── */

// Ordered so more-specific prefixes match first
const PATH_MATCHERS: Array<{ test: (p: string) => boolean; section: NavSection }> = [
  { test: (p) => p.startsWith('/finance/stripe/return'), section: 'stripe-return' },
  { test: (p) => p === '/control-center', section: 'control-center' },
  { test: (p) => p === '/careers', section: 'careers' },
  { test: (p) => p === '/finance', section: 'finance' },
  { test: (p) => p === '/automotive-finance', section: 'automotive-finance' },
  { test: (p) => p === '/chat', section: 'chat' },
  { test: (p) => p === '/live-talk', section: 'live-talk' },
  { test: (p) => p === '/media', section: 'media' },
  { test: (p) => p === '/memory', section: 'memory' },
  { test: (p) => p === '/knowledge', section: 'knowledge' },
  { test: (p) => p === '/goals', section: 'goals' },
  { test: (p) => p === '/calendar', section: 'calendar' },
  { test: (p) => p === '/workflows', section: 'workflows' },
  { test: (p) => p === '/insights', section: 'insights' },
  { test: (p) => p === '/agents', section: 'agents' },
  { test: (p) => p === '/settings', section: 'settings' },
  { test: (p) => p === '/tarot', section: 'tarot' },
  { test: (p) => p === '/admin-console', section: 'admin-console' },
];

const DEFAULT_SECTION: NavSection = 'home';

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
