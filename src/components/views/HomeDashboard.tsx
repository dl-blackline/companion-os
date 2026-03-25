import { motion } from 'framer-motion';
import { CompanionOrb } from '@/components/CompanionOrb';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CompanionState } from '@/types';
import { ArrowRight } from '@phosphor-icons/react/ArrowRight';
import { Brain } from '@phosphor-icons/react/Brain';
import { ChatCircle } from '@phosphor-icons/react/ChatCircle';
import { Images } from '@phosphor-icons/react/Images';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { ListChecks } from '@phosphor-icons/react/ListChecks';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';

interface HomeDashboardProps {
  companionState: CompanionState;
  aiName: string;
  onNavigate: (section: string) => void;
}

const STATE_LABELS: Record<CompanionState, string> = {
  idle: 'Ready for execution',
  listening: 'Listening',
  thinking: 'Reasoning',
  speaking: 'Responding',
  'generating-image': 'Generating image',
  'generating-video': 'Generating video',
  writing: 'Drafting output',
  analyzing: 'Analyzing context',
};

const STATE_SUBLABELS: Record<CompanionState, string> = {
  idle: 'All systems available',
  listening: 'Input channel active',
  thinking: 'Processing active thread',
  speaking: 'Voice response in progress',
  'generating-image': 'Visual pipeline engaged',
  'generating-video': 'Video pipeline engaged',
  writing: 'Composing structured output',
  analyzing: 'Reading and indexing inputs',
};

const quickActions = [
  {
    id: 'chat',
    label: 'Strategic Chat',
    description: 'High-context text collaboration',
    icon: ChatCircle,
  },
  {
    id: 'live-talk',
    label: 'Live Voice',
    description: 'Real-time conversational mode',
    icon: Microphone,
  },
  {
    id: 'media',
    label: 'Media Studio',
    description: 'Generate visual and video assets',
    icon: Images,
  },
  {
    id: 'workflows',
    label: 'Workflow Ops',
    description: 'Run repeatable operational logic',
    icon: Lightning,
  },
];

const statCards = [
  {
    label: 'Companion Status',
    value: 'Operational',
    detail: 'Realtime, memory, and reasoning online',
    icon: ShieldCheck,
  },
  {
    label: 'Context Depth',
    value: 'High',
    detail: 'Memory and knowledge channels active',
    icon: Brain,
  },
  {
    label: 'Execution Focus',
    value: '4 queues',
    detail: 'Chat, media, goals, and workflows available',
    icon: ListChecks,
  },
];

export function HomeDashboard({ companionState, aiName, onNavigate }: HomeDashboardProps) {
  const isSmallScreen = useIsMobile();

  return (
    <div className="executive-shell container-scroll">
      <div className="executive-header">
        <div>
          <p className="executive-eyebrow">Executive Command Center</p>
          <h1 className="leading-tight">{aiName}</h1>
          <p className="executive-subtitle">
            Private operating environment for high-agency planning, decision support, and execution.
          </p>
        </div>
      </div>

      <div className="executive-grid md:grid-cols-3 mb-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.05 }}
              className="executive-kpi"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
                <Icon size={18} className="text-primary" />
              </div>
              <p className="text-2xl font-semibold tracking-tight leading-none">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.detail}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34 }}
          className="glass-card rounded-2xl p-5 md:p-6"
        >
          <p className="executive-eyebrow">Core Companion</p>
          <div className="flex flex-col items-center text-center">
            <CompanionOrb
              state={companionState}
              size={isSmallScreen ? 'lg' : 'xl'}
              onClick={() => onNavigate('live-talk')}
              showRipples
            />
            <p className="mt-5 text-2xl font-semibold tracking-tight">{STATE_LABELS[companionState]}</p>
            <p className="text-sm text-muted-foreground mt-1">{STATE_SUBLABELS[companionState]}</p>
            <div className="mt-5 rounded-full border border-border/70 bg-black/25 px-4 py-1.5 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
              Tap Orb For Live Session
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.06 }}
          className="glass-card rounded-2xl p-5 md:p-6"
        >
          <p className="executive-eyebrow">Quick Actions</p>
          <div className="space-y-2.5">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.24, delay: 0.12 + i * 0.05 }}
                  onClick={() => onNavigate(action.id)}
                  className="executive-action p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-lg bg-primary/15 border border-primary/45 inline-flex items-center justify-center">
                        <Icon size={18} className="text-primary" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold tracking-tight">{action.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
