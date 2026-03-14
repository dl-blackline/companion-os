import { useState } from 'react';
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
import { AgentsView } from '@/components/views/AgentsView';
import { AdminConsoleView } from '@/components/views/AdminConsoleView';
import { TarotView } from '@/components/views/TarotView';
import { FloatingLiveOrb } from '@/components/FloatingLiveOrb';
import { useVoice } from '@/context/voice-context';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { List, X } from '@phosphor-icons/react';
import type { CompanionState } from '@/types';

function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [companionState, setCompanionState] = useState<CompanionState>('idle');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const { isActive: isGlobalVoiceActive, stopLiveTalk } = useVoice();
  const { isAdmin } = useAuth();
  const { settings } = useSettings();

  // Stop any active global voice session when entering Live Talk to prevent
  // duplicate voices from the FloatingLiveOrb and LiveTalkView running simultaneously.
  const navigateTo = (section: string) => {
    if (section === 'live-talk' && isGlobalVoiceActive) {
      stopLiveTalk();
    }
    setActiveSection(section as NavSection);
    setIsMobileMenuOpen(false);
  };

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
    <div className="flex min-h-[100dvh] w-screen overflow-hidden bg-background text-foreground">
      {/* Mobile header with hamburger */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-card border-b border-border safe-area-top">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X size={22} /> : <List size={22} />}
          </button>
          <span
            className="text-sm font-semibold tracking-widest uppercase text-muted-foreground"
            style={{ fontFamily: 'var(--font-space)' }}
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
            transition={{ duration: 0.2, ease: 'easeInOut' }}
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