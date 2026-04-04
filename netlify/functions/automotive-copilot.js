import { supabase } from '../../lib/_supabase.js';
import { fail, ok, preflight } from '../../lib/_responses.js';
import { validatePayloadSize } from '../../lib/_security.js';
import { generateChatCompletion } from '../../lib/openai-client.js';
import {
  addInferenceDisclosure,
  addSourceCitation,
  sanitizeAiResponse,
} from '../../lib/automotive/compliance-guardrails.js';
import {
  COPILOT_WORKSPACES,
  COPILOT_ROLE_BY_WORKSPACE,
  buildContextDigest,
  buildCopilotPrompt,
  buildObjectionCoaching,
  buildStrategyPaths,
  generateDeterministicInsights,
  parseCopilotResponse,
} from '../../lib/automotive/copilot-intelligence.js';

function getAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

function toStr(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function createTimelineEvent(userId, dealId, eventType, payload = {}) {
  if (!dealId) return;
  await supabase.from('automotive_timeline_events').insert({
    user_id: userId,
    deal_id: dealId,
    event_type: eventType,
    event_payload: payload,
  });
}

async function loadDealContext(userId, dealId) {
  const [
    dealRes,
    structureRes,
    metricsRes,
    docsRes,
    flagsRes,
    callbacksRes,
    callbackOptionsRes,
    guidelinesRes,
    obligationsRes,
    applicantRes,
    citRes,
    issuesRes,
    cancellationsRes,
    presentationsRes,
    productsRes,
    storePrefsRes,
  ] = await Promise.all([
    supabase.from('automotive_deals').select('*').eq('id', dealId).eq('user_id', userId).maybeSingle(),
    supabase.from('automotive_deal_structures').select('*').eq('deal_id', dealId).eq('user_id', userId).maybeSingle(),
    supabase.from('automotive_deal_metrics').select('*').eq('deal_id', dealId).eq('user_id', userId).maybeSingle(),
    supabase.from('automotive_documents').select('*').eq('deal_id', dealId).eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('automotive_review_flags').select('*').eq('deal_id', dealId).eq('user_id', userId).eq('status', 'open').order('created_at', { ascending: false }),
    supabase.from('automotive_callbacks').select('*').eq('deal_id', dealId).eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
    supabase.from('automotive_callback_options').select('*').eq('deal_id', dealId).eq('user_id', userId).order('option_index', { ascending: true }),
    supabase.from('automotive_lender_guidelines').select('id, lender_id, program_id, version_label, parsed_criteria, raw_text, effective_date').eq('user_id', userId).order('effective_date', { ascending: false }).limit(12),
    supabase.from('automotive_obligations').select('*').eq('deal_id', dealId).eq('user_id', userId),
    supabase.from('automotive_applicants').select('*').eq('deal_id', dealId).eq('user_id', userId),
    supabase.from('automotive_cit_cases').select('*').eq('deal_id', dealId).eq('user_id', userId).order('opened_at', { ascending: false }),
    supabase.from('automotive_customer_issues').select('*').eq('deal_id', dealId).eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('automotive_cancellation_cases').select('*').eq('deal_id', dealId).eq('user_id', userId).order('requested_at', { ascending: false }),
    supabase.from('automotive_menu_presentations').select('*').eq('deal_id', dealId).eq('user_id', userId).order('updated_at', { ascending: false }),
    supabase.from('automotive_fi_products').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('automotive_store_preferences').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  const deal = dealRes.data;
  if (!deal) return null;

  const guidelines = (guidelinesRes.data || []).filter((row) => {
    if (!deal.lender_id) return true;
    return !row.lender_id || row.lender_id === deal.lender_id;
  });

  return {
    deal,
    structure: structureRes.data || null,
    metrics: metricsRes.data || null,
    documents: docsRes.data || [],
    flags: flagsRes.data || [],
    callbacks: callbacksRes.data || [],
    callbackOptions: callbackOptionsRes.data || [],
    guidelines,
    obligations: obligationsRes.data || [],
    applicants: applicantRes.data || [],
    citCases: citRes.data || [],
    issues: issuesRes.data || [],
    cancellations: cancellationsRes.data || [],
    presentations: presentationsRes.data || [],
    products: productsRes.data || [],
    storePreferences: storePrefsRes.data || null,
  };
}

function enrichComplianceNotes(aiOutput, deterministic) {
  const notes = [...(aiOutput.complianceNotes || [])];

  for (const finding of deterministic.findings.slice(0, 3)) {
    if (finding.source === 'document') {
      notes.push(addSourceCitation('Document quality signal included in this recommendation.', 'document'));
    }
    if (finding.source === 'lender_callback') {
      notes.push(addSourceCitation('Callback strategy references lender callback data.', 'lender_callback'));
    }
    if (finding.source === 'system_computed') {
      notes.push(addSourceCitation('Metric references are computed from entered structure and profile data.', 'system_computed'));
    }
  }

  return Array.from(new Set(notes)).slice(0, 8);
}

async function analyzeDealCopilot(userId, body) {
  const dealId = toStr(body.dealId);
  const workspace = toStr(body.workspace) || COPILOT_WORKSPACES.deal_workspace;
  const userQuestion = toStr(body.question) || null;
  const mode = toStr(body.mode) || 'concise';

  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);

  const context = await loadDealContext(userId, dealId);
  if (!context) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  const deterministic = generateDeterministicInsights(workspace, context);
  const strategyPaths = buildStrategyPaths(context);

  let aiOutput = {
    executiveSummary: 'AI response unavailable. Using deterministic copilot guidance.',
    strongestPath: strategyPaths[0]?.label || 'Approval-First Path',
    risks: deterministic.findings.map((row) => row.detail),
    nextActions: deterministic.nextSteps,
    customerTalkTrack: ['I will keep this clear and show you options side-by-side.'],
    lenderTalkTrack: ['Here are the updated file changes and supporting documentation.'],
    complianceNotes: ['Validate all lender-facing statements before submission.'],
  };

  try {
    const prompt = buildCopilotPrompt({
      workspace,
      context,
      userQuestion,
      mode,
    });

    const aiRaw = await generateChatCompletion(prompt);
    aiOutput = parseCopilotResponse(aiRaw, deterministic);
  } catch (err) {
    aiOutput.complianceNotes.push(`AI completion fallback used: ${String(err?.message || err)}`);
  }

  aiOutput.executiveSummary = sanitizeAiResponse(aiOutput.executiveSummary || '');
  aiOutput.executiveSummary = addInferenceDisclosure(aiOutput.executiveSummary);
  aiOutput.complianceNotes = enrichComplianceNotes(aiOutput, deterministic);

  await createTimelineEvent(userId, dealId, 'copilot_analysis_generated', {
    workspace,
    role: COPILOT_ROLE_BY_WORKSPACE[workspace] || 'Finance Copilot',
    findingCount: deterministic.findings.length,
    askedQuestion: userQuestion,
  });

  return ok({
    role: COPILOT_ROLE_BY_WORKSPACE[workspace] || 'Finance Copilot',
    workspace,
    contextDigest: buildContextDigest(context),
    deterministicInsights: deterministic,
    strategyPaths,
    ai: aiOutput,
    generatedAt: new Date().toISOString(),
  });
}

async function getObjectionCoaching(userId, body) {
  const dealId = toStr(body.dealId);
  const objectionType = toStr(body.objectionType) || 'general';
  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);

  const context = await loadDealContext(userId, dealId);
  if (!context) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  const coaching = buildObjectionCoaching(objectionType, context);

  await createTimelineEvent(userId, dealId, 'copilot_objection_coaching', {
    objectionType,
    label: coaching.label,
  });

  return ok({
    role: 'F&I Presentation Coach',
    workspace: COPILOT_WORKSPACES.menu_workspace,
    coaching,
    generatedAt: new Date().toISOString(),
  });
}

async function listMemory(userId) {
  const { data, error } = await supabase
    .from('automotive_store_preferences')
    .select('preferences, compliance_notes, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return fail('Failed to load copilot memory.', 'ERR_DB', 500);
  return ok({
    memory: data?.preferences?.copilot_memory || {},
    complianceNotes: data?.compliance_notes || null,
    updatedAt: data?.updated_at || null,
  });
}

async function updateMemory(userId, body) {
  const key = toStr(body.key);
  const value = body.value;
  const confidence = Number(body.confidence || 0.5);

  if (!key) return fail('key is required.', 'ERR_VALIDATION', 400);

  const { data: existing } = await supabase
    .from('automotive_store_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const basePreferences = existing?.preferences || {};
  const memory = basePreferences.copilot_memory || {};

  memory[key] = {
    value,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 1)) : 0.5,
    updated_at: new Date().toISOString(),
    source: 'manager_confirmed',
  };

  const nextPreferences = {
    ...basePreferences,
    copilot_memory: memory,
  };

  const upsertPayload = {
    user_id: userId,
    preferences: nextPreferences,
    compliance_notes: existing?.compliance_notes || null,
  };

  const { error } = await supabase
    .from('automotive_store_preferences')
    .upsert(upsertPayload, { onConflict: 'user_id' });

  if (error) return fail('Failed to update copilot memory.', 'ERR_DB', 500);
  return ok({ updated: true, key, memory });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);

  if (event.httpMethod !== 'POST') {
    return fail('Method not allowed', 'ERR_METHOD', 405);
  }

  const sizeCheck = validatePayloadSize(event.body);
  if (!sizeCheck.valid) return fail(sizeCheck.error, 'ERR_PAYLOAD_SIZE', 413);

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return fail('Invalid JSON body', 'ERR_PARSE', 400);
  }

  switch (body.action) {
    case 'analyze_deal_copilot':
      return analyzeDealCopilot(user.id, body);
    case 'get_objection_coaching':
      return getObjectionCoaching(user.id, body);
    case 'list_memory':
      return listMemory(user.id);
    case 'update_memory':
      return updateMemory(user.id, body);
    default:
      return fail(`Unknown action: ${body.action || 'undefined'}`, 'ERR_ACTION', 400);
  }
}
