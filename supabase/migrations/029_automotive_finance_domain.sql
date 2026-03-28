-- ============================================================
-- Migration 029: Automotive finance — full domain expansion
-- Phase 2: vehicles, obligations, lenders, programs, guidelines,
--           callbacks, CIT/cancellations/issues, menu templates,
--           integration configs, reporting, commissions, store prefs
-- ============================================================

-- ── Extend deal status constraint to support the full state machine ────────
-- Drop the inline check, replace with named constraint containing all states.
ALTER TABLE automotive_deals DROP CONSTRAINT IF EXISTS automotive_deals_status_check;
ALTER TABLE automotive_deals
  ADD CONSTRAINT automotive_deals_status_check CHECK (status IN (
    'lead_received',
    'intake',
    'docs_pending',
    'docs_under_review',
    'document_review',
    'structure_in_progress',
    'structure_analysis',
    'callback_received',
    'callback_interpreted',
    'menu_ready',
    'presented',
    'submitted',
    'booked',
    'funded',
    'cit_hold',
    'issue_open',
    'cancelled',
    'archived'
  ));

-- ── Additive columns to existing deals table ──────────────────────────────
ALTER TABLE automotive_deals
  ADD COLUMN IF NOT EXISTS assigned_manager  TEXT,
  ADD COLUMN IF NOT EXISTS store_reference   TEXT,
  ADD COLUMN IF NOT EXISTS lead_source       TEXT,
  ADD COLUMN IF NOT EXISTS gross_cap_limit   NUMERIC;

-- ── Additive columns to deal_structures (lease + balloon support) ─────────
ALTER TABLE automotive_deal_structures
  ADD COLUMN IF NOT EXISTS balloon_amount         NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS residual_value         NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS residual_percent       NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS money_factor           NUMERIC,
  ADD COLUMN IF NOT EXISTS cap_cost_reduction     NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acquisition_fee        NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_capitalized_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS lease_payment          NUMERIC,
  ADD COLUMN IF NOT EXISTS vehicle_cost           NUMERIC;

-- ── Additive columns to deal_metrics (gross + reserve tracking) ───────────
ALTER TABLE automotive_deal_metrics
  ADD COLUMN IF NOT EXISTS backend_percent     NUMERIC,
  ADD COLUMN IF NOT EXISTS front_gross         NUMERIC,
  ADD COLUMN IF NOT EXISTS back_gross          NUMERIC,
  ADD COLUMN IF NOT EXISTS reserve_amount      NUMERIC,
  ADD COLUMN IF NOT EXISTS total_gross         NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_obligations NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_sensitivity JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 1. Lenders ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_lenders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  short_code      TEXT,
  contact_name    TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  portal_url      TEXT,
  notes           TEXT,
  tier_system     JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_lenders_user_active
  ON automotive_lenders(user_id, is_active, name);

ALTER TABLE automotive_lenders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_lenders_self"
  ON automotive_lenders FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 2. Lender Programs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_lender_programs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lender_id             UUID NOT NULL REFERENCES automotive_lenders(id) ON DELETE CASCADE,
  program_name          TEXT NOT NULL,
  deal_types            TEXT[] NOT NULL DEFAULT ARRAY['retail'],
  vehicle_conditions    TEXT[] DEFAULT ARRAY['new', 'used'],
  min_fico              INTEGER,
  max_ltv_percent       NUMERIC,
  max_advance_percent   NUMERIC,
  max_term_months       INTEGER,
  max_pti_percent       NUMERIC,
  max_dti_percent       NUMERIC,
  max_backend_amount    NUMERIC,
  max_backend_percent   NUMERIC,
  reserve_flat          NUMERIC,
  reserve_percent       NUMERIC,
  reserve_cap_percent   NUMERIC,
  stips_required        TEXT[],
  program_notes         TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  effective_date        DATE,
  expiration_date       DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_lender_programs_lender
  ON automotive_lender_programs(user_id, lender_id, is_active);

ALTER TABLE automotive_lender_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_lender_programs_self"
  ON automotive_lender_programs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 3. Lender Guidelines (knowledge brain source documents) ───────────────
