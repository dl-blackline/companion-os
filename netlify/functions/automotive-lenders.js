import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import { generateChatCompletion } from '../../lib/openai-client.js';
import {
  buildCallbackExtractionPrompt,
  parseAiCallbackResponse,
  normalizeCallbackOption,
  enrichCallbackOption,
} from '../../lib/automotive/callback-engine.js';
import { canTransition } from '../../lib/automotive/state-machine.js';
import { sanitizeAiResponse } from '../../lib/automotive/compliance-guardrails.js';

const SUPPORTED_ACTIONS = new Set([
  'upsert_lender',
  'list_lenders',
  'upsert_program',
  'list_programs',
  'upsert_guideline',
  'list_guidelines',
  'ingest_callback',
  'list_callbacks',
]);

function getAuthToken(event) {
  const h = event.headers?.authorization || event.headers?.Authorization;
  return h?.replace('Bearer ', '') || '';
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function toStr(v) { const s = typeof v === 'string' ? v.trim() : ''; return s || null; }
function toBool(v) { return v === true || v === 'true'; }

async function createTimelineEvent(userId, dealId, eventType, payload = {}) {
  if (!dealId) return;
  await supabase.from('automotive_timeline_events').insert({
    user_id: userId,
    deal_id: dealId,
    event_type: eventType,
    event_payload: payload,
  });
}

// ── Lender CRUD ───────────────────────────────────────────────────────────
async function upsertLender(userId, body) {
  const lenderId = toStr(body.id);
  const lenderName = toStr(body.lenderName);
  if (!lenderName) return fail('lenderName is required.', 'ERR_VALIDATION', 400);

  const payload = {
    user_id: userId,
    name: lenderName,
    short_code: toStr(body.lenderCode),
    contact_name: toStr(body.contactName),
    contact_phone: toStr(body.contactPhone),
    contact_email: toStr(body.contactEmail),
    portal_url: toStr(body.portalUrl),
    notes: toStr(body.notes),
    is_active: body.isActive !== false,
  };

  let result;
  if (lenderId) {
    result = await supabase
      .from('automotive_lenders')
      .update(payload)
      .eq('id', lenderId)
      .eq('user_id', userId)
      .select('id')
      .single();
  } else {
    result = await supabase
      .from('automotive_lenders')
      .insert(payload)
      .select('id')
      .single();
  }

  if (result.error) return fail('Failed to save lender.', 'ERR_DB', 500);
  return ok({ lenderId: result.data?.id });
}

async function listLenders(userId) {
  const { data, error } = await supabase
    .from('automotive_lenders')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) return fail('Failed to fetch lenders.', 'ERR_DB', 500);
  return ok({ lenders: data });
}

// ── Lender Programs ───────────────────────────────────────────────────────
async function upsertProgram(userId, body) {
  const lenderId = toStr(body.lenderId);
  if (!lenderId) return fail('lenderId is required.', 'ERR_VALIDATION', 400);

  const programId = toStr(body.id);
  const payload = {
    user_id: userId,
    lender_id: lenderId,
    program_name: toStr(body.programName) || 'Standard',
    deal_types: Array.isArray(body.dealTypes) ? body.dealTypes : ['retail'],
    vehicle_conditions: Array.isArray(body.vehicleConditions) ? body.vehicleConditions : ['new', 'used'],
    min_fico: body.minCreditScore ? parseInt(body.minCreditScore, 10) : null,
    max_ltv_percent: toNum(body.maxLtvPercent) || null,
    max_pti_percent: toNum(body.maxPtiPercent) || null,
    max_dti_percent: toNum(body.maxDtiPercent) || null,
    max_backend_amount: toNum(body.maxBackendAmount) || null,
    max_backend_percent: toNum(body.maxBackendPercent) || null,
    max_term_months: body.maxTermMonths ? parseInt(body.maxTermMonths, 10) : 84,
    max_advance_percent: toNum(body.maxAdvancePercent) || null,
    reserve_flat: toNum(body.reserveFlat) || null,
    reserve_percent: toNum(body.reservePercent) || null,
    reserve_cap_percent: toNum(body.reserveCapPercent) || null,
    stips_required: Array.isArray(body.stipsRequired) ? body.stipsRequired : null,
    program_notes: toStr(body.programNotes),
    effective_date: toStr(body.effectiveDate),
    expiration_date: toStr(body.expirationDate),
    is_active: body.isActive !== false,
  };

  let result;
  if (programId) {
    result = await supabase
      .from('automotive_lender_programs')
      .update(payload)
      .eq('id', programId)
      .eq('user_id', userId)
      .select('id')
      .single();
  } else {
    result = await supabase
      .from('automotive_lender_programs')
      .insert(payload)
      .select('id')
      .single();
  }

  if (result.error) return fail('Failed to save program.', 'ERR_DB', 500);
  return ok({ programId: result.data?.id });
}

