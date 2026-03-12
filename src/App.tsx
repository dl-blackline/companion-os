import { useState } from 'react';
import { useKV } from '@github/spark/hooks';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar, type NavSection } from '@/components/AppSidebar';
import { HomeDashboard } from '@/components/views/HomeDashboard';
import { ChatView } from '@/components/views/ChatView';
import { MemoryView } from '@/components/views/MemoryView';
import { KnowledgeView } from '@/components/views/KnowledgeView';
import { GoalsView } from '@/components/views/GoalsView';
import { InsightsView } from '@/components/views/InsightsView';
import { WorkflowsView } from '@/components/views/WorkflowsView';
import { SettingsView } from '@/components/views/SettingsView';
import type { CompanionSettings, DashboardData } from '@/types';

const defaultSettings: CompanionSettings = {
  aiName: 'Companion OS',
  defaultMode: 'neutral',
  memorySettings: {
    autoCapture: true,
    requireApproval: false,
    summarization: true,
  },
  modelSettings: {
    defaultModel: 'gpt-4o',
    fallbackModel: 'gpt-4o-mini',
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

const defaultDashboardData: DashboardData = {
  priorities: [],
  activeGoals: [],
  recentConversations: [],
  memoryHighlights: [],
  insights: [],
  currentProjects: [],
};

function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [settings, setSettings] = useKV<CompanionSettings>('companion-settings', defaultSettings);
  const [dashboardData] = useKV<DashboardData>('dashboard-data', defaultDashboardData);

  const handleNavigate = (section: string) => {
    setActiveSection(section as NavSection);
  };

  const currentSettings = settings || defaultSettings;

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return <HomeDashboard data={dashboardData || defaultDashboardData} onNavigate={handleNavigate} />;
      case 'chat':
        return <ChatView />;
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
        return <HomeDashboard data={dashboardData || defaultDashboardData} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <AppSidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection}
        aiName={currentSettings.aiName}
      />
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>
      <Toaster />
    </div>
  );
}

export default App;