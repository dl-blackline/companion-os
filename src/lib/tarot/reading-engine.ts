import type { DrawnCard, ReadingSession } from './tarot-types';
import { getTarotDeck } from './tarot-deck';
import { sampleWithoutReplacement, randomBoolean } from './shuffle';
import { THREE_CARD_SPREAD } from './spread-definitions';
import { generateInterpretation, generateSessionSummary } from './interpretation-engine';
import { getZodiacSign } from '@/lib/zodiac/get-zodiac-sign';

export interface GenerateReadingOptions {
  firstName: string;
  dateOfBirth: string; // ISO date string "YYYY-MM-DD"
  // spreadType is intentionally absent: v1 is always a three-card spread.
  // If additional spread types are added in a future version, this parameter
  // will be re-introduced with full engine support at that time.
}

export interface GenerateReadingResult {
  session: ReadingSession;
}

/**
 * Generates a complete tarot reading session.
 *
 * - Card selection is fully random and system-controlled.
 * - Name and DOB do NOT influence which cards are drawn.
 * - DOB is used only for zodiac sign derivation and personalization copy.
 * - v1 always uses the three-card (Past · Present · Future) spread.
 */
export function generateReading(options: GenerateReadingOptions): GenerateReadingResult {
  const { firstName, dateOfBirth } = options;

  // Zodiac — for display and interpretation overlay only, not for card selection
  const zodiac = getZodiacSign(dateOfBirth);

  // Card draw — completely independent of user input
  const spread = THREE_CARD_SPREAD;
  const deck = getTarotDeck();
  const selectedCards = sampleWithoutReplacement(deck, spread.positions.length);

  const drawnCards: DrawnCard[] = selectedCards.map((card, index) => {
    const position = spread.positions[index];
    const isReversed = randomBoolean();
    const interpretation = generateInterpretation({
      card,
      position,
      isReversed,
      zodiacSign: zodiac.sign,
      firstName,
    });

    return {
      card,
      position,
      isReversed,
      interpretation,
    };
  });

  const { summary, energyTheme, zodiacNote } = generateSessionSummary({
    firstName,
    zodiac,
    cards: drawnCards,
  });

  const session: ReadingSession = {
    id: generateSessionId(),
    firstName,
    dateOfBirth,
    zodiacSign: zodiac.sign,
    zodiacSymbol: zodiac.symbol,
    zodiacElement: zodiac.element,
    spreadType: 'three-card',
    cards: drawnCards,
    summary,
    energyTheme,
    zodiacNote,
    createdAt: new Date().toISOString(),
  };

  return { session };
}

function generateSessionId(): string {
  if (typeof globalThis?.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for environments that don't support randomUUID
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}
