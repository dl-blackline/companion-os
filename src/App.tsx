import { Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar, type NavSection } from '@/components/AppSidebar';
import { useVoice } from '@/context/voice-context';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { useAIControl } from '@/context/ai-control-context';
import { useOrbAppearance } from '@/context/orb-appearance-context';
import { useRuntimeHealth } from '@/hooks/use-runtime-health';
import type { CompanionState } from '@/types';

import { sectionFromPathname, pathnameFromSection } from '@/app-shell/router';
import { renderSection, FloatingLiveOrb, CommandPalette } from '@/app-shell/section-registry';
import { AnimatedSection } from '@/app-shell/animated-section';
import { MobileHeader, MobileDrawerOverlay, MobileSidebarWrapper } from '@/app-shell/mobile-shell';
import { StatusChips } from '@/app-shell/runtime-banner';
import { TelemetryRail } from '@/app-shell/telemetry-rail';
import { getRuntimeDisplay } from '@/app-shell/runtime-helpers';
import { evaluateGate, preNavigationEffects } from '@/app-shell/feature-gates';

function mapVoiceStatusToCompanionState(status: ReturnType<typeof useVoice>['status']): CompanionState | null {
  switch (status) {
    case 'listening': return 'listening';
    case 'thinking': return 'thinking';
    case 'speaking': return 'speaking';
    default: return null;
  }
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = sectionFromPathname(location.pathname);
  const [companionState, setCompanionState] = useState<CompanionState>('idle');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const isMobile = useIsMobile();
  const { isActive: isGlobalVoiceActive, stopLiveTalk, status: voiceStatus } = useVoice();
  const { isAdmin, plan } = useAuth();
  const { settings } = useSettings();
  const { orchestratorConfig } = useAIControl();
  const { orbColor, mode: orbMode } = useOrbAppearance();
  const runtimeHealth = useRuntimeHealth();

  const liveVoiceState = mapVoiceStatusToCompanionState(voiceStatus);
  const displayCompanionState = liveVoiceState ?? companionState;

  const disabledCapabilities = Object.entries(orchestratorConfig.capabilities)
    .filter(([, enabled]) => !enabled)
    .map(([name]) => name);
  const runtimeDisplay = getRuntimeDisplay(runtimeHealth.state, disabledCapabilities);

  /* ── Navigation with gating ─────────────────────────────────────────────── */

  const gateCtx = {
    plan: plan ?? 'free',
    isAdmin: !!isAdmin,
    voiceCapabilityEnabled: !!orchestratorConfig.capabilities.voice,
    isGlobalVoiceActive,
    stopLiveTalk,
  };

  const navigateTo = (section: string) => {
    const target = section as NavSection;
    const gate = evaluateGate(target, gateCtx);

    if (!gate.allowed) {
      if (gate.redirect) {
        navigate(pathnameFromSection(gate.redirect));
      }
      setIsMobileMenuOpen(false);
      return;
    }

    preNavigationEffects(target, gateCtx);
    navigate(pathnameFromSection(target));
    setIsMobileMenuOpen(false);
  };

  /* ── Command palette shortcut ───────────────────────────────────────────── */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ── Section render context ─────────────────────────────────────────────── */

  const sectionCtx = {
    companionState: displayCompanionState,
    setCompanionState,
    aiName: settings.aiName,
    isAdmin: !!isAdmin,
    onNavigate: navigateTo,
    onBack: () => navigate('/'),
    setActiveSection: (section: NavSection) => navigate(pathnameFromSection(section)),
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="visual-shell flex min-h-dvh w-screen overflow-hidden bg-background text-foreground">
      {/* Mobile chrome */}
      {isMobile && (
        <MobileHeader
          aiName={settings.aiName}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          statusChips={
            <StatusChips
              runtimeDisplay={runtimeDisplay}
              companionState={displayCompanionState}
              orbColor={orbColor}
              orbMode={orbMode}
            />
          }
        />
      )}

      {isMobile && (
        <MobileDrawerOverlay
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — desktop: static, mobile: drawer */}
      {isMobile ? (
        <MobileSidebarWrapper isOpen={isMobileMenuOpen}>
          <AppSidebar
            activeSection={activeSection}
            onSectionChange={navigateTo}
            aiName={settings.aiName}
            companionState={displayCompanionState}
            runtimeState={runtimeHealth.state}
            unavailableServices={runtimeHealth.unavailableServices}
          />
        </MobileSidebarWrapper>
      ) : (
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={navigateTo}
          aiName={settings.aiName}
          companionState={displayCompanionState}
          runtimeState={runtimeHealth.state}
          unavailableServices={runtimeHealth.unavailableServices}
        />
      )}

      <main className={`flex-1 flex flex-col overflow-hidden ${isMobile ? 'pt-[52px]' : ''}`}>
        {/* Desktop telemetry rail — persistent status bar */}
        {!isMobile && (
          <TelemetryRail
            runtimeDisplay={runtimeDisplay}
            companionState={displayCompanionState}
            activeSection={activeSection}
            modelLabel={orchestratorConfig.model || undefined}
          />
        )}
        <div className="flex-1 overflow-hidden">
          <AnimatedSection sectionKey={activeSection}>
            {renderSection(activeSection, sectionCtx)}
          </AnimatedSection>
        </div>
      </main>

      {/* Global floating Live Talk orb — hidden on Live Talk page */}
      {activeSection !== 'live-talk' && (
        <Suspense fallback={null}>
          <FloatingLiveOrb />
        </Suspense>
      )}

      {/* Command Palette */}
      <Suspense fallback={null}>
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          activeSection={activeSection}
          onNavigate={navigateTo}
        />
      </Suspense>

      <Toaster />
    </div>
  );
}

export default App;