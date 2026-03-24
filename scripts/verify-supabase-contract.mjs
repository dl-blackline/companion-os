#!/usr/bin/env node
/**
 * Verifies live Supabase schema/security contracts against runtime assumptions.
 *
 * Requires:
 * 1) Either SUPABASE_DB_URL env var or linked Supabase project
 * 2) Supabase CLI auth available in current environment
 */

import { execSync } from "node:child_process";

function runCommand(command) {
  return execSync(command, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function getQueryMode() {
  const rawDbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!rawDbUrl) return { mode: "linked", dbUrlArg: "" };

  const looksEncoded =
    rawDbUrl.startsWith("postgres%3A") ||
    rawDbUrl.startsWith("postgresql%3A");

  const encoded = looksEncoded ? rawDbUrl : encodeURIComponent(rawDbUrl);
  return { mode: "db-url", dbUrlArg: `--db-url ${encoded}` };
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
  const escapedSql = sql.replace(/"/g, '\\"').replace(/\n/g, " ");
  const { mode, dbUrlArg } = getQueryMode();
  const modeArg = mode === "db-url" ? dbUrlArg : "--linked";
  const cmd = `npx -y supabase db query ${modeArg} --output json "${escapedSql}" 2>&1`;
  const raw = runCommand(cmd);
  return parseJsonFromCliOutput(raw);
}

function assertCheck(condition, message, failures) {
  if (!condition) failures.push(message);
}

function main() {
  const failures = [];

  // 1) RLS enabled on all public tables.
  const rlsRows = query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const rlsOff = rlsRows.filter((r) => !r.rowsecurity);
  assertCheck(rlsOff.length === 0, `RLS disabled on tables: ${rlsOff.map((r) => r.tablename).join(", ")}`, failures);

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
  console.log("Checked storage bucket: media_uploads");
  console.log("Checked runtime compatibility columns and policy deduplication");
}

try {
  main();
} catch (error) {
  console.error("Supabase contract verification failed to run:");
  console.error(error?.message || error);
  process.exit(1);
}
