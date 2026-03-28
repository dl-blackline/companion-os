-- ============================================================
-- Migration 028: Automotive finance manager foundation
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'automotive_finance_documents',
  'automotive_finance_documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "automotive_finance_documents_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'automotive_finance_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "automotive_finance_documents_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'automotive_finance_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "automotive_finance_documents_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'automotive_finance_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE TABLE IF NOT EXISTS automotive_deals (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_name              TEXT NOT NULL,
  deal_type              TEXT NOT NULL DEFAULT 'retail' CHECK (deal_type IN ('retail', 'lease', 'balloon', 'business', 'commercial')),
  status                 TEXT NOT NULL DEFAULT 'intake' CHECK (status IN (
                           'intake',
                           'document_review',
                           'structure_analysis',
                           'menu_ready',
                           'presented',
                           'submitted',
                           'funded',
                           'cit_hold',
                           'cancelled',
                           'archived'
                         )),
  source_channel         TEXT,
  customer_payment_target NUMERIC,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_deals_user_created
  ON automotive_deals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automotive_deals_user_status
  ON automotive_deals(user_id, status);

ALTER TABLE automotive_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_deals_self"
  ON automotive_deals
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_applicants (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  applicant_role         TEXT NOT NULL DEFAULT 'primary' CHECK (applicant_role IN ('primary', 'co_applicant', 'guarantor', 'business_signer')),
  first_name             TEXT,
  last_name              TEXT,
  date_of_birth          DATE,
  license_number         TEXT,
  address_line_1         TEXT,
  address_line_2         TEXT,
  city                   TEXT,
  state                  TEXT,
  postal_code            TEXT,
  declared_monthly_income NUMERIC,
  declared_obligations_monthly NUMERIC,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_applicants_user_deal
  ON automotive_applicants(user_id, deal_id);

ALTER TABLE automotive_applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_applicants_self"
  ON automotive_applicants
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_documents (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  applicant_id           UUID REFERENCES automotive_applicants(id) ON DELETE SET NULL,
  document_type          TEXT NOT NULL CHECK (document_type IN (
                           'credit_bureau',
                           'drivers_license',
                           'proof_of_residence',
                           'proof_of_income',
                           'pay_stub',
                           'bank_statement',
                           'tax_return',
                           'reference',
                           'insurance',
                           'stipulation',
                           'lender_requirement',
                           'other'
                         )),
  storage_bucket         TEXT NOT NULL DEFAULT 'automotive_finance_documents',
  storage_path           TEXT NOT NULL,
  filename               TEXT NOT NULL,
  mime_type              TEXT,
  file_size_bytes        BIGINT,
  version_number         INTEGER NOT NULL DEFAULT 1,
  replaces_document_id   UUID REFERENCES automotive_documents(id) ON DELETE SET NULL,
  review_status          TEXT NOT NULL DEFAULT 'uploaded' CHECK (review_status IN ('uploaded', 'processing', 'reviewed', 'needs_attention', 'rejected')),
  extraction_confidence  NUMERIC,
  uploaded_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at            TIMESTAMPTZ,
  review_notes           TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_automotive_documents_user_deal
  ON automotive_documents(user_id, deal_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_automotive_documents_review_status
  ON automotive_documents(user_id, review_status);

ALTER TABLE automotive_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_documents_self"
  ON automotive_documents
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_document_fields (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id            UUID NOT NULL REFERENCES automotive_documents(id) ON DELETE CASCADE,
  field_name             TEXT NOT NULL,
  field_value            TEXT,
  field_value_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score       NUMERIC,
  source_page            INTEGER,
  is_user_confirmed      BOOLEAN NOT NULL DEFAULT false,
  confirmed_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_document_fields_doc
  ON automotive_document_fields(user_id, document_id, field_name);

ALTER TABLE automotive_document_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_document_fields_self"
  ON automotive_document_fields
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_review_flags (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  document_id            UUID REFERENCES automotive_documents(id) ON DELETE SET NULL,
  category               TEXT NOT NULL CHECK (category IN ('missing', 'mismatch', 'expiration', 'quality', 'consistency', 'suspicion', 'stip')),
  severity               TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status                 TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  message                TEXT NOT NULL,
  recommended_action     TEXT,
  resolved_at            TIMESTAMPTZ,
  resolved_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_review_flags_user_status
  ON automotive_review_flags(user_id, status, created_at DESC);

ALTER TABLE automotive_review_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_review_flags_self"
  ON automotive_review_flags
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_income_calculations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  applicant_id           UUID REFERENCES automotive_applicants(id) ON DELETE SET NULL,
  method                 TEXT NOT NULL CHECK (method IN ('declared', 'pay_stub', 'bank_statement', 'tax_return', 'employer_letter', 'mixed')),
  gross_monthly_income   NUMERIC,
  net_monthly_income     NUMERIC,
  confidence_score       NUMERIC,
  methodology            TEXT,
  source_document_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,
  variance_vs_declared   NUMERIC,
  is_manual_override     BOOLEAN NOT NULL DEFAULT false,
  override_note          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_income_calculations_deal
  ON automotive_income_calculations(user_id, deal_id, created_at DESC);

ALTER TABLE automotive_income_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_income_calculations_self"
  ON automotive_income_calculations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_deal_structures (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE UNIQUE,
  selling_price          NUMERIC NOT NULL DEFAULT 0,
  cash_down              NUMERIC NOT NULL DEFAULT 0,
  rebates                NUMERIC NOT NULL DEFAULT 0,
  trade_allowance        NUMERIC NOT NULL DEFAULT 0,
  trade_payoff           NUMERIC NOT NULL DEFAULT 0,
  amount_financed        NUMERIC NOT NULL DEFAULT 0,
  term_months            INTEGER NOT NULL DEFAULT 72,
  apr_percent            NUMERIC NOT NULL DEFAULT 0,
  payment_estimate       NUMERIC NOT NULL DEFAULT 0,
  backend_total          NUMERIC NOT NULL DEFAULT 0,
  ttl_fees               NUMERIC NOT NULL DEFAULT 0,
  collateral_value_basis TEXT,
  collateral_value       NUMERIC NOT NULL DEFAULT 0,
  advance_percent        NUMERIC,
  lender_fees            NUMERIC,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_deal_structures_user_deal
  ON automotive_deal_structures(user_id, deal_id);

ALTER TABLE automotive_deal_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_deal_structures_self"
  ON automotive_deal_structures
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_deal_metrics (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                   UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE UNIQUE,
  ltv_percent               NUMERIC,
  pti_percent               NUMERIC,
  dti_percent               NUMERIC,
  payment_estimate          NUMERIC,
  structure_pressure_score  INTEGER,
  approval_readiness_score  INTEGER,
  summary                   TEXT,
  calculated_at             TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_deal_metrics_user_deal
  ON automotive_deal_metrics(user_id, deal_id);

ALTER TABLE automotive_deal_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_deal_metrics_self"
  ON automotive_deal_metrics
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_fi_products (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  category               TEXT NOT NULL,
  description            TEXT,
  provider               TEXT,
  cost                   NUMERIC NOT NULL DEFAULT 0,
  sell_price             NUMERIC NOT NULL DEFAULT 0,
  term_compatibility     JSONB NOT NULL DEFAULT '{}'::jsonb,
  eligibility_notes      TEXT,
  pitch_notes            TEXT,
  disclosure_text        TEXT,
  printable_copy         TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_fi_products_user_active
  ON automotive_fi_products(user_id, is_active, category);

ALTER TABLE automotive_fi_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_fi_products_self"
  ON automotive_fi_products
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_menu_presentations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE UNIQUE,
  title                  TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'presented', 'acknowledged')),
  menu_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_view_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  presented_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_menu_presentations_user_deal
  ON automotive_menu_presentations(user_id, deal_id, updated_at DESC);

ALTER TABLE automotive_menu_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_menu_presentations_self"
  ON automotive_menu_presentations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_signature_acknowledgments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  presentation_id        UUID NOT NULL REFERENCES automotive_menu_presentations(id) ON DELETE CASCADE,
  customer_name          TEXT NOT NULL,
  typed_signature        TEXT NOT NULL,
  acknowledged_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address             TEXT,
  user_agent             TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_signature_ack_user_deal
  ON automotive_signature_acknowledgments(user_id, deal_id, acknowledged_at DESC);

ALTER TABLE automotive_signature_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_signature_acknowledgments_self"
  ON automotive_signature_acknowledgments
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_timeline_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  event_type             TEXT NOT NULL,
  event_payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_timeline_events_user_deal
  ON automotive_timeline_events(user_id, deal_id, created_at DESC);

ALTER TABLE automotive_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_timeline_events_self"
  ON automotive_timeline_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS automotive_integration_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                UUID REFERENCES automotive_deals(id) ON DELETE SET NULL,
  direction              TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  source_system          TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'mapped', 'needs_review', 'sent', 'failed', 'retried')),
  payload_raw            JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_mapped         JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message          TEXT,
  retry_count            INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_integration_events_user_created
  ON automotive_integration_events(user_id, created_at DESC);

ALTER TABLE automotive_integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automotive_integration_events_self"
  ON automotive_integration_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


DROP TRIGGER IF EXISTS trg_automotive_deals_updated_at ON automotive_deals;
CREATE TRIGGER trg_automotive_deals_updated_at
BEFORE UPDATE ON automotive_deals
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_applicants_updated_at ON automotive_applicants;
CREATE TRIGGER trg_automotive_applicants_updated_at
BEFORE UPDATE ON automotive_applicants
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_documents_updated_at ON automotive_documents;
CREATE TRIGGER trg_automotive_documents_updated_at
BEFORE UPDATE ON automotive_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_document_fields_updated_at ON automotive_document_fields;
CREATE TRIGGER trg_automotive_document_fields_updated_at
BEFORE UPDATE ON automotive_document_fields
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_review_flags_updated_at ON automotive_review_flags;
CREATE TRIGGER trg_automotive_review_flags_updated_at
BEFORE UPDATE ON automotive_review_flags
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_income_calculations_updated_at ON automotive_income_calculations;
CREATE TRIGGER trg_automotive_income_calculations_updated_at
BEFORE UPDATE ON automotive_income_calculations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_deal_structures_updated_at ON automotive_deal_structures;
CREATE TRIGGER trg_automotive_deal_structures_updated_at
BEFORE UPDATE ON automotive_deal_structures
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_deal_metrics_updated_at ON automotive_deal_metrics;
CREATE TRIGGER trg_automotive_deal_metrics_updated_at
BEFORE UPDATE ON automotive_deal_metrics
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_fi_products_updated_at ON automotive_fi_products;
CREATE TRIGGER trg_automotive_fi_products_updated_at
BEFORE UPDATE ON automotive_fi_products
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_menu_presentations_updated_at ON automotive_menu_presentations;
CREATE TRIGGER trg_automotive_menu_presentations_updated_at
BEFORE UPDATE ON automotive_menu_presentations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_integration_events_updated_at ON automotive_integration_events;
CREATE TRIGGER trg_automotive_integration_events_updated_at
BEFORE UPDATE ON automotive_integration_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
