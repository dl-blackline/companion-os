import { Suspense, lazy, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar, type NavSection } from '@/components/AppSidebar';
import { HomeDashboard } from '@/components/views/HomeDashboard';
import { useVoice } from '@/context/voice-context';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { useAIControl } from '@/context/ai-control-context';
import { useOrbAppearance } from '@/context/orb-appearance-context';
import { useRuntimeHealth } from '@/hooks/use-runtime-health';
import { List } from '@phosphor-icons/react/List';
import { X } from '@phosphor-icons/react/X';
import { toast } from 'sonner';
import type { CompanionState } from '@/types';

const ChatView = lazy(() => import('@/components/views/ChatView').then((module) => ({ default: module.ChatView })));
const LiveTalkView = lazy(() => import('@/components/views/LiveTalkView').then((module) => ({ default: module.LiveTalkView })));
const MediaView = lazy(() => import('@/components/views/MediaView').then((module) => ({ default: module.MediaView })));
const MemoryView = lazy(() => import('@/components/views/MemoryView').then((module) => ({ default: module.MemoryView })));
const KnowledgeView = lazy(() => import('@/components/views/KnowledgeView').then((module) => ({ default: module.KnowledgeView })));
const GoalsView = lazy(() => import('@/components/views/GoalsView').then((module) => ({ default: module.GoalsView })));
const InsightsView = lazy(() => import('@/components/views/InsightsView').then((module) => ({ default: module.InsightsView })));
const CareersView = lazy(() => import('@/components/views/CareersView').then((module) => ({ default: module.CareersView })));
const FinanceView = lazy(() => import('@/components/views/FinanceView').then((module) => ({ default: module.FinanceView })));
const AutomotiveFinanceView = lazy(() => import('@/components/views/AutomotiveFinanceView').then((module) => ({ default: module.AutomotiveFinanceView })));
const WorkflowsView = lazy(() => import('@/components/views/WorkflowsView').then((module) => ({ default: module.WorkflowsView })));
const SettingsView = lazy(() => import('@/components/views/SettingsView').then((module) => ({ default: module.SettingsView })));
const ControlCenterView = lazy(() => import('@/components/views/ControlCenterView').then((module) => ({ default: module.ControlCenterView })));
const AgentsView = lazy(() => import('@/components/views/AgentsView').then((module) => ({ default: module.AgentsView })));
const AdminConsoleView = lazy(() => import('@/components/views/AdminConsoleView').then((module) => ({ default: module.AdminConsoleView })));
const TarotView = lazy(() => import('@/components/views/TarotView').then((module) => ({ default: module.TarotView })));
const StripeReturnView = lazy(() => import('@/components/views/StripeReturnView').then((module) => ({ default: module.StripeReturnView })));
const FloatingLiveOrb = lazy(() => import('@/components/FloatingLiveOrb').then((module) => ({ default: module.FloatingLiveOrb })));

function SectionFallback() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="glass-card flex min-w-[240px] items-center gap-3 rounded-2xl px-5 py-4 text-sm text-muted-foreground">
        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
        Loading workspace…
      </div>
    </div>
  );
}

function sectionFromPathname(pathname: string): NavSection {
  if (pathname === '/control-center') return 'control-center';
  if (pathname === '/careers') return 'careers';
  if (pathname.startsWith('/finance/stripe/return')) return 'stripe-return';
  if (pathname === '/finance') return 'finance';
  if (pathname === '/automotive-finance') return 'automotive-finance';
  return 'home';
}

function pathnameFromSection(section: NavSection): string {
  if (section === 'control-center') return '/control-center';
  if (section === 'careers') return '/careers';
  if (section === 'finance') return '/finance';
  if (section === 'automotive-finance') return '/automotive-finance';
  if (section === 'stripe-return') return '/finance/stripe/return';
  return '/';
}

function mapVoiceStatusToCompanionState(status: ReturnType<typeof useVoice>['status']): CompanionState | null {
  switch (status) {
    case 'listening':
      return 'listening';
    case 'thinking':
      return 'thinking';
    case 'speaking':
      return 'speaking';
    default:
      return null;
  }
}

