import { getJob } from "../../lib/job-queue.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { authenticateRequest } from "../../lib/_security.js";
import { supabase } from "../../lib/_supabase.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  // Auth is optional: validate the token when present, deny if invalid,
  // but allow unauthenticated requests (job IDs act as unguessable identifiers).
  const authorizationHeader =
    event.headers?.authorization ?? event.headers?.Authorization;
  if (authorizationHeader) {
    const { error: authError } = await authenticateRequest(event, supabase);
    if (authError) return fail(authError, "ERR_AUTH", 401);
  }

  try {
    const jobId = event.queryStringParameters?.id;

    if (!jobId) {
      return fail("Missing required parameter: id", "ERR_VALIDATION", 400);
    }

    const job = await getJob(jobId);

    if (!job) {
      return fail("Job not found", "ERR_NOT_FOUND", 404);
    }

    return ok({
      id: job.id,
      job_type: job.job_type,
      status: job.status,
      result: job.result,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
    });
  } catch (error) {
    return fail("Failed to fetch job status", "ERR_INTERNAL", 500);
  }
}
