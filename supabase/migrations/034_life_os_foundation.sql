-- ══════════════════════════════════════════════════════════════════════════════
-- 034  Life OS Foundation
-- ══════════════════════════════════════════════════════════════════════════════
-- Upgrades Companion from disconnected feature sections into a unified personal
-- operating system. Goals, finance, calendar, tasks, and obligations now share
-- context through a coordination layer.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Extend user_goals with financial + life OS fields ─────────────────

-- Link goals to finance: a goal can optionally have a target amount and
-- be linked to a financial_savings_goal for two-way sync.
ALTER TABLE user_goals
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS current_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_pace NUMERIC,
  ADD COLUMN IF NOT EXISTS financial_goal_id UUID REFERENCES financial_savings_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS life_category TEXT DEFAULT 'personal'
    CHECK (life_category IN (
      'financial', 'health', 'career', 'relationship',
      'business', 'education', 'creative', 'personal'
    )),
  ADD COLUMN IF NOT EXISTS is_financial BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feasibility_score NUMERIC,
  ADD COLUMN IF NOT EXISTS feasibility_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_coordinated_at TIMESTAMPTZ;

-- Index for financial goal lookups
CREATE INDEX IF NOT EXISTS idx_user_goals_financial_goal
  ON user_goals(financial_goal_id) WHERE financial_goal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_goals_life_category
  ON user_goals(user_id, life_category);

-- ─── 2. Add linked_goal_id to financial_savings_goals ─────────────────────

ALTER TABLE financial_savings_goals
  ADD COLUMN IF NOT EXISTS linked_goal_id UUID,
  ADD COLUMN IF NOT EXISTS pace_status TEXT DEFAULT 'on_track'
    CHECK (pace_status IN ('on_track', 'at_risk', 'behind', 'ahead', 'completed'));

-- ─── 3. Life Coordination Signals ────────────────────────────────────────
-- Cross-system signals that connect goals, finance, calendar, and planning.
-- When something changes in one system, a signal is emitted so the others
-- can react. This is the glue that makes Companion feel unified.

CREATE TABLE IF NOT EXISTS life_coordination_signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type   TEXT NOT NULL CHECK (signal_type IN (
    -- Goal → Finance
    'goal_financial_created',
    'goal_financial_updated',
    'goal_financial_completed',
    -- Finance → Goal
    'savings_pace_on_track',
    'savings_pace_at_risk',
    'savings_pace_behind',
    'cash_flow_insufficient',
    'obligation_threatens_goal',
    -- Goal → Calendar
    'milestone_deadline_created',
    'milestone_completed',
    'goal_deadline_approaching',
    -- Calendar → Planning
    'payment_window_pressure',
    'income_event_upcoming',
    -- Planning → Action
    'action_suggested',
    'plan_generated',
    -- General
    'scorecard_updated',
    'feasibility_assessed',
    'coordination_refresh'
  )),
  source_system TEXT NOT NULL CHECK (source_system IN (
    'goals', 'finance', 'calendar', 'planning', 'scorecard', 'coordination'
  )),
  target_system TEXT NOT NULL CHECK (target_system IN (
    'goals', 'finance', 'calendar', 'planning', 'scorecard', 'all'
  )),
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  title         TEXT NOT NULL,
  summary       TEXT,
  action_hint   TEXT,
  -- Links to related entities
  related_goal_id UUID,
  related_financial_goal_id UUID,
  related_obligation_id UUID,
  related_calendar_event_id UUID,
  -- Payload for any extra context
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Lifecycle
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed', 'expired')),
  resolved_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_life_signals_user_active
  ON life_coordination_signals(user_id, status, created_at DESC)
  WHERE status = 'active';

CREATE INDEX idx_life_signals_user_type
  ON life_coordination_signals(user_id, signal_type);

CREATE INDEX idx_life_signals_goal
  ON life_coordination_signals(related_goal_id)
  WHERE related_goal_id IS NOT NULL;

CREATE INDEX idx_life_signals_financial_goal
  ON life_coordination_signals(related_financial_goal_id)
  WHERE related_financial_goal_id IS NOT NULL;

ALTER TABLE life_coordination_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "life_signals_self"
  ON life_coordination_signals
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 4. Life Plans ──────────────────────────────────────────────────────
-- Periodic plans that aggregate goals, obligations, calendar events,
-- and recommended actions into a coherent "what to do this period."

CREATE TABLE IF NOT EXISTS life_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type   TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  -- Aggregated context
  goals_snapshot  JSONB NOT NULL DEFAULT '[]'::jsonb,
  financial_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  obligations_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  calendar_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Plan output
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_dates     JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks         JSONB NOT NULL DEFAULT '[]'::jsonb,
  narrative     TEXT,
  -- Status
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_life_plans_user_period
  ON life_plans(user_id, period_type, period_start);

ALTER TABLE life_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "life_plans_self"
  ON life_plans
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 5. Add updated_at triggers ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_life_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_life_signals_updated ON life_coordination_signals;
CREATE TRIGGER trg_life_signals_updated
  BEFORE UPDATE ON life_coordination_signals
  FOR EACH ROW EXECUTE FUNCTION update_life_updated_at();

DROP TRIGGER IF EXISTS trg_life_plans_updated ON life_plans;
CREATE TRIGGER trg_life_plans_updated
  BEFORE UPDATE ON life_plans
  FOR EACH ROW EXECUTE FUNCTION update_life_updated_at();

-- ─── 6. Extend financial_calendar_events to link to goals ────────────────

ALTER TABLE financial_calendar_events
  ADD COLUMN IF NOT EXISTS linked_goal_id UUID,
  ADD COLUMN IF NOT EXISTS linked_milestone_title TEXT;

-- ─── 7. Add goal_impact field to financial_insights ──────────────────────

ALTER TABLE financial_insights
  ADD COLUMN IF NOT EXISTS linked_goal_id UUID,
  ADD COLUMN IF NOT EXISTS coordination_context TEXT;
