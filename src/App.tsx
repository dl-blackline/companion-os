import { useState } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
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
import type { CompanionSettings, CompanionState } from '@/types';

const defaultSettings: CompanionSettings = {
  aiName: 'Companion OS',
  defaultMode: 'neutral',
  memorySettings: {
    autoCapture: true,
    requireApproval: false,
    summarization: true,
  },
  modelSettings: {
    defaultModel: 'openai',
    fallbackModel: 'gemini',
    imageModel: 'flux',
    videoModel: 'runway',
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

  const handleNavigate = (section: string) => {
    setActiveSection(section as NavSection);
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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <AppSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        aiName={currentSettings.aiName}
        companionState={companionState}
      />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
      <Toaster />
    </div>
  );
}

export default App;