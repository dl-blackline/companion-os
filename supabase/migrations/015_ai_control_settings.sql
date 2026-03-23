-- ============================================================
-- Migration 015: AI Control Center settings tables
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tone            TEXT NOT NULL CHECK (tone IN ('professional', 'warm', 'direct', 'coach', 'analytical')) DEFAULT 'direct',
  memory_enabled  BOOLEAN NOT NULL DEFAULT true,
  capabilities    JSONB NOT NULL DEFAULT '{"chat": true, "voice": true, "image": true, "video": false}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  model         TEXT NOT NULL DEFAULT 'gpt-4o',
  temperature   DOUBLE PRECISION NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),
  max_tokens    INTEGER NOT NULL DEFAULT 2000 CHECK (max_tokens >= 256 AND max_tokens <= 8000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON ai_settings(user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_self" ON user_settings
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_settings_self" ON ai_settings
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
