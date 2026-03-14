/**
 * Minimal recommendation engine for Tarot AI Phase 2.
 *
 * Scores offers based on zodiacSign, energyTheme, and card signals.
 * Returns the top N offers as RecommendedOffer records to persist
 * with the reading session.
 *
 * Rules are intentionally transparent and not manipulative:
 * each recommendation includes a visible reason string.
 */

import type { DrawnCard } from '@/lib/tarot/tarot-types';
import { OFFERS } from '@/lib/copy/offer-copy';
import type { RecommendedOffer } from '@/services/tarot-service';

export interface RecommendationInput {
  zodiacSign: string;
  energyTheme: string;
  cards: DrawnCard[];
}

// ─── Offer scoring rules ──────────────────────────────────────────────────────

// Signs that resonate strongly with deep introspective readings
const INTROSPECTIVE_SIGNS = new Set([
  'Scorpio', 'Pisces', 'Cancer', 'Virgo', 'Capricorn',
]);

// Signs that tend toward relationship-oriented themes
const RELATIONSHIP_SIGNS = new Set([
  'Libra', 'Taurus', 'Gemini', 'Leo',
]);

// Energy theme keywords that suggest transformation / shadow work
const TRANSFORMATION_THEMES = [
  'transformation', 'release', 'liberation', 'integration',
  'shadow', 'emergence', 'wholeness',
];

// Energy theme keywords that suggest clarity / action
const ACTION_THEMES = [
  'clarity', 'action', 'courage', 'alignment', 'purpose', 'expansion',
];

function matchesTheme(energyTheme: string, keywords: string[]): boolean {
  const lower = energyTheme.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function hasMajorArcana(cards: DrawnCard[]): boolean {
  return cards.some((c) => c.card.arcana === 'MAJOR');
}

function hasSuit(cards: DrawnCard[], suit: string): boolean {
  return cards.some((c) => c.card.suit === suit);
}

/**
 * Returns up to 5 scored offer recommendations for the reading session.
 * Scoring is additive; ties broken by offer list order.
 */
export function buildRecommendations(input: RecommendationInput): RecommendedOffer[] {
  const { zodiacSign, energyTheme, cards } = input;

  const scored = OFFERS.map((offer) => {
    let score = 1.0;
    let reason = 'A curated offering to support your current path.';

    if (offer.id === 'premium-chart') {
      if (INTROSPECTIVE_SIGNS.has(zodiacSign)) {
        score += 0.5;
        reason = `As a ${zodiacSign}, a complete soul chart reveals the deeper patterns of your nature.`;
      }
      if (hasMajorArcana(cards)) {
        score += 0.3;
        reason = `The major arcana in your spread suggest larger life themes — a soul chart can illuminate these fully.`;
      }
    }

    if (offer.id === 'compatibility') {
      if (RELATIONSHIP_SIGNS.has(zodiacSign)) {
        score += 0.5;
        reason = `${zodiacSign} energy often centers on connection — a compatibility reading can bring clarity to important bonds.`;
      }
      if (hasSuit(cards, 'Cups')) {
        score += 0.3;
        reason = 'The Cups suit in your spread points to emotional themes — a compatibility reading may offer powerful insight.';
      }
    }

    if (offer.id === 'candle-kit') {
      if (matchesTheme(energyTheme, TRANSFORMATION_THEMES)) {
        score += 0.4;
        reason = `Your reading's theme of ${energyTheme.toLowerCase()} is well supported by intentional ritual practice.`;
      }
    }

    if (offer.id === 'chakra-guide') {
      if (matchesTheme(energyTheme, TRANSFORMATION_THEMES)) {
        score += 0.4;
        reason = 'The energies in your spread suggest value in an energetic reset and alignment practice.';
      }
      if (hasSuit(cards, 'Wands') || hasSuit(cards, 'Swords')) {
        score += 0.2;
        reason = 'Fire and Air energies in your spread can benefit from a grounding chakra alignment practice.';
      }
    }

    if (offer.id === 'cosmic-forecast') {
      if (matchesTheme(energyTheme, ACTION_THEMES)) {
        score += 0.4;
        reason = `Your ${energyTheme.toLowerCase()} theme suggests this is an active period — a monthly forecast helps you navigate it consciously.`;
      }
    }

    return { offerId: offer.id, reason, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
