/**
 * app-shell/feature-gates.ts — Plan gating, admin fallback, and capability checks.
 *
 * Centralizes the logic that decides whether a navigation attempt should be
 * allowed, redirected, or blocked. Domain handlers should call these helpers
 * instead of inline gating checks.
 */

import type { NavSection } from '@/components/AppSidebar';
import { toast } from 'sonner';

export type Plan = 'free' | 'pro' | 'ultra' | string;

export interface FeatureGateContext {
  plan: Plan;
  isAdmin: boolean;
  voiceCapabilityEnabled: boolean;
  isGlobalVoiceActive: boolean;
  stopLiveTalk: () => void;
}

export interface GateResult {
  allowed: boolean;
  /** If not allowed, redirect to this section instead */
  redirect?: NavSection;
}

/** Sections that require a paid plan */
const PAID_SECTIONS: ReadonlySet<NavSection> = new Set(['agents']);

/** Sections that require a specific capability */
const CAPABILITY_REQUIREMENTS: Partial<Record<NavSection, keyof Pick<FeatureGateContext, 'voiceCapabilityEnabled'>>> = {
  'live-talk': 'voiceCapabilityEnabled',
};

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
  // Plan gating
  if (PAID_SECTIONS.has(section) && ctx.plan === 'free') {
    toast.info('Agents is a paid feature. Upgrade in Settings > Account.');
    return { allowed: false, redirect: 'settings' };
  }

  // Capability gating
  const requiredCap = CAPABILITY_REQUIREMENTS[section];
  if (requiredCap && !ctx[requiredCap]) {
    toast.error('Voice capability is disabled in Control Center');
    return { allowed: false };
  }

  return { allowed: true };
}

/**
 * Pre-navigation side-effects. Call after gating passes but before
 * the section actually changes.
 */
export function preNavigationEffects(
  section: NavSection,
  ctx: FeatureGateContext,
): void {
  // Stop global voice when entering Live Talk to prevent duplicate sessions
  if (section === 'live-talk' && ctx.isGlobalVoiceActive) {
    ctx.stopLiveTalk();
  }
}
