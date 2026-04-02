import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import {
  buildKpiSnapshot,
  summarizePipeline,
  aggregateCommissions,
} from '../../lib/automotive/reporting-engine.js';

const SUPPORTED_ACTIONS = new Set([
  'get_kpi_snapshot',
  'get_pipeline_summary',
  'get_commission_summary',
  'list_snapshots',
  'get_snapshot',
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

// ── KPI Snapshot ───────────────────────────────────────────────────────────
async function getKpiSnapshot(userId, body) {
  const dateFrom = toStr(body.dateFrom) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dateTo = toStr(body.dateTo) || new Date().toISOString().slice(0, 10);
  const saveSnapshot = body.saveSnapshot === true;
  const label = toStr(body.label) || `KPI ${dateFrom} – ${dateTo}`;

  // Query all data in parallel for the reporting period
  const [
    dealsRes,
    metricsRes,
    presentationsRes,
    cancellationsRes,
    citRes,
    commissionsRes,
    productsRes,
  ] = await Promise.all([
    supabase
      .from('automotive_deals')
      .select('id, status, deal_type, created_at, funded_at')
      .eq('user_id', userId)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59Z'),

    supabase
      .from('automotive_deal_metrics')
      .select('deal_id, ltv_percent, pti_percent, dti_percent, payment_estimate, front_gross, back_gross, reserve_amount, total_gross')
      .eq('user_id', userId),

    supabase
      .from('automotive_menu_presentations')
      .select('deal_id, menu_payload, presented_at, status')
      .eq('user_id', userId)
      .gte('presented_at', dateFrom)
      .lte('presented_at', dateTo + 'T23:59:59Z'),

    supabase
      .from('automotive_cancellation_cases')
      .select('id, deal_id, status, refund_amount, chargeback_amount, product_id, requested_at')
      .eq('user_id', userId)
      .gte('requested_at', dateFrom)
      .lte('requested_at', dateTo + 'T23:59:59Z'),

    supabase
      .from('automotive_cit_cases')
      .select('id, deal_id, status, days_open, opened_at, resolved_at')
      .eq('user_id', userId),

    supabase
      .from('automotive_commission_records')
      .select('commission_type, amount, chargeback_amount, status, paid_at')
      .eq('user_id', userId)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59Z'),

    supabase
      .from('automotive_fi_products')
      .select('id, name, category')
      .eq('user_id', userId),
  ]);

  const deals = dealsRes.data || [];
  const metrics = metricsRes.data || [];
  const presentations = presentationsRes.data || [];
  const cancellations = cancellationsRes.data || [];
  const citCases = citRes.data || [];
  const commissions = commissionsRes.data || [];
  const products = productsRes.data || [];

  // Build product map for enrichment
  const productMap = new Map(products.map((p) => [p.id, { name: p.name, category: p.category }]));

  // Fund-only metrics
  const dealIdSet = new Set(deals.map((d) => d.id));
  const relevantMetrics = metrics.filter((m) => dealIdSet.has(m.deal_id));
  const relevantPresents = presentations.filter((p) => dealIdSet.has(p.deal_id));

  const snapshot = buildKpiSnapshot({
    deals,
    dealMetrics: relevantMetrics,
    presentations: relevantPresents,
    cancellations,
    citCases,
    commissions,
    periodStart: dateFrom,
    periodEnd: dateTo,
    productMap,
  });

  // Optionally persist the snapshot
  if (saveSnapshot) {
    await supabase
      .from('automotive_report_snapshots')
      .insert({
        user_id: userId,
        snapshot_date: new Date().toISOString().slice(0, 10),
        period_type: 'custom',
        period_start: dateFrom,
        period_end: dateTo,
        total_deals: snapshot?.volume?.totalDeals || 0,
        funded_deals: snapshot?.volume?.fundedDeals || 0,
        booked_deals: snapshot?.volume?.bookedDeals || 0,
        cancelled_deals: snapshot?.volume?.cancelledDeals || 0,
        total_front_gross: snapshot?.gross?.totalFrontGross || 0,
        total_back_gross: snapshot?.gross?.totalBackGross || 0,
        total_gross: snapshot?.gross?.totalGross || 0,
        pvr: snapshot?.pvr || 0,
        vpi: snapshot?.penetration?.vpi || 0,
        avg_ltv_percent: snapshot?.averages?.avgLtv || 0,
        avg_pti_percent: snapshot?.averages?.avgPti || 0,
        penetration_by_category: snapshot?.penetration?.byCategory || {},
        cancellation_by_category: snapshot?.cancellations?.byCategory || {},
        cit_aging_summary: snapshot?.cit || {},
        pipeline_by_status: snapshot?.pipeline?.byStatus || {},
        filters_applied: { label },
        computed_at: new Date().toISOString(),
      });
  }

  return ok({ snapshot, period: { from: dateFrom, to: dateTo }, savedSnapshot: saveSnapshot });
}

// ── Pipeline Summary ───────────────────────────────────────────────────────
async function getPipelineSummary(userId) {
  const { data: deals, error } = await supabase
    .from('automotive_deals')
    .select('id, status, deal_type, created_at')
    .eq('user_id', userId)
    .not('status', 'in', '("archived","cancelled")');

  if (error) return fail('Failed to fetch pipeline.', 'ERR_DB', 500);
  const summary = summarizePipeline(deals || []);
  return ok({ pipeline: summary });
}

// ── Commission Summary ────────────────────────────────────────────────────
async function getCommissionSummary(userId, body) {
  const payPeriod = toStr(body.payPeriod);

  let query = supabase
    .from('automotive_commission_records')
    .select('commission_type, amount, chargeback_amount, status, paid_at')
    .eq('user_id', userId);

  if (payPeriod) {
    const start = `${payPeriod}-01`;
    query = query.gte('created_at', start).lt('created_at', `${payPeriod}-32`);
  }

  const { data, error } = await query;
  if (error) return fail('Failed to fetch commissions.', 'ERR_DB', 500);
  const agg = aggregateCommissions(data || []);
  return ok({ commissions: agg });
}

// ── Saved Snapshots ────────────────────────────────────────────────────────
async function listSnapshots(userId) {
  const { data, error } = await supabase
    .from('automotive_report_snapshots')
    .select('id, snapshot_date, period_type, period_start, period_end, computed_at')
    .eq('user_id', userId)
    .order('computed_at', { ascending: false })
    .limit(50);

  if (error) return fail('Failed to fetch snapshots.', 'ERR_DB', 500);
  return ok({ snapshots: data });
}

async function getSnapshot(userId, snapshotId) {
  if (!snapshotId) return fail('snapshotId is required.', 'ERR_VALIDATION', 400);
  const { data, error } = await supabase
    .from('automotive_report_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return fail('Snapshot not found.', 'ERR_NOT_FOUND', 404);
  return ok({ snapshot: data });
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
    if (resource === 'pipeline') return getPipelineSummary(userId);
    if (resource === 'snapshots') return listSnapshots(userId);
    if (resource === 'snapshot' && params.id) return getSnapshot(userId, params.id);
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
    case 'get_kpi_snapshot':       return getKpiSnapshot(userId, body);
    case 'get_pipeline_summary':   return getPipelineSummary(userId);
    case 'get_commission_summary': return getCommissionSummary(userId, body);
    case 'list_snapshots':         return listSnapshots(userId);
    case 'get_snapshot':           return getSnapshot(userId, body.snapshotId);
    default:
      return fail(`Unknown action: ${action}`, 'ERR_ACTION', 400);
  }
}