function App() {
  const [activeSection, setActiveSection] = useState<NavSection>(() =>
    sectionFromPathname(window.location.pathname)
  );
  const [companionState, setCompanionState] = useState<CompanionState>('idle');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const { isActive: isGlobalVoiceActive, stopLiveTalk, status: voiceStatus } = useVoice();
  const { isAdmin, plan } = useAuth();
  const { settings } = useSettings();
  const { orchestratorConfig } = useAIControl();
  const { orbColor, mode: orbMode } = useOrbAppearance();
  const runtimeHealth = useRuntimeHealth();
  const reduceMotion = useReducedMotion();

  const liveVoiceState = mapVoiceStatusToCompanionState(voiceStatus);
  const displayCompanionState = liveVoiceState ?? companionState;

  const stateLabel = displayCompanionState.replace('-', ' ');
  const stateDotClass = displayCompanionState === 'idle'
    ? 'bg-zinc-400'
    : displayCompanionState === 'listening'
      ? 'bg-sky-300'
      : displayCompanionState === 'speaking'
        ? 'bg-rose-300'
        : displayCompanionState === 'thinking'
          ? 'bg-amber-200'
          : 'bg-zinc-200';

  const disabledCapabilities = Object.entries(orchestratorConfig.capabilities)
    .filter(([, enabled]) => !enabled)
    .map(([name]) => name);
  const runtimeHealthy = runtimeHealth.state === 'healthy' && disabledCapabilities.length === 0;
  const runtimeLabel = runtimeHealth.state === 'checking'
    ? 'Runtime Check'
    : runtimeHealthy
      ? 'Runtime'
      : 'Runtime Partial';
  const runtimeDotClass = runtimeHealth.state === 'checking'
    ? 'bg-zinc-500'
    : runtimeHealthy
      ? 'bg-zinc-100'
      : 'bg-zinc-400';

  // Stop any active global voice session when entering Live Talk to prevent
  // duplicate voices from the FloatingLiveOrb and LiveTalkView running simultaneously.
  const navigateTo = (section: string) => {
    if (section === 'agents' && plan === 'free') {
      toast.info('Agents is a paid feature. Upgrade in Settings > Account.');
      setActiveSection('settings');
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
      setIsMobileMenuOpen(false);
      return;
    }

    if (section === 'live-talk' && !orchestratorConfig.capabilities.voice) {
      toast.error('Voice capability is disabled in Control Center');
      return;
    }

    if (section === 'live-talk' && isGlobalVoiceActive) {
      stopLiveTalk();
    }
    setActiveSection(section as NavSection);
    const targetPath = pathnameFromSection(section as NavSection);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const onPopState = () => {
      setActiveSection(sectionFromPathname(window.location.pathname));
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = (section: string) => {
    navigateTo(section);
  };

  const handleSectionChange = (section: NavSection) => {
    navigateTo(section);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return (
          <HomeDashboard
            companionState={displayCompanionState}
            aiName={settings.aiName}
            onNavigate={handleNavigate}
          />
        );
      case 'live-talk':
        return (
          <LiveTalkView
            companionState={companionState}
            setCompanionState={setCompanionState}
            aiName={settings.aiName}
            onBack={() => setActiveSection('home')}
          />
        );
      case 'chat':
        return <ChatView />;
      case 'media':
        return (
          <MediaView
            companionState={companionState}
            setCompanionState={setCompanionState}
            aiName={settings.aiName}
          />
        );
      case 'memory':
        return <MemoryView />;
      case 'knowledge':
        return <KnowledgeView />;
      case 'goals':
        return <GoalsView />;
      case 'workflows':
        return <WorkflowsView />;
      case 'insights':
        return <InsightsView />;
      case 'careers':
        return <CareersView />;
      case 'finance':
        return <FinanceView />;
      case 'stripe-return':
        return (
          <StripeReturnView
            onNavigateToFinance={() => {
              setActiveSection('finance');
            }}
          />
        );
      case 'automotive-finance':
        return <AutomotiveFinanceView />;
      case 'agents':
        return <AgentsView />;
      case 'control-center':
        return <ControlCenterView />;
      case 'settings':
        return <SettingsView />;
      case 'tarot':
        return <TarotView />;
      case 'admin-console':
        return isAdmin ? <AdminConsoleView /> : (
          <HomeDashboard
            companionState={displayCompanionState}
            aiName={settings.aiName}
            onNavigate={handleNavigate}
          />
        );
      default:
        return (
          <HomeDashboard
            companionState={displayCompanionState}
            aiName={settings.aiName}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <div className="visual-shell flex min-h-dvh w-screen overflow-hidden bg-background text-foreground">
      {/* Mobile header with hamburger */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-30 px-4 py-3 bg-[oklch(0.09_0.006_260/0.94)] border-b border-border/50 backdrop-blur-xl safe-area-top">
          <div className="flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-black/20 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X size={22} /> : <List size={22} />}
          </button>
          <span
            className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground"
          >
            {settings.aiName}
          </span>
          <div className="w-11 rounded-xl border border-border/60 bg-black/20 h-11" aria-hidden="true" />
          </div>

          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="status-chip whitespace-nowrap">
              <span className={`status-dot ${runtimeDotClass}`} />
              {runtimeLabel}
            </span>
            <span className="status-chip status-chip-muted whitespace-nowrap">
              <span className={`status-dot ${stateDotClass}`} />
              {stateLabel}
            </span>
            <span className="status-chip status-chip-muted whitespace-nowrap">
              Orb {orbColor} {orbMode === 'emoji' ? 'emoji' : 'default'}
            </span>
          </div>
        </div>
      )}

      {/* Mobile drawer overlay */}
      {isMobile && (
        <div
          className={`drawer-overlay ${isMobileMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — desktop: static, mobile: drawer */}
      {isMobile ? (
        <div className={`mobile-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <AppSidebar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            aiName={settings.aiName}
            companionState={displayCompanionState}
            runtimeState={runtimeHealth.state}
            unavailableServices={runtimeHealth.unavailableServices}
          />
        </div>
      ) : (
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          aiName={settings.aiName}
          companionState={displayCompanionState}
          runtimeState={runtimeHealth.state}
          unavailableServices={runtimeHealth.unavailableServices}
        />
      )}

      <main className={`flex-1 overflow-hidden ${isMobile ? 'pt-[52px]' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.22, ease: 'easeInOut' }}
            className="h-full"
          >
            <Suspense fallback={<SectionFallback />}>
              {renderContent()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global floating Live Talk orb — hidden on the Live Talk page since
          LiveTalkView manages its own voice session. Showing both simultaneously
          would create two independent RealtimeVoiceClient instances and cause
          duplicate audio. */}
      {activeSection !== 'live-talk' && (
        <Suspense fallback={null}>
          <FloatingLiveOrb />
        </Suspense>
      )}

      <Toaster />
    </div>
  );
}

export default App;