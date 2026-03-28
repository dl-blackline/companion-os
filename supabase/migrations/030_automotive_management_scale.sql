-- ============================================================
-- Migration 030: Automotive finance Phase 5 management scale
-- Multi-user, multi-store, permissions, approvals, templates,
-- playbooks, governance, accountability, and executive reporting.
-- ============================================================

-- ── Organization / Store Hierarchy ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_name    TEXT NOT NULL,
  group_code    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_groups_owner
  ON automotive_groups(owner_user_id, is_active, created_at DESC);

ALTER TABLE automotive_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_groups_owner"
  ON automotive_groups FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS automotive_stores (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id                UUID REFERENCES automotive_groups(id) ON DELETE SET NULL,
  store_name              TEXT NOT NULL,
  store_code              TEXT,
  timezone                TEXT NOT NULL DEFAULT 'America/Chicago',
  address                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_template_set_id  UUID,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_stores_owner_group
  ON automotive_stores(owner_user_id, group_id, is_active);

ALTER TABLE automotive_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_stores_owner"
  ON automotive_stores FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS automotive_user_profiles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name           TEXT,
  email                  TEXT,
  global_role            TEXT NOT NULL DEFAULT 'finance_manager'
    CHECK (global_role IN (
      'finance_manager',
      'senior_finance_manager',
      'finance_director',
      'desk_manager',
      'general_sales_manager',
      'store_admin',
      'group_admin',
      'owner_executive',
      'read_only_analyst'
    )),
  default_store_id       UUID REFERENCES automotive_stores(id) ON DELETE SET NULL,
  can_access_sensitive_data BOOLEAN NOT NULL DEFAULT false,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_automotive_user_profiles_owner_role
  ON automotive_user_profiles(owner_user_id, global_role, is_active);

ALTER TABLE automotive_user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_user_profiles_owner"
  ON automotive_user_profiles FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS automotive_user_store_memberships (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id               UUID NOT NULL REFERENCES automotive_stores(id) ON DELETE CASCADE,
  role_at_store          TEXT NOT NULL DEFAULT 'finance_manager'
    CHECK (role_at_store IN (
      'finance_manager',
      'senior_finance_manager',
      'finance_director',
      'desk_manager',
      'general_sales_manager',
      'store_admin',
      'group_admin',
      'owner_executive',
      'read_only_analyst'
    )),
  can_manage_users       BOOLEAN NOT NULL DEFAULT false,
  can_manage_integrations BOOLEAN NOT NULL DEFAULT false,
  can_view_commissions   BOOLEAN NOT NULL DEFAULT false,
  can_override_income    BOOLEAN NOT NULL DEFAULT false,
  can_override_structure BOOLEAN NOT NULL DEFAULT false,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  assigned_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_automotive_user_store_memberships_owner
  ON automotive_user_store_memberships(owner_user_id, user_id, store_id, is_active);

ALTER TABLE automotive_user_store_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_user_store_memberships_owner"
  ON automotive_user_store_memberships FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ── Permission Model ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_permission_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  category      TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automotive_role_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automotive_role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key      TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_key, permission_key)
);

