import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Create a new job in the queue.
 * @param {string} job_type - Type of job (image_generation, video_generation, music_generation, content_workflow)
 * @param {object} payload  - Job-specific payload data
 * @returns {object|null} The created job record
 */
export async function createJob(job_type, payload) {
  const { data, error } = await supabase
    .from("job_queue")
    .insert({
      job_type,
      payload: payload || {},
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("createJob error:", error.message);
    return null;
  }

  return data;
}

/**
 * Fetch all pending jobs, ordered by creation time (oldest first).
 * @returns {Array} List of pending job records
 */
export async function getPendingJobs() {
  const { data, error } = await supabase
    .from("job_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getPendingJobs error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Mark a job as started (processing).
 * @param {string} job_id - The job ID
 * @returns {object|null} The updated job record
 */
export async function startJob(job_id) {
  const { data, error } = await supabase
    .from("job_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", job_id)
    .select()
    .single();

  if (error) {
    console.error("startJob error:", error.message);
    return null;
  }

  return data;
}

/**
 * Update the status of a job.
 * @param {string} job_id - The job ID
 * @param {string} status - New status (pending, processing, completed, failed)
 * @returns {object|null} The updated job record
 */
export async function updateJobStatus(job_id, status) {
  const { data, error } = await supabase
    .from("job_queue")
    .update({ status })
    .eq("id", job_id)
    .select()
    .single();

  if (error) {
    console.error("updateJobStatus error:", error.message);
    return null;
  }

  return data;
}

/**
 * Mark a job as completed and store its result.
 * @param {string} job_id - The job ID
 * @param {object} result - The result data to store
 * @returns {object|null} The updated job record
 */
export async function completeJob(job_id, result) {
  const { data, error } = await supabase
    .from("job_queue")
    .update({
      status: "completed",
      result: result || {},
      completed_at: new Date().toISOString(),
    })
    .eq("id", job_id)
    .select()
    .single();

  if (error) {
    console.error("completeJob error:", error.message);
    return null;
  }

  return data;
}

/**
 * Fetch a single job by ID.
 * @param {string} job_id - The job ID
 * @returns {object|null} The job record
 */
export async function getJob(job_id) {
  const { data, error } = await supabase
    .from("job_queue")
    .select("*")
    .eq("id", job_id)
    .single();

  if (error) {
    console.error("getJob error:", error.message);
    return null;
  }

  return data;
}
