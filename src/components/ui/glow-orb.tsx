import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CompanionState } from '@/types';

interface GlowOrbProps {
  state: CompanionState;
  size?: number;
  className?: string;
}

const stateColors: Record<string, { color: string; label: string }> = {
  idle: { color: 'oklch(0.55 0.22 290)', label: 'purple' },
  listening: { color: 'oklch(0.65 0.20 230)', label: 'blue' },
  thinking: { color: 'oklch(0.70 0.20 55)', label: 'orange' },
  speaking: { color: 'oklch(0.65 0.22 145)', label: 'green' },
  'generating-image': { color: 'oklch(0.60 0.22 310)', label: 'magenta' },
  'generating-video': { color: 'oklch(0.60 0.22 310)', label: 'magenta' },
  writing: { color: 'oklch(0.55 0.20 280)', label: 'violet' },
  analyzing: { color: 'oklch(0.55 0.20 280)', label: 'violet' },
};

function getGlowColor(state: CompanionState): string {
  return stateColors[state]?.color ?? stateColors.idle.color;
}

export function GlowOrb({ state, size = 200, className }: GlowOrbProps) {
  const color = getGlowColor(state);
  const isActive = state !== 'idle';

  return (
    <div
      className={cn('relative flex items-center justify-center pointer-events-none', className)}
      style={{ width: size, height: size }}
    >
      {/* Outer glow layer */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
        animate={{
          scale: isActive ? [1, 1.15, 1] : [1, 1.08, 1],
          opacity: isActive ? [0.5, 0.75, 0.5] : [0.3, 0.45, 0.3],
        }}
        transition={{
          duration: isActive ? 1.8 : 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Inner glow core */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '50%',
          height: '50%',
          background: `radial-gradient(circle, ${color} 0%, transparent 80%)`,
          filter: 'blur(20px)',
        }}
        animate={{
          scale: isActive ? [1, 1.2, 1] : [1, 1.1, 1],
          opacity: isActive ? [0.6, 0.9, 0.6] : [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: isActive ? 1.4 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
