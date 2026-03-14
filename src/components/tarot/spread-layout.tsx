import type { DrawnCard } from '@/lib/tarot/tarot-types';
import { TarotCardDisplay } from './tarot-card-display';

interface SpreadLayoutProps {
  cards: DrawnCard[];
  revealedCount: number;
  onCardReveal: () => void;
}

export function SpreadLayout({ cards, revealedCount, onCardReveal }: SpreadLayoutProps) {
  return (
    <div
      className="flex flex-col items-center gap-8"
      role="region"
      aria-label="Three-card tarot spread"
    >
      {/* Spread connector line (decorative) */}
      <div className="relative w-full max-w-xs hidden sm:flex items-center justify-center">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
      </div>

      {/* Cards row */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
        {cards.map((drawnCard, index) => (
          <TarotCardDisplay
            key={drawnCard.card.id}
            drawnCard={drawnCard}
            isRevealed={index < revealedCount}
            onClick={index === revealedCount - 1 ? onCardReveal : undefined}
          />
        ))}
      </div>

      {/* Reveal prompt */}
      {revealedCount < cards.length && revealedCount > 0 && (
        <p className="text-xs text-neutral-500 text-center animate-pulse">
          Tap the glowing card to continue the reveal…
        </p>
      )}

      {revealedCount === 0 && (
        <p className="text-xs text-neutral-500 text-center">
          Your cards are being placed…
        </p>
      )}
    </div>
  );
}
