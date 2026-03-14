-- Tarot AI Phase 2: Reading persistence, email leads, analytics
-- Creates all tables needed for the Tarot AI feature.

-- Reading sessions
CREATE TABLE IF NOT EXISTS reading_sessions (
  id            TEXT        PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_name    TEXT        NOT NULL,
  date_of_birth DATE        NOT NULL,
  zodiac_sign   TEXT        NOT NULL,
  zodiac_symbol TEXT,
  zodiac_element TEXT,
  spread_type   TEXT        NOT NULL DEFAULT 'three-card',
  status        TEXT        NOT NULL DEFAULT 'PENDING',
  summary       TEXT,
  energy_theme  TEXT,
  zodiac_note   TEXT
);

-- Per-card results for a session
CREATE TABLE IF NOT EXISTS reading_card_results (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id     TEXT        NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
  card_id        TEXT        NOT NULL,
  card_name      TEXT        NOT NULL,
  card_arcana    TEXT        NOT NULL,
  card_suit      TEXT,
  position       INT         NOT NULL,
  position_label TEXT        NOT NULL,
  is_reversed    BOOLEAN     NOT NULL DEFAULT FALSE,
  interpretation TEXT        NOT NULL,
  UNIQUE (session_id, position)
);

-- Email lead capture
CREATE TABLE IF NOT EXISTS tarot_email_leads (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email       TEXT        NOT NULL UNIQUE,
  first_name  TEXT,
  source      TEXT        NOT NULL DEFAULT 'reading-save',
  zodiac_sign TEXT,
  session_id  TEXT,
  metadata    JSONB
);

-- Product recommendations generated at reading time
CREATE TABLE IF NOT EXISTS tarot_product_recommendations (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id  TEXT        NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
  offer_id    TEXT        NOT NULL,
  reason      TEXT,
  score       FLOAT       NOT NULL DEFAULT 1.0,
  position    INT         NOT NULL DEFAULT 0
);

-- Analytics / funnel events
CREATE TABLE IF NOT EXISTS tarot_analytics_events (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_name  TEXT        NOT NULL,
  session_id  TEXT,
  offer_id    TEXT,
  properties  JSONB
);

-- Auto-update updated_at on reading_sessions
CREATE OR REPLACE FUNCTION update_reading_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reading_sessions_updated_at ON reading_sessions;
CREATE TRIGGER trg_reading_sessions_updated_at
  BEFORE UPDATE ON reading_sessions
  FOR EACH ROW EXECUTE FUNCTION update_reading_session_updated_at();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_reading_card_results_session_id ON reading_card_results(session_id);
CREATE INDEX IF NOT EXISTS idx_tarot_email_leads_email        ON tarot_email_leads(email);
CREATE INDEX IF NOT EXISTS idx_tarot_analytics_events_session ON tarot_analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_tarot_analytics_events_name    ON tarot_analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_tarot_recommendations_session  ON tarot_product_recommendations(session_id);
