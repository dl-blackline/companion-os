import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DrawnCard } from '@/lib/tarot/tarot-types';

interface TarotCardDisplayProps {
  drawnCard: DrawnCard;
  isRevealed: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

export function TarotCardDisplay({
  drawnCard,
  isRevealed,
  onClick,
  isSelected,
}: TarotCardDisplayProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { card, isReversed, position } = drawnCard;

  const handleClick = () => {
    if (isRevealed && !isFlipped) {
      setIsFlipped(true);
      onClick?.();
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Position label */}
      <span className="text-xs font-semibold tracking-widest uppercase text-amber-400/70">
        {position.label}
      </span>

      {/* Card container */}
      <motion.div
        className="relative cursor-pointer"
        style={{ width: 120, height: 208, perspective: 1000 }}
        onClick={handleClick}
        initial={{ opacity: 0, y: 30 }}
        animate={isRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        role={isRevealed && !isFlipped ? 'button' : undefined}
        aria-label={
          isFlipped
            ? `${card.name}${isReversed ? ', reversed' : ''} — ${position.label}`
            : isRevealed
            ? `Tap to reveal ${position.label} card`
            : `${position.label} card, not yet revealed`
        }
        tabIndex={isRevealed && !isFlipped ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <motion.div
          style={{
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
          }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
        >
          {/* Card back */}
          <div
            className="absolute inset-0 rounded-xl border border-amber-400/20 bg-gradient-to-br from-neutral-800 to-neutral-900 shadow-xl flex items-center justify-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div
              className="w-[82%] h-[87%] rounded-lg border border-amber-400/30"
              style={{
                background:
                  'repeating-linear-gradient(45deg, rgba(212,175,55,0.07) 0px, rgba(212,175,55,0.07) 1px, transparent 1px, transparent 8px)',
              }}
            />
            {isRevealed && (
              <div className="absolute inset-0 rounded-xl flex items-end justify-center pb-4">
                <span className="text-[10px] text-amber-400/50 tracking-widest">TAP TO REVEAL</span>
              </div>
            )}
          </div>

          {/* Card face */}
          <div
            className={`absolute inset-0 rounded-xl border shadow-xl overflow-hidden flex flex-col items-center justify-between py-3 px-2 ${
              isSelected
                ? 'border-amber-400/60 shadow-amber-400/20'
                : 'border-white/10'
            } bg-gradient-to-br from-neutral-900 via-neutral-850 to-neutral-900`}
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Arcana label */}
            <span className="text-[9px] tracking-widest uppercase text-amber-400/60 font-medium">
              {card.arcana === 'MAJOR' ? 'Major Arcana' : card.suit ?? ''}
            </span>

            {/* Card art placeholder */}
            <div
              className={`w-full flex-1 mx-0.5 my-1 rounded-lg flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-700 ${
                isReversed ? 'rotate-180' : ''
              }`}
            >
              <span className="text-3xl opacity-50" aria-hidden="true">
                {getCardEmoji(card.arcana, card.suit)}
              </span>
            </div>

            {/* Card name */}
            <div className="text-center space-y-0.5">
              <p className="text-[11px] font-semibold text-white leading-tight">
                {card.name}
              </p>
              {isReversed && (
                <p className="text-[9px] text-amber-400/60 tracking-wide">Reversed</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Glow effect when selected/flipped */}
        <AnimatePresence>
          {isFlipped && (
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                boxShadow: '0 0 30px rgba(212,175,55,0.2)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function getCardEmoji(arcana: string, suit: string | null): string {
  if (arcana === 'MAJOR') return '✦';
  switch (suit) {
    case 'Cups': return '🌊';
    case 'Wands': return '🔥';
    case 'Swords': return '⚡';
    case 'Pentacles': return '⬡';
    default: return '✦';
  }
}
