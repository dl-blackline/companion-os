import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CompanionState } from '@/types';

interface CompanionOrbProps {
  state: CompanionState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
  showRipples?: boolean;
}

const sizeConfig = {
  sm: {
    container: 'w-28 h-28',
    core: 'w-16 h-16',
    ring1: 'w-20 h-20',
    ring2: 'w-24 h-24',
    ring3: 'w-28 h-28',
  },
  md: {
    container: 'w-44 h-44',
    core: 'w-24 h-24',
    ring1: 'w-32 h-32',
    ring2: 'w-38 h-38',
    ring3: 'w-44 h-44',
  },
  lg: {
    container: 'w-64 h-64',
    core: 'w-36 h-36',
    ring1: 'w-48 h-48',
    ring2: 'w-56 h-56',
    ring3: 'w-64 h-64',
  },
  xl: {
    container: 'w-80 h-80',
    core: 'w-44 h-44',
    ring1: 'w-60 h-60',
    ring2: 'w-70 h-70',
    ring3: 'w-80 h-80',
  },
};

function getStateColors(state: CompanionState) {
  switch (state) {
    case 'listening':
      return {
        coreFrom: 'oklch(0.72 0.22 230)',
        coreMid: 'oklch(0.58 0.20 240)',
        coreTo: 'oklch(0.35 0.15 245)',
        ringColor: 'oklch(0.65 0.20 230 / 0.35)',
        highlightColor: 'oklch(0.88 0.12 220 / 0.60)',
        orbClass: 'orb-listen',
      };
    case 'thinking':
      return {
        coreFrom: 'oklch(0.72 0.26 310)',
        coreMid: 'oklch(0.55 0.22 300)',
        coreTo: 'oklch(0.32 0.16 295)',
        ringColor: 'oklch(0.60 0.22 310 / 0.35)',
        highlightColor: 'oklch(0.88 0.14 300 / 0.60)',
        orbClass: 'orb-think',
      };
    case 'speaking':
      return {
        coreFrom: 'oklch(0.85 0.18 65)',
        coreMid: 'oklch(0.68 0.20 70)',
        coreTo: 'oklch(0.40 0.14 75)',
        ringColor: 'oklch(0.70 0.18 65 / 0.35)',
        highlightColor: 'oklch(0.95 0.10 60 / 0.60)',
        orbClass: 'orb-speak',
      };
    case 'generating-image':
    case 'generating-video':
      return {
        coreFrom: 'oklch(0.75 0.24 310)',
        coreMid: 'oklch(0.55 0.22 290)',
        coreTo: 'oklch(0.35 0.16 275)',
        ringColor: 'oklch(0.60 0.20 295 / 0.35)',
        highlightColor: 'oklch(0.88 0.14 300 / 0.55)',
        orbClass: 'orb-generate',
      };
    case 'writing':
    case 'analyzing':
      return {
        coreFrom: 'oklch(0.68 0.22 280)',
        coreMid: 'oklch(0.52 0.18 285)',
        coreTo: 'oklch(0.32 0.14 285)',
        ringColor: 'oklch(0.55 0.18 280 / 0.35)',
        highlightColor: 'oklch(0.85 0.12 275 / 0.55)',
        orbClass: 'orb-generate',
      };
    default: // idle
      return {
        coreFrom: 'oklch(0.68 0.22 285)',
        coreMid: 'oklch(0.50 0.18 285)',
        coreTo: 'oklch(0.30 0.12 285)',
        ringColor: 'oklch(0.50 0.18 285 / 0.28)',
        highlightColor: 'oklch(0.85 0.12 280 / 0.50)',
        orbClass: 'orb-idle',
      };
  }
}

function getRingAnimationClass(state: CompanionState, ring: 'inner' | 'mid' | 'outer') {
  if (state === 'thinking') {
    return ring === 'mid' ? 'ring-fast' : ring === 'inner' ? 'ring-medium' : 'ring-slow';
  }
  if (state === 'speaking') {
    return ring === 'inner' ? 'ring-fast' : ring === 'mid' ? 'ring-medium' : '';
  }
  return ring === 'inner' ? 'ring-slow' : ring === 'mid' ? 'ring-medium' : '';
}

