import { describe, it, expect } from 'vitest';
import { sectionFromPathname, pathnameFromSection } from '@/app-shell/router';
import { evaluateGate, preNavigationEffects } from '@/app-shell/feature-gates';
import { getRuntimeDisplay, getStateDotClass } from '@/app-shell/runtime-helpers';
import { isVisibleNavSection, isAdminSection } from '@/app-shell/navigation';
import { SECTION_COMPONENTS, renderSection } from '@/app-shell/section-registry';

/* ── Router ───────────────────────────────────────────────────────────────── */

describe('app-shell/router', () => {
  describe('sectionFromPathname', () => {
    it('returns home for /', () => {
      expect(sectionFromPathname('/')).toBe('home');
    });
    it('returns control-center for /control-center', () => {
      expect(sectionFromPathname('/control-center')).toBe('control-center');
    });
    it('returns careers for /careers', () => {
      expect(sectionFromPathname('/careers')).toBe('careers');
    });
    it('returns stripe-return for /finance/stripe/return', () => {
      expect(sectionFromPathname('/finance/stripe/return')).toBe('stripe-return');
    });
    it('returns finance for /finance', () => {
      expect(sectionFromPathname('/finance')).toBe('finance');
    });
    it('returns automotive-finance for /automotive-finance', () => {
      expect(sectionFromPathname('/automotive-finance')).toBe('automotive-finance');
    });
    it('returns home for unknown paths', () => {
      expect(sectionFromPathname('/unknown')).toBe('home');
    });
  });

  describe('pathnameFromSection', () => {
    it('returns / for home', () => {
      expect(pathnameFromSection('home')).toBe('/');
    });
    it('returns unique paths for all routed sections', () => {
      expect(pathnameFromSection('chat')).toBe('/chat');
      expect(pathnameFromSection('media')).toBe('/media');
      expect(pathnameFromSection('memory')).toBe('/memory');
      expect(pathnameFromSection('live-talk')).toBe('/live-talk');
      expect(pathnameFromSection('knowledge')).toBe('/knowledge');
      expect(pathnameFromSection('goals')).toBe('/goals');
      expect(pathnameFromSection('settings')).toBe('/settings');
      expect(pathnameFromSection('agents')).toBe('/agents');
    });
    it('returns /control-center for control-center', () => {
      expect(pathnameFromSection('control-center')).toBe('/control-center');
    });
    it('returns /finance/stripe/return for stripe-return', () => {
      expect(pathnameFromSection('stripe-return')).toBe('/finance/stripe/return');
    });
  });

  describe('sectionFromPathname — new routes', () => {
    it('returns chat for /chat', () => {
      expect(sectionFromPathname('/chat')).toBe('chat');
    });
    it('returns media for /media', () => {
      expect(sectionFromPathname('/media')).toBe('media');
    });
    it('returns settings for /settings', () => {
      expect(sectionFromPathname('/settings')).toBe('settings');
    });
    it('returns agents for /agents', () => {
      expect(sectionFromPathname('/agents')).toBe('agents');
    });
    it('returns live-talk for /live-talk', () => {
      expect(sectionFromPathname('/live-talk')).toBe('live-talk');
    });
    it('returns tarot for /tarot', () => {
      expect(sectionFromPathname('/tarot')).toBe('tarot');
    });
    it('returns admin-console for /admin-console', () => {
      expect(sectionFromPathname('/admin-console')).toBe('admin-console');
    });
  });
});

/* ── Feature gates ────────────────────────────────────────────────────────── */

describe('app-shell/feature-gates', () => {
  const baseCtx = {
    plan: 'pro' as const,
    isAdmin: false,
    voiceCapabilityEnabled: true,
    isGlobalVoiceActive: false,
    stopLiveTalk: () => {},
  };

  it('allows navigation to regular sections', () => {
    const result = evaluateGate('chat', baseCtx);
    expect(result.allowed).toBe(true);
  });

  it('blocks agents for free plan and redirects to settings', () => {
    const result = evaluateGate('agents', { ...baseCtx, plan: 'free' });
    expect(result.allowed).toBe(false);
    expect(result.redirect).toBe('settings');
  });

  it('allows agents for paid plan', () => {
    const result = evaluateGate('agents', { ...baseCtx, plan: 'pro' });
    expect(result.allowed).toBe(true);
  });

  it('blocks live-talk when voice capability is disabled', () => {
    const result = evaluateGate('live-talk', { ...baseCtx, voiceCapabilityEnabled: false });
    expect(result.allowed).toBe(false);
    expect(result.redirect).toBeUndefined();
  });

  it('allows live-talk when voice capability is enabled', () => {
    const result = evaluateGate('live-talk', baseCtx);
    expect(result.allowed).toBe(true);
  });

  it('preNavigationEffects stops live talk when entering live-talk with active voice', () => {
    let stopped = false;
    const ctx = { ...baseCtx, isGlobalVoiceActive: true, stopLiveTalk: () => { stopped = true; } };
    preNavigationEffects('live-talk', ctx);
    expect(stopped).toBe(true);
  });

  it('preNavigationEffects does nothing for non-live-talk sections', () => {
    let stopped = false;
    const ctx = { ...baseCtx, isGlobalVoiceActive: true, stopLiveTalk: () => { stopped = true; } };
    preNavigationEffects('chat', ctx);
    expect(stopped).toBe(false);
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
  it('stripe-return, admin-console, tarot are hidden nav sections', () => {
    expect(isVisibleNavSection('stripe-return')).toBe(false);
    expect(isVisibleNavSection('admin-console')).toBe(false);
    expect(isVisibleNavSection('tarot')).toBe(false);
  });

  it('home, chat, media are visible nav sections', () => {
    expect(isVisibleNavSection('home')).toBe(true);
    expect(isVisibleNavSection('chat')).toBe(true);
    expect(isVisibleNavSection('media')).toBe(true);
  });

  it('admin-console is an admin section', () => {
    expect(isAdminSection('admin-console')).toBe(true);
    expect(isAdminSection('home')).toBe(false);
  });
});

/* ── Section registry ─────────────────────────────────────────────────────── */

describe('app-shell/section-registry', () => {
  it('has an entry for every expected section', () => {
    const expectedSections = [
      'home', 'live-talk', 'chat', 'media', 'memory', 'knowledge',
      'goals', 'calendar', 'workflows', 'insights', 'careers', 'finance',
      'stripe-return', 'automotive-finance', 'agents', 'control-center',
      'settings', 'tarot', 'admin-console',
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
      aiName: 'Vuk',
      isAdmin: false,
      onNavigate: () => {},
      onBack: () => {},
      setActiveSection: () => {},
    };
    // Should not throw for any known section
    const result = renderSection('chat', ctx);
    expect(result).toBeDefined();
  });

  it('renderSection falls back to home for unknown sections', () => {
    const ctx = {
      companionState: 'idle' as const,
      setCompanionState: () => {},
      aiName: 'Vuk',
      isAdmin: false,
      onNavigate: () => {},
      onBack: () => {},
      setActiveSection: () => {},
    };
    const result = renderSection('nonexistent' as any, ctx);
    expect(result).toBeDefined();
  });
});