async function listPrograms(userId, body) {
  const lenderId = toStr(body?.lenderId);
  const filter = supabase
    .from('automotive_lender_programs')
    .select('*')
    .eq('user_id', userId)
    .order('program_name');
  if (lenderId) filter.eq('lender_id', lenderId);
  const { data, error } = await filter;
  if (error) return fail('Failed to fetch programs.', 'ERR_DB', 500);
  return ok({ programs: data });
}

// ── Lender Guidelines ─────────────────────────────────────────────────────
async function upsertGuideline(userId, body) {
  const lenderId = toStr(body.lenderId);
  if (!lenderId) return fail('lenderId is required.', 'ERR_VALIDATION', 400);

  const guidelineId = toStr(body.id);
  const payload = {
    user_id: userId,
    lender_id: lenderId,
    program_id: toStr(body.programId),
    document_name: toStr(body.documentName) || toStr(body.title) || 'Guideline Document',
    document_type: toStr(body.documentType) || 'general',
    content_text: toStr(body.rawText),
    storage_path: toStr(body.storagePath),
    deal_types: Array.isArray(body.dealTypes) ? body.dealTypes : null,
    effective_date: toStr(body.effectiveDate),
    expiration_date: toStr(body.expirationDate),
    source_confirmed: body.sourceConfirmed === true,
  };

  let result;
  if (guidelineId) {
    result = await supabase
      .from('automotive_lender_guidelines')
      .update(payload)
      .eq('id', guidelineId)
      .eq('user_id', userId)
      .select('id')
      .single();
  } else {
    result = await supabase
      .from('automotive_lender_guidelines')
      .insert(payload)
      .select('id')
      .single();
  }

  if (result.error) return fail('Failed to save guideline.', 'ERR_DB', 500);
  return ok({ guidelineId: result.data?.id });
}

async function listGuidelines(userId, lenderId) {
  if (!lenderId) return fail('lenderId is required.', 'ERR_VALIDATION', 400);
  const { data, error } = await supabase
    .from('automotive_lender_guidelines')
    .select('*')
    .eq('user_id', userId)
    .eq('lender_id', lenderId)
    .order('effective_date', { ascending: false });
  if (error) return fail('Failed to fetch guidelines.', 'ERR_DB', 500);
  return ok({ guidelines: data });
}

