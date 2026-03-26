import { motion } from 'framer-motion';
import { Brain } from '@phosphor-icons/react/Brain';
import { FilmSlate } from '@phosphor-icons/react/FilmSlate';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { SpeakerHigh } from '@phosphor-icons/react/SpeakerHigh';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { cn } from '@/lib/utils';
import type { CompanionState } from '@/types';

interface CompanionStatusIconProps {
  state: CompanionState;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

function getStateStyle(state: CompanionState) {
  switch (state) {
    case 'listening':
      return {
        icon: Microphone,
        iconClass: 'text-sky-100',
        frameClass: 'border-sky-300/50 bg-slate-950/85',
        neonClass: 'from-sky-300/90 via-cyan-200/70 to-indigo-300/90',
        glowClass: 'bg-sky-300/45',
      };
    case 'speaking':
      return {
        icon: SpeakerHigh,
        iconClass: 'text-rose-50',
        frameClass: 'border-rose-300/55 bg-slate-950/85',
        neonClass: 'from-rose-300/90 via-orange-200/75 to-fuchsia-300/85',
        glowClass: 'bg-rose-300/45',
      };
    case 'thinking':
      return {
        icon: Brain,
        iconClass: 'text-amber-50',
        frameClass: 'border-amber-200/60 bg-slate-950/85',
        neonClass: 'from-amber-200/90 via-yellow-100/80 to-orange-300/85',
        glowClass: 'bg-amber-200/45',
      };
    case 'generating-image':
      return {
        icon: ImageSquare,
        iconClass: 'text-indigo-50',
        frameClass: 'border-indigo-300/55 bg-slate-950/85',
        neonClass: 'from-indigo-300/90 via-fuchsia-200/80 to-sky-300/85',
        glowClass: 'bg-indigo-300/45',
      };
    case 'generating-video':
      return {
        icon: FilmSlate,
        iconClass: 'text-violet-50',
        frameClass: 'border-violet-300/55 bg-slate-950/85',
        neonClass: 'from-violet-300/90 via-pink-200/80 to-cyan-300/85',
        glowClass: 'bg-violet-300/45',
      };
    case 'writing':
      return {
        icon: PencilSimple,
        iconClass: 'text-emerald-50',
        frameClass: 'border-emerald-300/55 bg-slate-950/85',
        neonClass: 'from-emerald-300/90 via-teal-200/80 to-cyan-300/85',
        glowClass: 'bg-emerald-300/45',
      };
    case 'analyzing':
      return {
        icon: MagnifyingGlass,
        iconClass: 'text-cyan-50',
        frameClass: 'border-cyan-300/55 bg-slate-950/85',
        neonClass: 'from-cyan-300/90 via-sky-200/80 to-emerald-300/85',
        glowClass: 'bg-cyan-300/45',
      };
    default:
      return {
        icon: Sparkle,
        iconClass: 'text-zinc-100',
        frameClass: 'border-zinc-300/40 bg-slate-950/85',
        neonClass: 'from-zinc-200/80 via-zinc-100/50 to-zinc-300/75',
        glowClass: 'bg-zinc-300/30',
      };
  }
}

const sizeMap = {
  sm: { box: 'h-9 w-9 rounded-lg', icon: 16 },
  md: { box: 'h-12 w-12 rounded-xl', icon: 20 },
  lg: { box: 'h-14 w-14 rounded-xl', icon: 24 },
};

export function CompanionStatusIcon({ state, size = 'md', onClick, className }: CompanionStatusIconProps) {
  const style = getStateStyle(state);
  const conf = sizeMap[size];
  const Icon = style.icon;
  const active = state !== 'idle';

  const content = (
    <motion.div
      animate={active ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={active ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden border shadow-[0_14px_36px_rgba(0,0,0,0.38)]',
        conf.box,
        style.frameClass,
        className
      )}
    >
      <span className={cn('absolute -inset-3 blur-xl opacity-60 pointer-events-none', style.glowClass)} />

      <motion.span
        className={cn(
          'absolute -inset-[44%] pointer-events-none rounded-full bg-linear-to-r opacity-55',
          style.neonClass
        )}
        animate={active ? { rotate: [0, 360] } : { rotate: 0 }}
        transition={active ? { duration: 5.5, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
      />

      <span className="absolute inset-[1.5px] rounded-[inherit] bg-slate-950/88 backdrop-blur-md" />
      <span className="absolute inset-0 rounded-[inherit] bg-linear-to-br from-white/14 via-transparent to-black/25" />

      <motion.span
        className="absolute -left-2 top-0 h-full w-4 rotate-14 bg-white/18 blur-[1px]"
        animate={active ? { x: ['-30%', '360%'] } : { x: '-30%' }}
        transition={active ? { duration: 2.8, repeat: Infinity, repeatDelay: 0.7, ease: 'easeInOut' } : { duration: 0.2 }}
      />

      <Icon size={conf.icon} weight="fill" className={cn('relative z-10 drop-shadow-[0_0_12px_rgba(255,255,255,0.26)]', style.iconClass)} />
      {active && <span className="absolute inset-0 rounded-[inherit] border border-white/25" />}
    </motion.div>
  );

  if (!onClick) return content;

  return (
    <button type="button" onClick={onClick} className="focus-ring-lux rounded-xl">
      {content}
    </button>
  );
}
