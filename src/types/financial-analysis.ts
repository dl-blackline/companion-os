// ─── Phase 2: Financial Analysis Types ──────────────────────

export interface RecurringIncomeSignal {
  id: string;
  signal_name: string;
  detected_source: string | null;
  frequency: 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly' | 'irregular';
  estimated_amount: number;
  amount_variance: number;
  confidence_score: number;
  last_occurrence: string | null;
  next_expected: string | null;
  occurrence_count: number;
  sample_transaction_ids: string[];
  is_user_confirmed: boolean;
  user_label: string | null;
  status: 'detected' | 'confirmed' | 'dismissed' | 'expired';
  detected_at: string;
  confirmed_at: string | null;
}

export interface RecurringExpenseSignal {
  id: string;
  signal_name: string;
  merchant_name: string | null;
  category: string;
  frequency: 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly' | 'quarterly' | 'annual' | 'irregular';
  estimated_amount: number;
  amount_variance: number;
  confidence_score: number;
  last_occurrence: string | null;
  next_expected: string | null;
  occurrence_count: number;
  sample_transaction_ids: string[];
  is_user_confirmed: boolean;
  user_label: string | null;
  linked_obligation_id: string | null;
  status: 'detected' | 'confirmed' | 'dismissed' | 'expired';
  detected_at: string;
  confirmed_at: string | null;
}

export interface CashFlowPeriod {
  id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  total_inflow: number;
  total_outflow: number;
  net_flow: number;
  recurring_inflow: number;
  recurring_outflow: number;
  non_recurring_inflow: number;
  non_recurring_outflow: number;
  transaction_count: number;
  top_expense_categories: Array<{ category: string; total: number }>;
  largest_inflows: Array<{ name: string; amount: number; date: string }>;
  largest_outflows: Array<{ name: string; amount: number; date: string }>;
  computed_at: string;
}

export interface IncomeAnalysisSnapshot {
  id: string;
  estimated_monthly_income: number;
  detected_source_count: number;
  primary_frequency: string | null;
  confidence_score: number;
  source_breakdown: Array<{
    source: string;
    frequency: string;
    estimated_monthly: number;
    confidence: number;
  }>;
  analysis_window_start: string;
  analysis_window_end: string;
  methodology: string;
  notes: string | null;
  computed_at: string;
}

export interface BalanceSnapshot {
  id: string;
  account_id: string;
  current_balance: number | null;
  available_balance: number | null;
  iso_currency_code: string;
  snapshot_date: string;
  source: string;
}

export interface EnhancedSavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  current_amount: number;
  monthly_contribution_target: number | null;
  feasibility_score: number | null;
  pacing_status: 'on_track' | 'at_risk' | 'behind' | 'ahead' | 'unknown';
  feasibility_notes: string | null;
  estimated_monthly_capacity: number | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface AnalysisSummary {
  estimatedMonthlyIncome: number;
  estimatedMonthlyExpenses: number;
  estimatedMonthlySurplus: number;
  incomeSourceCount: number;
  recurringExpenseCount: number;
  incomeConfidence: number;
  lastAnalyzedAt: string | null;
}

export interface FinancialAnalysisDashboard {
  incomeSignals: RecurringIncomeSignal[];
  expenseSignals: RecurringExpenseSignal[];
  cashFlowPeriods: CashFlowPeriod[];
  incomeAnalysis: IncomeAnalysisSnapshot | null;
  balanceSnapshots: BalanceSnapshot[];
  goals: EnhancedSavingsGoal[];
  summary: AnalysisSummary;
}
