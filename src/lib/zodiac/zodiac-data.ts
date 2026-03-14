export interface ZodiacSign {
  sign: string;
  symbol: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  dateLabel: string;
  traits: string[];
  rulingPlanet: string;
  reflection: string;
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  {
    sign: 'Capricorn',
    symbol: '♑',
    element: 'Earth',
    modality: 'Cardinal',
    startMonth: 12,
    startDay: 22,
    endMonth: 1,
    endDay: 19,
    dateLabel: 'December 22 – January 19',
    traits: ['ambitious', 'disciplined', 'patient', 'pragmatic'],
    rulingPlanet: 'Saturn',
    reflection:
      'Your pragmatic spirit grounds the cosmos in tangible wisdom.',
  },
  {
    sign: 'Aquarius',
    symbol: '♒',
    element: 'Air',
    modality: 'Fixed',
    startMonth: 1,
    startDay: 20,
    endMonth: 2,
    endDay: 18,
    dateLabel: 'January 20 – February 18',
    traits: ['innovative', 'humanitarian', 'independent', 'visionary'],
    rulingPlanet: 'Uranus',
    reflection:
      'Your visionary mind perceives connections others have yet to imagine.',
  },
  {
    sign: 'Pisces',
    symbol: '♓',
    element: 'Water',
    modality: 'Mutable',
    startMonth: 2,
    startDay: 19,
    endMonth: 3,
    endDay: 20,
    dateLabel: 'February 19 – March 20',
    traits: ['intuitive', 'empathetic', 'artistic', 'mystical'],
    rulingPlanet: 'Neptune',
    reflection:
      'Your deep intuition flows like water through the hidden channels of the spirit.',
  },
  {
    sign: 'Aries',
    symbol: '♈',
    element: 'Fire',
    modality: 'Cardinal',
    startMonth: 3,
    startDay: 21,
    endMonth: 4,
    endDay: 19,
    dateLabel: 'March 21 – April 19',
    traits: ['courageous', 'energetic', 'pioneering', 'assertive'],
    rulingPlanet: 'Mars',
    reflection:
      'Your pioneering fire ignites the first spark of every new beginning.',
  },
  {
    sign: 'Taurus',
    symbol: '♉',
    element: 'Earth',
    modality: 'Fixed',
    startMonth: 4,
    startDay: 20,
    endMonth: 5,
    endDay: 20,
    dateLabel: 'April 20 – May 20',
    traits: ['reliable', 'patient', 'sensual', 'devoted'],
    rulingPlanet: 'Venus',
    reflection:
      'Your steadfast presence anchors beauty and abundance in the material world.',
  },
  {
    sign: 'Gemini',
    symbol: '♊',
    element: 'Air',
    modality: 'Mutable',
    startMonth: 5,
    startDay: 21,
    endMonth: 6,
    endDay: 20,
    dateLabel: 'May 21 – June 20',
    traits: ['curious', 'adaptable', 'expressive', 'witty'],
    rulingPlanet: 'Mercury',
    reflection:
      'Your quicksilver mind weaves threads of thought into living tapestries.',
  },
  {
    sign: 'Cancer',
    symbol: '♋',
    element: 'Water',
    modality: 'Cardinal',
    startMonth: 6,
    startDay: 21,
    endMonth: 7,
    endDay: 22,
    dateLabel: 'June 21 – July 22',
    traits: ['nurturing', 'intuitive', 'protective', 'empathetic'],
    rulingPlanet: 'Moon',
    reflection:
      'Your tender heart holds the tides of emotion with quiet, lunar grace.',
  },
  {
    sign: 'Leo',
    symbol: '♌',
    element: 'Fire',
    modality: 'Fixed',
    startMonth: 7,
    startDay: 23,
    endMonth: 8,
    endDay: 22,
    dateLabel: 'July 23 – August 22',
    traits: ['charismatic', 'generous', 'creative', 'regal'],
    rulingPlanet: 'Sun',
    reflection:
      'Your radiant spirit illuminates every room with sovereign warmth.',
  },
  {
    sign: 'Virgo',
    symbol: '♍',
    element: 'Earth',
    modality: 'Mutable',
    startMonth: 8,
    startDay: 23,
    endMonth: 9,
    endDay: 22,
    dateLabel: 'August 23 – September 22',
    traits: ['analytical', 'precise', 'devoted', 'perceptive'],
    rulingPlanet: 'Mercury',
    reflection:
      'Your discerning eye reveals the sacred pattern within the smallest detail.',
  },
  {
    sign: 'Libra',
    symbol: '♎',
    element: 'Air',
    modality: 'Cardinal',
    startMonth: 9,
    startDay: 23,
    endMonth: 10,
    endDay: 22,
    dateLabel: 'September 23 – October 22',
    traits: ['diplomatic', 'harmonious', 'aesthetic', 'balanced'],
    rulingPlanet: 'Venus',
    reflection:
      'Your graceful equilibrium seeks beauty and justice in equal measure.',
  },
  {
    sign: 'Scorpio',
    symbol: '♏',
    element: 'Water',
    modality: 'Fixed',
    startMonth: 10,
    startDay: 23,
    endMonth: 11,
    endDay: 21,
    dateLabel: 'October 23 – November 21',
    traits: ['intense', 'perceptive', 'transformative', 'magnetic'],
    rulingPlanet: 'Pluto',
    reflection:
      'Your penetrating gaze peers beyond the veil into the core of every mystery.',
  },
  {
    sign: 'Sagittarius',
    symbol: '♐',
    element: 'Fire',
    modality: 'Mutable',
    startMonth: 11,
    startDay: 22,
    endMonth: 12,
    endDay: 21,
    dateLabel: 'November 22 – December 21',
    traits: ['adventurous', 'philosophical', 'optimistic', 'free-spirited'],
    rulingPlanet: 'Jupiter',
    reflection:
      'Your arrow of intention flies toward horizons most dare only to dream of.',
  },
];
