import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CompanionState } from '@/types';

interface BackgroundGlowProps {
  state?: CompanionState;
  className?: string;
}

const stateAccent: Record<string, { primary: string; secondary: string; tertiary: string }> = {
  idle:               { primary: 'oklch(0.45 0.18 290)', secondary: 'oklch(0.42 0.15 310)', tertiary: 'oklch(0.48 0.14 260)' },
  listening:          { primary: 'oklch(0.55 0.22 230)', secondary: 'oklch(0.50 0.18 210)', tertiary: 'oklch(0.52 0.16 250)' },
  thinking:           { primary: 'oklch(0.55 0.22 55)',  secondary: 'oklch(0.50 0.18 40)',  tertiary: 'oklch(0.52 0.16 70)' },
  speaking:           { primary: 'oklch(0.55 0.22 145)', secondary: 'oklch(0.50 0.18 130)', tertiary: 'oklch(0.52 0.16 160)' },
  'generating-image': { primary: 'oklch(0.50 0.22 310)', secondary: 'oklch(0.48 0.18 290)', tertiary: 'oklch(0.52 0.16 330)' },
  'generating-video': { primary: 'oklch(0.50 0.22 310)', secondary: 'oklch(0.48 0.18 290)', tertiary: 'oklch(0.52 0.16 330)' },
  writing:            { primary: 'oklch(0.45 0.20 280)', secondary: 'oklch(0.42 0.16 265)', tertiary: 'oklch(0.48 0.14 295)' },
  analyzing:          { primary: 'oklch(0.45 0.20 280)', secondary: 'oklch(0.42 0.16 265)', tertiary: 'oklch(0.48 0.14 295)' },
};

export function BackgroundGlow({ state = 'idle', className }: BackgroundGlowProps) {
  const colors = stateAccent[state] ?? stateAccent.idle;
  const isActive = state !== 'idle';

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className
      )}
      style={{ mixBlendMode: 'screen' }}
    >
      {/* Primary floating orb — state-reactive color & intensity */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '45%',
          height: '45%',
          top: '10%',
          left: '20%',
          filter: 'blur(80px)',
        }}
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 15, 0],
          opacity: isActive ? [0.22, 0.32, 0.22] : [0.18, 0.24, 0.18],
          background: `radial-gradient(circle, ${colors.primary} 0%, transparent 70%)`,
        }}
        transition={{
          duration: isActive ? 8 : 12,
          repeat: Infinity,
          ease: 'easeInOut',
          background: { duration: 1.2, ease: 'easeOut' },
        }}
      />

      {/* Secondary floating orb — independent color channel */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '35%',
          height: '35%',
          bottom: '15%',
          right: '15%',
          filter: 'blur(70px)',
        }}
        animate={{
          x: [0, -25, 15, 0],
          y: [0, 20, -10, 0],
          opacity: isActive ? [0.16, 0.26, 0.16] : [0.12, 0.18, 0.12],
          background: `radial-gradient(circle, ${colors.secondary} 0%, transparent 70%)`,
        }}
        transition={{
          duration: isActive ? 10 : 15,
          repeat: Infinity,
          ease: 'easeInOut',
          background: { duration: 1.2, ease: 'easeOut' },
        }}
      />

      {/* Tertiary subtle accent — adds depth */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '25%',
          height: '25%',
          top: '50%',
          left: '60%',
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, 20, -15, 0],
          y: [0, -15, 20, 0],
          opacity: isActive ? [0.14, 0.22, 0.14] : [0.10, 0.15, 0.10],
          background: `radial-gradient(circle, ${colors.tertiary} 0%, transparent 70%)`,
        }}
        transition={{
          duration: isActive ? 12 : 18,
          repeat: Infinity,
          ease: 'easeInOut',
          background: { duration: 1.2, ease: 'easeOut' },
        }}
      />

      {/* Active state: extra radiant pulse overlay */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '55%',
          height: '55%',
          top: '25%',
          left: '22%',
          filter: 'blur(100px)',
          background: `radial-gradient(circle, ${colors.primary} 0%, transparent 60%)`,
        }}
        animate={{
          opacity: isActive ? [0, 0.12, 0] : 0,
          scale: isActive ? [0.9, 1.1, 0.9] : 0.9,
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
