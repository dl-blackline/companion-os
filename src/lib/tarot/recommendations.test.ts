import { describe, it, expect } from 'vitest';
import { buildRecommendations } from '@/lib/tarot/recommendations';
import { generateReading } from '@/lib/tarot/reading-engine';
import { OFFERS } from '@/lib/copy/offer-copy';

const SESSION = generateReading({ firstName: 'Luna', dateOfBirth: '1990-10-28' }); // Scorpio

describe('buildRecommendations', () => {
  it('returns an array of recommendations', () => {
    const recs = buildRecommendations({
      zodiacSign: 'Scorpio',
      energyTheme: 'Transformation & Emergence',
      cards: SESSION.session.cards,
    });
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('returns at most 5 recommendations', () => {
    const recs = buildRecommendations({
      zodiacSign: 'Leo',
      energyTheme: 'Clarity & Decisive Action',
      cards: SESSION.session.cards,
    });
    expect(recs.length).toBeLessThanOrEqual(5);
  });

  it('each recommendation has offerId, reason, and score', () => {
    const recs = buildRecommendations({
      zodiacSign: 'Pisces',
      energyTheme: 'Inner Wisdom & Reflection',
      cards: SESSION.session.cards,
    });
    for (const rec of recs) {
      expect(typeof rec.offerId).toBe('string');
      expect(rec.offerId.length).toBeGreaterThan(0);
      expect(typeof rec.reason).toBe('string');
      expect(rec.reason.length).toBeGreaterThan(0);
      expect(typeof rec.score).toBe('number');
      expect(rec.score).toBeGreaterThan(0);
    }
  });

  it('results are sorted by score descending', () => {
    const recs = buildRecommendations({
      zodiacSign: 'Capricorn',
      energyTheme: 'Alignment & Purpose',
      cards: SESSION.session.cards,
    });
    for (let i = 0; i < recs.length - 1; i++) {
      expect(recs[i].score).toBeGreaterThanOrEqual(recs[i + 1].score);
    }
  });

  it('premium-chart gets a higher score for introspective signs', () => {
    const scorpio = buildRecommendations({
      zodiacSign: 'Scorpio',
      energyTheme: 'Integration & Wholeness',
      cards: SESSION.session.cards,
    });
    const aries = buildRecommendations({
      zodiacSign: 'Aries',
      energyTheme: 'Integration & Wholeness',
      cards: SESSION.session.cards,
    });
    const scorpioChart = scorpio.find((r) => r.offerId === 'premium-chart')!;
    const ariesChart = aries.find((r) => r.offerId === 'premium-chart')!;
    expect(scorpioChart.score).toBeGreaterThan(ariesChart.score);
  });

  it('compatibility gets a higher score for relationship signs', () => {
    const libra = buildRecommendations({
      zodiacSign: 'Libra',
      energyTheme: 'Alignment & Purpose',
      cards: SESSION.session.cards,
    });
    const virgo = buildRecommendations({
      zodiacSign: 'Virgo',
      energyTheme: 'Alignment & Purpose',
      cards: SESSION.session.cards,
    });
    const libraCompat = libra.find((r) => r.offerId === 'compatibility')!;
    const virgoCompat = virgo.find((r) => r.offerId === 'compatibility')!;
    expect(libraCompat.score).toBeGreaterThan(virgoCompat.score);
  });

  it('all offer IDs reference known offers', () => {
    const validIds = new Set(OFFERS.map((o) => o.id));
    const recs = buildRecommendations({
      zodiacSign: 'Gemini',
      energyTheme: 'Creativity & Flow',
      cards: SESSION.session.cards,
    });
    for (const rec of recs) {
      expect(validIds.has(rec.offerId)).toBe(true);
    }
  });
});
