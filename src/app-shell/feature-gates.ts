/**
 * app-shell/feature-gates.ts — Plan gating, admin fallback, and capability checks.
 *
 * v2: Simplified for the six core sections. Legacy gating for agents,
 * live-talk, and voice capabilities removed from the active gate map.
 */

import type { NavSection } from '@/components/AppSidebar';
import { toast } from 'sonner';

export type Plan = 'free' | 'pro' | 'ultra' | string;

export interface FeatureGateContext {
  plan: Plan;
  isAdmin: boolean;
}

export interface GateResult {
  allowed: boolean;
  /** If not allowed, redirect to this section instead */
  redirect?: NavSection;
}

/**
 * Evaluate whether the user can navigate to a section.
 *
 * Returns { allowed: true } if navigation should proceed, or
 * { allowed: false, redirect } with a toast side-effect if blocked.
 */
export function evaluateGate(
  section: NavSection,
  ctx: FeatureGateContext,
): GateResult {
  // Admin-only gating
  if (section === 'admin-console' && !ctx.isAdmin) {
    toast.error('Admin access required.');
    return { allowed: false, redirect: 'today' };
  }

  return { allowed: true };
}

/**
 * Pre-navigation side-effects. Call after gating passes but before
 * the section actually changes. Currently a no-op in v2 core sections.
 */
export function preNavigationEffects(
  _section: NavSection,
  _ctx: FeatureGateContext,
): void {
  // No pre-navigation effects needed for v2 core sections.
  // Voice/live-talk effects were removed with the legacy nav.
}
