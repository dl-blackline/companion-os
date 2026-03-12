import { useState } from 'react';
import { useKV } from '@github/spark/hooks';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar, type NavSection } from '@/components/AppSidebar';
import { HomeDashboard } from '@/components/views/HomeDashboard';
import type { CompanionSettings, DashboardData } from '@/types';
import { generateId } from '@/lib/helpers';

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
  const [settings] = useKV<CompanionSettings>('companion-settings', defaultSettings);
  const [dashboardData] = useKV<DashboardData>('dashboard-data', defaultDashboardData);

  const handleNavigate = (section: string) => {
    setActiveSection(section as NavSection);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return <HomeDashboard data={dashboardData || defaultDashboardData} onNavigate={handleNavigate} />;
      case 'chat':
        return <PlaceholderView title="Chat" description="Conversational AI Hub with streaming responses and multiple modes" />;
      case 'memory':
        return <PlaceholderView title="Memory" description="Layered memory system for persistent, context-aware intelligence" />;
      case 'knowledge':
        return <PlaceholderView title="Knowledge" description="Personal knowledge vault with searchable documents and notes" />;
      case 'goals':
        return <PlaceholderView title="Goals" description="Multi-timeframe goals dashboard with AI-assisted planning" />;
      case 'workflows':
        return <PlaceholderView title="Workflows" description="Modular tool framework and agent actions" />;
      case 'insights':
        return <PlaceholderView title="Insights" description="Proactive recommendations and pattern recognition" />;
      case 'settings':
        return <PlaceholderView title="Settings" description="Deep personalization and model controls" />;
      default:
        return <HomeDashboard data={dashboardData || defaultDashboardData} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <AppSidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection}
        aiName={settings?.aiName || 'Companion OS'}
      />
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>
      <Toaster />
    </div>
  );
}

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            This section is under construction and will be fully implemented soon.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;