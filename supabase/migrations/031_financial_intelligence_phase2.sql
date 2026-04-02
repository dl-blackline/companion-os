-- ============================================================
-- Migration 031: Financial Intelligence Phase 2
-- Income signals, recurring patterns, cash flow, balance snapshots
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Account Balance Snapshots
-- Point-in-time balance records for tracking balance history
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_balance_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  current_balance NUMERIC,
  available_balance NUMERIC,
  iso_currency_code TEXT DEFAULT 'USD',
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  source          TEXT NOT NULL DEFAULT 'sync' CHECK (source IN ('sync', 'manual', 'refresh')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user_date
  ON account_balance_snapshots(user_id, snapshot_date DESC);

ALTER TABLE account_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balance_snapshots_self"
  ON account_balance_snapshots
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 2. Recurring Income Signals
-- Detected likely income patterns from transaction analysis
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_income_signals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_name       TEXT NOT NULL,
  detected_source   TEXT,
  frequency         TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'irregular')),
  estimated_amount  NUMERIC NOT NULL DEFAULT 0,
  amount_variance   NUMERIC DEFAULT 0,
  confidence_score  NUMERIC NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  last_occurrence   DATE,
  next_expected     DATE,
  occurrence_count  INTEGER NOT NULL DEFAULT 0,
  sample_transaction_ids UUID[] DEFAULT '{}',
  is_user_confirmed BOOLEAN NOT NULL DEFAULT false,
  user_label        TEXT,
  status            TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'confirmed', 'dismissed', 'expired')),
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_signals_user
  ON recurring_income_signals(user_id, status);

ALTER TABLE recurring_income_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_signals_self"
  ON recurring_income_signals
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 3. Recurring Expense Signals
-- Detected recurring outflows/bills from transaction analysis
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_expense_signals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_name       TEXT NOT NULL,
  merchant_name     TEXT,
  category          TEXT NOT NULL DEFAULT 'other',
  frequency         TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'annual', 'irregular')),
  estimated_amount  NUMERIC NOT NULL DEFAULT 0,
  amount_variance   NUMERIC DEFAULT 0,
  confidence_score  NUMERIC NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  last_occurrence   DATE,
  next_expected     DATE,
  occurrence_count  INTEGER NOT NULL DEFAULT 0,
  sample_transaction_ids UUID[] DEFAULT '{}',
  is_user_confirmed BOOLEAN NOT NULL DEFAULT false,
  user_label        TEXT,
  linked_obligation_id UUID REFERENCES financial_obligations(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'confirmed', 'dismissed', 'expired')),
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_signals_user
  ON recurring_expense_signals(user_id, status);

ALTER TABLE recurring_expense_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_signals_self"
  ON recurring_expense_signals
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 4. Cash Flow Summaries
-- Monthly aggregated cash flow for trend analysis
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_flow_summaries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  period_label      TEXT NOT NULL,
  total_inflow      NUMERIC NOT NULL DEFAULT 0,
  total_outflow     NUMERIC NOT NULL DEFAULT 0,
  net_flow          NUMERIC NOT NULL DEFAULT 0,
  recurring_inflow  NUMERIC NOT NULL DEFAULT 0,
  recurring_outflow NUMERIC NOT NULL DEFAULT 0,
  non_recurring_inflow  NUMERIC NOT NULL DEFAULT 0,
  non_recurring_outflow NUMERIC NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  top_expense_categories JSONB DEFAULT '[]'::jsonb,
  largest_inflows   JSONB DEFAULT '[]'::jsonb,
  largest_outflows  JSONB DEFAULT '[]'::jsonb,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_summaries_user_period
  ON cash_flow_summaries(user_id, period_start DESC);

ALTER TABLE cash_flow_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_flow_summaries_self"
  ON cash_flow_summaries
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 5. Income Analysis Snapshots
-- Periodic aggregation of income signals into an estimate
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS income_analysis_snapshots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimated_monthly_income NUMERIC NOT NULL DEFAULT 0,
  detected_source_count   INTEGER NOT NULL DEFAULT 0,
  primary_frequency       TEXT,
  confidence_score        NUMERIC NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_breakdown        JSONB DEFAULT '[]'::jsonb,
  analysis_window_start   DATE NOT NULL,
  analysis_window_end     DATE NOT NULL,
  methodology             TEXT NOT NULL DEFAULT 'transaction_pattern',
  notes                   TEXT,
  computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_analysis_user
  ON income_analysis_snapshots(user_id, computed_at DESC);

ALTER TABLE income_analysis_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_analysis_self"
  ON income_analysis_snapshots
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 6. Extend financial_savings_goals with linked account and
--    feasibility context
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_savings_goals' AND column_name = 'linked_account_id') THEN
    ALTER TABLE financial_savings_goals ADD COLUMN linked_account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_savings_goals' AND column_name = 'feasibility_score') THEN
    ALTER TABLE financial_savings_goals ADD COLUMN feasibility_score NUMERIC CHECK (feasibility_score >= 0 AND feasibility_score <= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_savings_goals' AND column_name = 'feasibility_notes') THEN
    ALTER TABLE financial_savings_goals ADD COLUMN feasibility_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_savings_goals' AND column_name = 'estimated_monthly_capacity') THEN
    ALTER TABLE financial_savings_goals ADD COLUMN estimated_monthly_capacity NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_savings_goals' AND column_name = 'pacing_status') THEN
    ALTER TABLE financial_savings_goals ADD COLUMN pacing_status TEXT CHECK (pacing_status IN ('on_track', 'at_risk', 'behind', 'ahead', 'unknown')) DEFAULT 'unknown';
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────
-- Updated-at triggers
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_income_signals_updated_at ON recurring_income_signals;
CREATE TRIGGER trg_income_signals_updated_at
BEFORE UPDATE ON recurring_income_signals
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_expense_signals_updated_at ON recurring_expense_signals;
CREATE TRIGGER trg_expense_signals_updated_at
BEFORE UPDATE ON recurring_expense_signals
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
