import { motion } from 'framer-motion';
import { CompanionOrb } from '@/components/CompanionOrb';
import type { CompanionState } from '@/types';
import {
  Microphone,
  ChatCircle,
  Images,
  Lightning,
  ArrowRight,
} from '@phosphor-icons/react';

interface HomeDashboardProps {
  companionState: CompanionState;
  aiName: string;
  onNavigate: (section: string) => void;
}

const STATE_LABELS: Record<CompanionState, string> = {
  idle: 'Ready',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  'generating-image': 'Generating image…',
  'generating-video': 'Generating video…',
  writing: 'Writing…',
  analyzing: 'Analyzing…',
};

const STATE_SUBLABELS: Record<CompanionState, string> = {
  idle: 'Your AI companion is here',
  listening: 'I can hear you',
  thinking: 'Working on your request',
  speaking: 'Playing response',
  'generating-image': 'Creating your vision',
  'generating-video': 'Rendering your scene',
  writing: 'Composing for you',
  analyzing: 'Processing your content',
};

const quickActions = [
  {
    id: 'live-talk',
    label: 'Live Talk',
    icon: Microphone,
    description: 'Real-time voice conversation',
    accent: 'oklch(0.65 0.20 230)',
    borderAccent: 'border-[oklch(0.65_0.20_230/0.35)]',
    bgAccent: 'oklch(0.65 0.20 230 / 0.08)',
    iconColor: 'text-[oklch(0.70_0.20_230)]',
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: ChatCircle,
    description: 'Text conversation',
    accent: 'oklch(0.55 0.22 290)',
    borderAccent: 'border-[oklch(0.55_0.22_290/0.35)]',
    bgAccent: 'oklch(0.55 0.22 290 / 0.08)',
    iconColor: 'text-[oklch(0.60_0.22_290)]',
  },
  {
    id: 'media',
    label: 'Create',
    icon: Images,
    description: 'Generate photos & videos',
    accent: 'oklch(0.72 0.26 310)',
    borderAccent: 'border-[oklch(0.72_0.26_310/0.35)]',
    bgAccent: 'oklch(0.72 0.26 310 / 0.08)',
    iconColor: 'text-[oklch(0.72_0.26_310)]',
  },
  {
    id: 'workflows',
    label: 'Automate',
    icon: Lightning,
    description: 'Intelligent workflows',
    accent: 'oklch(0.75 0.14 65)',
    borderAccent: 'border-[oklch(0.75_0.14_65/0.35)]',
    bgAccent: 'oklch(0.75 0.14 65 / 0.08)',
    iconColor: 'text-[oklch(0.75_0.14_65)]',
  },
];

export function HomeDashboard({ companionState, aiName, onNavigate }: HomeDashboardProps) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full overflow-hidden bg-background">
      {/* Ambient background gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 45%, oklch(0.28 0.08 285 / 0.40) 0%, transparent 72%)',
        }}
      />
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.80 0.05 280) 1px, transparent 1px), linear-gradient(90deg, oklch(0.80 0.05 280) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-0">
        {/* App name */}
        <motion.p
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-xs font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-10"
          style={{ fontFamily: 'var(--font-space)' }}
        >
          {aiName}
        </motion.p>

        {/* Orb */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8"
        >
          <CompanionOrb
            state={companionState}
            size="xl"
            onClick={() => onNavigate('live-talk')}
            showRipples={true}
          />
        </motion.div>

        {/* State label */}
        <motion.div
          className="flex flex-col items-center gap-1 mb-12"
          key={companionState}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <span
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-space)' }}
          >
            {STATE_LABELS[companionState]}
          </span>
          <span className="text-sm text-muted-foreground">
            {STATE_SUBLABELS[companionState]}
          </span>
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-xl px-4"
        >
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.30 + i * 0.07 }}
                onClick={() => onNavigate(action.id)}
                className={`group relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-300
                  ${action.borderAccent} bg-card/60 hover:bg-card/90 backdrop-blur-sm
                  hover:shadow-[0_0_24px_oklch(0.50_0.18_285/0.25)] active:scale-[0.97]`}
              >
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl"
                  style={{ background: action.bgAccent }}
                >
                  <Icon size={20} weight="fill" className={action.iconColor} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className="text-sm font-semibold leading-none"
                    style={{ fontFamily: 'var(--font-space)' }}
                  >
                    {action.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground text-center leading-tight">
                    {action.description}
                  </span>
                </div>
                <ArrowRight
                  size={12}
                  className="absolute top-3 right-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity"
                />
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

