import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import { canTransition } from '../../lib/automotive/state-machine.js';

const SUPPORTED_ACTIONS = new Set([
  'open_cit_case',
  'update_cit_status',
  'list_cit_cases',
  'open_cancellation',
  'update_cancellation_status',
  'list_cancellations',
  'open_customer_issue',
  'update_issue_status',
  'list_customer_issues',
  'add_commission',
  'update_commission',
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

function toStr(v) { const s = typeof v === 'string' ? v.trim() : ''; return s || null; }
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

async function createTimelineEvent(userId, dealId, eventType, payload = {}) {
  if (!dealId) return;
  await supabase.from('automotive_timeline_events').insert({
    user_id: userId,
    deal_id: dealId,
    event_type: eventType,
    event_payload: payload,
  });
}

// ── CIT Cases ─────────────────────────────────────────────────────────────
async function openCitCase(userId, body) {
  const dealId = toStr(body.dealId);
  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);

  const { data: deal } = await supabase
    .from('automotive_deals')
    .select('id, status')
    .eq('id', dealId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!deal) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  const { data: citRow, error } = await supabase
    .from('automotive_cit_cases')
    .insert({
      user_id: userId,
      deal_id: dealId,
      status: 'open',
      outstanding_stips: Array.isArray(body.stipsRequired) ? body.stipsRequired : [],
      lender_contact: toStr(body.lenderContact),
      escalation_reason: toStr(body.openedReason),
      notes: toStr(body.notes),
    })
    .select('id')
    .single();

  if (error) return fail('Failed to open CIT case.', 'ERR_DB', 500);

  // Move deal to cit_hold if permitted
  if (canTransition('deal', deal.status, 'cit_hold')) {
    await supabase
      .from('automotive_deals')
      .update({ status: 'cit_hold' })
      .eq('id', dealId)
      .eq('user_id', userId);
  }

  await createTimelineEvent(userId, dealId, 'cit_case_opened', { citCaseId: citRow.id, reason: body.openedReason });

  return ok({ citCaseId: citRow.id });
}

async function updateCitStatus(userId, body) {
  const citCaseId = toStr(body.citCaseId);
  const newStatus = toStr(body.newStatus);
  if (!citCaseId || !newStatus) return fail('citCaseId and newStatus are required.', 'ERR_VALIDATION', 400);

  const { data: citCase } = await supabase
    .from('automotive_cit_cases')
    .select('id, deal_id, status')
    .eq('id', citCaseId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!citCase) return fail('CIT case not found.', 'ERR_NOT_FOUND', 404);
  if (!canTransition('cit', citCase.status, newStatus)) {
    return fail(`Cannot transition CIT case from ${citCase.status} to ${newStatus}.`, 'ERR_STATE', 422);
  }

  const updatePayload = {
    status: newStatus,
    notes: toStr(body.notes) || undefined,
  };

  if (Array.isArray(body.stipsReceived)) updatePayload.outstanding_stips = body.stipsReceived;

  const isResolved = newStatus === 'resolved' || newStatus === 'unfunded' || newStatus === 'archived';
  if (isResolved) updatePayload.resolved_at = new Date().toISOString();

  const { error } = await supabase
    .from('automotive_cit_cases')
    .update(updatePayload)
    .eq('id', citCaseId)
    .eq('user_id', userId);

  if (error) return fail('Failed to update CIT case.', 'ERR_DB', 500);

  await createTimelineEvent(userId, citCase.deal_id, 'cit_status_updated', { citCaseId, fromStatus: citCase.status, toStatus: newStatus });

  // Advance deal to funded if CIT resolved
  if (newStatus === 'resolved' && body.advanceDealToFunded) {
    const { data: deal } = await supabase.from('automotive_deals').select('status').eq('id', citCase.deal_id).eq('user_id', userId).maybeSingle();
    if (deal && canTransition('deal', deal.status, 'funded')) {
      await supabase.from('automotive_deals').update({ status: 'funded' }).eq('id', citCase.deal_id).eq('user_id', userId);
      await createTimelineEvent(userId, citCase.deal_id, 'deal_funded', { triggeredByCitResolution: true });
    }
  }

  return ok({ updated: true });
}

async function listCitCases(userId, body) {
  const dealId = toStr(body.dealId);
  const status = toStr(body.status);

  let query = supabase
    .from('automotive_cit_cases')
    .select('*')
    .eq('user_id', userId)
    .order('opened_at', { ascending: false });

  if (dealId) query = query.eq('deal_id', dealId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return fail('Failed to fetch CIT cases.', 'ERR_DB', 500);
  return ok({ citCases: data });
}

// ── Cancellation Cases ────────────────────────────────────────────────────
async function openCancellation(userId, body) {
  const dealId = toStr(body.dealId);
  const productId = toStr(body.productId);
  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);

  const { data: deal } = await supabase
    .from('automotive_deals')
    .select('id')
    .eq('id', dealId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!deal) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  const { data: cancelRow, error } = await supabase
    .from('automotive_cancellation_cases')
    .insert({
      user_id: userId,
      deal_id: dealId,
      product_id: productId,
      cancellation_reason: toStr(body.cancellationReason),
      requested_at: new Date().toISOString(),
      refund_amount: toNum(body.estimatedRefund) || null,
      status: 'requested',
      notes: toStr(body.notes),
    })
    .select('id')
    .single();

  if (error) return fail('Failed to open cancellation.', 'ERR_DB', 500);

  await createTimelineEvent(userId, dealId, 'cancellation_opened', {
    cancellationId: cancelRow.id,
    productId,
    reason: body.cancellationReason,
  });

  return ok({ cancellationId: cancelRow.id });
}

async function updateCancellationStatus(userId, body) {
  const cancellationId = toStr(body.cancellationId);
  const newStatus = toStr(body.newStatus);
  if (!cancellationId || !newStatus) return fail('cancellationId and newStatus are required.', 'ERR_VALIDATION', 400);

  const { data: record } = await supabase
    .from('automotive_cancellation_cases')
    .select('id, deal_id, status')
    .eq('id', cancellationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!record) return fail('Cancellation not found.', 'ERR_NOT_FOUND', 404);
  if (!canTransition('cancellation', record.status, newStatus)) {
    return fail(`Cannot transition cancellation from ${record.status} to ${newStatus}.`, 'ERR_STATE', 422);
  }

  const updatePayload = {
    status: newStatus,
    notes: toStr(body.notes) || undefined,
  };

  if (body.actualRefundAmount !== undefined) updatePayload.refund_amount = toNum(body.actualRefundAmount);
  if (body.chargebackAmount !== undefined) updatePayload.chargeback_amount = toNum(body.chargebackAmount);
  if (toStr(body.chargebackNotes)) updatePayload.chargeback_notes = toStr(body.chargebackNotes);
  if (toStr(body.providerConfirmation)) updatePayload.provider_confirmation = toStr(body.providerConfirmation);
  if (body.refundedAt) updatePayload.refunded_at = body.refundedAt;
  if (body.submittedAt) updatePayload.submitted_at = body.submittedAt;
  if (body.confirmedAt) updatePayload.confirmed_at = body.confirmedAt;

  const { error } = await supabase
    .from('automotive_cancellation_cases')
    .update(updatePayload)
    .eq('id', cancellationId)
    .eq('user_id', userId);

  if (error) return fail('Failed to update cancellation.', 'ERR_DB', 500);

  await createTimelineEvent(userId, record.deal_id, 'cancellation_updated', {
    cancellationId,
    fromStatus: record.status,
    toStatus: newStatus,
  });

  return ok({ updated: true });
}

async function listCancellations(userId, body) {
  const dealId = toStr(body.dealId);
  const status = toStr(body.status);

  let query = supabase
    .from('automotive_cancellation_cases')
    .select('*')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false });

  if (dealId) query = query.eq('deal_id', dealId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return fail('Failed to fetch cancellations.', 'ERR_DB', 500);
  return ok({ cancellations: data });
}

