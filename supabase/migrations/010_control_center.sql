-- ============================================================
-- Migration 010: Control Center — RBAC, Entitlements, Feature
-- Flags, Audit Logs, Support Tickets, User Preferences
-- ============================================================

-- ─── User Roles ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  granted_by  UUID REFERENCES auth.users(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_write" ON user_roles;

-- SECURITY DEFINER function checks admin status without triggering RLS on user_roles,
-- preventing infinite recursion (PostgreSQL error 42P17).
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role = 'admin'
  );
$$;

-- Admins can view/manage all roles; users can see their own
CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_admin(auth.uid())
  );

CREATE POLICY "user_roles_admin_write" ON user_roles
  FOR ALL USING (
    is_admin(auth.uid())
  );

-- ─── User Entitlements ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_entitlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan            TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise', 'admin_override')) DEFAULT 'free',
  status          TEXT NOT NULL CHECK (status IN ('active', 'trial', 'expired', 'suspended', 'none')) DEFAULT 'active',
  overridden_by   UUID REFERENCES auth.users(id),
  trial_ends_at   TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  features        TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user_id ON user_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_plan ON user_entitlements(plan);

ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entitlements_self_select" ON user_entitlements;
DROP POLICY IF EXISTS "entitlements_admin_all" ON user_entitlements;

CREATE POLICY "entitlements_self_select" ON user_entitlements
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "entitlements_admin_all" ON user_entitlements
  FOR ALL USING (
    is_admin(auth.uid())
  );

-- ─── Feature Flags ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_flags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  enabled             BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage  INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
  admin_only          BOOLEAN NOT NULL DEFAULT false,
  kill_switch         BOOLEAN NOT NULL DEFAULT false,
  category            TEXT NOT NULL CHECK (category IN ('ai','media','voice','memory','billing','beta','ops','security')) DEFAULT 'ops',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags_read_public" ON feature_flags;
DROP POLICY IF EXISTS "feature_flags_admin_write" ON feature_flags;

-- All authenticated users can read non-admin-only flags
CREATE POLICY "feature_flags_read_public" ON feature_flags
  FOR SELECT USING (
    admin_only = false
    OR is_admin(auth.uid())
  );

-- Only admins can write
CREATE POLICY "feature_flags_admin_write" ON feature_flags
  FOR ALL USING (
    is_admin(auth.uid())
  );

-- Seed default feature flags
INSERT INTO feature_flags (key, name, description, enabled, category, admin_only) VALUES
  ('image_generation',     'Image Generation',     'Enable AI image generation features',        true,  'media',    false),
  ('video_generation',     'Video Generation',     'Enable AI video generation features',        true,  'media',    false),
  ('voice_realtime',       'Realtime Voice',       'Enable WebRTC realtime voice conversations', true,  'voice',    false),
  ('memory_long_term',     'Long-term Memory',     'Enable persistent cross-session memory',     true,  'memory',   false),
  ('knowledge_graph',      'Knowledge Graph',      'Enable knowledge graph building',            true,  'memory',   false),
  ('agent_tasks',          'Autonomous Agents',    'Enable autonomous agent task execution',     true,  'ai',       false),
  ('subscription_billing', 'Subscription Billing', 'Enable subscription/payment flows',         false, 'billing',  true),
  ('beta_features',        'Beta Features',        'Gate access to beta/experimental features',  false, 'beta',     false),
  ('maintenance_mode',     'Maintenance Mode',     'Put the platform into maintenance mode',     false, 'ops',      true),
  ('rate_limiting',        'Rate Limiting',        'Enforce per-user rate limits',               true,  'ops',      true),
  ('advanced_models',      'Advanced AI Models',   'Allow access to advanced/expensive models',  true,  'ai',       false),
  ('analytics',            'Analytics',            'Enable usage analytics collection',          true,  'ops',      true)
ON CONFLICT (key) DO NOTHING;

-- ─── Audit Logs ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES auth.users(id),
  actor_email  TEXT,
  action       TEXT NOT NULL,
  target_type  TEXT NOT NULL DEFAULT '',
  target_id    TEXT,
  details      JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_read" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_service_insert" ON audit_logs;

-- Only admins can view audit logs
CREATE POLICY "audit_logs_admin_read" ON audit_logs
  FOR SELECT USING (
    is_admin(auth.uid())
  );

-- Insert is done server-side (service role), not by clients
CREATE POLICY "audit_logs_service_insert" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ─── Support Tickets ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL CHECK (status IN ('open','in_progress','resolved','closed','escalated')) DEFAULT 'open',
  priority     TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')) DEFAULT 'medium',
  category     TEXT NOT NULL CHECK (category IN ('billing','technical','account','abuse','feature_request','other')) DEFAULT 'other',
  admin_notes  TEXT,
  resolution   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_self_select" ON support_tickets;
DROP POLICY IF EXISTS "tickets_admin_all" ON support_tickets;

-- Users can see their own tickets
CREATE POLICY "tickets_self_select" ON support_tickets
  FOR SELECT USING (user_id = auth.uid());

-- Admins can see/write all tickets
CREATE POLICY "tickets_admin_all" ON support_tickets
  FOR ALL USING (
    is_admin(auth.uid())
  );

-- ─── User Preferences ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  prefs       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prefs_self" ON user_preferences;
DROP POLICY IF EXISTS "prefs_admin_read" ON user_preferences;

CREATE POLICY "prefs_self" ON user_preferences
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "prefs_admin_read" ON user_preferences
  FOR SELECT USING (
    is_admin(auth.uid())
  );

-- ─── Updated-at triggers ─────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_user_entitlements_updated_at ON user_entitlements;
CREATE TRIGGER trg_user_entitlements_updated_at
  BEFORE UPDATE ON user_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
