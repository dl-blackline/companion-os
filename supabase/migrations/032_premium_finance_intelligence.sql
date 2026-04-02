-- ============================================================================
-- 032: Premium Finance Intelligence
-- Bill Decoder + Financial Scorecard + Vehicle Equity Intelligence
-- ============================================================================

-- ─── Decoded Bills ──────────────────────────────────────────────────────────
-- Enhanced structured bill records with per-field confidence and review flow.
-- Links back to the source financial_documents record for traceability.
CREATE TABLE decoded_bills (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id             UUID REFERENCES financial_documents(id) ON DELETE SET NULL,
  extraction_id           UUID REFERENCES financial_document_extractions(id) ON DELETE SET NULL,

  -- Classification
  bill_type               TEXT NOT NULL DEFAULT 'other',
  -- credit_card, utility, insurance, loan, phone_internet, rent_mortgage, medical, subscription, other

  -- Provider info
  provider_name           TEXT,
  account_name            TEXT,
  masked_account_number   TEXT,

  -- Dates
  billing_period_start    DATE,
  billing_period_end      DATE,
  issue_date              DATE,
  due_date                DATE,

  -- Amounts
  total_due               NUMERIC(12,2),
  minimum_due             NUMERIC(12,2),
  current_balance         NUMERIC(12,2),
  statement_balance       NUMERIC(12,2),
  past_due_amount         NUMERIC(12,2),
  late_fee                NUMERIC(12,2),
  credit_limit            NUMERIC(12,2),

  -- Indicators
  autopay_detected        BOOLEAN DEFAULT false,
  is_recurring_candidate  BOOLEAN DEFAULT false,

  -- Confidence & provenance
  extraction_confidence   NUMERIC(3,2) DEFAULT 0,
  field_confidence        JSONB DEFAULT '{}',
  -- { provider_name: 0.95, total_due: 0.88, due_date: 0.92, ... }

  -- Review status
  review_status           TEXT NOT NULL DEFAULT 'pending_review',
  -- pending_review | confirmed | rejected | merged

  -- User-confirmed overrides (null = using extracted value)
  confirmed_fields        JSONB DEFAULT '{}',

  -- Linking
  linked_obligation_id    UUID REFERENCES financial_obligations(id) ON DELETE SET NULL,

  -- Timestamps
  decoded_at              TIMESTAMPTZ DEFAULT now(),
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE decoded_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decoded_bills_user" ON decoded_bills FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_decoded_bills_user ON decoded_bills(user_id);
CREATE INDEX idx_decoded_bills_review ON decoded_bills(user_id, review_status);
CREATE INDEX idx_decoded_bills_document ON decoded_bills(document_id);

CREATE TRIGGER set_decoded_bills_updated_at
  BEFORE UPDATE ON decoded_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── User Vehicles ──────────────────────────────────────────────────────────
-- Vehicle records for equity tracking and financial position awareness.
CREATE TABLE user_vehicles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Vehicle info
  year                    INTEGER NOT NULL,
  make                    TEXT NOT NULL,
  model                   TEXT NOT NULL,
  trim                    TEXT,
  mileage                 INTEGER,
  condition               TEXT DEFAULT 'good',
  -- excellent | good | fair | poor

  -- Financial
  current_payoff          NUMERIC(12,2),
  monthly_payment         NUMERIC(12,2),
  lender                  TEXT,
  term_remaining_months   INTEGER,
  interest_rate           NUMERIC(5,2),

  -- Value
  estimated_value         NUMERIC(12,2),
  value_source            TEXT DEFAULT 'user_estimate',
  -- user_estimate | kbb | nada | dealer_appraisal | other
  value_as_of             DATE,

  -- Computed
  equity_position         NUMERIC(12,2) DEFAULT 0,
  -- positive = equity, negative = negative equity

  status                  TEXT NOT NULL DEFAULT 'active',
  -- active | sold | traded

  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_vehicles_user" ON user_vehicles FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_user_vehicles_user ON user_vehicles(user_id);
CREATE INDEX idx_user_vehicles_active ON user_vehicles(user_id, status) WHERE status = 'active';

CREATE TRIGGER set_user_vehicles_updated_at
  BEFORE UPDATE ON user_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── Financial Scorecard Snapshots ──────────────────────────────────────────
-- Point-in-time financial scorecard with per-dimension detail.
CREATE TABLE financial_scorecard_snapshots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Dimension scores (0-100)
  liquidity_score         INTEGER,
  liquidity_label         TEXT,
  liquidity_detail        JSONB DEFAULT '{}',

  bill_pressure_score     INTEGER,
  bill_pressure_label     TEXT,
  bill_pressure_detail    JSONB DEFAULT '{}',

  debt_pressure_score     INTEGER,
  debt_pressure_label     TEXT,
  debt_pressure_detail    JSONB DEFAULT '{}',

  savings_health_score    INTEGER,
  savings_health_label    TEXT,
  savings_health_detail   JSONB DEFAULT '{}',

  organization_score      INTEGER,
  organization_label      TEXT,
  organization_detail     JSONB DEFAULT '{}',

  vehicle_position_score  INTEGER,
  vehicle_position_label  TEXT,
  vehicle_position_detail JSONB DEFAULT '{}',

  -- Composite
  overall_score           INTEGER,
  overall_label           TEXT,
  strongest_area          TEXT,
  most_urgent_area        TEXT,

  -- Guidance
  next_actions            JSONB DEFAULT '[]',
  insights                JSONB DEFAULT '[]',

  computed_at             TIMESTAMPTZ DEFAULT now(),
  created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE financial_scorecard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scorecard_snapshots_user" ON financial_scorecard_snapshots FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_scorecard_user ON financial_scorecard_snapshots(user_id);
CREATE INDEX idx_scorecard_latest ON financial_scorecard_snapshots(user_id, computed_at DESC);

-- ─── Vehicle Equity Snapshots ───────────────────────────────────────────────
-- Historical equity position tracking for vehicles over time.
CREATE TABLE vehicle_equity_snapshots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id              UUID NOT NULL REFERENCES user_vehicles(id) ON DELETE CASCADE,

  estimated_value         NUMERIC(12,2),
  payoff_balance          NUMERIC(12,2),
  equity_position         NUMERIC(12,2),
  value_source            TEXT,

  snapshot_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vehicle_equity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_equity_snapshots_user" ON vehicle_equity_snapshots FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_vehicle_equity_user ON vehicle_equity_snapshots(user_id);
CREATE INDEX idx_vehicle_equity_vehicle ON vehicle_equity_snapshots(vehicle_id, snapshot_date DESC);
CREATE UNIQUE INDEX idx_vehicle_equity_unique ON vehicle_equity_snapshots(vehicle_id, snapshot_date);