// ── Customer Issues ───────────────────────────────────────────────────────
async function openCustomerIssue(userId, body) {
  const dealId = toStr(body.dealId);
  const issueType = toStr(body.issueType);
  if (!dealId || !issueType) return fail('dealId and issueType are required.', 'ERR_VALIDATION', 400);

  const { data: deal } = await supabase
    .from('automotive_deals')
    .select('id, status')
    .eq('id', dealId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!deal) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  const { data: issueRow, error } = await supabase
    .from('automotive_customer_issues')
    .insert({
      user_id: userId,
      deal_id: dealId,
      issue_type: issueType,
      description: toStr(body.issueDescription) || 'Customer issue reported',
      status: 'open',
      target_resolution_date: toStr(body.targetResolutionDate),
      escalated_to: toStr(body.assignedTo),
      notes: toStr(body.notes),
    })
    .select('id')
    .single();

  if (error) return fail('Failed to open customer issue.', 'ERR_DB', 500);

  // Mark deal as issue_open if permitted
  if (canTransition('deal', deal.status, 'issue_open')) {
    await supabase
      .from('automotive_deals')
      .update({ status: 'issue_open' })
      .eq('id', dealId)
      .eq('user_id', userId);
  }

  await createTimelineEvent(userId, dealId, 'customer_issue_opened', { issueId: issueRow.id, issueType, priority: body.priority });

  return ok({ issueId: issueRow.id });
}

