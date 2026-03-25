-- ============================================================
-- Migration 024: Feature usage events for plan quota enforcement
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_usage_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key  TEXT NOT NULL CHECK (feature_key IN ('media_generation', 'agent_task')),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_events_user_feature_created
  ON feature_usage_events (user_id, feature_key, created_at DESC);

ALTER TABLE feature_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_usage_events_self_select" ON feature_usage_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "feature_usage_events_admin_read" ON feature_usage_events
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "feature_usage_events_service_insert" ON feature_usage_events
  FOR INSERT WITH CHECK (true);