CREATE TABLE IF NOT EXISTS automotive_lender_guidelines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lender_id        UUID REFERENCES automotive_lenders(id) ON DELETE SET NULL,
  program_id       UUID REFERENCES automotive_lender_programs(id) ON DELETE SET NULL,
  document_name    TEXT NOT NULL,
  document_type    TEXT NOT NULL DEFAULT 'general'
    CHECK (document_type IN ('general', 'program_sheet', 'rate_sheet', 'callback_cheatsheet', 'underwriting', 'structure_criteria', 'special')),
  content_text     TEXT,
  storage_path     TEXT,
  deal_types       TEXT[],
  effective_date   DATE,
  expiration_date  DATE,
  indexed_at       TIMESTAMPTZ,
  source_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_lender_guidelines_user_lender
  ON automotive_lender_guidelines(user_id, lender_id, document_type);

ALTER TABLE automotive_lender_guidelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_lender_guidelines_self"
  ON automotive_lender_guidelines FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 4. Vehicles (purchase vehicle + trade-in) ─────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_vehicles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id             UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  vehicle_role        TEXT NOT NULL DEFAULT 'purchase'
    CHECK (vehicle_role IN ('purchase', 'trade')),
  vin                 TEXT,
  year                INTEGER,
  make                TEXT,
  model               TEXT,
  trim_level          TEXT,
  mileage             INTEGER,
  color               TEXT,
  stock_number        TEXT,
  condition           TEXT DEFAULT 'used'
    CHECK (condition IN ('new', 'used', 'certified')),
  msrp                NUMERIC,
  invoice_cost        NUMERIC,
  wholesale_value     NUMERIC,
  retail_book_value   NUMERIC,
  nada_value          NUMERIC,
  kbb_value           NUMERIC,
  mmr_value           NUMERIC,
  book_value_basis    TEXT CHECK (book_value_basis IN ('nada', 'kbb', 'mmr', 'auction', 'manual', 'other')),
  payoff_amount       NUMERIC,
  payoff_lender       TEXT,
  payoff_good_through DATE,
  collateral_notes    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_vehicles_user_deal
  ON automotive_vehicles(user_id, deal_id, vehicle_role);

ALTER TABLE automotive_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_vehicles_self"
  ON automotive_vehicles FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 5. Obligations (applicant liabilities used for DTI) ───────────────────
CREATE TABLE IF NOT EXISTS automotive_obligations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id             UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  applicant_id        UUID REFERENCES automotive_applicants(id) ON DELETE SET NULL,
  obligation_type     TEXT NOT NULL
    CHECK (obligation_type IN ('mortgage', 'rent', 'auto_loan', 'student_loan', 'credit_card', 'personal_loan', 'child_support', 'other')),
  creditor_name       TEXT,
  monthly_payment     NUMERIC NOT NULL DEFAULT 0,
  balance_remaining   NUMERIC,
  account_status      TEXT NOT NULL DEFAULT 'current'
    CHECK (account_status IN ('current', 'delinquent', 'paid_off', 'collection', 'unknown')),
  is_bureau_verified  BOOLEAN NOT NULL DEFAULT false,
  is_paying_off       BOOLEAN NOT NULL DEFAULT false,
  source              TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'bureau', 'document')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_obligations_user_deal
  ON automotive_obligations(user_id, deal_id, applicant_id);

ALTER TABLE automotive_obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_obligations_self"
  ON automotive_obligations FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 6. Callbacks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_callbacks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id              UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  lender_id            UUID REFERENCES automotive_lenders(id) ON DELETE SET NULL,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status               TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'normalized', 'needs_review', 'optioned', 'structure_recommended', 'resolved', 'superseded')),
  raw_input            TEXT NOT NULL,
  normalized_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  lender_notes         TEXT,
  callback_rep         TEXT,
  interpreter_output   JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution_notes     TEXT,
  resolved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_callbacks_user_deal
  ON automotive_callbacks(user_id, deal_id, received_at DESC);

