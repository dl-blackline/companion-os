export interface FinancialHealthMetrics {
  income30d: number;
  expenses30d: number;
  netCashFlow30d: number;
  savingsRate: number;
  liquidityDays: number;
  totalBalance: number;
}

export interface FinancialPulse {
  score: number;
  trend: 'improving' | 'tightening';
  narrative: string;
  metrics: FinancialHealthMetrics;
  lastEvaluatedAt: string;
}

export interface FinancialConnection {
  id: string;
  provider: 'plaid';
  institution_name: string | null;
  status: 'connected' | 'error' | 'disconnected';
  last_sync_at: string | null;
  error_message: string | null;
}

export interface FinancialAccount {
  id: string;
  connection_id: string;
  name: string | null;
  official_name: string | null;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  iso_currency_code: string | null;
}

export interface FinancialTransaction {
  id: string;
  account_id: string;
  name: string | null;
  merchant_name: string | null;
  amount: number;
  iso_currency_code: string | null;
  category: string[];
  pending: boolean;
  transaction_date: string | null;
}

export interface FinancialSummary {
  configured: boolean;
  connected: boolean;
  connections: FinancialConnection[];
  accounts: FinancialAccount[];
  transactions: FinancialTransaction[];
  pulse: FinancialPulse;
}
