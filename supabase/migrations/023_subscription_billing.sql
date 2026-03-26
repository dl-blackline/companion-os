-- ============================================================
-- Migration 023: Stripe-backed subscription billing foundation
-- ============================================================

-- Customer mapping between Supabase auth users and Stripe customers.
CREATE TABLE IF NOT EXISTS billing_customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id  TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_user_id ON billing_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_customers_customer_id ON billing_customers(stripe_customer_id);

ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_customers_self_select" ON billing_customers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "billing_customers_admin_all" ON billing_customers
  FOR ALL USING (is_admin(auth.uid()));


-- Subscription snapshot persisted from Stripe webhooks.
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id     TEXT,
  stripe_price_id        TEXT,
  status                 TEXT NOT NULL DEFAULT 'incomplete',
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT false,
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id ON billing_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer_id ON billing_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON billing_subscriptions(status);

ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_subscriptions_self_select" ON billing_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "billing_subscriptions_admin_all" ON billing_subscriptions
  FOR ALL USING (is_admin(auth.uid()));


-- Keep updated_at fresh whenever rows are modified.
DROP TRIGGER IF EXISTS trg_billing_customers_updated_at ON billing_customers;
CREATE TRIGGER trg_billing_customers_updated_at
BEFORE UPDATE ON billing_customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_billing_subscriptions_updated_at ON billing_subscriptions;
CREATE TRIGGER trg_billing_subscriptions_updated_at
BEFORE UPDATE ON billing_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Turn on billing feature flag when migration is applied.
UPDATE feature_flags
SET enabled = true, updated_at = now()
WHERE key = 'subscription_billing';
