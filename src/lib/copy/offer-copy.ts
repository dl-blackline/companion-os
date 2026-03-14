export interface OfferItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  ctaLabel: string;
  category: 'reading' | 'product' | 'subscription';
  badge?: string;
}

export const OFFERS: OfferItem[] = [
  {
    id: 'premium-chart',
    title: 'Your Complete Soul Chart',
    subtitle: 'A 12-page written reading',
    description:
      'Receive a deeply personalized written interpretation of your full natal chart — blending tarot archetypes, zodiac insights, and elemental themes into a single beautifully formatted document.',
    price: '$27',
    ctaLabel: 'Unlock My Chart',
    category: 'reading',
    badge: 'Most Popular',
  },
  {
    id: 'compatibility',
    title: 'Compatibility Reading',
    subtitle: 'Two paths, one spread',
    description:
      'Explore the energetic dynamic between you and someone significant. This reading examines your combined elemental natures, complementary strengths, and the growth edge your connection offers.',
    price: '$19',
    ctaLabel: 'Explore the Connection',
    category: 'reading',
  },
  {
    id: 'candle-kit',
    title: 'Ritual Candle Set',
    subtitle: 'Curated for your sign',
    description:
      'A hand-poured soy candle trio selected for your elemental nature, infused with botanical notes chosen for clarity, protection, and intentional living. Arrives with a brief ritual guide.',
    price: '$44',
    ctaLabel: 'Claim My Set',
    category: 'product',
  },
  {
    id: 'chakra-guide',
    title: 'Chakra Alignment Guide',
    subtitle: 'Energy body reset',
    description:
      'A beautiful digital guide mapping your tarot spread results onto your energetic body — with targeted breathwork, affirmations, and gentle movement practices for each chakra.',
    price: '$12',
    ctaLabel: 'Begin Alignment',
    category: 'product',
  },
  {
    id: 'cosmic-forecast',
    title: 'Monthly Cosmic Forecast',
    subtitle: 'Your personalized lunar guide',
    description:
      'Each month, receive a beautifully composed written forecast weaving together your zodiac sign, current planetary transits, and a curated two-card pull — delivered to your inbox on the new moon.',
    price: '$9/mo',
    ctaLabel: 'Subscribe to the Cosmos',
    category: 'subscription',
    badge: 'New',
  },
];
