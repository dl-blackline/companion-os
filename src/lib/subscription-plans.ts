import type { EntitlementPlan } from '@/types';

export interface PlanDescriptor {
  id: EntitlementPlan;
  name: string;
  tagline: string;
  monthlyPrice: string;
  featured: boolean;
  highlights: string[];
}

export const PLAN_DESCRIPTORS: Record<EntitlementPlan, PlanDescriptor> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Core companion experience',
    monthlyPrice: '$0',
    featured: false,
    highlights: [
      'Chat, live talk, memory, and core settings',
      'Starter model access for daily use',
      'Built-in upgrade prompts for premium workflows',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Power workflows and automation',
    monthlyPrice: '$29',
    featured: true,
    highlights: [
      'Autonomous agent workflows',
      'Advanced model routing and controls',
      'Priority runtime capacity',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Governance and scale',
    monthlyPrice: '$199',
    featured: false,
    highlights: [
      'Enterprise policy controls',
      'Higher usage ceilings and support SLA',
      'Expanded admin governance tooling',
    ],
  },
  admin_override: {
    id: 'admin_override',
    name: 'Admin Override',
    tagline: 'Manual admin grant',
    monthlyPrice: 'N/A',
    featured: false,
    highlights: [
      'Bypass billing controls',
      'Reserved for operational admin actions',
      'Not customer-purchasable',
    ],
  },
};

export function isPaidPlan(plan: EntitlementPlan): boolean {
  return plan === 'pro' || plan === 'enterprise' || plan === 'admin_override';
}

export function canUseAgents(plan: EntitlementPlan): boolean {
  return isPaidPlan(plan);
}
