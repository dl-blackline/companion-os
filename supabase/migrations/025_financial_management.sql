-- ============================================================
-- Migration 025: Financial management (bank links + health pulse)
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL DEFAULT 'plaid' CHECK (provider IN ('plaid')),
  item_id           TEXT NOT NULL UNIQUE,
  access_token      TEXT NOT NULL,
  institution_name  TEXT,
  status            TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'disconnected')),
  cursor            TEXT,
  last_sync_at      TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, item_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_connections_user_id
  ON financial_connections(user_id);

ALTER TABLE financial_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_connections_self"
  ON financial_connections
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS financial_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id      UUID NOT NULL REFERENCES financial_connections(id) ON DELETE CASCADE,
  account_id         TEXT NOT NULL,
  name               TEXT,
  official_name      TEXT,
  mask               TEXT,
  type               TEXT,
  subtype            TEXT,
  current_balance    NUMERIC,
  available_balance  NUMERIC,
  iso_currency_code  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_user_id
  ON financial_accounts(user_id);

ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_accounts_self"
  ON financial_accounts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS financial_transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id             UUID NOT NULL REFERENCES financial_connections(id) ON DELETE CASCADE,
  account_id                TEXT NOT NULL,
  provider_transaction_id   TEXT NOT NULL,
  name                      TEXT,
  merchant_name             TEXT,
  amount                    NUMERIC NOT NULL,
  iso_currency_code         TEXT,
  category                  TEXT[],
  pending                   BOOLEAN NOT NULL DEFAULT false,
  authorized_date           DATE,
  transaction_date          DATE,
  raw                       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, provider_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_id_date
  ON financial_transactions(user_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_account_id
  ON financial_transactions(account_id);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_transactions_self"
  ON financial_transactions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


DROP TRIGGER IF EXISTS trg_financial_connections_updated_at ON financial_connections;
CREATE TRIGGER trg_financial_connections_updated_at
BEFORE UPDATE ON financial_connections
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_financial_accounts_updated_at ON financial_accounts;
CREATE TRIGGER trg_financial_accounts_updated_at
BEFORE UPDATE ON financial_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_financial_transactions_updated_at ON financial_transactions;
CREATE TRIGGER trg_financial_transactions_updated_at
BEFORE UPDATE ON financial_transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
