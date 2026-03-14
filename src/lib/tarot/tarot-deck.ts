import type { TarotCardData } from './tarot-types';
import majorArcana from '@/data/tarot/major-arcana.json';
import cups from '@/data/tarot/minor-arcana-cups.json';
import wands from '@/data/tarot/minor-arcana-wands.json';
import swords from '@/data/tarot/minor-arcana-swords.json';
import pentacles from '@/data/tarot/minor-arcana-pentacles.json';

/**
 * Returns the full seeded tarot deck as a typed array.
 * Cards are loaded from JSON data files; the full 78-card deck can be
 * populated by extending those files without changing any code here.
 */
export function getTarotDeck(): TarotCardData[] {
  const all = [
    ...majorArcana,
    ...cups,
    ...wands,
    ...swords,
    ...pentacles,
  ] as TarotCardData[];

  // Sort by numeralIndex so the deck order is always deterministic
  return all.slice().sort((a, b) => a.numeralIndex - b.numeralIndex);
}

/** Returns only the Major Arcana cards. */
export function getMajorArcana(): TarotCardData[] {
  return getTarotDeck().filter((c) => c.arcana === 'MAJOR');
}

/** Returns cards for a specific suit (Minor Arcana). */
export function getCardsBySuit(suit: string): TarotCardData[] {
  return getTarotDeck().filter((c) => c.suit === suit);
}

/** Looks up a single card by its slug id. */
export function getCardById(id: string): TarotCardData | undefined {
  return getTarotDeck().find((c) => c.id === id);
}
