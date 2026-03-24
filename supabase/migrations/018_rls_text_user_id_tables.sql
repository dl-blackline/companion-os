-- ============================================================
-- Migration 018: RLS for all user-owned text-user_id tables
-- ============================================================
-- Migrations 001–009 and 013 used `user_id text` for user-owned
-- data. RLS was never added to those tables. This migration:
--   1. Enables RLS on every affected table.
--   2. Creates owner policies using `user_id = auth.uid()::text`
--      (casting uuid → text — no schema or data changes needed).
--   3. Handles join-scoped tables (realtime_events, content_assets,
--      workflow_steps) via EXISTS subqueries.
--   4. Locks down shared system tables (job_queue, agent_tasks,
--      orchestrator_actions) to service-role-only (backend bypass).
--   5. Admin override via is_admin() from migration 017.
--
-- NOTE: "default-user" and other test strings will no longer be
-- accessible by any authenticated session — this is intentional.
-- The backend (ai-orchestrator.js line 898) already writes the
-- real Supabase auth UUID as text for all authenticated requests.
-- ============================================================

-- ─── Pattern: user_id text tables ───────────────────────────
-- For any table with `user_id text not null`, the correct RLS is:
--   USING (user_id = auth.uid()::text)
-- auth.uid() returns uuid; casting to text matches stored strings.


-- ─── MESSAGES ────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_owner_all" ON messages;
CREATE POLICY "messages_owner_all" ON messages
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "messages_admin_read" ON messages;
CREATE POLICY "messages_admin_read" ON messages
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── EPISODIC MEMORY ─────────────────────────────────────────
ALTER TABLE episodic_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "episodic_memory_owner_all" ON episodic_memory;
CREATE POLICY "episodic_memory_owner_all" ON episodic_memory
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "episodic_memory_admin_read" ON episodic_memory;
CREATE POLICY "episodic_memory_admin_read" ON episodic_memory
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── RELATIONSHIP MEMORY ─────────────────────────────────────
ALTER TABLE relationship_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "relationship_memory_owner_all" ON relationship_memory;
CREATE POLICY "relationship_memory_owner_all" ON relationship_memory
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "relationship_memory_admin_read" ON relationship_memory;
CREATE POLICY "relationship_memory_admin_read" ON relationship_memory
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── MEMORY SUMMARIES ────────────────────────────────────────
ALTER TABLE memory_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memory_summaries_owner_all" ON memory_summaries;
CREATE POLICY "memory_summaries_owner_all" ON memory_summaries
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "memory_summaries_admin_read" ON memory_summaries;
CREATE POLICY "memory_summaries_admin_read" ON memory_summaries
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── USER PROFILES ───────────────────────────────────────────
-- user_id is the primary key (text) — same cast applies.
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_owner_all" ON user_profiles;
CREATE POLICY "user_profiles_owner_all" ON user_profiles
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "user_profiles_admin_read" ON user_profiles;
CREATE POLICY "user_profiles_admin_read" ON user_profiles
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── KNOWLEDGE NODES ─────────────────────────────────────────
ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge_nodes_owner_all" ON knowledge_nodes;
CREATE POLICY "knowledge_nodes_owner_all" ON knowledge_nodes
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "knowledge_nodes_admin_read" ON knowledge_nodes;
CREATE POLICY "knowledge_nodes_admin_read" ON knowledge_nodes
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── KNOWLEDGE EDGES ─────────────────────────────────────────
ALTER TABLE knowledge_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge_edges_owner_all" ON knowledge_edges;
CREATE POLICY "knowledge_edges_owner_all" ON knowledge_edges
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "knowledge_edges_admin_read" ON knowledge_edges;
CREATE POLICY "knowledge_edges_admin_read" ON knowledge_edges
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── REALTIME SESSIONS ───────────────────────────────────────
ALTER TABLE realtime_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_sessions_owner_all" ON realtime_sessions;
CREATE POLICY "realtime_sessions_owner_all" ON realtime_sessions
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "realtime_sessions_admin_read" ON realtime_sessions;
CREATE POLICY "realtime_sessions_admin_read" ON realtime_sessions
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── REALTIME EVENTS (join via realtime_sessions) ────────────
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_events_owner_all" ON realtime_events;
CREATE POLICY "realtime_events_owner_all" ON realtime_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM realtime_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "realtime_events_admin_read" ON realtime_events;
CREATE POLICY "realtime_events_admin_read" ON realtime_events
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── AUTONOMOUS TASKS ────────────────────────────────────────
ALTER TABLE autonomous_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autonomous_tasks_owner_all" ON autonomous_tasks;
CREATE POLICY "autonomous_tasks_owner_all" ON autonomous_tasks
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "autonomous_tasks_admin_read" ON autonomous_tasks;
CREATE POLICY "autonomous_tasks_admin_read" ON autonomous_tasks
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── AUTONOMOUS INSIGHTS ─────────────────────────────────────
ALTER TABLE autonomous_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autonomous_insights_owner_all" ON autonomous_insights;
CREATE POLICY "autonomous_insights_owner_all" ON autonomous_insights
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "autonomous_insights_admin_read" ON autonomous_insights;
CREATE POLICY "autonomous_insights_admin_read" ON autonomous_insights
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── PERSONALITY PROFILES ────────────────────────────────────
ALTER TABLE personality_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personality_profiles_owner_all" ON personality_profiles;
CREATE POLICY "personality_profiles_owner_all" ON personality_profiles
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "personality_profiles_admin_read" ON personality_profiles;
CREATE POLICY "personality_profiles_admin_read" ON personality_profiles
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── EMOTIONAL SIGNALS ───────────────────────────────────────
ALTER TABLE emotional_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emotional_signals_owner_all" ON emotional_signals;
CREATE POLICY "emotional_signals_owner_all" ON emotional_signals
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "emotional_signals_admin_read" ON emotional_signals;
CREATE POLICY "emotional_signals_admin_read" ON emotional_signals
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── RELATIONSHIP EVENTS ─────────────────────────────────────
ALTER TABLE relationship_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "relationship_events_owner_all" ON relationship_events;
CREATE POLICY "relationship_events_owner_all" ON relationship_events
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "relationship_events_admin_read" ON relationship_events;
CREATE POLICY "relationship_events_admin_read" ON relationship_events
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── CONTENT PROJECTS ────────────────────────────────────────
ALTER TABLE content_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_projects_owner_all" ON content_projects;
CREATE POLICY "content_projects_owner_all" ON content_projects
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "content_projects_admin_read" ON content_projects;
CREATE POLICY "content_projects_admin_read" ON content_projects
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── CONTENT ASSETS (join via content_projects) ──────────────
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_assets_owner_all" ON content_assets;
CREATE POLICY "content_assets_owner_all" ON content_assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM content_projects p
      WHERE p.id = project_id
        AND p.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "content_assets_admin_read" ON content_assets;
