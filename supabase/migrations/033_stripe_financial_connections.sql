-- ============================================================
-- Migration 033: Stripe Financial Connections
-- Linked accounts, balance snapshots, unified transactions,
-- categories, notes, and webhook idempotency.
-- ============================================================

-- ── Extend financial_connections provider constraint ──
ALTER TABLE financial_connections
  DROP CONSTRAINT IF EXISTS financial_connections_provider_check;
ALTER TABLE financial_connections
  ADD CONSTRAINT financial_connections_provider_check
  CHECK (provider IN ('plaid', 'stripe'));

-- Allow nullable item_id + access_token for Stripe FC (they use different identifiers)
ALTER TABLE financial_connections
  ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE financial_connections
  ALTER COLUMN access_token DROP NOT NULL;

-- Add Stripe-specific columns to financial_connections
ALTER TABLE financial_connections
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS account_display_name TEXT,
  ADD COLUMN IF NOT EXISTS account_last4 TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT,
  ADD COLUMN IF NOT EXISTS account_subtype TEXT,
  ADD COLUMN IF NOT EXISTS livemode BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;

-- Unique constraint for Stripe FC accounts (full constraint, not partial index,
-- so PostgREST ON CONFLICT works correctly)
ALTER TABLE financial_connections
  ADD CONSTRAINT uq_financial_connections_stripe_account
  UNIQUE (user_id, stripe_account_id);

-- ── Balance snapshots ──
CREATE TABLE IF NOT EXISTS account_balance_snapshots (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id               UUID NOT NULL REFERENCES financial_connections(id) ON DELETE CASCADE,
  available_balance           NUMERIC,
  current_balance             NUMERIC,
  currency                    TEXT DEFAULT 'usd',
  as_of                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_snapshots_connection
  ON account_balance_snapshots(connection_id, as_of DESC);

CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user
  ON account_balance_snapshots(user_id);

ALTER TABLE account_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balance_snapshots_self"
  ON account_balance_snapshots
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Unified / normalized transactions ──
CREATE TABLE IF NOT EXISTS normalized_transactions (
  id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id                       UUID NOT NULL REFERENCES financial_connections(id) ON DELETE CASCADE,
  stripe_transaction_id               TEXT,
  stripe_financial_connections_account_id TEXT,
  institution_name                    TEXT,
  account_display_name                TEXT,
  account_last4                       TEXT,
  account_subtype                     TEXT,
  transaction_date                    DATE,
  posted_at                           TIMESTAMPTZ,
  amount                              NUMERIC NOT NULL,
  direction                           TEXT CHECK (direction IN ('inflow', 'outflow')),
  description                         TEXT,
  merchant_name                       TEXT,
  category                            TEXT,
  user_category_override              TEXT,
  notes                               TEXT,
  status                              TEXT DEFAULT 'posted' CHECK (status IN ('posted', 'pending')),
  livemode                            BOOLEAN DEFAULT true,
  raw_metadata                        JSONB DEFAULT '{}'::jsonb,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, stripe_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_normalized_transactions_user_date
  ON normalized_transactions(user_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_normalized_transactions_connection
  ON normalized_transactions(connection_id);

CREATE INDEX IF NOT EXISTS idx_normalized_transactions_category
  ON normalized_transactions(user_id, category);

CREATE INDEX IF NOT EXISTS idx_normalized_transactions_merchant
  ON normalized_transactions(user_id, merchant_name);

ALTER TABLE normalized_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "normalized_transactions_self"
  ON normalized_transactions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Transaction categories catalog ──
CREATE TABLE IF NOT EXISTS transaction_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  icon            TEXT,
  color           TEXT,
  is_system       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_categories_self"
  ON transaction_categories
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Webhook events processed (idempotency) ──
CREATE TABLE IF NOT EXISTS webhook_events_processed (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_summary JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_id
  ON webhook_events_processed(event_id);

-- No RLS on webhook_events_processed — only server-side access via service role

-- ── Triggers ──
DROP TRIGGER IF EXISTS trg_normalized_transactions_updated_at ON normalized_transactions;
CREATE TRIGGER trg_normalized_transactions_updated_at
BEFORE UPDATE ON normalized_transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
