import { ZODIAC_SIGNS, type ZodiacSign } from './zodiac-data';

export interface ZodiacResult {
  sign: string;
  symbol: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  dateLabel: string;
  traits: string[];
  rulingPlanet: string;
  reflection: string;
}

/**
 * Derives the Western zodiac sign from a date of birth.
 *
 * @param dob - Date of birth as a Date object or ISO date string (YYYY-MM-DD)
 * @returns ZodiacResult with sign, element, modality and personalization data
 * @throws Error if the dob is invalid
 */
export function getZodiacSign(dob: Date | string): ZodiacResult {
  const date = typeof dob === 'string' ? new Date(dob) : dob;

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date of birth provided');
  }

  // Use UTC values to avoid timezone-shifted month/day mismatches
  const month = date.getUTCMonth() + 1; // 1–12
  const day = date.getUTCDate();

  const matched = findZodiacSign(month, day);

  const result: ZodiacResult = {
    sign: matched.sign,
    symbol: matched.symbol,
    element: matched.element,
    modality: matched.modality,
    dateLabel: matched.dateLabel,
    traits: matched.traits,
    rulingPlanet: matched.rulingPlanet,
    reflection: matched.reflection,
  };

  return result;
}

/** Internal helper: find the correct ZodiacSign entry for a given month/day */
function findZodiacSign(month: number, day: number): ZodiacSign {
  for (const zodiac of ZODIAC_SIGNS) {
    const { startMonth, startDay, endMonth, endDay } = zodiac;

    if (startMonth < endMonth) {
      // Same-year range (e.g. Aries: Mar 21 – Apr 19)
      if (
        (month === startMonth && day >= startDay) ||
        (month === endMonth && day <= endDay) ||
        (month > startMonth && month < endMonth)
      ) {
        return zodiac;
      }
    } else {
      // Year-crossing range (Capricorn: Dec 22 – Jan 19)
      if (
        (month === startMonth && day >= startDay) ||
        (month === endMonth && day <= endDay) ||
        month > startMonth ||
        month < endMonth
      ) {
        return zodiac;
      }
    }
  }

  // Fallback — should never reach here for valid dates
  return ZODIAC_SIGNS[0];
}
