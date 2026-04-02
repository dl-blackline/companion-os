// ── Bill Decoder Types ──────────────────────────────────────────────────────

export type BillType =
  | 'credit_card'
  | 'utility'
  | 'insurance'
  | 'loan'
  | 'phone_internet'
  | 'rent_mortgage'
  | 'medical'
  | 'subscription'
  | 'other';

export type BillReviewStatus = 'pending_review' | 'confirmed' | 'rejected' | 'merged';

export interface DecodedBill {
  id: string;
  user_id: string;
  document_id: string | null;
  extraction_id: string | null;
  bill_type: BillType;
  provider_name: string | null;
  account_name: string | null;
  masked_account_number: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  issue_date: string | null;
  due_date: string | null;
  total_due: number | null;
  minimum_due: number | null;
  current_balance: number | null;
  statement_balance: number | null;
  past_due_amount: number | null;
  late_fee: number | null;
  credit_limit: number | null;
  autopay_detected: boolean;
  is_recurring_candidate: boolean;
  extraction_confidence: number;
  field_confidence: Record<string, number>;
  review_status: BillReviewStatus;
  confirmed_fields: Record<string, unknown>;
  linked_obligation_id: string | null;
  decoded_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillDecoderDashboard {
  bills: DecodedBill[];
  pendingReviewCount: number;
  confirmedCount: number;
  rejectedCount: number;
  mergedCount: number;
}

// ── Vehicle Equity Types ────────────────────────────────────────────────────

export type VehicleCondition = 'excellent' | 'good' | 'fair' | 'poor';
export type VehicleStatus = 'active' | 'sold' | 'traded';

export interface UserVehicle {
  id: string;
  user_id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  mileage: number | null;
  condition: VehicleCondition;
  current_payoff: number | null;
  monthly_payment: number | null;
  lender: string | null;
  term_remaining_months: number | null;
  interest_rate: number | null;
  estimated_value: number | null;
  value_source: string;
  value_as_of: string | null;
  equity_position: number;
  status: VehicleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleEquitySnapshot {
  id: string;
  user_id: string;
  vehicle_id: string;
  estimated_value: number | null;
  payoff_balance: number | null;
  equity_position: number | null;
  value_source: string | null;
  snapshot_date: string;
  created_at: string;
}

// ── Scorecard Types ─────────────────────────────────────────────────────────

export type ScorecardLabel = 'strong' | 'stable' | 'moderate' | 'under pressure' | 'needs attention' | 'incomplete visibility';

export interface ScorecardDimension {
  score: number;
  label: ScorecardLabel;
  detail: Record<string, unknown>;
}

export interface NextAction {
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

export interface ScorecardInsight {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'positive';
  message: string;
}

export interface FinancialScorecard {
  // Dimensions
  liquidity_score: number;
  liquidity_label: ScorecardLabel;
  liquidity_detail: Record<string, unknown>;

  bill_pressure_score: number;
  bill_pressure_label: ScorecardLabel;
  bill_pressure_detail: Record<string, unknown>;

  debt_pressure_score: number;
  debt_pressure_label: ScorecardLabel;
  debt_pressure_detail: Record<string, unknown>;

  savings_health_score: number;
  savings_health_label: ScorecardLabel;
  savings_health_detail: Record<string, unknown>;

  organization_score: number;
  organization_label: ScorecardLabel;
  organization_detail: Record<string, unknown>;

  vehicle_position_score: number;
  vehicle_position_label: ScorecardLabel;
  vehicle_position_detail: Record<string, unknown>;

  // Composite
  overall_score: number;
  overall_label: ScorecardLabel;
  strongest_area: string;
  most_urgent_area: string;

  // Guidance
  next_actions: NextAction[];
  insights: ScorecardInsight[];

  computed_at?: string;
}

export interface ScorecardDashboard {
  scorecard: FinancialScorecard | null;
  vehicles: UserVehicle[];
  equitySnapshots: VehicleEquitySnapshot[];
}
