export type AutomotiveDealType = 'retail' | 'lease' | 'balloon' | 'business' | 'commercial';

export type AutomotiveDealStatus =
  | 'lead_received'
  | 'intake'
  | 'docs_pending'
  | 'docs_under_review'
  | 'document_review'
  | 'structure_in_progress'
  | 'structure_analysis'
  | 'callback_received'
  | 'callback_interpreted'
  | 'menu_ready'
  | 'presented'
  | 'submitted'
  | 'booked'
  | 'funded'
  | 'cit_hold'
  | 'issue_open'
  | 'cancelled'
  | 'archived';

export type AutomotiveReviewSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AutomotiveDeal {
  id: string;
  user_id: string;
  deal_name: string;
  deal_type: AutomotiveDealType;
  status: AutomotiveDealStatus;
  source_channel: string | null;
  customer_payment_target: number | null;
  assigned_manager?: string | null;
  assigned_user_id?: string | null;
  store_reference?: string | null;
  store_id?: string | null;
  lead_source?: string | null;
  lender_id?: string | null;
  lender_name?: string | null;
  vehicle_summary?: string | null;
  callback_status?: string | null;
  callback_count?: number;
  open_flag_count?: number;
  issue_count?: number;
  has_open_cit?: boolean;
  menu_status?: 'not_started' | 'draft' | 'presented' | 'acknowledged';
  structure_pressure_score?: number | null;
  approval_readiness_score?: number | null;
  payment_estimate?: number | null;
  file_summary?: string | null;
  last_activity_at?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveDealStructure {
  id: string;
  deal_id: string;
  selling_price: number;
  cash_down: number;
  rebates: number;
  trade_allowance: number;
  trade_payoff: number;
  amount_financed: number;
  term_months: number;
  apr_percent: number;
  payment_estimate: number;
  backend_total: number;
  ttl_fees: number;
  collateral_value_basis: string | null;
  collateral_value: number;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveReviewFlag {
  id: string;
  deal_id: string;
  category: string;
  severity: AutomotiveReviewSeverity;
  status: 'open' | 'resolved';
  message: string;
  recommended_action: string | null;
  created_at: string;
}

export interface AutomotiveFiProduct {
  id: string;
  name: string;
  category: string;
  provider: string | null;
  cost: number;
  sell_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveMenuPresentation {
  id: string;
  deal_id: string;
  title: string;
  status: 'draft' | 'presented' | 'acknowledged';
  menu_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  presented_at: string | null;
}

export interface AutomotiveDashboardDocument {
  id: string;
  deal_id: string;
  document_type: string | null;
  filename: string | null;
  document_status: string;
  confidence_score: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AutomotiveDashboardSummary {
  totalDeals: number;
  openFlags: number;
  dealsReadyForMenu: number;
  dealsInCit: number;
  dealsNeedingDocs: number;
  callbacksWaiting: number;
  bookedNotFunded: number;
  cancellationRequests: number;
  customerIssues: number;
  commissionsPending: number;
}

export interface AutomotiveFinanceDashboard {
  summary: AutomotiveDashboardSummary;
  deals: AutomotiveDeal[];
  recentFlags: AutomotiveReviewFlag[];
  products: AutomotiveFiProduct[];
  presentations: AutomotiveMenuPresentation[];
  recentDocuments: AutomotiveDashboardDocument[];
}
