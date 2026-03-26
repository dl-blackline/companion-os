-- ============================================================
-- Migration 026: Career management (resume versions + job targets)
-- ============================================================

CREATE TABLE IF NOT EXISTS career_resume_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT,
  target_role      TEXT,
  job_description  TEXT,
  resume_text      TEXT NOT NULL,
  notes            TEXT,
  is_primary       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_resume_versions_user_id
  ON career_resume_versions(user_id);

ALTER TABLE career_resume_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_resume_versions_self"
  ON career_resume_versions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS career_job_targets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company          TEXT,
  role             TEXT NOT NULL,
  location         TEXT,
  seniority        TEXT,
  job_url          TEXT,
  status           TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'applied', 'interviewing', 'offer', 'rejected', 'paused')),
  priority         SMALLINT NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_job_targets_user_id
  ON career_job_targets(user_id);

CREATE INDEX IF NOT EXISTS idx_career_job_targets_user_status
  ON career_job_targets(user_id, status);

ALTER TABLE career_job_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_job_targets_self"
  ON career_job_targets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


DROP TRIGGER IF EXISTS trg_career_resume_versions_updated_at ON career_resume_versions;
CREATE TRIGGER trg_career_resume_versions_updated_at
BEFORE UPDATE ON career_resume_versions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_career_job_targets_updated_at ON career_job_targets;
CREATE TRIGGER trg_career_job_targets_updated_at
BEFORE UPDATE ON career_job_targets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
