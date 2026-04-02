import { motion, useReducedMotion } from 'framer-motion';
import { CompanionStatusIcon } from '@/components/CompanionStatusIcon';
import type { CompanionState } from '@/types';
import { useLifeOS } from '@/hooks/use-life-os';
import { ArrowRight } from '@phosphor-icons/react/ArrowRight';
import { Brain } from '@phosphor-icons/react/Brain';
import { ChatCircle } from '@phosphor-icons/react/ChatCircle';
import { Briefcase } from '@phosphor-icons/react/Briefcase';
import { Images } from '@phosphor-icons/react/Images';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { ListChecks } from '@phosphor-icons/react/ListChecks';
import { Money } from '@phosphor-icons/react/Money';
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
    id: 'careers',
    label: 'Career OS',
    description: 'Resume review and job hunt AI mode',
    icon: Briefcase,
  },
  {
    id: 'finance',
    label: 'Finance Pulse',
    description: 'Live cashflow and resilience tracking',
    icon: Money,
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
  const reduceMotion = useReducedMotion();
  const { dashboard: lifeOs } = useLifeOS();

  const activeGoals = lifeOs?.goals?.filter((g) => g.status === 'active') ?? [];
  const financialGoals = activeGoals.filter((g) => g.is_financial);
  const urgentSignals = lifeOs?.signals?.filter((s) => s.severity === 'high' || s.severity === 'critical') ?? [];
  const atRiskGoals = activeGoals.filter((g) => (g.feasibility_score ?? 100) < 50);

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
              transition={{ duration: reduceMotion ? 0.1 : 0.28, delay: reduceMotion ? 0 : i * 0.05 }}
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

      {/* Life OS Summary */}
      {(activeGoals.length > 0 || urgentSignals.length > 0) && (
        <motion.section
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.3 }}
          className="glass-card rounded-2xl p-5 md:p-6 mb-4"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="executive-eyebrow">Life OS</p>
            <button
              type="button"
              onClick={() => onNavigate('goals')}
              className="text-[11px] uppercase tracking-[0.14em] text-primary hover:text-primary/80"
            >
              View All Goals →
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
              <p className="text-2xl font-semibold">{activeGoals.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Active Goals</p>
            </div>
            <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
              <p className="text-2xl font-semibold">{financialGoals.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Financial Goals</p>
            </div>
            <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
              <p className={`text-2xl font-semibold ${urgentSignals.length > 0 ? 'text-amber-400' : ''}`}>
                {urgentSignals.length}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Urgent Signals</p>
            </div>
            <div className="rounded-xl bg-black/20 border border-border/40 p-3 text-center">
              <p className={`text-2xl font-semibold ${atRiskGoals.length > 0 ? 'text-red-400' : ''}`}>
                {atRiskGoals.length}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">At Risk</p>
            </div>
          </div>

          {urgentSignals.length > 0 && (
            <div className="space-y-2">
              {urgentSignals.slice(0, 3).map((sig) => (
                <div
                  key={sig.id}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    sig.severity === 'critical'
                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  }`}
                >
                  <span className="font-medium">{sig.title}</span>
                  {sig.action_hint && (
                    <span className="text-muted-foreground ml-2">— {sig.action_hint}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4">
        <motion.section
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.34 }}
          className="glass-card rounded-2xl p-5 md:p-6"
        >
          <p className="executive-eyebrow">Core Companion</p>
          <div className="flex flex-col items-center text-center">
            <CompanionStatusIcon state={companionState} size="lg" onClick={() => onNavigate('live-talk')} />
            <p className="mt-4 text-2xl font-semibold tracking-tight">{STATE_LABELS[companionState]}</p>
            <p className="text-sm text-muted-foreground mt-1">{STATE_SUBLABELS[companionState]}</p>
            <button
              type="button"
              onClick={() => onNavigate('live-talk')}
              className="mt-5 rounded-full border border-border/70 bg-black/25 px-4 py-1.5 text-[11px] tracking-[0.16em] uppercase text-muted-foreground hover:text-foreground hover:border-border"
            >
              Open Live Session
            </button>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.34, delay: reduceMotion ? 0 : 0.06 }}
          className="glass-card rounded-2xl p-5 md:p-6"
        >
          <p className="executive-eyebrow">Quick Actions</p>
          <div className="space-y-2.5">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: reduceMotion ? 0 : -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: reduceMotion ? 0.1 : 0.24, delay: reduceMotion ? 0 : 0.12 + i * 0.05 }}
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
