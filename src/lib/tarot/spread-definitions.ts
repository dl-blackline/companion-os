import type { SpreadDefinition } from './tarot-types';

export const THREE_CARD_SPREAD: SpreadDefinition = {
  type: 'three-card',
  name: 'Past · Present · Future',
  description:
    'A timeless three-card spread that illuminates the arc of your current path — where you have been, where you stand, and where you are being called.',
  positions: [
    {
      index: 0,
      label: 'Past',
      description:
        'The energies and experiences that have shaped your current situation.',
    },
    {
      index: 1,
      label: 'Present',
      description:
        'The forces and themes active in your life at this moment.',
    },
    {
      index: 2,
      label: 'Future',
      description:
        'The likely trajectory and emerging potential if current energies continue to unfold.',
    },
  ],
};

export const SPREAD_DEFINITIONS: Record<string, SpreadDefinition> = {
  'three-card': THREE_CARD_SPREAD,
};