-- ── Store / Group Scoped Standards and Templates ─────────────────────────
CREATE TABLE IF NOT EXISTS automotive_template_sets (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id               UUID REFERENCES automotive_groups(id) ON DELETE CASCADE,
  store_id               UUID REFERENCES automotive_stores(id) ON DELETE CASCADE,
  set_name               TEXT NOT NULL,
  description            TEXT,
  is_default             BOOLEAN NOT NULL DEFAULT false,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_template_sets_scope
  ON automotive_template_sets(owner_user_id, group_id, store_id, is_active);

ALTER TABLE automotive_template_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_template_sets_owner"
  ON automotive_template_sets FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS automotive_templates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id                 UUID NOT NULL REFERENCES automotive_template_sets(id) ON DELETE CASCADE,
  store_id               UUID REFERENCES automotive_stores(id) ON DELETE CASCADE,
  template_type          TEXT NOT NULL
    CHECK (template_type IN (
      'deal_intake',
      'missing_doc_checklist',
      'scorecard_standard',
      'menu_template',
      'customer_presentation',
      'lender_follow_up',
      'cit_workflow',
      'cancellation_workflow',
      'reporting_preset',
      'coaching_template',
      'objection_library',
      'fi_script'
    )),
  template_name          TEXT NOT NULL,
  version_number         INTEGER NOT NULL DEFAULT 1,
  status                 TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  applies_to_deal_types  TEXT[] NOT NULL DEFAULT ARRAY['retail'],
  is_default             BOOLEAN NOT NULL DEFAULT false,
  payload                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (set_id, template_type, template_name, version_number)
);

CREATE INDEX IF NOT EXISTS idx_automotive_templates_scope
  ON automotive_templates(owner_user_id, set_id, template_type, status);

ALTER TABLE automotive_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_templates_owner"
  ON automotive_templates FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ── Lender Playbooks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_lender_playbooks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id                UUID REFERENCES automotive_stores(id) ON DELETE CASCADE,
  lender_id               UUID REFERENCES automotive_lenders(id) ON DELETE CASCADE,
  playbook_name           TEXT NOT NULL,
  version_number          INTEGER NOT NULL DEFAULT 1,
  status                  TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  tendencies              JSONB NOT NULL DEFAULT '{}'::jsonb,
  callback_patterns       JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferred_deal_types    TEXT[] NOT NULL DEFAULT ARRAY['retail'],
  pti_dti_guidance        JSONB NOT NULL DEFAULT '{}'::jsonb,
  stip_expectations       JSONB NOT NULL DEFAULT '{}'::jsonb,
  backend_tolerance_notes TEXT,
  common_pitfalls         JSONB NOT NULL DEFAULT '[]'::jsonb,
  escalation_notes        TEXT,
  source_doc_refs         JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_notes          JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_inference_notes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, store_id, lender_id, playbook_name, version_number)
);

CREATE INDEX IF NOT EXISTS idx_automotive_lender_playbooks_scope
  ON automotive_lender_playbooks(owner_user_id, store_id, lender_id, status);

ALTER TABLE automotive_lender_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_lender_playbooks_owner"
  ON automotive_lender_playbooks FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ── Approvals / Reviews / Escalations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_approval_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id               UUID REFERENCES automotive_stores(id) ON DELETE SET NULL,
  deal_id                UUID REFERENCES automotive_deals(id) ON DELETE CASCADE,
  request_type           TEXT NOT NULL
    CHECK (request_type IN (
      'structure_review',
      'income_override',
      'structure_override',
      'menu_approval',
      'callback_escalation',
      'guideline_conflict',
      'exception_case',
      'cancellation_review',
      'commission_discrepancy',
      'cit_escalation'
    )),
  status                 TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'revise_required', 'cancelled')),
  priority               TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  requested_by_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_reviewer_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_note         TEXT,
  decision_note          TEXT,
  decision_at            TIMESTAMPTZ,
  due_at                 TIMESTAMPTZ,
  payload                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_approval_requests_scope
  ON automotive_approval_requests(owner_user_id, store_id, status, request_type, created_at DESC);

ALTER TABLE automotive_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_approval_requests_owner"
  ON automotive_approval_requests FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS automotive_approval_decisions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approval_request_id    UUID NOT NULL REFERENCES automotive_approval_requests(id) ON DELETE CASCADE,
  action                 TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'revise_required', 'comment')),
  actor_user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note                   TEXT,
  payload                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_approval_decisions_req
  ON automotive_approval_decisions(owner_user_id, approval_request_id, created_at DESC);

ALTER TABLE automotive_approval_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_approval_decisions_owner"
  ON automotive_approval_decisions FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ── Accountability / Audit / SLA / Coaching ───────────────────────────────
