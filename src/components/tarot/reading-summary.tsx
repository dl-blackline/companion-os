import { motion } from 'framer-motion';
import type { ReadingSession } from '@/lib/tarot/tarot-types';
import { ZodiacBadge } from './zodiac-badge';

interface ReadingSummaryProps {
  session: ReadingSession;
  isVisible: boolean;
}

export function ReadingSummary({ session, isVisible }: ReadingSummaryProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="space-y-6 rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/5 to-transparent p-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold tracking-widest uppercase text-amber-400/70">
          Reading Complete
        </p>
        <h2 className="text-xl font-semibold text-white">
          Your Spread Summary
        </h2>
      </div>

      {/* Energy theme */}
      <div className="text-center">
        <p className="text-xs text-neutral-400 mb-1 tracking-wide">Energetic Theme</p>
        <p className="text-amber-300 font-medium text-lg">{session.energyTheme}</p>
      </div>

      {/* Summary */}
      <p className="text-sm text-neutral-300 leading-relaxed text-center">{session.summary}</p>

      {/* Zodiac note */}
      <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <ZodiacBadge
            zodiac={{
              sign: session.zodiacSign,
              symbol: session.zodiacSymbol,
              element: session.zodiacElement as 'Fire' | 'Earth' | 'Air' | 'Water',
            }}
          />
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed">{session.zodiacNote}</p>
      </div>

      {/* Reflection prompt */}
      <div className="text-center pt-2">
        <p className="text-xs text-neutral-500 italic">
          Sit with what resonated. The card that stirred the most is often your clearest mirror.
        </p>
      </div>
    </motion.div>
  );
}
