import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CompanionState } from '@/types';

interface AICoreProps {
  state: CompanionState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
}

const sizeMap = {
  sm: { box: 112, core: 48, ring: 80, waveH: 28, bars: 20 },
  md: { box: 176, core: 72, ring: 128, waveH: 36, bars: 26 },
  lg: { box: 256, core: 104, ring: 192, waveH: 44, bars: 32 },
  xl: { box: 320, core: 136, ring: 240, waveH: 52, bars: 40 },
};

/* ── colour palette per AI state ── */
function palette(state: CompanionState) {
  switch (state) {
    case 'listening':
      return {
        primary: 'oklch(0.72 0.22 230)',
        secondary: 'oklch(0.58 0.20 240)',
        deep: 'oklch(0.35 0.15 245)',
        glow: 'oklch(0.65 0.20 230 / 0.45)',
        highlight: 'oklch(0.88 0.12 220 / 0.60)',
      };
    case 'thinking':
      return {
        primary: 'oklch(0.72 0.26 310)',
        secondary: 'oklch(0.55 0.22 300)',
        deep: 'oklch(0.32 0.16 295)',
        glow: 'oklch(0.60 0.22 310 / 0.45)',
        highlight: 'oklch(0.88 0.14 300 / 0.60)',
      };
    case 'speaking':
      return {
        primary: 'oklch(0.85 0.18 65)',
        secondary: 'oklch(0.68 0.20 70)',
        deep: 'oklch(0.40 0.14 75)',
        glow: 'oklch(0.70 0.18 65 / 0.45)',
        highlight: 'oklch(0.95 0.10 60 / 0.60)',
      };
    case 'generating-image':
    case 'generating-video':
      return {
        primary: 'oklch(0.75 0.24 310)',
        secondary: 'oklch(0.55 0.22 290)',
        deep: 'oklch(0.35 0.16 275)',
        glow: 'oklch(0.60 0.20 295 / 0.45)',
        highlight: 'oklch(0.88 0.14 300 / 0.55)',
      };
    case 'writing':
    case 'analyzing':
      return {
        primary: 'oklch(0.68 0.22 280)',
        secondary: 'oklch(0.52 0.18 285)',
        deep: 'oklch(0.32 0.14 285)',
        glow: 'oklch(0.55 0.18 280 / 0.45)',
        highlight: 'oklch(0.85 0.12 275 / 0.55)',
      };
    default:
      return {
        primary: 'oklch(0.68 0.22 285)',
        secondary: 'oklch(0.50 0.18 285)',
        deep: 'oklch(0.30 0.12 285)',
        glow: 'oklch(0.50 0.18 285 / 0.35)',
        highlight: 'oklch(0.85 0.12 280 / 0.50)',
      };
  }
}

/* ── energy ring speed per state ── */
function ringSpeed(state: CompanionState) {
  switch (state) {
    case 'thinking':
      return { inner: 4, outer: 6 };
    case 'speaking':
      return { inner: 5, outer: 8 };
    case 'listening':
      return { inner: 7, outer: 10 };
    default:
      return { inner: 10, outer: 14 };
  }
}

/* ── waveform bars (memoised) ── */
function useWaveBars(count: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        scaleY: [
          0.15,
          Math.random() * 0.6 + 0.35,
          Math.random() * 0.35 + 0.1,
          Math.random() * 0.75 + 0.25,
          0.15,
        ],
        duration: 0.45 + Math.random() * 0.5,
        delay: (i * 0.03) % 0.45,
      })),
    [count]
  );
}

/* ──────────────────────────────────
   AICore – Living AI Core component
   ────────────────────────────────── */
export function AICore({ state, size = 'lg', onClick, className }: AICoreProps) {
  const s = sizeMap[size];
  const c = palette(state);
  const speed = ringSpeed(state);
  const bars = useWaveBars(s.bars);

  const isActive = state !== 'idle';
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking';
  const showWave = isListening || isSpeaking;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center select-none',
        onClick && 'cursor-pointer',
        className
      )}
      style={{ width: s.box, height: s.box }}
      onClick={onClick}
    >
      {/* ── ambient glow ── */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${c.primary} 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
        animate={{
          scale: isActive ? [1, 1.18, 1] : [1, 1.08, 1],
          opacity: isActive ? [0.35, 0.6, 0.35] : [0.2, 0.35, 0.2],
        }}
        transition={{
          duration: isActive ? 2 : 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* ── outer energy ring ── */}
      <motion.div
        className="absolute rounded-full pointer-events-none border border-dashed"
        style={{
          width: s.ring,
          height: s.ring,
          borderColor: c.glow,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: speed.outer, repeat: Infinity, ease: 'linear' }}
      />

      {/* ── inner energy ring ── */}
      <motion.div
        className="absolute rounded-full pointer-events-none border"
        style={{
          width: s.ring * 0.78,
          height: s.ring * 0.78,
          borderColor: c.glow,
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: speed.inner, repeat: Infinity, ease: 'linear' }}
      />

      {/* ── pulsing energy halo ── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: s.ring * 0.92,
              height: s.ring * 0.92,
              border: `1.5px solid ${c.glow}`,
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.2, 0.5, 0.2] }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* ── core orb ── */}
      <motion.div
        className="relative rounded-full z-10"
        style={{
          width: s.core,
          height: s.core,
          background: `radial-gradient(circle at 38% 32%, ${c.primary} 0%, ${c.secondary} 45%, ${c.deep} 100%)`,
        }}
        animate={
          isActive
            ? { scale: [1, 1.04, 1], transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }
            : { scale: [1, 1.025, 1], transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } }
        }
        whileHover={onClick ? { scale: 1.08 } : undefined}
        whileTap={onClick ? { scale: 0.95 } : undefined}
      >
        {/* highlight for 3D depth */}
        <div
          className="absolute top-[14%] left-[18%] w-[35%] h-[32%] rounded-full blur-sm pointer-events-none"
          style={{ background: c.highlight }}
        />

        {/* thinking: orbiting particle */}
        <AnimatePresence>
          {isThinking && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <div
                className="absolute top-[6%] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                style={{ background: c.primary, boxShadow: `0 0 8px ${c.primary}` }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* speaking: inner pulse dot */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: c.highlight }}
                animate={{ scale: [1, 1.8, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── microphone waveform ── */}
      <AnimatePresence>
        {showWave && (
          <motion.div
            className="absolute z-20 flex items-center justify-center gap-[2px] pointer-events-none"
            style={{ bottom: '8%', height: s.waveH }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3 }}
          >
            {bars.map((bar, i) => (
              <motion.div
                key={i}
                className="rounded-full origin-bottom"
                style={{
                  width: 2.5,
                  height: s.waveH,
                  background: isListening ? c.primary : c.secondary,
                }}
                animate={
                  showWave
                    ? { scaleY: bar.scaleY }
                    : { scaleY: 0.1 }
                }
                transition={
                  showWave
                    ? {
                        duration: bar.duration,
                        repeat: Infinity,
                        repeatType: 'loop' as const,
                        delay: bar.delay,
                        ease: 'easeInOut',
                      }
                    : { duration: 0.3, ease: 'easeOut' }
                }
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── state-transition flash ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${c.primary} 0%, transparent 60%)`,
          }}
          initial={{ opacity: 0.6, scale: 0.8 }}
          animate={{ opacity: 0, scale: 1.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </AnimatePresence>
    </div>
  );
}