export function CompanionOrb({
  state,
  size = 'lg',
  onClick,
  className,
  showRipples = true,
}: CompanionOrbProps) {
  const sizes = sizeConfig[size];
  const colors = getStateColors(state);
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking';
  const isActive = state !== 'idle';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center select-none',
        sizes.container,
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Ambient background haze */}
      <div
        className="absolute rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{
          width: '150%',
          height: '150%',
          background: `radial-gradient(circle, ${colors.coreFrom} 0%, transparent 70%)`,
        }}
      />

      {/* Ripple rings (listening / speaking) */}
      <AnimatePresence>
        {showRipples && (isListening || isSpeaking) && (
          <>
            <div
              className={cn(
                'absolute rounded-full pointer-events-none border',
                sizes.ring3,
                isListening ? 'border-[oklch(0.65_0.20_230/0.50)] ripple-1' : 'border-[oklch(0.70_0.18_65/0.45)] ripple-1'
              )}
            />
            <div
              className={cn(
                'absolute rounded-full pointer-events-none border',
                sizes.ring3,
                isListening ? 'border-[oklch(0.65_0.20_230/0.40)] ripple-2' : 'border-[oklch(0.70_0.18_65/0.35)] ripple-2'
              )}
            />
            <div
              className={cn(
                'absolute rounded-full pointer-events-none border',
                sizes.ring3,
                isListening ? 'border-[oklch(0.65_0.20_230/0.30)] ripple-3' : 'border-[oklch(0.70_0.18_65/0.25)] ripple-3'
              )}
            />
          </>
        )}
      </AnimatePresence>

      {/* Outer decorative ring */}
      <div
        className={cn(
          'absolute rounded-full pointer-events-none border border-dashed opacity-30',
          sizes.ring3,
          getRingAnimationClass(state, 'outer')
        )}
        style={{ borderColor: colors.ringColor }}
      />

      {/* Mid ring */}
      <div
        className={cn(
          'absolute rounded-full pointer-events-none border opacity-40',
          sizes.ring2,
          getRingAnimationClass(state, 'mid')
        )}
        style={{ borderColor: colors.ringColor }}
      />

      {/* Inner ring */}
      <div
        className={cn(
          'absolute rounded-full pointer-events-none border opacity-55',
          sizes.ring1,
          getRingAnimationClass(state, 'inner')
        )}
        style={{ borderColor: colors.ringColor }}
      />

      {/* Core orb */}
      <motion.div
        className={cn(
          'relative rounded-full z-10',
          sizes.core,
          colors.orbClass
        )}
        style={{
          background: `radial-gradient(circle at 38% 32%, ${colors.coreFrom} 0%, ${colors.coreMid} 45%, ${colors.coreTo} 100%)`,
        }}
        animate={
          isActive
            ? { scale: [1, 1.02, 1], transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }
            : { scale: [1, 1.03, 1], transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }
        }
        whileHover={onClick ? { scale: 1.06 } : {}}
        whileTap={onClick ? { scale: 0.97 } : {}}
      >
        {/* Inner highlight for 3D depth */}
        <div
          className="absolute top-[14%] left-[18%] w-[35%] h-[32%] rounded-full blur-sm pointer-events-none"
          style={{ background: colors.highlightColor }}
        />

        {/* Thinking: orbiting particle */}
        {isThinking && (
          <div className="absolute inset-0 rounded-full ring-fast pointer-events-none">
            <div
              className="absolute top-[5%] left-[50%] -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{ background: colors.coreFrom, boxShadow: `0 0 6px ${colors.coreFrom}` }}
            />
          </div>
        )}

        {/* Speaking: small inner pulse dot */}
        {isSpeaking && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: colors.highlightColor }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
