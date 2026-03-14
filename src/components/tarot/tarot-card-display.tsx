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
        style={{ width: 120, height: 208, perspective: 1200 }}
        onClick={handleClick}
        initial={{ opacity: 0, y: 30 }}
        animate={isRevealed ? { opacity: 1, y: 0 } : { opacity: 0.3, y: 10 }}
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
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* ── Card Back ─────────────────────────────────────────────────── */}
          <div
            className="absolute inset-0 rounded-xl overflow-hidden shadow-xl"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {/* Outer border / frame */}
            <div className="absolute inset-0 rounded-xl border border-amber-400/25 bg-gradient-to-br from-neutral-900 via-neutral-850 to-neutral-900" />
            {/* Inner decorative frame */}
            <div
              className="absolute inset-[7px] rounded-lg border border-amber-400/20"
              style={{
                background:
                  'repeating-linear-gradient(45deg, rgba(212,175,55,0.06) 0px, rgba(212,175,55,0.06) 1px, transparent 1px, transparent 9px)',
              }}
            />
            {/* Central symbol */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <span
                  className="text-2xl text-amber-400/40 select-none"
                  aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.3))' }}
                >
                  ✦
                </span>
              </div>
            </div>
            {/* Corner ornaments */}
            {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos) => (
              <span
                key={pos}
                className={`absolute ${pos} text-[8px] text-amber-400/30 select-none`}
                aria-hidden="true"
              >
                ✦
              </span>
            ))}
            {/* Tap to reveal hint */}
            {isRevealed && (
              <div className="absolute inset-x-0 bottom-0 flex justify-center pb-3">
                <span className="text-[9px] text-amber-400/40 tracking-[0.2em] uppercase">
                  tap
                </span>
              </div>
            )}
          </div>

          {/* ── Card Face ─────────────────────────────────────────────────── */}
          <div
            className={`absolute inset-0 rounded-xl overflow-hidden shadow-xl flex flex-col ${
              isSelected ? 'shadow-amber-400/20' : ''
            }`}
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'linear-gradient(160deg, #1a1614 0%, #0e0d0b 100%)',
              border: isSelected
                ? '1px solid rgba(212,175,55,0.5)'
                : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Top label bar */}
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-white/6">
              <span className="text-[8px] font-semibold tracking-[0.18em] uppercase text-amber-400/50">
                {card.arcana === 'MAJOR' ? 'Major' : card.suit ?? ''}
              </span>
              {isReversed && (
                <span className="text-[8px] text-amber-400/40 tracking-wide">↻</span>
              )}
            </div>

            {/* Card art area */}
            <div
              className={`relative flex-1 mx-2 my-1.5 rounded-md overflow-hidden ${
                isReversed ? 'rotate-180' : ''
              }`}
              style={{
                background:
                  'radial-gradient(ellipse at 50% 40%, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.04) 50%, transparent 80%)',
              }}
            >
              {/* Subtle geometric ornament */}
              <svg
                className="absolute inset-0 w-full h-full opacity-20"
                viewBox="0 0 80 100"
                fill="none"
                aria-hidden="true"
              >
                <rect x="10" y="10" width="60" height="80" rx="4" stroke="rgba(212,175,55,0.4)" strokeWidth="0.5" />
                <rect x="16" y="16" width="48" height="68" rx="3" stroke="rgba(212,175,55,0.25)" strokeWidth="0.5" />
                <line x1="40" y1="10" x2="40" y2="90" stroke="rgba(212,175,55,0.15)" strokeWidth="0.5" />
                <line x1="10" y1="50" x2="70" y2="50" stroke="rgba(212,175,55,0.15)" strokeWidth="0.5" />
                <circle cx="40" cy="50" r="12" stroke="rgba(212,175,55,0.3)" strokeWidth="0.5" />
              </svg>

              {/* Central card symbol */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-4xl select-none"
                  aria-hidden="true"
                  style={{
                    filter: 'drop-shadow(0 2px 12px rgba(212,175,55,0.4))',
                    opacity: 0.85,
                  }}
                >
                  {getCardSymbol(card.arcana, card.suit)}
                </span>
              </div>
            </div>

            {/* Bottom label */}
            <div className="px-2.5 py-2 border-t border-white/6 space-y-0.5">
              <p
                className="text-[10px] font-semibold text-white leading-tight text-center truncate"
                title={card.name}
              >
                {card.name}
              </p>
              {isReversed && (
                <p className="text-[8px] text-amber-400/50 tracking-wider text-center uppercase">
                  Reversed
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Reveal glow ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {isFlipped && (
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ boxShadow: '0 0 40px rgba(212,175,55,0.18), 0 0 80px rgba(212,175,55,0.08)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>

        {/* ── Active-card emphasis ring ─────────────────────────────────── */}
        <AnimatePresence>
          {isSelected && isFlipped && (
            <motion.div
              className="absolute -inset-1 rounded-[14px] pointer-events-none"
              style={{ border: '1px solid rgba(212,175,55,0.2)' }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4 }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Card symbol mapping ──────────────────────────────────────────────────────

function getCardSymbol(arcana: string, suit: string | null): string {
  if (arcana === 'MAJOR') return '✦';
  switch (suit) {
    case 'Cups':      return '⌀';  // water / cup motif
    case 'Wands':     return '⚘';  // flame / life motif
    case 'Swords':    return '✧';  // air / light motif
    case 'Pentacles': return '⬡';  // earth / coin motif
    default:          return '✦';
  }
}