ALTER TABLE automotive_callbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_callbacks_self"
  ON automotive_callbacks FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 7. Callback Options ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_callback_options (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callback_id                 UUID NOT NULL REFERENCES automotive_callbacks(id) ON DELETE CASCADE,
  deal_id                     UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  option_number               INTEGER NOT NULL DEFAULT 1,
  label                       TEXT,
  term_months                 INTEGER,
  rate_percent                NUMERIC,
  advance_percent             NUMERIC,
  max_amount_financed         NUMERIC,
  required_cash_down          NUMERIC,
  max_backend_amount          NUMERIC,
  max_backend_percent         NUMERIC,
  stips_required              JSONB NOT NULL DEFAULT '[]'::jsonb,
  pti_cap_percent             NUMERIC,
  dti_cap_percent             NUMERIC,
  customer_restrictions       JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_payment           NUMERIC,
  estimated_ltv               NUMERIC,
  plain_english_explanation   TEXT,
  comparison_notes            TEXT,
  is_recommended              BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_callback_options_callback
  ON automotive_callback_options(user_id, callback_id, option_number);

ALTER TABLE automotive_callback_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_callback_options_self"
  ON automotive_callback_options FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 8. CIT Cases ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_cit_cases (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                 UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'awaiting_stips', 'awaiting_customer', 'awaiting_lender', 'resolved', 'escalated', 'unfunded', 'archived')),
  opened_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_resolution_date  DATE,
  resolved_at             TIMESTAMPTZ,
  funded_amount           NUMERIC,
  outstanding_stips       JSONB NOT NULL DEFAULT '[]'::jsonb,
  lender_contact          TEXT,
  notes                   TEXT,
  escalation_reason       TEXT,
  days_open               INTEGER GENERATED ALWAYS AS (
    EXTRACT(DAY FROM (COALESCE(resolved_at, now()) - opened_at))::INTEGER
  ) STORED,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_cit_cases_user_status
  ON automotive_cit_cases(user_id, status, opened_at DESC);

ALTER TABLE automotive_cit_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_cit_cases_self"
  ON automotive_cit_cases FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 9. Cancellation Cases ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_cancellation_cases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id               UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES automotive_fi_products(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'pending_docs', 'submitted', 'confirmed', 'refunded', 'charged_back', 'closed')),
  cancellation_reason   TEXT NOT NULL,
  cancellation_date     DATE,
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at          TIMESTAMPTZ,
  confirmed_at          TIMESTAMPTZ,
  refund_amount         NUMERIC,
  chargeback_amount     NUMERIC,
  chargeback_notes      TEXT,
  provider_confirmation TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_cancellation_cases_user_status
  ON automotive_cancellation_cases(user_id, status, requested_at DESC);

ALTER TABLE automotive_cancellation_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_cancellation_cases_self"
  ON automotive_cancellation_cases FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 10. Customer Issues ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_customer_issues (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id               UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  issue_type            TEXT NOT NULL
    CHECK (issue_type IN ('payment_dispute', 'product_complaint', 'documentation_error', 'funding_delay', 'lender_dispute', 'warranty_claim', 'regulatory', 'other')),
  status                TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'awaiting_customer', 'awaiting_lender', 'awaiting_dealer', 'resolved', 'escalated', 'closed')),
  description           TEXT NOT NULL,
  reported_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_resolution_date DATE,
  resolved_at           TIMESTAMPTZ,
  resolution_notes      TEXT,
  escalated_to          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_customer_issues_user_status
  ON automotive_customer_issues(user_id, status, reported_at DESC);

ALTER TABLE automotive_customer_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_customer_issues_self"
  ON automotive_customer_issues FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 11. F&I Menu Templates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_fi_menu_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name       TEXT NOT NULL,
  deal_types          TEXT[] NOT NULL DEFAULT ARRAY['retail'],
  tier_definitions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_products    JSONB NOT NULL DEFAULT '[]'::jsonb,
  presentation_notes  TEXT,
  disclosure_footer   TEXT,
  is_default          BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_fi_menu_templates_user
  ON automotive_fi_menu_templates(user_id, is_active, is_default);