// ── Callback Ingestion + AI Interpretation ────────────────────────────────
async function ingestCallback(userId, body) {
  const dealId = toStr(body.dealId);
  const rawCallbackText = toStr(body.rawCallbackText);
  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);
  if (!rawCallbackText) return fail('rawCallbackText is required.', 'ERR_VALIDATION', 400);

  // Load deal to verify ownership and get context
  const { data: deal } = await supabase
    .from('automotive_deals')
    .select('id, status, deal_type, lender_id')
    .eq('id', dealId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!deal) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  // Load deal structure for enrichment context
  const { data: structure } = await supabase
    .from('automotive_deal_structures')
    .select('amount_financed, apr_percent, term_months')
    .eq('deal_id', dealId)
    .eq('user_id', userId)
    .maybeSingle();

  const dealContext = {
    dealType: deal.deal_type,
    amountFinanced: structure?.amount_financed || 0,
    aprPercent: structure?.apr_percent || 0,
    termMonths: structure?.term_months || 72,
  };

  // Build AI prompt and extract callback
  const { systemPrompt, userPrompt } = buildCallbackExtractionPrompt(rawCallbackText, dealContext);
  let aiRaw = '';
  let parsedCallback = { options: [], parseError: 'Not attempted' };

  try {
    aiRaw = await generateChatCompletion(systemPrompt, userPrompt, { model: 'gpt-4o', temperature: 0.1, maxTokens: 2000 });
    aiRaw = sanitizeAiResponse(aiRaw);
    parsedCallback = parseAiCallbackResponse(aiRaw);
  } catch (err) {
    // Ingestion continues even if AI fails — raw text is preserved
    parsedCallback = { options: [], parseError: String(err?.message || err) };
  }

  // Save the callback record
  const { data: callbackRow, error: cbError } = await supabase
    .from('automotive_callbacks')
    .insert({
      user_id: userId,
      deal_id: dealId,
      lender_id: deal.lender_id,
      raw_input: rawCallbackText,
      callback_rep: parsedCallback.callbackRep || null,
      lender_notes: parsedCallback.lenderNotes || null,
      normalized_data: {
        lenderName: parsedCallback.lenderName || null,
        parseError: parsedCallback.parseError || null,
      },
      interpreter_output: {
        raw: aiRaw,
        parseError: parsedCallback.parseError || null,
      },
      status: parsedCallback.options.length > 0 ? 'normalized' : 'received',
    })
    .select('id')
    .single();

  if (cbError) return fail('Failed to save callback.', 'ERR_DB', 500);
  const callbackId = callbackRow.id;

  // Save callback options
  const options = [];
  for (let i = 0; i < (parsedCallback.options || []).length; i++) {
    const normalized = normalizeCallbackOption(parsedCallback.options[i], i);
    const enriched = enrichCallbackOption(normalized, dealContext);
    const { data: optRow } = await supabase
      .from('automotive_callback_options')
      .insert({
        user_id: userId,
        deal_id: dealId,
        callback_id: callbackId,
        option_number: i + 1,
        label: normalized.tierLabel,
        term_months: normalized.approvedTerm,
        rate_percent: normalized.aprOffered,
        max_amount_financed: normalized.approvedAmount,
        stips_required: Array.isArray(normalized.stipsList) ? normalized.stipsList : [],
        customer_restrictions: normalized.conditions || {},
        estimated_payment: enriched.estimatedPayment,
        estimated_ltv: enriched.estimatedLtv,
        comparison_notes: normalized.isCounterOffer ? 'Counter-offer' : null,
      })
      .select('id')
      .single();
    options.push({ ...enriched, id: optRow?.id });
  }

  // Advance deal status to callback_received
  const newStatus = 'callback_received';
  if (canTransition('deal', deal.status, newStatus)) {
    await supabase
      .from('automotive_deals')
      .update({ status: newStatus })
      .eq('id', dealId)
      .eq('user_id', userId);
  }

  await createTimelineEvent(userId, dealId, 'callback_ingested', {
    callbackId,
    lenderName: parsedCallback.lenderName,
    optionCount: options.length,
    parseError: parsedCallback.parseError || null,
  });

  return ok({
    callbackId,
    status: parsedCallback.options.length > 0 ? 'normalized' : 'received',
    lenderName: parsedCallback.lenderName,
    callbackRep: parsedCallback.callbackRep,
    lenderNotes: parsedCallback.lenderNotes,
    options,
    parseError: parsedCallback.parseError || null,
  });
}

async function listCallbacksForDeal(userId, dealId) {
  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);
  const { data: callbacks } = await supabase
    .from('automotive_callbacks')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: options } = await supabase
    .from('automotive_callback_options')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', userId)
    .order('option_number');

  const byCallbackId = {};
  for (const opt of options || []) {
    if (!byCallbackId[opt.callback_id]) byCallbackId[opt.callback_id] = [];
    byCallbackId[opt.callback_id].push(opt);
  }

  const enrichedCallbacks = (callbacks || []).map((cb) => ({
    ...cb,
    options: byCallbackId[cb.id] || [],
  }));

  return ok({ callbacks: enrichedCallbacks });
}

// ── Handler ────────────────────────────────────────────────────────────────
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);
  const userId = user.id;

  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    const resource = params.resource;
    if (resource === 'lenders') return listLenders(userId);
    if (resource === 'guidelines') return listGuidelines(userId, params.lenderId);
    if (resource === 'callbacks') return listCallbacksForDeal(userId, params.dealId);
    return fail('Unknown resource.', 'ERR_QUERY', 400);
  }

  if (event.httpMethod !== 'POST') return fail('Method not allowed', 'ERR_METHOD', 405);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return fail('Invalid JSON body', 'ERR_PARSE', 400);
  }

  const action = typeof body.action === 'string' ? body.action : '';
  if (!SUPPORTED_ACTIONS.has(action)) {
    return fail(`Unknown action: ${action || 'undefined'}`, 'ERR_ACTION', 400);
  }

  switch (action) {
    case 'upsert_lender':      return upsertLender(userId, body);
    case 'list_lenders':       return listLenders(userId);
    case 'upsert_program':     return upsertProgram(userId, body);
    case 'list_programs':      return listPrograms(userId, body);
    case 'upsert_guideline':   return upsertGuideline(userId, body);
    case 'list_guidelines':    return listGuidelines(userId, body.lenderId);
    case 'ingest_callback':    return ingestCallback(userId, body);
    case 'list_callbacks':     return listCallbacksForDeal(userId, body.dealId);
    default:
      return fail(`Unknown action: ${action}`, 'ERR_ACTION', 400);
  }
}
