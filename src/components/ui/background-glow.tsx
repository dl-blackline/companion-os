import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CompanionState } from '@/types';

interface BackgroundGlowProps {
  state?: CompanionState;
  className?: string;
}

const stateAccent: Record<string, string> = {
  idle: 'oklch(0.45 0.18 290)',
  listening: 'oklch(0.55 0.18 230)',
  thinking: 'oklch(0.55 0.18 55)',
  speaking: 'oklch(0.55 0.18 145)',
  'generating-image': 'oklch(0.50 0.18 310)',
  'generating-video': 'oklch(0.50 0.18 310)',
  writing: 'oklch(0.45 0.16 280)',
  analyzing: 'oklch(0.45 0.16 280)',
};

export function BackgroundGlow({ state = 'idle', className }: BackgroundGlowProps) {
  const accent = stateAccent[state] ?? stateAccent.idle;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className
      )}
      style={{ mixBlendMode: 'screen' }}
    >
      {/* Primary floating orb */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '45%',
          height: '45%',
          top: '10%',
          left: '20%',
          background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
          filter: 'blur(80px)',
          opacity: 0.18,
        }}
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 15, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Secondary floating orb */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '35%',
          height: '35%',
          bottom: '15%',
          right: '15%',
          background: `radial-gradient(circle, oklch(0.45 0.15 290) 0%, transparent 70%)`,
          filter: 'blur(70px)',
          opacity: 0.12,
        }}
        animate={{
          x: [0, -25, 15, 0],
          y: [0, 20, -10, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Tertiary subtle accent */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '25%',
          height: '25%',
          top: '50%',
          left: '60%',
          background: `radial-gradient(circle, oklch(0.50 0.14 230) 0%, transparent 70%)`,
          filter: 'blur(60px)',
          opacity: 0.10,
        }}
        animate={{
          x: [0, 20, -15, 0],
          y: [0, -15, 20, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
