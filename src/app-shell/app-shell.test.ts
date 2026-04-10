import { describe, it, expect } from 'vitest';
import { sectionFromPathname, pathnameFromSection } from '@/app-shell/router';
import { evaluateGate, preNavigationEffects } from '@/app-shell/feature-gates';
import { getRuntimeDisplay, getStateDotClass } from '@/app-shell/runtime-helpers';
import { isVisibleNavSection, isAdminSection } from '@/app-shell/navigation';
import { SECTION_COMPONENTS, renderSection } from '@/app-shell/section-registry';

/* ── Router ───────────────────────────────────────────────────────────────── */

describe('app-shell/router', () => {
  describe('sectionFromPathname', () => {
    it('returns today for /', () => {
      expect(sectionFromPathname('/')).toBe('today');
    });
    it('returns stripe-return for /finance/stripe/return', () => {
      expect(sectionFromPathname('/finance/stripe/return')).toBe('stripe-return');
    });
    it('returns finance for /finance', () => {
      expect(sectionFromPathname('/finance')).toBe('finance');
    });
    it('returns tasks for /tasks', () => {
      expect(sectionFromPathname('/tasks')).toBe('tasks');
    });
    it('returns investments for /investments', () => {
      expect(sectionFromPathname('/investments')).toBe('investments');
    });
    it('returns assistant for /assistant', () => {
      expect(sectionFromPathname('/assistant')).toBe('assistant');
    });
    it('returns settings for /settings', () => {
      expect(sectionFromPathname('/settings')).toBe('settings');
    });
    it('returns admin-console for /admin-console', () => {
      expect(sectionFromPathname('/admin-console')).toBe('admin-console');
    });
    it('returns today for unknown paths', () => {
      expect(sectionFromPathname('/unknown')).toBe('today');
    });
    it('returns today for legacy paths that no longer exist', () => {
      expect(sectionFromPathname('/chat')).toBe('today');
      expect(sectionFromPathname('/media')).toBe('today');
      expect(sectionFromPathname('/memory')).toBe('today');
      expect(sectionFromPathname('/live-talk')).toBe('today');
      expect(sectionFromPathname('/goals')).toBe('today');
      expect(sectionFromPathname('/careers')).toBe('today');
      expect(sectionFromPathname('/tarot')).toBe('today');
      expect(sectionFromPathname('/control-center')).toBe('today');
    });
  });

  describe('pathnameFromSection', () => {
    it('returns / for today', () => {
      expect(pathnameFromSection('today')).toBe('/');
    });
    it('returns /finance for finance', () => {
      expect(pathnameFromSection('finance')).toBe('/finance');
    });
    it('returns /tasks for tasks', () => {
      expect(pathnameFromSection('tasks')).toBe('/tasks');
    });
    it('returns /investments for investments', () => {
      expect(pathnameFromSection('investments')).toBe('/investments');
    });
    it('returns /assistant for assistant', () => {
      expect(pathnameFromSection('assistant')).toBe('/assistant');
    });
    it('returns /settings for settings', () => {
      expect(pathnameFromSection('settings')).toBe('/settings');
    });
    it('returns /finance/stripe/return for stripe-return', () => {
      expect(pathnameFromSection('stripe-return')).toBe('/finance/stripe/return');
    });
    it('returns /admin-console for admin-console', () => {
      expect(pathnameFromSection('admin-console')).toBe('/admin-console');
    });
  });
});

/* ── Feature gates ────────────────────────────────────────────────────────── */

describe('app-shell/feature-gates', () => {
  const baseCtx = {
    plan: 'pro' as const,
    isAdmin: false,
  };

  it('allows navigation to core sections', () => {
    expect(evaluateGate('today', baseCtx).allowed).toBe(true);
    expect(evaluateGate('finance', baseCtx).allowed).toBe(true);
    expect(evaluateGate('tasks', baseCtx).allowed).toBe(true);
    expect(evaluateGate('investments', baseCtx).allowed).toBe(true);
    expect(evaluateGate('assistant', baseCtx).allowed).toBe(true);
    expect(evaluateGate('settings', baseCtx).allowed).toBe(true);
  });

  it('blocks admin-console for non-admins and redirects to today', () => {
    const result = evaluateGate('admin-console', { ...baseCtx, isAdmin: false });
    expect(result.allowed).toBe(false);
    expect(result.redirect).toBe('today');
  });

  it('allows admin-console for admins', () => {
    const result = evaluateGate('admin-console', { ...baseCtx, isAdmin: true });
    expect(result.allowed).toBe(true);
  });

  it('preNavigationEffects does not throw for any section', () => {
    expect(() => preNavigationEffects('today', baseCtx)).not.toThrow();
    expect(() => preNavigationEffects('finance', baseCtx)).not.toThrow();
    expect(() => preNavigationEffects('settings', baseCtx)).not.toThrow();
  });
});

