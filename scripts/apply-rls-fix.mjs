/**
 * apply-rls-fix.mjs
 * Applies the is_admin() SECURITY DEFINER fix to the live Supabase database,
 * resolving the infinite recursion (42P17) in user_roles RLS policies.
 *
 * Usage: node scripts/apply-rls-fix.mjs
 * Requires SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL in environment.
 */

import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL
  || execSync('npx -y netlify-cli env:get SUPABASE_URL', { encoding: 'utf8' }).trim();

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || execSync('npx -y netlify-cli env:get SUPABASE_SERVICE_ROLE_KEY', { encoding: 'utf8' }).trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 20) {
  console.error('ERROR: Could not retrieve SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

console.log('Applying RLS fix to:', SUPABASE_URL);

// The Supabase Management API /pg/query endpoint executes arbitrary SQL
// with full superuser privileges — correct for schema migrations.
const SQL = `
-- Fix 017: Eliminate infinite recursion in user_roles RLS (error 42P17)

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

-- user_roles (root cause — self-referential policy)
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

-- user_entitlements
DROP POLICY IF EXISTS "entitlements_admin_all" ON user_entitlements;
CREATE POLICY "entitlements_admin_all" ON user_entitlements
  FOR ALL USING (is_admin(auth.uid()));

-- feature_flags
DROP POLICY IF EXISTS "feature_flags_read_public" ON feature_flags;
DROP POLICY IF EXISTS "feature_flags_admin_write" ON feature_flags;
CREATE POLICY "feature_flags_read_public" ON feature_flags
  FOR SELECT USING (admin_only = false OR is_admin(auth.uid()));
CREATE POLICY "feature_flags_admin_write" ON feature_flags
  FOR ALL USING (is_admin(auth.uid()));

-- audit_logs
DROP POLICY IF EXISTS "audit_logs_admin_read" ON audit_logs;
CREATE POLICY "audit_logs_admin_read" ON audit_logs
  FOR SELECT USING (is_admin(auth.uid()));

-- support_tickets
DROP POLICY IF EXISTS "tickets_admin_all" ON support_tickets;
CREATE POLICY "tickets_admin_all" ON support_tickets
  FOR ALL USING (is_admin(auth.uid()));

-- user_preferences
DROP POLICY IF EXISTS "prefs_admin_read" ON user_preferences;
CREATE POLICY "prefs_admin_read" ON user_preferences
  FOR SELECT USING (is_admin(auth.uid()));
`;

// Extract project ref from URL (e.g. kxfxurxzgfqedkyayjkd from https://kxfxurxzgfqedkyayjkd.supabase.co)
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

async function run() {
  console.log('Sending SQL via Management API...');
  
  const res = await fetch(mgmtUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });

  const body = await res.text();
  
  if (res.ok) {
    console.log('\n✓ RLS fix applied successfully!');
    console.log('Response:', body.substring(0, 300));
  } else {
    // Management API requires a personal access token, not the service role key.
    // Fall back to executing via the pg REST endpoint (Supabase db admin endpoint).
    console.log(`Management API returned ${res.status}. Trying direct SQL execution...`);
    await tryDirectExec();
  }
}

async function tryDirectExec() {
  // Some Supabase plans allow SQL exec via /rest/v1/rpc/exec_sql (custom function)
  // or via the pg endpoint. Here we report the SQL for manual execution.
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('Could not auto-apply. Run this SQL in the Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/kxfxurxzgfqedkyayjkd/sql/new');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(SQL);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