CREATE TABLE IF NOT EXISTS automotive_audit_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id               UUID REFERENCES automotive_stores(id) ON DELETE SET NULL,
  deal_id                UUID REFERENCES automotive_deals(id) ON DELETE SET NULL,
  actor_user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  area                   TEXT NOT NULL,
  action                 TEXT NOT NULL,
  entity_type            TEXT NOT NULL,
  entity_id              UUID,
  before_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_audit_events_scope
  ON automotive_audit_events(owner_user_id, store_id, deal_id, created_at DESC);

ALTER TABLE automotive_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_audit_events_owner"
  ON automotive_audit_events FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS automotive_deal_sla_tracking (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id               UUID REFERENCES automotive_stores(id) ON DELETE CASCADE,
  deal_id                UUID NOT NULL REFERENCES automotive_deals(id) ON DELETE CASCADE,
  stage                  TEXT NOT NULL,
  entered_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at                 TIMESTAMPTZ,
  exited_at              TIMESTAMPTZ,
  owner_user_id_assigned UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_overdue             BOOLEAN NOT NULL DEFAULT false,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_deal_sla_tracking_scope
  ON automotive_deal_sla_tracking(owner_user_id, store_id, stage, is_overdue, entered_at DESC);

ALTER TABLE automotive_deal_sla_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_deal_sla_tracking_owner"
  ON automotive_deal_sla_tracking FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS automotive_coaching_notes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id               UUID REFERENCES automotive_stores(id) ON DELETE SET NULL,
  manager_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deal_id                UUID REFERENCES automotive_deals(id) ON DELETE SET NULL,
  note_type              TEXT NOT NULL
    CHECK (note_type IN ('structure', 'callback', 'docs', 'menu', 'cancellation', 'cit', 'commission', 'general')),
  title                  TEXT NOT NULL,
  body                   TEXT NOT NULL,
  tags                   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_reference_case      BOOLEAN NOT NULL DEFAULT false,
  reference_case_label   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automotive_coaching_notes_scope
  ON automotive_coaching_notes(owner_user_id, store_id, target_user_id, note_type, created_at DESC);

ALTER TABLE automotive_coaching_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automotive_coaching_notes_owner"
  ON automotive_coaching_notes FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ── Extend existing tables for scale/governance ───────────────────────────
ALTER TABLE automotive_deals
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES automotive_stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_step_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_step_owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automotive_deals_store_status
  ON automotive_deals(user_id, store_id, status, updated_at DESC);

ALTER TABLE automotive_fi_products
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES automotive_stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS managed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automotive_fi_products_store
  ON automotive_fi_products(user_id, store_id, category, is_active);

ALTER TABLE automotive_commission_records
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES automotive_stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS projected_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS finalized_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_automotive_commission_records_store
  ON automotive_commission_records(user_id, store_id, status, created_at DESC);

-- ── Seed system role/permission definitions ───────────────────────────────
INSERT INTO automotive_role_definitions (key, label, description, is_system)
VALUES
  ('finance_manager', 'Finance Manager', 'Core F&I operational role', true),
  ('senior_finance_manager', 'Senior Finance Manager', 'Senior operator with limited override rights', true),
  ('finance_director', 'Finance Director', 'Leadership oversight and approvals', true),
  ('desk_manager', 'Desk Manager', 'Deal desk collaborator', true),
  ('general_sales_manager', 'General Sales Manager', 'Sales leadership with oversight visibility', true),
  ('store_admin', 'Store Admin', 'Store-level administration and standards', true),
  ('group_admin', 'Group Admin', 'Group-level administration and governance', true),
  ('owner_executive', 'Owner / Executive', 'Executive read/write strategic access', true),
  ('read_only_analyst', 'Read-only Analyst', 'Read-only reporting and analysis role', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO automotive_permission_definitions (key, label, category, description)
VALUES
  ('deal.create', 'Create Deal', 'deals', 'Create deals and initialize intake'),
  ('deal.edit', 'Edit Deal', 'deals', 'Edit non-finalized deal fields'),
  ('docs.review', 'Review Documents', 'docs', 'Review and resolve document issues'),
  ('income.override', 'Income Override', 'underwriting', 'Apply or approve income overrides'),
  ('structure.override', 'Structure Override', 'underwriting', 'Apply or approve structure overrides'),
  ('callback.edit', 'Edit Callback Interpretation', 'lender', 'Edit normalized callback options'),
  ('menu.edit', 'Edit Menus', 'menu', 'Build and edit F&I menus'),
  ('presentation.customer', 'Run Customer Presentation', 'menu', 'Present menu and capture acknowledgments'),
  ('cit.manage', 'Manage CIT', 'post_sale', 'Manage CIT cases and escalations'),
  ('issues.manage', 'Manage Cancellations and Issues', 'post_sale', 'Process cancellations and customer issues'),
  ('guidelines.manage', 'Manage Lender Guidelines', 'lender', 'Upload and maintain lender guidelines'),
  ('products.manage', 'Manage Product Master', 'catalog', 'Edit products, pricing, and active set'),
  ('templates.manage', 'Manage Templates', 'standards', 'Create and maintain standards/templates'),
  ('reporting.store', 'View Store Reporting', 'reporting', 'View store-scoped dashboards and reporting'),
  ('reporting.group', 'View Group Reporting', 'reporting', 'View cross-store executive reporting'),
  ('commissions.view', 'View Commissions', 'compensation', 'View commission records and projections'),
  ('integrations.manage', 'Manage Integrations', 'integration', 'Configure integration sources/destinations'),
  ('users.manage', 'Manage Users', 'admin', 'Create users and assign roles/store memberships'),
  ('audit.view', 'View Audit Trail', 'governance', 'Review accountability/audit events')
ON CONFLICT (key) DO NOTHING;

-- ── updated_at triggers on new mutable tables ─────────────────────────────
DROP TRIGGER IF EXISTS trg_automotive_groups_updated_at ON automotive_groups;
CREATE TRIGGER trg_automotive_groups_updated_at
  BEFORE UPDATE ON automotive_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_stores_updated_at ON automotive_stores;
CREATE TRIGGER trg_automotive_stores_updated_at
  BEFORE UPDATE ON automotive_stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_user_profiles_updated_at ON automotive_user_profiles;
CREATE TRIGGER trg_automotive_user_profiles_updated_at
  BEFORE UPDATE ON automotive_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_user_store_memberships_updated_at ON automotive_user_store_memberships;
CREATE TRIGGER trg_automotive_user_store_memberships_updated_at
  BEFORE UPDATE ON automotive_user_store_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_template_sets_updated_at ON automotive_template_sets;
CREATE TRIGGER trg_automotive_template_sets_updated_at
  BEFORE UPDATE ON automotive_template_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_templates_updated_at ON automotive_templates;
CREATE TRIGGER trg_automotive_templates_updated_at
  BEFORE UPDATE ON automotive_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_lender_playbooks_updated_at ON automotive_lender_playbooks;
CREATE TRIGGER trg_automotive_lender_playbooks_updated_at
  BEFORE UPDATE ON automotive_lender_playbooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_approval_requests_updated_at ON automotive_approval_requests;
CREATE TRIGGER trg_automotive_approval_requests_updated_at
  BEFORE UPDATE ON automotive_approval_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_deal_sla_tracking_updated_at ON automotive_deal_sla_tracking;
CREATE TRIGGER trg_automotive_deal_sla_tracking_updated_at
  BEFORE UPDATE ON automotive_deal_sla_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_automotive_coaching_notes_updated_at ON automotive_coaching_notes;
CREATE TRIGGER trg_automotive_coaching_notes_updated_at
  BEFORE UPDATE ON automotive_coaching_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();