/* ── Runtime helpers ──────────────────────────────────────────────────────── */

describe('app-shell/runtime-helpers', () => {
  it('returns correct dot class for companion states', () => {
    expect(getStateDotClass('idle')).toBe('bg-zinc-400');
    expect(getStateDotClass('listening')).toBe('bg-sky-300');
    expect(getStateDotClass('speaking')).toBe('bg-rose-300');
    expect(getStateDotClass('thinking')).toBe('bg-amber-200');
  });

  it('returns "Runtime Check" when state is checking', () => {
    const display = getRuntimeDisplay('checking', []);
    expect(display.label).toBe('Runtime Check');
    expect(display.dotClass).toBe('bg-zinc-500');
  });

  it('returns "Runtime" when healthy with no disabled capabilities', () => {
    const display = getRuntimeDisplay('healthy', []);
    expect(display.label).toBe('Runtime');
    expect(display.dotClass).toBe('bg-zinc-100');
  });

  it('returns "Runtime Partial" when healthy but with disabled capabilities', () => {
    const display = getRuntimeDisplay('healthy', ['voice']);
    expect(display.label).toBe('Runtime Partial');
    expect(display.dotClass).toBe('bg-zinc-400');
  });

  it('returns "Runtime Partial" when degraded', () => {
    const display = getRuntimeDisplay('degraded', []);
    expect(display.label).toBe('Runtime Partial');
  });
});

/* ── Navigation helpers ───────────────────────────────────────────────────── */

describe('app-shell/navigation', () => {
  it('stripe-return, admin-console are hidden nav sections', () => {
    expect(isVisibleNavSection('stripe-return')).toBe(false);
    expect(isVisibleNavSection('admin-console')).toBe(false);
  });

  it('today, finance, tasks, investments, assistant, settings are visible nav sections', () => {
    expect(isVisibleNavSection('today')).toBe(true);
    expect(isVisibleNavSection('finance')).toBe(true);
    expect(isVisibleNavSection('tasks')).toBe(true);
    expect(isVisibleNavSection('investments')).toBe(true);
    expect(isVisibleNavSection('assistant')).toBe(true);
    expect(isVisibleNavSection('settings')).toBe(true);
  });

  it('admin-console is an admin section', () => {
    expect(isAdminSection('admin-console')).toBe(true);
    expect(isAdminSection('today')).toBe(false);
  });
});

/* ── Section registry ─────────────────────────────────────────────────────── */

describe('app-shell/section-registry', () => {
  it('has an entry for every v2 section', () => {
    const expectedSections = [
      'today', 'finance', 'tasks', 'investments', 'assistant',
      'settings', 'stripe-return', 'admin-console',
    ];
    for (const section of expectedSections) {
      expect(SECTION_COMPONENTS).toHaveProperty(section);
      expect(typeof SECTION_COMPONENTS[section as keyof typeof SECTION_COMPONENTS]).toBe('function');
    }
  });

  it('renderSection returns a ReactNode for known sections', () => {
    const ctx = {
      companionState: 'idle' as const,
      setCompanionState: () => {},
      aiName: 'Companion',
      isAdmin: false,
      onNavigate: () => {},
      onBack: () => {},
      setActiveSection: () => {},
    };
    const result = renderSection('today', ctx);
    expect(result).toBeDefined();
  });

  it('renderSection falls back to today for unknown sections', () => {
    const ctx = {
      companionState: 'idle' as const,
      setCompanionState: () => {},
      aiName: 'Companion',
      isAdmin: false,
      onNavigate: () => {},
      onBack: () => {},
      setActiveSection: () => {},
    };
    const result = renderSection('nonexistent' as any, ctx);
    expect(result).toBeDefined();
  });
});
