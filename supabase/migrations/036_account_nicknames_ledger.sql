-- ============================================================
-- Migration 036: Account Nicknames, Notes & Ledger Entries
-- ============================================================

-- ── Add nickname and notes columns to financial_connections ──
ALTER TABLE financial_connections
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS user_notes TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- ── Ledger entries — planned/scheduled future money movements ──
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id   UUID REFERENCES financial_connections(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  amount          NUMERIC NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  due_date        DATE NOT NULL,
  recurrence      TEXT CHECK (recurrence IN ('once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
  category        TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'overdue')),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_due
  ON ledger_entries(user_id, due_date);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_connection
  ON ledger_entries(connection_id);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_entries_self" ON ledger_entries;
CREATE POLICY "ledger_entries_self"
  ON ledger_entries
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_ledger_entries_updated_at ON ledger_entries;
CREATE TRIGGER trg_ledger_entries_updated_at
BEFORE UPDATE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
