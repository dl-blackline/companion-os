/**
 * Shared finance utilities used across modular finance panels.
 */

export function currency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function estimateMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly': return amount * (52 / 12);
    case 'biweekly': return amount * (26 / 12);
    case 'semi_monthly': return amount * 2;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'annual': return amount / 12;
    default: return amount;
  }
}

export function confidenceLabel(score: number): string {
  if (score >= 0.8) return 'High';
  if (score >= 0.5) return 'Medium';
  if (score >= 0.3) return 'Low';
  return 'Very Low';
}

export function frequencyLabel(f: string): string {
  const map: Record<string, string> = {
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    semi_monthly: 'Semi-monthly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    annual: 'Annual',
    irregular: 'Irregular',
  };
  return map[f] || f;
}

export type ScorecardLabelType = 'strong' | 'stable' | 'moderate' | 'incomplete visibility' | 'under pressure' | 'needs attention';

export function scoreLabelVariant(label: ScorecardLabelType | string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (label === 'strong' || label === 'stable') return 'default';
  if (label === 'moderate' || label === 'incomplete visibility') return 'secondary';
  if (label === 'under pressure' || label === 'needs attention') return 'destructive';
  return 'outline';
}

export function dimensionDisplayName(name: string): string {
  const map: Record<string, string> = {
    liquidity: 'Liquidity',
    bill_pressure: 'Bill Pressure',
    debt_pressure: 'Debt Pressure',
    savings_health: 'Savings Health',
    organization: 'Organization',
    vehicle_position: 'Vehicle Position',
  };
  return map[name] || name;
}
