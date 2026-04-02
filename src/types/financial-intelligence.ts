export type FinancialDocumentSourceType =
  | 'bank_statement'
  | 'credit_card_statement'
  | 'loan_statement'
  | 'utility_bill'
  | 'rent_mortgage'
  | 'insurance_bill'
  | 'subscription_bill'
  | 'other';

export type FinancialObligationStatus =
  | 'planned'
  | 'paid'
  | 'overdue'
  | 'skipped'
  | 'disputed'
  | 'unknown';

export type FinancialGoalPriority = 'low' | 'medium' | 'high' | 'critical';

export type FinancialGoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export type FinancialCalendarEventType =
  | 'bill_due'
  | 'payday'
  | 'savings_transfer'
  | 'debt_payment'
  | 'reminder'
  | 'custom';

export interface FinancialSnapshot {
  totalUpcomingObligations: number;
  minimumPaymentsThisMonth: number;
  totalRevolvingBalances: number;
  utilizationPercent: number;
  overdueCount: number;
  dueSoonCount: number;
  pressure7d: number;
  pressure30d: number;
}

export interface FinancialDocumentRecord {
  id: string;
  source_type: FinancialDocumentSourceType;
  filename: string;
  document_status: 'uploaded' | 'processing' | 'parsed' | 'failed' | 'archived';
  parse_confidence: number | null;
  uploaded_at: string;
  parsed_at: string | null;
}

export interface FinancialObligation {
  id: string;
  institution_name: string | null;
  account_label: string | null;
  category: string;
  due_date: string | null;
  amount_due: number | null;
  minimum_due: number | null;
  planned_payment: number | null;
  actual_payment_date: string | null;
  status: FinancialObligationStatus;
  is_recurring: boolean;
  current_balance: number | null;
  credit_limit: number | null;
  past_due_amount: number | null;
  notes: string | null;
}

export interface FinancialSavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  priority: FinancialGoalPriority;
  current_amount: number;
  monthly_contribution_target: number | null;
  recommended_contribution_rate: number | null;
  funding_rule: string | null;
  status: FinancialGoalStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialCalendarEvent {
  id: string;
  obligation_id: string | null;
  title: string;
  event_type: FinancialCalendarEventType;
  scheduled_date: string;
  amount: number | null;
  status: 'scheduled' | 'completed' | 'skipped' | 'overdue';
  reminder_offset_days: number | null;
  notes: string | null;
}

export interface FinancialInsightRecord {
  id: string;
  insight_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  summary: string;
  action_hint: string | null;
  confidence_score: number | null;
  generated_by: string;
  generated_at: string;
  dismissed_at: string | null;
}

export interface FinancialIntelligenceDashboard {
  snapshot: FinancialSnapshot;
  documents: FinancialDocumentRecord[];
  obligations: FinancialObligation[];
  goals: FinancialSavingsGoal[];
  calendarEvents: FinancialCalendarEvent[];
  insights: FinancialInsightRecord[];
}
