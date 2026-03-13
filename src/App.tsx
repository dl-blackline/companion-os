import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocalStorage } from '@/hooks/use-local-storage';
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
import { FloatingLiveOrb } from '@/components/FloatingLiveOrb';
import { List, X } from '@phosphor-icons/react';
import type { CompanionSettings, CompanionState } from '@/types';

const defaultSettings: CompanionSettings = {
  aiName: 'Companion OS',
  defaultMode: 'neutral',
  aiMood: 'neutral',
  memorySettings: {
    autoCapture: true,
    requireApproval: false,
    summarization: true,
  },
  modelSettings: {
    defaultModel: 'gpt-4.1',
    fallbackModel: 'gpt-4.1-mini',
    imageModel: 'openai-image',
    videoModel: 'sora',
    musicModel: 'suno',
    voiceModel: 'elevenlabs',
    temperature: 0.7,
    maxLength: 2000,
    citationPreference: 'when-available',
    toolUseAggressiveness: 0.5,
    memoryRetrievalIntensity: 0.7,
  },
  privacySettings: {
    dataStorage: true,
    exportEnabled: true,
    auditTrail: true,
  },
};

function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [companionState, setCompanionState] = useState<CompanionState>('idle');
  const [settings, setSettings] = useLocalStorage<CompanionSettings>('companion-settings', defaultSettings);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleNavigate = (section: string) => {
    setActiveSection(section as NavSection);
    setIsMobileMenuOpen(false);
  };

  const handleSectionChange = (section: NavSection) => {
    setActiveSection(section);
    setIsMobileMenuOpen(false);
  };

  const currentSettings = settings || defaultSettings;

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return (
          <HomeDashboard
            companionState={companionState}
            aiName={currentSettings.aiName}
            onNavigate={handleNavigate}
          />
        );
      case 'live-talk':
        return (
          <LiveTalkView
            companionState={companionState}
            setCompanionState={setCompanionState}
            aiName={currentSettings.aiName}
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
            aiName={currentSettings.aiName}
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
        return <SettingsView settings={currentSettings} onSettingsChange={setSettings} />;
      default:
        return (
          <HomeDashboard
            companionState={companionState}
            aiName={currentSettings.aiName}
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
            {currentSettings.aiName}
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
            aiName={currentSettings.aiName}
            companionState={companionState}
          />
        </div>
      ) : (
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          aiName={currentSettings.aiName}
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

      {/* Global floating Live Talk orb — visible on all pages */}
      <FloatingLiveOrb />

      <Toaster />
    </div>
  );
}

export default App;