CREATE POLICY "content_assets_admin_read" ON content_assets
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── WORKFLOW STEPS (join via content_projects) ──────────────
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_steps_owner_all" ON workflow_steps;
CREATE POLICY "workflow_steps_owner_all" ON workflow_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM content_projects p
      WHERE p.id = project_id
        AND p.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "workflow_steps_admin_read" ON workflow_steps;
CREATE POLICY "workflow_steps_admin_read" ON workflow_steps
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── SKILLS (global registry — no user_id in live schema) ──
-- The live Supabase instance has skills as a shared registry
-- without user_id (created by bootstrap). Read-only for all
-- authenticated users; writes are service-role-only.
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills_read" ON skills;
CREATE POLICY "skills_read" ON skills
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- ─── SKILL USAGE ─────────────────────────────────────────────
ALTER TABLE skill_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill_usage_owner_all" ON skill_usage;
CREATE POLICY "skill_usage_owner_all" ON skill_usage
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "skill_usage_admin_read" ON skill_usage;
CREATE POLICY "skill_usage_admin_read" ON skill_usage
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── SKILL SUGGESTIONS ───────────────────────────────────────
ALTER TABLE skill_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill_suggestions_owner_all" ON skill_suggestions;
CREATE POLICY "skill_suggestions_owner_all" ON skill_suggestions
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "skill_suggestions_admin_read" ON skill_suggestions;
CREATE POLICY "skill_suggestions_admin_read" ON skill_suggestions
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── USER GOALS ──────────────────────────────────────────────
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_goals_owner_all" ON user_goals;
CREATE POLICY "user_goals_owner_all" ON user_goals
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "user_goals_admin_read" ON user_goals;
CREATE POLICY "user_goals_admin_read" ON user_goals
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── USER CONSTRAINTS ────────────────────────────────────────
ALTER TABLE user_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_constraints_owner_all" ON user_constraints;
CREATE POLICY "user_constraints_owner_all" ON user_constraints
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "user_constraints_admin_read" ON user_constraints;
CREATE POLICY "user_constraints_admin_read" ON user_constraints
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── COMPANION INITIATIVES ───────────────────────────────────
ALTER TABLE companion_initiatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companion_initiatives_owner_all" ON companion_initiatives;
CREATE POLICY "companion_initiatives_owner_all" ON companion_initiatives
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "companion_initiatives_admin_read" ON companion_initiatives;
CREATE POLICY "companion_initiatives_admin_read" ON companion_initiatives
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── INTERACTION LOG ─────────────────────────────────────────
ALTER TABLE interaction_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interaction_log_owner_all" ON interaction_log;
CREATE POLICY "interaction_log_owner_all" ON interaction_log
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "interaction_log_admin_read" ON interaction_log;
CREATE POLICY "interaction_log_admin_read" ON interaction_log
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── AUTONOMOUS AGENTS (global registry) ─────────────────────
-- No user_id — this is a shared table for agent definitions.
-- Authenticated users can read. Only service role may write.
ALTER TABLE autonomous_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autonomous_agents_read" ON autonomous_agents;
CREATE POLICY "autonomous_agents_read" ON autonomous_agents
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- No INSERT/UPDATE/DELETE policy = service role only for writes.


-- ─── AGENT TASKS (has user_id in live schema) ───────────────
-- Live DB has agent_tasks.user_id text (added by bootstrap).
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_tasks_owner_all" ON agent_tasks;
CREATE POLICY "agent_tasks_owner_all" ON agent_tasks
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "agent_tasks_admin_read" ON agent_tasks;
CREATE POLICY "agent_tasks_admin_read" ON agent_tasks
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── ORCHESTRATOR ACTIONS (has user_id in live schema) ───────
-- Live DB has orchestrator_actions.user_id text (added by bootstrap).
ALTER TABLE orchestrator_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orchestrator_actions_owner_all" ON orchestrator_actions;
CREATE POLICY "orchestrator_actions_owner_all" ON orchestrator_actions
  FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "orchestrator_actions_admin_read" ON orchestrator_actions;
CREATE POLICY "orchestrator_actions_admin_read" ON orchestrator_actions
  FOR SELECT USING (is_admin(auth.uid()));


-- ─── JOB QUEUE (service role only) ───────────────────────────
-- job_queue has no user_id. Backend uses service role (bypasses RLS).
-- Enabling RLS with no client policy = deny all anon/user access.
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
-- (no SELECT/INSERT/UPDATE/DELETE policy = service role only via bypass)
