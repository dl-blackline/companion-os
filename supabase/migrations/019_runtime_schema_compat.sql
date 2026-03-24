-- ============================================================
-- Migration 019: Runtime schema compatibility for drifted tables
-- ============================================================
-- Purpose:
-- Align live table shapes with what the runtime code currently writes.
-- This is non-destructive: only additive columns, safe backfills, and
-- policy updates where needed.
--
-- Affected runtime modules:
-- - lib/skill-engine.js
-- - lib/agent-manager.js
-- - lib/orchestrator.js
-- - lib/companion-brain.js
-- ============================================================

-- ------------------------------------------------------------
-- skills
-- ------------------------------------------------------------
-- Runtime expects: user_id, name, category, proficiency, updated_at

ALTER TABLE skills ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS proficiency double precision DEFAULT 0;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skills_proficiency_check'
      AND conrelid = 'public.skills'::regclass
  ) THEN
    ALTER TABLE skills
      ADD CONSTRAINT skills_proficiency_check
      CHECK (proficiency >= 0 AND proficiency <= 1);
  END IF;
END $$;

-- Runtime upsert uses onConflict user_id,name
CREATE UNIQUE INDEX IF NOT EXISTS skills_user_id_name_uidx
  ON skills (user_id, name)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS skills_user_id_idx
  ON skills (user_id);

-- Switch from shared-read policy to owner/admin now that user_id exists.
DROP POLICY IF EXISTS "skills_read" ON skills;
DROP POLICY IF EXISTS "skills_owner_all" ON skills;
DROP POLICY IF EXISTS "skills_admin_read" ON skills;

CREATE POLICY "skills_owner_all" ON skills
  FOR ALL USING (user_id = auth.uid()::text);

CREATE POLICY "skills_admin_read" ON skills
  FOR SELECT USING (is_admin(auth.uid()));


-- ------------------------------------------------------------
-- skill_usage
-- ------------------------------------------------------------
-- Runtime writes: user_id, skill_name, context

ALTER TABLE skill_usage ADD COLUMN IF NOT EXISTS skill_name text;
ALTER TABLE skill_usage ADD COLUMN IF NOT EXISTS context text DEFAULT '';

-- Backfill skill_name from skill_id where possible.
UPDATE skill_usage su
SET skill_name = s.name
FROM skills s
WHERE su.skill_name IS NULL
  AND su.skill_id IS NOT NULL
  AND su.skill_id = s.id;

CREATE INDEX IF NOT EXISTS skill_usage_user_id_idx
  ON skill_usage (user_id);


-- ------------------------------------------------------------
-- skill_suggestions
-- ------------------------------------------------------------
-- Runtime writes/reads: user_id, skill_name, reason, priority, dismissed

ALTER TABLE skill_suggestions ADD COLUMN IF NOT EXISTS skill_name text;
ALTER TABLE skill_suggestions ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE skill_suggestions ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE skill_suggestions ADD COLUMN IF NOT EXISTS dismissed boolean DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skill_suggestions_priority_check'
      AND conrelid = 'public.skill_suggestions'::regclass
  ) THEN
    ALTER TABLE skill_suggestions
      ADD CONSTRAINT skill_suggestions_priority_check
      CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
END $$;

-- Backfill from proposed_skill json when available.
UPDATE skill_suggestions
SET
  skill_name = COALESCE(skill_name, proposed_skill->>'skill_name'),
  reason = COALESCE(reason, proposed_skill->>'reason'),
  priority = COALESCE(priority, proposed_skill->>'priority', 'medium'),
  dismissed = COALESCE(dismissed, status = 'dismissed')
WHERE proposed_skill IS NOT NULL;

CREATE INDEX IF NOT EXISTS skill_suggestions_user_id_idx
  ON skill_suggestions (user_id);


-- ------------------------------------------------------------
-- agent_tasks
-- ------------------------------------------------------------
-- Runtime writes/reads: task_description and started_at.

ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS task_description text;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Backfill task_description from legacy task column if present.
UPDATE agent_tasks
SET task_description = COALESCE(task_description, task)
WHERE task_description IS NULL;