async function updateIssueStatus(userId, body) {
  const issueId = toStr(body.issueId);
  const newStatus = toStr(body.newStatus);
  if (!issueId || !newStatus) return fail('issueId and newStatus are required.', 'ERR_VALIDATION', 400);

  const { data: record } = await supabase
    .from('automotive_customer_issues')
    .select('id, deal_id, status')
    .eq('id', issueId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!record) return fail('Issue not found.', 'ERR_NOT_FOUND', 404);
  if (!canTransition('issue', record.status, newStatus)) {
    return fail(`Cannot transition issue from ${record.status} to ${newStatus}.`, 'ERR_STATE', 422);
  }

  const updatePayload = { status: newStatus };
  if (toStr(body.resolutionNote)) updatePayload.resolution_notes = body.resolutionNote;
  if (newStatus === 'resolved' || newStatus === 'closed') updatePayload.resolved_at = new Date().toISOString();

  const { error } = await supabase
    .from('automotive_customer_issues')
    .update(updatePayload)
    .eq('id', issueId)
    .eq('user_id', userId);

  if (error) return fail('Failed to update issue.', 'ERR_DB', 500);

  await createTimelineEvent(userId, record.deal_id, 'customer_issue_updated', { issueId, fromStatus: record.status, toStatus: newStatus });

  return ok({ updated: true });
}

async function listCustomerIssues(userId, body) {
  const dealId = toStr(body.dealId);
  const status = toStr(body.status);

  let query = supabase
    .from('automotive_customer_issues')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (dealId) query = query.eq('deal_id', dealId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return fail('Failed to fetch customer issues.', 'ERR_DB', 500);
  return ok({ issues: data });
}

// ── Commission Records ────────────────────────────────────────────────────
async function addCommission(userId, body) {
  const dealId = toStr(body.dealId);
  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);

  const { data: row, error } = await supabase
    .from('automotive_commission_records')
    .insert({
      user_id: userId,
      deal_id: dealId,
      commission_type: toStr(body.commissionType) || 'fi_back_gross',
      gross_amount: toNum(body.grossAmount),
      commission_rate: toNum(body.commissionRate) || null,
      commission_amount: toNum(body.commissionAmount),
      pay_period: toStr(body.payPeriod),
      status: toStr(body.status) || 'pending',
      notes: toStr(body.notes),
    })
    .select('id')
    .single();

  if (error) return fail('Failed to add commission record.', 'ERR_DB', 500);

  await createTimelineEvent(userId, dealId, 'commission_added', { commissionId: row.id, commissionType: body.commissionType, amount: body.commissionAmount });

  return ok({ commissionId: row.id });
}

async function updateCommission(userId, body) {
  const commissionId = toStr(body.commissionId);
  if (!commissionId) return fail('commissionId is required.', 'ERR_VALIDATION', 400);

  const { error } = await supabase
    .from('automotive_commission_records')
    .update({
      status: toStr(body.status) || undefined,
      commission_amount: body.commissionAmount !== undefined ? toNum(body.commissionAmount) : undefined,
      chargeback_amount: body.chargebackAmount !== undefined ? toNum(body.chargebackAmount) : undefined,
      paid_at: body.paidAt || undefined,
      notes: toStr(body.notes) || undefined,
    })
    .eq('id', commissionId)
    .eq('user_id', userId);

  if (error) return fail('Failed to update commission.', 'ERR_DB', 500);
  return ok({ updated: true });
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
    const dealId = params.dealId;
    if (resource === 'cit') return listCitCases(userId, { dealId });
    if (resource === 'cancellations') return listCancellations(userId, { dealId });
    if (resource === 'issues') return listCustomerIssues(userId, { dealId });
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
    case 'open_cit_case':             return openCitCase(userId, body);
    case 'update_cit_status':         return updateCitStatus(userId, body);
    case 'list_cit_cases':            return listCitCases(userId, body);
    case 'open_cancellation':         return openCancellation(userId, body);
    case 'update_cancellation_status': return updateCancellationStatus(userId, body);
    case 'list_cancellations':        return listCancellations(userId, body);
    case 'open_customer_issue':       return openCustomerIssue(userId, body);
    case 'update_issue_status':       return updateIssueStatus(userId, body);
    case 'list_customer_issues':      return listCustomerIssues(userId, body);
    case 'add_commission':            return addCommission(userId, body);
    case 'update_commission':         return updateCommission(userId, body);
    default:
      return fail(`Unknown action: ${action}`, 'ERR_ACTION', 400);
  }
}
