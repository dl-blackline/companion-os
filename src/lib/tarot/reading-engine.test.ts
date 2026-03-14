import { describe, it, expect } from 'vitest';
import { generateReading } from '@/lib/tarot/reading-engine';
import { getTarotDeck } from '@/lib/tarot/tarot-deck';

const BASE_OPTIONS = {
  firstName: 'Luna',
  dateOfBirth: '1990-06-15',
};

describe('getTarotDeck', () => {
  it('returns a non-empty deck', () => {
    const deck = getTarotDeck();
    expect(deck.length).toBeGreaterThan(0);
  });

  it('contains 22 major arcana cards', () => {
    const major = getTarotDeck().filter((c) => c.arcana === 'MAJOR');
    expect(major).toHaveLength(22);
  });

  it('all cards have required fields', () => {
    for (const card of getTarotDeck()) {
      expect(card.id).toBeTruthy();
      expect(card.name).toBeTruthy();
      expect(card.uprightMeaning).toBeTruthy();
      expect(card.reversedMeaning).toBeTruthy();
      expect(card.uprightKeywords.length).toBeGreaterThan(0);
      expect(card.reversedKeywords.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate card IDs', () => {
    const ids = getTarotDeck().map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('generateReading', () => {
  it('returns a session with the expected shape', () => {
    const { session } = generateReading(BASE_OPTIONS);

    expect(session).toMatchObject({
      id: expect.any(String),
      firstName: 'Luna',
      dateOfBirth: '1990-06-15',
      zodiacSign: expect.any(String),
      spreadType: 'three-card',
      cards: expect.any(Array),
      summary: expect.any(String),
      energyTheme: expect.any(String),
      zodiacNote: expect.any(String),
      createdAt: expect.any(String),
    });
  });

  it('draws exactly 3 cards for a three-card spread', () => {
    const { session } = generateReading(BASE_OPTIONS);
    expect(session.cards).toHaveLength(3);
  });

  it('draws unique cards (no duplicates in spread)', () => {
    const { session } = generateReading(BASE_OPTIONS);
    const ids = session.cards.map((c) => c.card.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });

  it('assigns position labels past/present/future', () => {
    const { session } = generateReading(BASE_OPTIONS);
    const labels = session.cards.map((c) => c.position.label);
    expect(labels).toEqual(['Past', 'Present', 'Future']);
  });

  it('each drawn card has an interpretation string', () => {
    const { session } = generateReading(BASE_OPTIONS);
    for (const card of session.cards) {
      expect(typeof card.interpretation).toBe('string');
      expect(card.interpretation.length).toBeGreaterThan(0);
    }
  });

  it('includes the first name in the interpretation text', () => {
    const { session } = generateReading(BASE_OPTIONS);
    // At least one card interpretation should include the first name
    const hasName = session.cards.some((c) =>
      c.interpretation.includes(BASE_OPTIONS.firstName)
    );
    expect(hasName).toBe(true);
  });

  it('derives the correct zodiac sign from DOB', () => {
    const { session } = generateReading(BASE_OPTIONS);
    expect(session.zodiacSign).toBe('Gemini'); // June 15
  });

  it('generates different spreads on subsequent calls (randomness)', () => {
    const draws1 = generateReading(BASE_OPTIONS).session.cards.map((c) => c.card.id);
    const draws2 = generateReading(BASE_OPTIONS).session.cards.map((c) => c.card.id);
    // Not strictly guaranteed to be different, but with 78 cards the probability
    // of an identical 3-card ordered draw is ~1 in 79,000 — effectively impossible.
    expect(draws1.join()).not.toBe(draws2.join());
  });

  it('throws for an invalid date of birth', () => {
    expect(() =>
      generateReading({ ...BASE_OPTIONS, dateOfBirth: 'invalid' })
    ).toThrow();
  });

  it('includes both isReversed true and false across many runs', () => {
    const reversedFlags = new Set<boolean>();
    for (let i = 0; i < 20; i++) {
      const { session } = generateReading(BASE_OPTIONS);
      session.cards.forEach((c) => reversedFlags.add(c.isReversed));
    }
    expect(reversedFlags.has(true)).toBe(true);
    expect(reversedFlags.has(false)).toBe(true);
  });
});
