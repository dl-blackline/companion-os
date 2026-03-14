import type { TarotCardData, DrawnCard, SpreadPosition } from './tarot-types';
import type { ZodiacResult } from '@/lib/zodiac/get-zodiac-sign';

// ─── Card Interpretation ──────────────────────────────────────────────────────

export interface InterpretationOptions {
  card: TarotCardData;
  position: SpreadPosition;
  isReversed: boolean;
  zodiacSign: string;
  firstName: string;
}

const POSITION_OPENERS: Record<string, string[]> = {
  Past: [
    'The energies that shaped your path carried',
    'In the realm of what has been, there lies',
    'Your past holds the signature of',
    'The foundation of this moment was forged through',
    'Beneath the ground you stand on, you will find',
    'Looking back with clear eyes, what emerges is',
  ],
  Present: [
    'The currents moving through your life right now speak of',
    'In this very moment, you are navigating the energy of',
    'Your present state carries the unmistakable vibration of',
    'The living force in your current experience is',
    'What you are being asked to meet directly is',
    'The dominant energy surrounding you now is',
  ],
  Future: [
    'The horizon opens toward',
    'The energy taking shape ahead of you suggests',
    'What is being called into being carries the quality of',
    'The path unfolding before you holds the promise of',
    'If you continue to align with your highest truth, you move toward',
    'The current of possibility flowing toward you carries',
  ],
};

const REVERSED_QUALIFIERS = [
  'though its full expression may be temporarily obscured',
  'though this energy is asking for deeper integration before it fully blooms',
  'though its gifts may require you to first release what no longer serves',
  'though the path to its fullest expression asks for inner work first',
  'though the invitation here is to look within before reaching outward',
  'though resistance to this energy may be part of the lesson itself',
];

const CLOSING_REFLECTIONS = [
  'Trust what resonates most deeply.',
  'Let this image sit with you.',
  'Notice what stirs beneath the surface.',
  'What arises as you hold this card is your truest signal.',
  'Breathe into this energy rather than rushing past it.',
];

const ZODIAC_OVERLAYS: Record<string, string> = {
  Aries: 'As an Aries, this energy challenges you to act with courageous conviction.',
  Taurus: 'As a Taurus, this energy invites you to ground and embody what you know.',
  Gemini: 'As a Gemini, this energy asks you to explore its many facets with curiosity.',
  Cancer: 'As a Cancer, this energy resonates deeply with your intuitive, feeling nature.',
  Leo: 'As a Leo, this energy calls you to express it boldly and authentically.',
  Virgo: 'As a Virgo, this energy is refined through your discerning, devoted attention.',
  Libra: 'As a Libra, this energy invites you to find its harmony and elegant balance.',
  Scorpio: 'As a Scorpio, this energy speaks to the transformative depths you know well.',
  Sagittarius: 'As a Sagittarius, this energy points toward the horizon you are always seeking.',
  Capricorn: 'As a Capricorn, this energy asks you to build with it wisely and patiently.',
  Aquarius: 'As an Aquarius, this energy gains power when you apply it in service of the collective.',
  Pisces: 'As a Pisces, this energy flows naturally through your deep, mystical perception.',
};

function pickFrom<T>(arr: T[]): T {
  if (typeof globalThis?.crypto?.getRandomValues === 'function') {
    const bytes = new Uint32Array(1);
    const maxUnbiased = Math.floor(0x100000000 / arr.length) * arr.length;
    let value: number;
    do {
      globalThis.crypto.getRandomValues(bytes);
      value = bytes[0];
    } while (value >= maxUnbiased);
    return arr[value % arr.length];
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a mystical but grounded interpretation for a single drawn card.
 * This is deterministic template logic; the interface allows future LLM integration.
 */
export function generateInterpretation(opts: InterpretationOptions): string {
  const { card, position, isReversed, zodiacSign, firstName } = opts;
  const meaning = isReversed ? card.reversedMeaning : card.uprightMeaning;
  const openers = POSITION_OPENERS[position.label] ?? POSITION_OPENERS['Present'];
  const opener = pickFrom(openers);
  const qualifier = isReversed ? ` — ${pickFrom(REVERSED_QUALIFIERS)}` : '';
  const zodiacOverlay = ZODIAC_OVERLAYS[zodiacSign] ?? '';
  const closing = pickFrom(CLOSING_REFLECTIONS);

  return [
    `${firstName}, ${opener.toLowerCase()} ${card.name}${isReversed ? ' (reversed)' : ''}.`,
    `${meaning}${qualifier}.`,
    zodiacOverlay,
    closing,
  ]
    .filter(Boolean)
    .join(' ');
}

// ─── Session Summary ──────────────────────────────────────────────────────────

export interface SessionSummaryOptions {
  firstName: string;
  zodiac: ZodiacResult;
  cards: DrawnCard[];
}

export interface SessionSummary {
  summary: string;
  energyTheme: string;
  zodiacNote: string;
}

const ENERGY_THEMES: string[] = [
  'Transformation & Emergence',
  'Clarity & Decisive Action',
  'Inner Wisdom & Reflection',
  'Renewal & New Beginnings',
  'Release & Liberation',
  'Expansion & Abundance',
  'Integration & Wholeness',
  'Courage & Authentic Expression',
  'Patience & Deepening',
  'Alignment & Purpose',
  'Illumination & Truth',
  'Surrender & Trust',
  'Boundaries & Self-Sovereignty',
  'Creativity & Flow',
  'Healing & Restoration',
];

const SUMMARY_THREADS = [
  'The thread connecting these three cards is one of',
  'A single current runs through this spread — it speaks of',
  'Taken together, your cards weave a story of',
  'The overarching energy of this reading points toward',
  'What your spread reveals, at its deepest level, is a call toward',
  'The three voices in this reading converge around a single truth:',
];

const CLOSING_LINES = [
  'Allow yourself to sit with these images and meanings. What resonates most deeply is often the message meant most directly for you.',
  'The wisdom here is not abstract — it is specific to this moment in your journey. Trust what stirs in you as you reflect.',
  'These three cards do not predict a fixed outcome. They illuminate the living field of possibilities available to you now.',
  'Hold these insights lightly, but don\'t dismiss what rings true. Your inner knowing will do the rest.',
  'The card that unsettles you most often holds the most direct mirror. Approach it with openness rather than resistance.',
];

export function generateSessionSummary(opts: SessionSummaryOptions): SessionSummary {
  const { firstName, zodiac, cards } = opts;

  const cardNames = cards.map((c) => c.card.name).join(', ');
  const energyTheme = pickFrom(ENERGY_THEMES);
  const summaryThread = pickFrom(SUMMARY_THREADS);
  const closing = pickFrom(CLOSING_LINES);

  const summary = [
    `${firstName}, the cards have spoken. ${summaryThread} ${energyTheme.toLowerCase()}.`,
    `Through ${cardNames}, a coherent picture emerges — one that honors where you have been, acknowledges the truth of where you stand, and gently illuminates the direction your spirit is being called.`,
    closing,
  ].join(' ');

  const zodiacNote = [
    `As a ${zodiac.sign} — a ${zodiac.element} sign of ${zodiac.modality} quality ruled by ${zodiac.rulingPlanet} —`,
    `this spread carries particular resonance.`,
    zodiac.reflection,
  ].join(' ');

  return { summary, energyTheme, zodiacNote };
}
