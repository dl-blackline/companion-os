// ── Phase 2 Automotive Finance Domain Types ───────────────────────────────
// Covers all tables added in migration 029.

// ── Lenders ───────────────────────────────────────────────────────────────
export interface AutomotiveLender {
  id: string;
  user_id: string;
  name: string;
  short_code: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  portal_url: string | null;
  notes: string | null;
  tier_system: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveLenderProgram {
  id: string;
  user_id: string;
  lender_id: string;
  program_name: string;
  deal_types: string[];
  vehicle_conditions: string[];
  min_fico: number | null;
  max_ltv_percent: number | null;
  max_advance_percent: number | null;
  max_term_months: number | null;
  max_pti_percent: number | null;
  max_dti_percent: number | null;
  max_backend_amount: number | null;
  max_backend_percent: number | null;
  reserve_flat: number | null;
  reserve_percent: number | null;
  reserve_cap_percent: number | null;
  stips_required: string[] | null;
  program_notes: string | null;
  is_active: boolean;
  effective_date: string | null;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveLenderGuideline {
  id: string;
  user_id: string;
  lender_id: string | null;
  program_id: string | null;
  document_name: string;
  document_type: 'general' | 'program_sheet' | 'rate_sheet' | 'callback_cheatsheet' | 'underwriting' | 'structure_criteria' | 'special';
  content_text: string | null;
  storage_path: string | null;
  deal_types: string[] | null;
  effective_date: string | null;
  expiration_date: string | null;
  indexed_at: string | null;
  source_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

// ── Vehicles ──────────────────────────────────────────────────────────────
export type VehicleRole = 'purchase' | 'trade';
export type VehicleCondition = 'new' | 'used' | 'certified';

export interface AutomotiveVehicle {
  id: string;
  user_id: string;
  deal_id: string;
  vehicle_role: VehicleRole;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim_level: string | null;
  mileage: number | null;
  color: string | null;
  stock_number: string | null;
  condition: VehicleCondition;
  msrp: number;
  invoice_cost: number;
  wholesale_value: number | null;
  retail_book_value: number | null;
  nada_value: number | null;
  kbb_value: number | null;
  mmr_value: number | null;
  book_value_basis: string | null;
  payoff_amount: number | null;
  payoff_lender: string | null;
  collateral_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Obligations ───────────────────────────────────────────────────────────
export type ObligationType =
  | 'mortgage'
  | 'rent'
  | 'auto_loan'
  | 'student_loan'
  | 'credit_card'
  | 'personal_loan'
  | 'child_support'
  | 'other';

export interface AutomotiveObligation {
  id: string;
  user_id: string;
  deal_id: string;
  applicant_id: string | null;
  obligation_type: ObligationType;
  creditor_name: string | null;
  monthly_payment: number;
  balance_remaining: number | null;
  account_status: 'current' | 'delinquent' | 'paid_off' | 'collection' | 'unknown';
  is_bureau_verified: boolean;
  is_paying_off: boolean;
  source: 'manual' | 'bureau' | 'document';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Callbacks ─────────────────────────────────────────────────────────────
export type CallbackStatus =
  | 'received'
  | 'normalized'
  | 'needs_review'
  | 'optioned'
  | 'structure_recommended'
  | 'resolved'
  | 'superseded';

export interface AutomotiveCallback {
  id: string;
  user_id: string;
  deal_id: string;
  lender_id: string | null;
  received_at: string;
  raw_input: string;
  normalized_data: Record<string, unknown>;
  callback_rep: string | null;
  lender_notes: string | null;
  interpreter_output: Record<string, unknown>;
  resolution_notes: string | null;
  resolved_at: string | null;
  status: CallbackStatus;
  created_at: string;
  updated_at: string;
  // Joined
  options?: AutomotiveCallbackOption[];
}

export interface AutomotiveCallbackOption {
  id: string;
  user_id: string;
  deal_id: string;
  callback_id: string;
  option_number: number;
  label: string | null;
  term_months: number | null;
  rate_percent: number | null;
  advance_percent: number | null;
  max_amount_financed: number | null;
  required_cash_down: number | null;
  max_backend_amount: number | null;
  max_backend_percent: number | null;
  stips_required: unknown[];
  pti_cap_percent: number | null;
  dti_cap_percent: number | null;
  customer_restrictions: Record<string, unknown>;
  estimated_payment: number | null;
  estimated_ltv: number | null;
  plain_english_explanation: string | null;
  comparison_notes: string | null;
  is_recommended: boolean;
  created_at: string;
  updated_at: string;
}

// ── CIT Cases ─────────────────────────────────────────────────────────────
export type CitStatus =
  | 'open'
  | 'awaiting_stips'
  | 'awaiting_customer'
  | 'awaiting_lender'
  | 'resolved'
  | 'escalated'
  | 'unfunded'
  | 'archived';

export interface AutomotiveCitCase {
  id: string;
  user_id: string;
  deal_id: string;
  status: CitStatus;
  opened_at: string;
  target_resolution_date: string | null;
  resolved_at: string | null;
  funded_amount: number | null;
  outstanding_stips: unknown[];
  lender_contact: string | null;
  escalation_reason: string | null;
  days_open: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Cancellation Cases ────────────────────────────────────────────────────
export type CancellationStatus =
  | 'requested'
  | 'pending_docs'
  | 'submitted'
  | 'confirmed'
  | 'refunded'
  | 'charged_back'
  | 'closed';

export interface AutomotiveCancellationCase {
  id: string;
  user_id: string;
  deal_id: string;
  product_id: string | null;
  status: CancellationStatus;
  cancellation_reason: string;
  cancellation_date: string | null;
  requested_at: string;
  submitted_at: string | null;
  confirmed_at: string | null;
  refund_amount: number | null;
  chargeback_amount: number | null;
  chargeback_notes: string | null;
  provider_confirmation: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Customer Issues ───────────────────────────────────────────────────────
export type IssueStatus =
  | 'open'
  | 'in_progress'
  | 'awaiting_customer'
  | 'awaiting_lender'
  | 'awaiting_dealer'
  | 'resolved'
  | 'escalated'
  | 'closed';

export interface AutomotiveCustomerIssue {
  id: string;
  user_id: string;
  deal_id: string;
  issue_type: string;
  status: IssueStatus;
  description: string;
  reported_at: string;
  target_resolution_date: string | null;
  resolution_notes: string | null;
  escalated_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── F&I Menu Templates ────────────────────────────────────────────────────
export interface AutomotiveFiMenuTemplate {
  id: string;
  user_id: string;
  template_name: string;
  deal_types: string[];
  lender_id: string | null;
  required_products: string[];
  optional_products: string[];
  layout_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Integration Sources / Destinations ───────────────────────────────────
export type IntegrationSourceType =
  | 'dealertrack'
  | 'routeone'
  | 'crm_webhook'
  | 'internet_lead'
  | 'manual_upload'
  | 'other';

export type IntegrationDestinationType =
  | 'dealertrack'
  | 'routeone'
  | 'crm_api'
  | 'reporting_platform'
  | 'other';

export interface AutomotiveIntegrationSource {
  id: string;
  user_id: string;
  source_type: IntegrationSourceType;
  source_name: string;
  webhook_secret: string | null;
  field_map: Record<string, string>;
  auto_create_deal: boolean;
  dedup_fields: string[];
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveIntegrationDestination {
  id: string;
  user_id: string;
  destination_type: IntegrationDestinationType;
  destination_name: string;
  endpoint_url: string | null;
  auth_header_name: string | null;
  auth_header_value: string | null;
  field_map: Record<string, string>;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Reporting Snapshots ───────────────────────────────────────────────────
export interface AutomotiveReportSnapshot {
  id: string;
  user_id: string;
  snapshot_label: string;
  period_from: string;
  period_to: string;
  snapshot_data: KpiSnapshot;
  generated_at: string;
  created_at: string;
}

// ── Commission Records ────────────────────────────────────────────────────
export type CommissionType =
  | 'fi_back_gross'
  | 'fi_flat'
  | 'vehicle_front'
  | 'reserve'
  | 'bonus'
  | 'chargeback';

export type CommissionStatus = 'pending' | 'paid' | 'charged_back' | 'voided';

export interface AutomotiveCommissionRecord {
  id: string;
  user_id: string;
  deal_id: string;
  commission_type: CommissionType;
  gross_amount: number;
  commission_rate: number | null;
  commission_amount: number;
  chargeback_amount: number | null;
  pay_period: string | null;
  paid_at: string | null;
  status: CommissionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Store Preferences ─────────────────────────────────────────────────────
export interface AutomotiveStorePreferences {
  id: string;
  user_id: string;
  store_name: string | null;
  default_deal_type: string | null;
  default_lender_id: string | null;
  default_fi_menu_template_id: string | null;
  gross_cap_limit: number | null;
  default_ttl_rate: number | null;
  default_doc_fee: number | null;
  compliance_notes: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Engine Output Types ───────────────────────────────────────────────────

export interface StructureFlag {
  metric: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RateScenario {
  aprPercent: number;
  delta: number;
  payment: number;
}

export interface TermScenario {
  termMonths: number;
  payment: number;
}

export interface PaymentSensitivity {
  rateScenarios: RateScenario[];
  termScenarios: TermScenario[];
}

export interface StructureAnalysis {
  amountFinanced: number;
  payment: number;
  cashDue: number;
  ltv: number;
  pti: number;
  dti: number;
  backendLoad: number;
  monthlyObligations: number;
  structurePressureScore: number;
  approvalReadinessScore: number;
  sensitivity: PaymentSensitivity;
  flags: StructureFlag[];
  lenderCriteriaUsed: Record<string, number>;
  calculatedAt: string;
}

export interface IncomeVariance {
  variance: number;
  variancePercent: number;
  severity: 'unknown' | 'unverified' | 'minimal' | 'moderate' | 'significant' | 'critical';
  explanation: string;
}

export interface IncomeProfile {
  declared: { monthlyGross: number; monthlyNet: number };
  documentSupported: {
    monthlyGross: number;
    confidence: number;
    method: string;
    sourceDocumentIds: string[];
  };
  approvedWorkingIncome: { monthlyGross: number; isManualOverride: boolean; overrideNote?: string };
  variance: IncomeVariance | null;
  historicalCalculations: number;
}

export interface CallbackOptionEnriched {
  id?: string;
  tierLabel: string | null;
  approvedAmount: number | null;
  approvedTerm: number | null;
  aprOffered: number | null;
  conditions: string | null;
  stipsList: string[];
  isCounterOffer: boolean;
  estimatedPayment: number | null;
  estimatedLtv: number | null;
  confidence: number;
}

export interface DocumentScorecard {
  coverageScore: number;
  freshnessScore: number;
  incomeConfidenceScore: number;
  flagPressureScore: number;
  overallScore: number;
  coverageDetail: { required: number; present: number; missing: string[] };
  flags: string[];
}

export interface KpiSummary {
  fundedUnits: number;
  totalFrontGross: number;
  totalBackGross: number;
  totalGross: number;
  averageFrontGross: number;
  averageBackGross: number;
  pvr: number;
  vpi: number;
  productPenetration: Record<string, number>;
  cancellationSummary: { total: number; totalRefunds: number };
  citSummary: { open: number; avgDaysOpen: number };
  commissionSummary: { totalEarned: number; netCommissions: number };
}

export interface KpiSnapshot {
  pipeline: {
    byStatus: Record<string, number>;
    total: number;
    activePipeline: number;
  };
  gross: {
    totalFrontGross: number;
    totalBackGross: number;
    totalGross: number;
    averageFrontGross: number;
    averageBackGross: number;
    pvr: number;
  };
  products: {
    byProduct: Record<string, unknown>;
    totalProductsSold: number;
    vpi: number;
  };
  cit: {
    open: number;
    resolved: number;
    avgDaysOpen: number;
  };
  cancellations: {
    total: number;
    byStatus: Record<string, number>;
    totalRefunds: number;
  };
  commissions: {
    totalEarned: number;
    netCommissions: number;
  };
  generatedAt: string;
}

// ── Phase 5 Management-Scale Types ───────────────────────────────────────

export type AutomotiveManagementRole =
  | 'finance_manager'
  | 'senior_finance_manager'
  | 'finance_director'
  | 'desk_manager'
  | 'general_sales_manager'
  | 'store_admin'
  | 'group_admin'
  | 'owner_executive'
  | 'read_only_analyst';

export interface AutomotiveGroup {
  id: string;
  owner_user_id: string;
  group_name: string;
  group_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveStore {
  id: string;
  owner_user_id: string;
  group_id: string | null;
  store_name: string;
  store_code: string | null;
  timezone: string;
  address: Record<string, unknown>;
  active_template_set_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveUserProfile {
  id: string;
  owner_user_id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  global_role: AutomotiveManagementRole;
  default_store_id: string | null;
  can_access_sensitive_data: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveUserStoreMembership {
  id: string;
  owner_user_id: string;
  user_id: string;
  store_id: string;
  role_at_store: AutomotiveManagementRole;
  can_manage_users: boolean;
  can_manage_integrations: boolean;
  can_view_commissions: boolean;
  can_override_income: boolean;
  can_override_structure: boolean;
  is_active: boolean;
  assigned_at: string;
  created_at: string;
  updated_at: string;
}

export type AutomotiveApprovalRequestType =
  | 'structure_review'
  | 'income_override'
  | 'structure_override'
  | 'menu_approval'
  | 'callback_escalation'
  | 'guideline_conflict'
  | 'exception_case'
  | 'cancellation_review'
  | 'commission_discrepancy'
  | 'cit_escalation';

export type AutomotiveApprovalStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'revise_required'
  | 'cancelled';

export interface AutomotiveApprovalRequest {
  id: string;
  owner_user_id: string;
  store_id: string | null;
  deal_id: string | null;
  request_type: AutomotiveApprovalRequestType;
  status: AutomotiveApprovalStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requested_by_user_id: string | null;
  assigned_reviewer_id: string | null;
  decided_by_user_id: string | null;
  requested_note: string | null;
  decision_note: string | null;
  decision_at: string | null;
  due_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveTemplate {
  id: string;
  owner_user_id: string;
  set_id: string;
  store_id: string | null;
  template_type: string;
  template_name: string;
  version_number: number;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  applies_to_deal_types: string[];
  is_default: boolean;
  payload: Record<string, unknown>;
  created_by_user_id: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveLenderPlaybook {
  id: string;
  owner_user_id: string;
  store_id: string | null;
  lender_id: string | null;
  playbook_name: string;
  version_number: number;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  tendencies: Record<string, unknown>;
  callback_patterns: Record<string, unknown>;
  preferred_deal_types: string[];
  pti_dti_guidance: Record<string, unknown>;
  stip_expectations: Record<string, unknown>;
  backend_tolerance_notes: string | null;
  common_pitfalls: unknown[];
  escalation_notes: string | null;
  source_doc_refs: unknown[];
  internal_notes: Record<string, unknown>;
  ai_inference_notes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AutomotiveAuditEvent {
  id: string;
  owner_user_id: string;
  store_id: string | null;
  deal_id: string | null;
  actor_user_id: string | null;
  area: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_payload: Record<string, unknown>;
  after_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AutomotiveCoachingNote {
  id: string;
  owner_user_id: string;
  store_id: string | null;
  manager_user_id: string | null;
  target_user_id: string | null;
  deal_id: string | null;
  note_type: string;
  title: string;
  body: string;
  tags: string[];
  is_reference_case: boolean;
  reference_case_label: string | null;
  created_at: string;
  updated_at: string;
}
