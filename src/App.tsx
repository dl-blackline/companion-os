import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar, type NavSection } from '@/components/AppSidebar';
import { HomeDashboard } from '@/components/views/HomeDashboard';
import { ChatView } from '@/components/views/ChatView';
import { LiveTalkView } from '@/components/views/LiveTalkView';
import { MediaView } from '@/components/views/MediaView';
import { MemoryView } from '@/components/views/MemoryView';
import { KnowledgeView } from '@/components/views/KnowledgeView';
import { GoalsView } from '@/components/views/GoalsView';
import { InsightsView } from '@/components/views/InsightsView';
import { WorkflowsView } from '@/components/views/WorkflowsView';
import { SettingsView } from '@/components/views/SettingsView';
import { ControlCenterView } from '@/components/views/ControlCenterView';
import { AgentsView } from '@/components/views/AgentsView';
import { AdminConsoleView } from '@/components/views/AdminConsoleView';
import { TarotView } from '@/components/views/TarotView';
import { FloatingLiveOrb } from '@/components/FloatingLiveOrb';
import { useVoice } from '@/context/voice-context';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { useAIControl } from '@/context/ai-control-context';
import { List, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { CompanionState } from '@/types';

function sectionFromPathname(pathname: string): NavSection {
  if (pathname === '/control-center') return 'control-center';
  return 'home';
}

function pathnameFromSection(section: NavSection): string {
  if (section === 'control-center') return '/control-center';
  return '/';
}

function App() {
  const [activeSection, setActiveSection] = useState<NavSection>(() =>
    sectionFromPathname(window.location.pathname)
  );
  const [companionState, setCompanionState] = useState<CompanionState>('idle');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const { isActive: isGlobalVoiceActive, stopLiveTalk } = useVoice();
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const { orchestratorConfig } = useAIControl();

  // Stop any active global voice session when entering Live Talk to prevent
  // duplicate voices from the FloatingLiveOrb and LiveTalkView running simultaneously.
  const navigateTo = (section: string) => {
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
            companionState={companionState}
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
            companionState={companionState}
            aiName={settings.aiName}
            onNavigate={handleNavigate}
          />
        );
      default:
        return (
          <HomeDashboard
            companionState={companionState}
            aiName={settings.aiName}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <div className="flex min-h-dvh w-screen overflow-hidden bg-background text-foreground">
      {/* Mobile header with hamburger */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-[oklch(0.17_0.012_255/0.96)] border-b border-border/80 backdrop-blur-md safe-area-top">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X size={22} /> : <List size={22} />}
          </button>
          <span
            className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground"
          >
            {settings.aiName}
          </span>
          <div className="w-11" />
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
            companionState={companionState}
          />
        </div>
      ) : (
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          aiName={settings.aiName}
          companionState={companionState}
        />
      )}

      <main className={`flex-1 overflow-hidden ${isMobile ? 'pt-[52px]' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global floating Live Talk orb — hidden on the Live Talk page since
          LiveTalkView manages its own voice session. Showing both simultaneously
          would create two independent RealtimeVoiceClient instances and cause
          duplicate audio. */}
      {activeSection !== 'live-talk' && <FloatingLiveOrb />}

      <Toaster />
    </div>
  );
}

export default App;