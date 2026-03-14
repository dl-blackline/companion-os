import { motion, AnimatePresence } from 'framer-motion';
import type { DrawnCard } from '@/lib/tarot/tarot-types';
import { TarotCardDisplay } from './tarot-card-display';

interface InterpretationPanelProps {
  card: DrawnCard;
  isVisible: boolean;
}

export function InterpretationPanel({ card, isVisible }: InterpretationPanelProps) {
  const { card: cardData, isReversed, interpretation, position } = card;
  const keywords = isReversed ? cardData.reversedKeywords : cardData.uprightKeywords;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6 space-y-4"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-amber-400/70 mb-1">
                {position.label}
              </p>
              <h3 className="text-lg font-semibold text-white">
                {cardData.name}
                {isReversed && (
                  <span className="ml-2 text-sm font-normal text-amber-400/70">(Reversed)</span>
                )}
              </h3>
            </div>
            <span className="shrink-0 text-xs text-neutral-500 mt-1">
              {cardData.arcana === 'MAJOR' ? 'Major Arcana' : cardData.suit}
            </span>
          </div>

          {/* Keywords */}
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 rounded-full text-[11px] bg-amber-400/10 border border-amber-400/20 text-amber-300/80 tracking-wide"
              >
                {kw}
              </span>
            ))}
          </div>

          {/* Meaning */}
          <div className="space-y-2 text-sm text-neutral-300 leading-relaxed">
            <p className="font-medium text-neutral-200">
              {isReversed ? cardData.reversedMeaning : cardData.uprightMeaning}
            </p>
          </div>

          {/* Personal interpretation */}
          <div className="pt-2 border-t border-white/6">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/60 mb-2">
              Your Reading
            </p>
            <p className="text-sm text-neutral-300 leading-relaxed italic">{interpretation}</p>
          </div>

          {/* Astrological correspondence */}
          {cardData.astrologicalCorrespondence && (
            <p className="text-xs text-neutral-500">
              <span className="text-neutral-400">Astrological:</span>{' '}
              {cardData.astrologicalCorrespondence}
              {cardData.element ? ` · ${cardData.element}` : ''}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
