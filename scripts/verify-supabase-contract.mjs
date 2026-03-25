#!/usr/bin/env node
/**
 * Verifies live Supabase schema/security contracts against runtime assumptions.
 *
 * Requires:
 * 1) Either SUPABASE_DB_URL env var or linked Supabase project
 * 2) Supabase CLI auth available in current environment
 */

import { execFileSync, execSync } from "node:child_process";

function quoteForShell(value) {
  if (value === "") return '""';
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `"${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
}

function runNpx(args) {
  if (process.platform === "win32") {
    const command = `npx ${args.map(quoteForShell).join(" ")} 2>&1`;
    return execSync(command, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  }

  try {
    return execFileSync("npx", args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : "";
    const stderr = error?.stderr ? String(error.stderr) : "";
    const message = (stdout + stderr).trim() || error?.message || "Unknown command failure";
    throw new Error(message);
  }
}

function getQueryModeArgs() {
  const rawDbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!rawDbUrl) return ["--linked"];

  // Supabase CLI expects a raw connection string for --db-url.
  return ["--db-url", rawDbUrl];
}

function parseJsonFromCliOutput(output) {
  const firstArray = output.indexOf("[");
  const firstObject = output.indexOf("{");
  let start = -1;

  if (firstArray >= 0 && firstObject >= 0) {
    start = Math.min(firstArray, firstObject);
  } else if (firstArray >= 0) {
    start = firstArray;
  } else {
    start = firstObject;
  }

  if (start < 0) {
    throw new Error("Could not find JSON payload in Supabase CLI output.");
  }

  const jsonText = output.slice(start).trim();
  return JSON.parse(jsonText);
}

function query(sql) {
  const normalizedSql = sql.replace(/\n/g, " ");
  const modeArgs = getQueryModeArgs();
  const raw = runNpx([
    "-y",
    "supabase",
    "db",
    "query",
    ...modeArgs,
    "--output",
    "json",
    normalizedSql,
  ]);
  return parseJsonFromCliOutput(raw);
}

function assertCheck(condition, message, failures) {
  if (!condition) failures.push(message);
}

function main() {
  const failures = [];

  // Tables intentionally kept as service-role-only (RLS enabled + no policies).
  const allowedNoPolicyTables = new Set([
    "active_projects",
    "agent_activity",
    "background_jobs",
    "job_queue",
  ]);

  // 1) RLS enabled on all public tables.
  const rlsRows = query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const rlsOff = rlsRows.filter((r) => !r.rowsecurity);
  assertCheck(rlsOff.length === 0, `RLS disabled on tables: ${rlsOff.map((r) => r.tablename).join(", ")}`, failures);

  // 1b) No-policy tables should be exactly the allowed service-role-only set.
  const noPolicyRows = query(
    "SELECT t.tablename FROM pg_tables t LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=t.tablename WHERE t.schemaname='public' GROUP BY t.tablename HAVING count(p.policyname)=0 ORDER BY t.tablename"
  );
  const noPolicyTables = noPolicyRows.map((r) => r.tablename);
  const unexpectedNoPolicy = noPolicyTables.filter((name) => !allowedNoPolicyTables.has(name));
  const missingAllowedNoPolicy = Array.from(allowedNoPolicyTables).filter(
    (name) => !noPolicyTables.includes(name)
  );

  assertCheck(
    unexpectedNoPolicy.length === 0,
    `Unexpected no-policy tables: ${unexpectedNoPolicy.join(", ")}`,
    failures
  );
  assertCheck(
    missingAllowedNoPolicy.length === 0,
    `Expected service-role-only tables changed/missing: ${missingAllowedNoPolicy.join(", ")}`,
    failures
  );

  // 2) Required functions exist.
  const requiredFunctions = [
    "is_admin",
    "match_messages",
    "match_episodic_memory",
    "match_relationship_memory",
    "match_memory_summaries",
    "match_media_analysis",
    "match_media_knowledge",
    "match_brain_memory",
  ];

  const functionRows = query(
    "SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_name = ANY(ARRAY['is_admin','match_messages','match_episodic_memory','match_relationship_memory','match_memory_summaries','match_media_analysis','match_media_knowledge','match_brain_memory']) ORDER BY routine_name"
  );
  const fnSet = new Set(functionRows.map((r) => r.routine_name));
  const missingFns = requiredFunctions.filter((name) => !fnSet.has(name));
  assertCheck(missingFns.length === 0, `Missing functions: ${missingFns.join(", ")}`, failures);

  // 2c) SECURITY DEFINER functions must use explicit search_path.
  const secDefRows = query(
    "SELECT proname, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.prosecdef = true ORDER BY proname"
  );
  const secDefWithoutSearchPath = secDefRows
    .filter((r) => !/SET\s+search_path/i.test(r.definition))
    .map((r) => r.proname);
  assertCheck(
    secDefWithoutSearchPath.length === 0,
    `SECURITY DEFINER functions missing search_path: ${secDefWithoutSearchPath.join(", ")}`,
    failures
  );

  // 2b) Required extensions exist.
  const requiredExtensions = ["vector", "pgcrypto", "pg_trgm"];
  const extensionRows = query(
    "SELECT extname FROM pg_extension WHERE extname = ANY(ARRAY['vector','pgcrypto','pg_trgm']) ORDER BY extname"
  );
  const extensionSet = new Set(extensionRows.map((r) => r.extname));
  const missingExtensions = requiredExtensions.filter((name) => !extensionSet.has(name));
  assertCheck(
    missingExtensions.length === 0,
    `Missing extensions: ${missingExtensions.join(", ")}`,
    failures
  );

  // 3) Storage bucket contract.
  const bucketRows = query(
    "SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'media_uploads'"
  );

  assertCheck(bucketRows.length === 1, "Bucket media_uploads is missing.", failures);
  if (bucketRows.length === 1) {
    assertCheck(bucketRows[0].public === true, "Bucket media_uploads should be public=true.", failures);
    assertCheck(
      Number(bucketRows[0].file_size_limit) === 104857600,
      `Bucket media_uploads file_size_limit expected 104857600, got ${bucketRows[0].file_size_limit}.`,
      failures
    );
  }

  // 3b) Storage object policies for media_uploads should cover CRUD paths.
  const storagePolicyRows = query(
    "SELECT policyname, cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (qual ILIKE '%media_uploads%' OR with_check ILIKE '%media_uploads%')"
  );
  const storageCmds = new Set(storagePolicyRows.map((r) => r.cmd));
  const missingStorageCmds = ["SELECT", "INSERT", "UPDATE", "DELETE"].filter(
    (cmd) => !storageCmds.has(cmd)
  );
  assertCheck(
    missingStorageCmds.length === 0,
    `Missing media_uploads storage policy commands: ${missingStorageCmds.join(", ")}`,
    failures
  );

  // 4) Runtime compatibility columns introduced in migration 019.
  const runtimeColumns = query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='skills' AND column_name IN ('user_id','proficiency','updated_at')) OR (table_name='skill_usage' AND column_name IN ('skill_name','context','user_id')) OR (table_name='skill_suggestions' AND column_name IN ('skill_name','reason','priority','dismissed','user_id')) OR (table_name='agent_tasks' AND column_name IN ('task_description','started_at','user_id'))) ORDER BY table_name, column_name"
  );

  const expectedPairs = new Set([
    "skills.user_id",
    "skills.proficiency",
    "skills.updated_at",
    "skill_usage.skill_name",
    "skill_usage.context",
    "skill_usage.user_id",
    "skill_suggestions.skill_name",
    "skill_suggestions.reason",
    "skill_suggestions.priority",
    "skill_suggestions.dismissed",
    "skill_suggestions.user_id",
    "agent_tasks.task_description",
    "agent_tasks.started_at",
    "agent_tasks.user_id",
  ]);

  for (const row of runtimeColumns) {
    expectedPairs.delete(`${row.table_name}.${row.column_name}`);
  }

  assertCheck(
    expectedPairs.size === 0,
    `Missing runtime compatibility columns: ${Array.from(expectedPairs).join(", ")}`,
    failures
  );

  // 5) Duplicate policy groups should be zero after migration 020 cleanup.
  const duplicatePolicies = query(
    "SELECT tablename, cmd, count(*) AS policy_count FROM pg_policies WHERE schemaname='public' GROUP BY tablename, cmd HAVING count(*) > 1 ORDER BY tablename, cmd"
  );
  assertCheck(
    duplicatePolicies.length === 0,
    `Duplicate policy groups still exist: ${duplicatePolicies
      .map((r) => `${r.tablename}:${r.cmd}(${r.policy_count})`)
      .join(", ")}`,
    failures
  );

  // 6) Legacy policy names should be gone after cleanup migration.
  const legacyPolicyRows = query(
    "SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND policyname ILIKE 'users can access %' ORDER BY tablename, policyname"
  );
  assertCheck(
    legacyPolicyRows.length === 0,
    `Legacy policies still present: ${legacyPolicyRows
      .map((r) => `${r.tablename}:${r.policyname}`)
      .join(", ")}`,
    failures
  );

  if (failures.length > 0) {
    console.error("Supabase contract verification FAILED:\n");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Supabase contract verification passed.");
  console.log(`Checked tables: ${rlsRows.length}`);
  console.log(`Checked functions: ${requiredFunctions.length}`);
  console.log(`Checked extensions: ${requiredExtensions.length}`);
  console.log(`Checked service-role-only no-policy tables: ${allowedNoPolicyTables.size}`);
  console.log("Checked storage bucket: media_uploads");
  console.log("Checked storage object policies, runtime compatibility columns, and policy hygiene");
}

try {
  main();
} catch (error) {
  console.error("Supabase contract verification failed to run:");
  console.error(error?.message || error);
  process.exit(1);
}
