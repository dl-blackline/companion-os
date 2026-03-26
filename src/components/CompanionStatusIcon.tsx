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
      return { icon: Microphone, iconClass: 'text-sky-200', ringClass: 'border-sky-300/45 bg-sky-500/10' };
    case 'speaking':
      return { icon: SpeakerHigh, iconClass: 'text-rose-100', ringClass: 'border-rose-300/45 bg-rose-500/10' };
    case 'thinking':
      return { icon: Brain, iconClass: 'text-amber-100', ringClass: 'border-amber-200/50 bg-amber-500/10' };
    case 'generating-image':
      return { icon: ImageSquare, iconClass: 'text-indigo-100', ringClass: 'border-indigo-300/45 bg-indigo-500/10' };
    case 'generating-video':
      return { icon: FilmSlate, iconClass: 'text-violet-100', ringClass: 'border-violet-300/45 bg-violet-500/10' };
    case 'writing':
      return { icon: PencilSimple, iconClass: 'text-emerald-100', ringClass: 'border-emerald-300/45 bg-emerald-500/10' };
    case 'analyzing':
      return { icon: MagnifyingGlass, iconClass: 'text-cyan-100', ringClass: 'border-cyan-300/45 bg-cyan-500/10' };
    default:
      return { icon: Sparkle, iconClass: 'text-zinc-200', ringClass: 'border-zinc-300/35 bg-zinc-500/10' };
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
        'relative inline-flex items-center justify-center border shadow-[0_10px_24px_rgba(0,0,0,0.25)]',
        conf.box,
        style.ringClass,
        className
      )}
    >
      <Icon size={conf.icon} weight="fill" className={style.iconClass} />
      {active && <span className="absolute -inset-1 rounded-[inherit] border border-white/10" />}
    </motion.div>
  );

  if (!onClick) return content;

  return (
    <button type="button" onClick={onClick} className="focus-ring-lux rounded-xl">
      {content}
    </button>
  );
}
