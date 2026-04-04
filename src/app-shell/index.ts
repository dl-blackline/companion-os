/**
 * app-shell/index.ts — Barrel export for the app-shell module.
 *
 * Re-exports all public API from the app-shell sub-modules so consumers
 * can import from `@/app-shell` instead of reaching into individual files.
 */

// Router
export { sectionFromPathname, pathnameFromSection, pushSectionPath } from './router';

// Navigation metadata
export { isVisibleNavSection, isAdminSection, HIDDEN_NAV_SECTIONS, ADMIN_ONLY_SECTIONS } from './navigation';
export type { NavSection } from './navigation';

// Section registry
export { SECTION_COMPONENTS, renderSection, SectionFallback, FloatingLiveOrb, CommandPalette } from './section-registry';
export type { SectionRenderContext } from './section-registry';

// Animated section
export { AnimatedSection } from './animated-section';

// Mobile shell
export { MobileHeader, MobileDrawerOverlay, MobileSidebarWrapper } from './mobile-shell';

// Runtime display
export { StatusChips } from './runtime-banner';
export { getRuntimeDisplay, getStateDotClass } from './runtime-helpers';
export type { RuntimeDisplayInfo } from './runtime-helpers';

// Feature gates
export { evaluateGate, preNavigationEffects } from './feature-gates';
export type { FeatureGateContext, GateResult, Plan } from './feature-gates';
