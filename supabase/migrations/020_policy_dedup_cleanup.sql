-- ============================================================
-- Migration 020: Deduplicate legacy overlapping RLS policies
-- ============================================================
-- These legacy policies are functionally identical to newer
-- canonical policies and create OR-style duplicates that add
-- noise/risk during audits. Removing them does not change access.

-- ai_settings
DROP POLICY IF EXISTS "Users manage their AI settings" ON ai_settings;

-- messages
DROP POLICY IF EXISTS "users can access their messages" ON messages;

-- episodic_memory
DROP POLICY IF EXISTS "users can access their episodic memory" ON episodic_memory;

-- relationship_memory
DROP POLICY IF EXISTS "users can access relationship memory" ON relationship_memory;

-- user_profiles
DROP POLICY IF EXISTS "users can access their profile" ON user_profiles;
