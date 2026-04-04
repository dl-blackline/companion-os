import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import { validatePayloadSize } from '../../lib/_security.js';

function getAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

async function loadCareerWorkspace(userId) {
  const [resumeRes, targetRes] = await Promise.all([
    supabase
      .from('career_resume_versions')
      .select('id, title, target_role, job_description, resume_text, notes, is_primary, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('career_job_targets')
      .select('id, company, role, location, seniority, job_url, status, priority, notes, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ]);

  return {
    resumeVersions: resumeRes.data || [],
    jobTargets: targetRes.data || [],
  };
}

async function handleSaveResumeVersion(user, body) {
  const resumeText = body?.resumeText;
  if (!resumeText || typeof resumeText !== 'string') {
    return fail('Missing required field: resumeText', 'ERR_VALIDATION', 400);
  }

  const wantsPrimary = body?.isPrimary === true;
  if (wantsPrimary) {
    await supabase
      .from('career_resume_versions')
      .update({ is_primary: false })
      .eq('user_id', user.id);
  }

  const row = {
    user_id: user.id,
    title: body?.title || null,
    target_role: body?.targetRole || null,
    job_description: body?.jobDescription || null,
    resume_text: resumeText,
    notes: body?.notes || null,
    is_primary: wantsPrimary,
  };

  let query = supabase
    .from('career_resume_versions')
    .upsert(row, { onConflict: 'id' });

  if (body?.id) {
    query = supabase
      .from('career_resume_versions')
      .upsert({ ...row, id: body.id }, { onConflict: 'id' });
  }

  const { error } = await query;
  if (error) return fail('Failed to save resume version', 'ERR_DB', 500);

  return ok(await loadCareerWorkspace(user.id));
}

async function handleSaveJobTarget(user, body) {
  const role = body?.role;
  if (!role || typeof role !== 'string') {
    return fail('Missing required field: role', 'ERR_VALIDATION', 400);
  }

  const priority = Number(body?.priority || 3);
  const safePriority = Number.isFinite(priority)
    ? Math.max(1, Math.min(5, Math.round(priority)))
    : 3;

  const row = {
    user_id: user.id,
    company: body?.company || null,
    role,
    location: body?.location || null,
    seniority: body?.seniority || null,
    job_url: body?.jobUrl || null,
    status: body?.status || 'prospect',
    priority: safePriority,
    notes: body?.notes || null,
  };

  let query = supabase
    .from('career_job_targets')
    .upsert(row, { onConflict: 'id' });

  if (body?.id) {
    query = supabase
      .from('career_job_targets')
      .upsert({ ...row, id: body.id }, { onConflict: 'id' });
  }

  const { error } = await query;
  if (error) return fail('Failed to save job target', 'ERR_DB', 500);

  return ok(await loadCareerWorkspace(user.id));
}

async function handleDeleteResumeVersion(user, body) {
  if (!body?.id) return fail('Missing required field: id', 'ERR_VALIDATION', 400);

  const { error } = await supabase
    .from('career_resume_versions')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id);

  if (error) return fail('Failed to delete resume version', 'ERR_DB', 500);

  return ok(await loadCareerWorkspace(user.id));
}

async function handleDeleteJobTarget(user, body) {
  if (!body?.id) return fail('Missing required field: id', 'ERR_VALIDATION', 400);

  const { error } = await supabase
    .from('career_job_targets')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id);

  if (error) return fail('Failed to delete job target', 'ERR_DB', 500);

  return ok(await loadCareerWorkspace(user.id));
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);

  try {
    if (event.httpMethod === 'GET') {
      return ok(await loadCareerWorkspace(user.id));
    }

    if (event.httpMethod !== 'POST') {
      return fail('Method not allowed', 'ERR_METHOD', 405);
    }

    const sizeCheck = validatePayloadSize(event.body);
    if (!sizeCheck.valid) return fail(sizeCheck.error, 'ERR_PAYLOAD_SIZE', 413);

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return fail('Invalid JSON body', 'ERR_VALIDATION', 400);
    }

    switch (body.action) {
      case 'save_resume_version':
        return handleSaveResumeVersion(user, body);
      case 'save_job_target':
        return handleSaveJobTarget(user, body);
      case 'delete_resume_version':
        return handleDeleteResumeVersion(user, body);
      case 'delete_job_target':
        return handleDeleteJobTarget(user, body);
      default:
        return fail('Unsupported action', 'ERR_VALIDATION', 400);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Career management request failed', 'ERR_INTERNAL', 500);
  }
}
