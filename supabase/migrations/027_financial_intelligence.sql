-- ============================================================
-- Migration 027: Financial intelligence layer
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financial_documents',
  'financial_documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "financial_documents_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'financial_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "financial_documents_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'financial_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "financial_documents_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'financial_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


CREATE TABLE IF NOT EXISTS financial_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_bucket     TEXT NOT NULL DEFAULT 'financial_documents',
  storage_path       TEXT NOT NULL,
  source_type        TEXT NOT NULL CHECK (source_type IN (
                        'bank_statement',
                        'credit_card_statement',
                        'loan_statement',
                        'utility_bill',
                        'rent_mortgage',
                        'insurance_bill',
                        'subscription_bill',
                        'other'
                      )),
  filename           TEXT NOT NULL,
  mime_type          TEXT,
  file_size_bytes    BIGINT,
  document_status    TEXT NOT NULL DEFAULT 'uploaded' CHECK (document_status IN ('uploaded', 'processing', 'parsed', 'failed', 'archived')),
  parse_confidence   NUMERIC,
  parse_summary      TEXT,
  statement_start_date DATE,
  statement_end_date   DATE,
  statement_closing_date DATE,
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  parsed_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_financial_documents_user_id_uploaded_at
  ON financial_documents(user_id, uploaded_at DESC);

ALTER TABLE financial_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_documents_self"
  ON financial_documents
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS financial_document_extractions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id            UUID NOT NULL REFERENCES financial_documents(id) ON DELETE CASCADE,
  institution_name       TEXT,
  account_type           TEXT,
  masked_account_identifier TEXT,
  due_date               DATE,
  current_balance        NUMERIC,
  statement_balance      NUMERIC,
  minimum_payment_due    NUMERIC,
  credit_limit           NUMERIC,
  available_credit       NUMERIC,
  apr_percent            NUMERIC,
  past_due_amount        NUMERIC,
  fees_amount            NUMERIC,
  recurring_payment_detected BOOLEAN,
  recurring_hint         TEXT,
  extracted_obligations  JSONB NOT NULL DEFAULT '[]'::jsonb,
  transaction_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_notes       TEXT,
  confidence_score       NUMERIC,
  model_used             TEXT,
  extracted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_document_extractions_user_doc
  ON financial_document_extractions(user_id, document_id);

ALTER TABLE financial_document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_document_extractions_self"
  ON financial_document_extractions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS financial_obligations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_document_id   UUID REFERENCES financial_documents(id) ON DELETE SET NULL,
  extraction_id        UUID REFERENCES financial_document_extractions(id) ON DELETE SET NULL,
  institution_name     TEXT,
  account_type         TEXT,
  account_label        TEXT,
  masked_account_identifier TEXT,
  category             TEXT NOT NULL DEFAULT 'bill' CHECK (category IN ('bill', 'loan', 'credit_card', 'rent', 'insurance', 'subscription', 'utility', 'tax', 'other')),
  due_date             DATE,
  estimated_payment_date DATE,
  actual_payment_date  DATE,
  amount_due           NUMERIC,
  minimum_due          NUMERIC,
  planned_payment      NUMERIC,
  past_due_amount      NUMERIC,
  current_balance      NUMERIC,
  credit_limit         NUMERIC,
  available_credit     NUMERIC,
  apr_percent          NUMERIC,
  status               TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'paid', 'overdue', 'skipped', 'disputed', 'unknown')),
  is_recurring         BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule      TEXT,
  next_due_date        DATE,
  notes                TEXT,
  confidence_score     NUMERIC,
  source_data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_obligations_user_due_date
  ON financial_obligations(user_id, due_date ASC);

CREATE INDEX IF NOT EXISTS idx_financial_obligations_user_status
  ON financial_obligations(user_id, status);

ALTER TABLE financial_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_obligations_self"
  ON financial_obligations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS financial_savings_goals (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                       TEXT NOT NULL,
  target_amount              NUMERIC NOT NULL,
  target_date                DATE,
  priority                   TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  current_amount             NUMERIC NOT NULL DEFAULT 0,
  monthly_contribution_target NUMERIC,
  recommended_contribution_rate NUMERIC,
  funding_rule               TEXT,
  status                     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_savings_goals_user
  ON financial_savings_goals(user_id);

ALTER TABLE financial_savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_savings_goals_self"
  ON financial_savings_goals
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS financial_calendar_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  obligation_id        UUID REFERENCES financial_obligations(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  event_type           TEXT NOT NULL CHECK (event_type IN ('bill_due', 'payday', 'savings_transfer', 'debt_payment', 'reminder', 'custom')),
  scheduled_date       DATE NOT NULL,
  amount               NUMERIC,
  status               TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'skipped', 'overdue')),
  reminder_offset_days INTEGER,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_calendar_events_user_date
  ON financial_calendar_events(user_id, scheduled_date ASC);

ALTER TABLE financial_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_calendar_events_self"
  ON financial_calendar_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS financial_insights (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type         TEXT NOT NULL CHECK (insight_type IN ('cash_pressure', 'due_date_cluster', 'utilization_risk', 'rising_balance', 'recurring_obligation', 'savings_gap', 'document_gap', 'custom')),
  severity             TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title                TEXT NOT NULL,
  summary              TEXT NOT NULL,
  action_hint          TEXT,
  confidence_score     NUMERIC,
  related_record_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_by         TEXT NOT NULL DEFAULT 'system',
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_insights_user_generated
  ON financial_insights(user_id, generated_at DESC);

ALTER TABLE financial_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_insights_self"
  ON financial_insights
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS financial_preferences (
  user_id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone                  TEXT,
  monthly_income_anchor_day SMALLINT,
  risk_tolerance            TEXT CHECK (risk_tolerance IN ('conservative', 'balanced', 'assertive')),
  reminder_default_days     SMALLINT,
  privacy_notice_ack_at     TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_preferences_self"
  ON financial_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


DROP TRIGGER IF EXISTS trg_financial_documents_updated_at ON financial_documents;
CREATE TRIGGER trg_financial_documents_updated_at
BEFORE UPDATE ON financial_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_financial_document_extractions_updated_at ON financial_document_extractions;
CREATE TRIGGER trg_financial_document_extractions_updated_at
BEFORE UPDATE ON financial_document_extractions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_financial_obligations_updated_at ON financial_obligations;
CREATE TRIGGER trg_financial_obligations_updated_at
BEFORE UPDATE ON financial_obligations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_financial_savings_goals_updated_at ON financial_savings_goals;
CREATE TRIGGER trg_financial_savings_goals_updated_at
BEFORE UPDATE ON financial_savings_goals
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_financial_calendar_events_updated_at ON financial_calendar_events;
CREATE TRIGGER trg_financial_calendar_events_updated_at
BEFORE UPDATE ON financial_calendar_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_financial_insights_updated_at ON financial_insights;
CREATE TRIGGER trg_financial_insights_updated_at
BEFORE UPDATE ON financial_insights
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_financial_preferences_updated_at ON financial_preferences;
CREATE TRIGGER trg_financial_preferences_updated_at
BEFORE UPDATE ON financial_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
