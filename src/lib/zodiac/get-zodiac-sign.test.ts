import { describe, it, expect } from 'vitest';
import { getZodiacSign } from '@/lib/zodiac/get-zodiac-sign';

describe('getZodiacSign', () => {
  // ── Happy path: one date per sign ────────────────────────────────────────────
  const cases = [
    // Sign, sampleDate, expected sign
    ['Capricorn', '1990-01-10', 'Capricorn'],  // Jan 10
    ['Capricorn', '1990-12-25', 'Capricorn'],  // Dec 25 (year-crossing)
    ['Aquarius',  '1990-02-05', 'Aquarius'],
    ['Pisces',    '1990-03-10', 'Pisces'],
    ['Aries',     '1990-04-01', 'Aries'],
    ['Taurus',    '1990-05-01', 'Taurus'],
    ['Gemini',    '1990-06-01', 'Gemini'],
    ['Cancer',    '1990-07-01', 'Cancer'],
    ['Leo',       '1990-08-01', 'Leo'],
    ['Virgo',     '1990-09-01', 'Virgo'],
    ['Libra',     '1990-10-01', 'Libra'],
    ['Scorpio',   '1990-11-01', 'Scorpio'],
    ['Sagittarius','1990-12-01', 'Sagittarius'],
  ] as const;

  cases.forEach(([, dob, expectedSign]) => {
    it(`returns ${expectedSign} for ${dob}`, () => {
      const result = getZodiacSign(dob);
      expect(result.sign).toBe(expectedSign);
    });
  });

  // ── Cusp boundaries ───────────────────────────────────────────────────────────

  it('returns Aries for March 21 (start of Aries)', () => {
    expect(getZodiacSign('2000-03-21').sign).toBe('Aries');
  });

  it('returns Pisces for March 20 (end of Pisces)', () => {
    expect(getZodiacSign('2000-03-20').sign).toBe('Pisces');
  });

  it('returns Capricorn for December 22 (start of Capricorn)', () => {
    expect(getZodiacSign('2000-12-22').sign).toBe('Capricorn');
  });

  it('returns Sagittarius for December 21 (end of Sagittarius)', () => {
    expect(getZodiacSign('2000-12-21').sign).toBe('Sagittarius');
  });

  // ── Return shape ──────────────────────────────────────────────────────────────

  it('returns the expected ZodiacResult shape', () => {
    const result = getZodiacSign('1990-06-15');
    expect(result).toMatchObject({
      sign: expect.any(String),
      symbol: expect.any(String),
      element: expect.stringMatching(/^(Fire|Earth|Air|Water)$/),
      modality: expect.stringMatching(/^(Cardinal|Fixed|Mutable)$/),
      dateLabel: expect.any(String),
      traits: expect.arrayContaining([expect.any(String)]),
      rulingPlanet: expect.any(String),
      reflection: expect.any(String),
    });
  });

  // ── Date object input ─────────────────────────────────────────────────────────

  it('accepts a Date object as input', () => {
    const result = getZodiacSign(new Date('1985-11-15'));
    expect(result.sign).toBe('Scorpio');
  });

  // ── Invalid input ─────────────────────────────────────────────────────────────

  it('throws for an invalid date string', () => {
    expect(() => getZodiacSign('not-a-date')).toThrow('Invalid date of birth provided');
  });

  // ── Element associations ──────────────────────────────────────────────────────

  it('returns Fire element for Aries', () => {
    expect(getZodiacSign('2000-04-01').element).toBe('Fire');
  });

  it('returns Water element for Pisces', () => {
    expect(getZodiacSign('2000-03-01').element).toBe('Water');
  });

  it('returns Earth element for Taurus', () => {
    expect(getZodiacSign('2000-05-01').element).toBe('Earth');
  });

  it('returns Air element for Gemini', () => {
    expect(getZodiacSign('2000-06-01').element).toBe('Air');
  });
});
