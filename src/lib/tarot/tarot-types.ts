// ─── Core Tarot Types ─────────────────────────────────────────────────────────

export type Arcana = 'MAJOR' | 'MINOR';
export type Suit = 'Cups' | 'Swords' | 'Wands' | 'Pentacles' | null;

export interface TarotCardData {
  id: string;           // slug, e.g. "the-fool"
  name: string;
  arcana: Arcana;
  suit: Suit;
  numeralIndex: number; // 0–77
  uprightMeaning: string;
  reversedMeaning: string;
  uprightKeywords: string[];
  reversedKeywords: string[];
  element?: string;
  astrologicalCorrespondence?: string;
  symbolism?: string;
  imageUrl?: string;
}

// ─── Spread Types ─────────────────────────────────────────────────────────────

export type SpreadType = 'three-card';

export interface SpreadPosition {
  index: number;
  label: string;        // "Past", "Present", "Future"
  description: string;  // context for the position
}

export interface SpreadDefinition {
  type: SpreadType;
  name: string;
  positions: SpreadPosition[];
  description: string;
}

// ─── Reading Types ────────────────────────────────────────────────────────────

export interface DrawnCard {
  card: TarotCardData;
  position: SpreadPosition;
  isReversed: boolean;
  interpretation: string;
}

export interface ReadingSession {
  id: string;
  firstName: string;
  dateOfBirth: string;  // ISO date string
  zodiacSign: string;
  zodiacSymbol: string;
  zodiacElement: string;
  spreadType: SpreadType;
  cards: DrawnCard[];
  summary: string;
  energyTheme: string;
  zodiacNote: string;
  createdAt: string;
}

// ─── Intake Form Types ────────────────────────────────────────────────────────

export interface IntakeFormValues {
  firstName: string;
  dateOfBirth: string; // YYYY-MM-DD
}
