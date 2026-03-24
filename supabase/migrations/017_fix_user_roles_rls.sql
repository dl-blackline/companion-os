-- ============================================================
-- Migration 017: Fix infinite recursion in user_roles RLS
-- ============================================================
-- Error 42P17: The user_roles table had policies that queried
-- user_roles themselves, causing PostgreSQL to recurse forever.
--
-- Fix: introduce a SECURITY DEFINER function `is_admin()` that
-- runs as the function owner (bypassing RLS), breaking the cycle.
-- All downstream tables that checked admin status via a correlated
-- subquery on user_roles are updated to use is_admin() instead.
-- ============================================================

-- ─── Helper: is_admin ────────────────────────────────────────
-- SECURITY DEFINER means this runs as the definer (postgres/owner)
-- and therefore skips RLS on user_roles, eliminating the recursion.

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

-- ─── Fix user_roles policies (the root cause of recursion) ───

DROP POLICY IF EXISTS "user_roles_select"      ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_write" ON user_roles;

CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_admin(auth.uid())
  );

CREATE POLICY "user_roles_admin_write" ON user_roles
  FOR ALL USING (
    is_admin(auth.uid())
  );

-- ─── Fix user_entitlements ───────────────────────────────────

DROP POLICY IF EXISTS "entitlements_admin_all" ON user_entitlements;

CREATE POLICY "entitlements_admin_all" ON user_entitlements
  FOR ALL USING (
    is_admin(auth.uid())
  );

-- ─── Fix feature_flags ───────────────────────────────────────

DROP POLICY IF EXISTS "feature_flags_read_public"  ON feature_flags;
DROP POLICY IF EXISTS "feature_flags_admin_write"  ON feature_flags;

CREATE POLICY "feature_flags_read_public" ON feature_flags
  FOR SELECT USING (
    admin_only = false
    OR is_admin(auth.uid())
  );

CREATE POLICY "feature_flags_admin_write" ON feature_flags
  FOR ALL USING (
    is_admin(auth.uid())
  );

-- ─── Fix audit_logs ──────────────────────────────────────────

DROP POLICY IF EXISTS "audit_logs_admin_read" ON audit_logs;

CREATE POLICY "audit_logs_admin_read" ON audit_logs
  FOR SELECT USING (
    is_admin(auth.uid())
  );

-- ─── Fix support_tickets ─────────────────────────────────────

DROP POLICY IF EXISTS "tickets_admin_all" ON support_tickets;

CREATE POLICY "tickets_admin_all" ON support_tickets
  FOR ALL USING (
    is_admin(auth.uid())
  );

-- ─── Fix user_preferences ────────────────────────────────────

DROP POLICY IF EXISTS "prefs_admin_read" ON user_preferences;

CREATE POLICY "prefs_admin_read" ON user_preferences
  FOR SELECT USING (
    is_admin(auth.uid())
  );
