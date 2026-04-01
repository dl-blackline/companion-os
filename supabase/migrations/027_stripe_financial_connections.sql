-- ============================================================
-- Migration 027: Stripe Financial Connections (linked accounts)
-- ============================================================
-- Stores linked bank account metadata from Stripe Financial Connections.
-- Designed for future extension: balances, transactions, ownership,
-- income verification, and account refresh workflows.

CREATE TABLE IF NOT EXISTS stripe_financial_accounts (
  id                                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_financial_connection_account_id  TEXT NOT NULL UNIQUE,
  institution_name                       TEXT,
  account_display_name                   TEXT,
  account_type                           TEXT,
  account_subtype                        TEXT,
  account_status                         TEXT NOT NULL DEFAULT 'active',
  last4                                  TEXT,
  livemode                               BOOLEAN NOT NULL DEFAULT false,
  permissions                            TEXT[] NOT NULL DEFAULT '{}',
  supported_payment_method_types         TEXT[] NOT NULL DEFAULT '{}',
  balance_refresh_status                 TEXT,
  ownership_refresh_status               TEXT,
  transaction_refresh_status             TEXT,
  linked_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                             TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at                        TIMESTAMPTZ,
  metadata                               JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stripe_financial_accounts_user_id
  ON stripe_financial_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_stripe_financial_accounts_status
  ON stripe_financial_accounts(user_id, account_status);

ALTER TABLE stripe_financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_financial_accounts_self_select"
  ON stripe_financial_accounts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "stripe_financial_accounts_admin_all"
  ON stripe_financial_accounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS trg_stripe_financial_accounts_updated_at ON stripe_financial_accounts;
CREATE TRIGGER trg_stripe_financial_accounts_updated_at
BEFORE UPDATE ON stripe_financial_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