ALTER TABLE automotive_fi_menu_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_fi_menu_templates_self"
  ON automotive_fi_menu_templates FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 12. Integration Sources (inbound) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_integration_sources (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_name             TEXT NOT NULL,
  source_type             TEXT NOT NULL
    CHECK (source_type IN ('dealertrack', 'routeone', 'crm_webhook', 'dms_webhook', 'lead_provider', 'custom_webhook')),
  webhook_secret_hash     TEXT,
  field_map               JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalization_rules     JSONB NOT NULL DEFAULT '{}'::jsonb,
  duplicate_check_fields  TEXT[] DEFAULT ARRAY['customer_last_name', 'vin'],
  is_active               BOOLEAN NOT NULL DEFAULT false,
  last_received_at        TIMESTAMPTZ,
  total_received          INTEGER NOT NULL DEFAULT 0,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_integration_sources_user
  ON automotive_integration_sources(user_id, is_active, source_type);

ALTER TABLE automotive_integration_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_integration_sources_self"
  ON automotive_integration_sources FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 13. Integration Destinations (outbound) ───────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_integration_destinations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination_name   TEXT NOT NULL,
  destination_type   TEXT NOT NULL
    CHECK (destination_type IN ('dealertrack', 'routeone', 'crm', 'dms', 'custom_webhook')),
  endpoint_url       TEXT,
  auth_type          TEXT NOT NULL DEFAULT 'none'
    CHECK (auth_type IN ('none', 'bearer', 'basic', 'api_key', 'oauth2')),
  auth_config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_map          JSONB NOT NULL DEFAULT '{}'::jsonb,
  transform_rules    JSONB NOT NULL DEFAULT '{}'::jsonb,
  requires_approval  BOOLEAN NOT NULL DEFAULT true,
  is_active          BOOLEAN NOT NULL DEFAULT false,
  last_sent_at       TIMESTAMPTZ,
  total_sent         INTEGER NOT NULL DEFAULT 0,
  retry_config       JSONB NOT NULL DEFAULT '{"max_retries": 3, "backoff_seconds": 30}'::jsonb,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_integration_destinations_user
  ON automotive_integration_destinations(user_id, is_active, destination_type);

ALTER TABLE automotive_integration_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_integration_destinations_self"
  ON automotive_integration_destinations FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 14. Report Snapshots ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_report_snapshots (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date              DATE NOT NULL,
  period_type                TEXT NOT NULL DEFAULT 'monthly'
    CHECK (period_type IN ('daily', 'weekly', 'monthly', 'custom')),
  period_start               DATE NOT NULL,
  period_end                 DATE NOT NULL,
  total_deals                INTEGER NOT NULL DEFAULT 0,
  funded_deals               INTEGER NOT NULL DEFAULT 0,
  booked_deals               INTEGER NOT NULL DEFAULT 0,
  cancelled_deals            INTEGER NOT NULL DEFAULT 0,
  total_front_gross          NUMERIC NOT NULL DEFAULT 0,
  total_back_gross           NUMERIC NOT NULL DEFAULT 0,
  total_gross                NUMERIC NOT NULL DEFAULT 0,
  pvr                        NUMERIC,
  vpi                        NUMERIC,
  avg_ltv_percent            NUMERIC,
  avg_pti_percent            NUMERIC,
  avg_term_months            NUMERIC,
  penetration_by_category    JSONB NOT NULL DEFAULT '{}'::jsonb,
  cancellation_by_category   JSONB NOT NULL DEFAULT '{}'::jsonb,
  cit_aging_summary          JSONB NOT NULL DEFAULT '{}'::jsonb,
  pipeline_by_status         JSONB NOT NULL DEFAULT '{}'::jsonb,
  filters_applied            JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_report_snapshots_user_period
  ON automotive_report_snapshots(user_id, period_start DESC, period_type);

ALTER TABLE automotive_report_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_report_snapshots_self"
  ON automotive_report_snapshots FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 15. Commission Records ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_commission_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id          UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES automotive_fi_products(id) ON DELETE SET NULL,
  commission_type  TEXT NOT NULL
    CHECK (commission_type IN ('fi_flat', 'fi_percent', 'reserve', 'front_gross', 'bonus', 'other')),
  amount           NUMERIC NOT NULL DEFAULT 0,
  basis            TEXT,
  status           TEXT NOT NULL DEFAULT 'estimated'
    CHECK (status IN ('estimated', 'pending', 'paid', 'charged_back', 'voided')),
  paid_at          TIMESTAMPTZ,
  chargeback_at    TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_commission_records_user_deal
  ON automotive_commission_records(user_id, deal_id, status);

ALTER TABLE automotive_commission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_commission_records_self"
  ON automotive_commission_records FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 16. Store Preferences (singleton per user) ────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_store_preferences (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  store_name                  TEXT,
  dealer_number               TEXT,
  address                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_deal_type           TEXT NOT NULL DEFAULT 'retail'
    CHECK (default_deal_type IN ('retail', 'lease', 'balloon', 'business', 'commercial')),
  default_menu_template_id    UUID REFERENCES automotive_fi_menu_templates(id) ON DELETE SET NULL,
  fi_manager_name             TEXT,
  disclosure_footer           TEXT,
  acknowledgment_disclaimer   TEXT,
  commission_structure        JSONB NOT NULL DEFAULT '{}'::jsonb,
  reporting_preferences       JSONB NOT NULL DEFAULT '{}'::jsonb,
  lender_defaults             JSONB NOT NULL DEFAULT '{}'::jsonb,
  structure_defaults          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_store_preferences_user
  ON automotive_store_preferences(user_id);

ALTER TABLE automotive_store_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_store_preferences_self"
  ON automotive_store_preferences FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Add lender_id FK to deals now that lenders table exists ───────────────
ALTER TABLE automotive_deals
  ADD COLUMN IF NOT EXISTS lender_id UUID REFERENCES automotive_lenders(id) ON DELETE SET NULL;

-- ── Triggers: updated_at on all new tables ────────────────────────────────
DROP TRIGGER IF EXISTS trg_automotive_lenders_updated_at ON automotive_lenders;
CREATE TRIGGER trg_automotive_lenders_updated_at
  BEFORE UPDATE ON automotive_lenders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_lender_programs_updated_at ON automotive_lender_programs;
CREATE TRIGGER trg_automotive_lender_programs_updated_at
  BEFORE UPDATE ON automotive_lender_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_lender_guidelines_updated_at ON automotive_lender_guidelines;
CREATE TRIGGER trg_automotive_lender_guidelines_updated_at
  BEFORE UPDATE ON automotive_lender_guidelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_vehicles_updated_at ON automotive_vehicles;
CREATE TRIGGER trg_automotive_vehicles_updated_at
  BEFORE UPDATE ON automotive_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_obligations_updated_at ON automotive_obligations;
CREATE TRIGGER trg_automotive_obligations_updated_at
  BEFORE UPDATE ON automotive_obligations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_callbacks_updated_at ON automotive_callbacks;
CREATE TRIGGER trg_automotive_callbacks_updated_at
  BEFORE UPDATE ON automotive_callbacks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_callback_options_updated_at ON automotive_callback_options;
CREATE TRIGGER trg_automotive_callback_options_updated_at
  BEFORE UPDATE ON automotive_callback_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_cit_cases_updated_at ON automotive_cit_cases;
CREATE TRIGGER trg_automotive_cit_cases_updated_at
  BEFORE UPDATE ON automotive_cit_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_cancellation_cases_updated_at ON automotive_cancellation_cases;
CREATE TRIGGER trg_automotive_cancellation_cases_updated_at
  BEFORE UPDATE ON automotive_cancellation_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_customer_issues_updated_at ON automotive_customer_issues;
CREATE TRIGGER trg_automotive_customer_issues_updated_at
  BEFORE UPDATE ON automotive_customer_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_fi_menu_templates_updated_at ON automotive_fi_menu_templates;
CREATE TRIGGER trg_automotive_fi_menu_templates_updated_at
  BEFORE UPDATE ON automotive_fi_menu_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_integration_sources_updated_at ON automotive_integration_sources;
CREATE TRIGGER trg_automotive_integration_sources_updated_at
  BEFORE UPDATE ON automotive_integration_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_integration_destinations_updated_at ON automotive_integration_destinations;
CREATE TRIGGER trg_automotive_integration_destinations_updated_at
  BEFORE UPDATE ON automotive_integration_destinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_commission_records_updated_at ON automotive_commission_records;
CREATE TRIGGER trg_automotive_commission_records_updated_at
  BEFORE UPDATE ON automotive_commission_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_store_preferences_updated_at ON automotive_store_preferences;
CREATE TRIGGER trg_automotive_store_preferences_updated_at
  BEFORE UPDATE ON automotive_store_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
