import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import {
  analyzeStructure,
  generateScenarios,
  calculateAmountFinanced,
} from '../../lib/automotive/structure-engine.js';
import { aggregateObligations } from '../../lib/automotive/income-engine.js';
import { validateStructureIntegrity } from '../../lib/automotive/compliance-guardrails.js';
import { canTransition } from '../../lib/automotive/state-machine.js';

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

async function createTimelineEvent(userId, dealId, eventType, payload = {}) {
  await supabase.from('automotive_timeline_events').insert({
    user_id: userId,
    deal_id: dealId,
    event_type: eventType,
    event_payload: payload,
  });
}

// ── Analyze deal structure + income + obligations ──────────────────────────
async function analyzeFullStructure(userId, body) {
  const dealId = toStr(body.dealId);
  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);

  // Load structure
  const { data: structure } = await supabase
    .from('automotive_deal_structures')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', userId)
    .maybeSingle();

  // Load deal for type and lender criteria
  const { data: deal } = await supabase
    .from('automotive_deals')
    .select('id, deal_type, lender_id')
    .eq('id', dealId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!deal) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  // Load active income calculation
  const { data: incomeCalcs } = await supabase
    .from('automotive_income_calculations')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const latestIncome = incomeCalcs?.[0] || null;

  // Load active obligations
  const { data: obligations } = await supabase
    .from('automotive_obligations')
    .select('monthly_payment, is_paying_off, obligation_type')
    .eq('deal_id', dealId)
    .eq('user_id', userId);

  // Load applicant declared income
  const { data: applicants } = await supabase
    .from('automotive_applicants')
    .select('declared_monthly_income, declared_obligations_monthly')
    .eq('deal_id', dealId)
    .eq('user_id', userId)
    .eq('applicant_role', 'primary')
    .limit(1);

  const primaryApplicant = applicants?.[0] || null;

  // Load lender program criteria if lender is set
  let lenderCriteria = {};
  if (deal.lender_id) {
    const { data: programs } = await supabase
      .from('automotive_lender_programs')
      .select('max_ltv_percent, max_pti_percent, max_dti_percent, max_backend_percent, max_term_months')
      .eq('lender_id', deal.lender_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    if (programs?.[0]) {
      const p = programs[0];
      lenderCriteria = {
        maxLtv: p.max_ltv_percent || 125,
        maxPti: p.max_pti_percent || 20,
        maxDti: p.max_dti_percent || 50,
        maxBackendPercent: p.max_backend_percent || 30,
        maxTermMonths: p.max_term_months || 84,
      };
    }
  }

  const structureInput = structure
    ? { ...structure, dealType: deal.deal_type }
    : { dealType: deal.deal_type };

  const incomeInput = {
    grossMonthly: latestIncome?.gross_monthly_income || primaryApplicant?.declared_monthly_income || 0,
    netMonthly: 0,
    confidence: latestIncome?.confidence_score || (primaryApplicant?.declared_monthly_income ? 50 : 0),
  };

  const { totalMonthly, activeMonthly } = aggregateObligations(obligations || []);

  // Validate structure integrity (compliance guardrail)
  const integrityCheck = validateStructureIntegrity(structureInput);

  const analysis = analyzeStructure(
    structureInput,
    incomeInput,
    obligations || [],
    lenderCriteria,
  );

  // Persist computed metrics to DB
  await supabase
    .from('automotive_deal_metrics')
    .upsert({
      user_id: userId,
      deal_id: dealId,
      ltv_percent: analysis.ltv,
      pti_percent: analysis.pti,
      dti_percent: analysis.dti,
      payment_estimate: analysis.payment,
      backend_percent: analysis.backendLoad,
      front_gross: analysis.frontGross,
      monthly_obligations: activeMonthly,
      structure_pressure_score: analysis.structurePressureScore,
      approval_readiness_score: analysis.approvalReadinessScore,
      payment_sensitivity: analysis.sensitivity,
      summary: integrityCheck.errors.length > 0
        ? `Structure errors: ${integrityCheck.errors.join('; ')}`
        : analysis.flags.length > 0
          ? `${analysis.flags.length} advisory flag(s) — review before submission.`
          : 'Structure within expected range.',
      calculated_at: new Date().toISOString(),
    }, { onConflict: 'deal_id' });

  await createTimelineEvent(userId, dealId, 'structure_analyzed', {
    ltv: analysis.ltv,
    pti: analysis.pti,
    dti: analysis.dti,
    pressureScore: analysis.structurePressureScore,
  });

  return ok({
    analysis,
    integrityCheck,
    incomeInput,
    lenderCriteria,
    obligationSummary: { totalMonthly, activeMonthly },
  });
}

// ── Generate structure scenarios ───────────────────────────────────────────
async function getScenarios(userId, body) {
  const dealId = toStr(body.dealId);
  const objective = toStr(body.objective) || 'approval';

  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);

  const [structureRes, dealRes, incomeRes, obligRes] = await Promise.all([
    supabase.from('automotive_deal_structures').select('*').eq('deal_id', dealId).eq('user_id', userId).maybeSingle(),
    supabase.from('automotive_deals').select('id, deal_type').eq('id', dealId).eq('user_id', userId).maybeSingle(),
    supabase.from('automotive_income_calculations').select('gross_monthly_income, confidence_score').eq('deal_id', dealId).eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('automotive_obligations').select('monthly_payment, is_paying_off').eq('deal_id', dealId).eq('user_id', userId),
  ]);

  if (!dealRes.data) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  const structure = structureRes.data ? { ...structureRes.data, dealType: dealRes.data.deal_type } : { dealType: dealRes.data.deal_type };
  const income = { grossMonthly: incomeRes.data?.[0]?.gross_monthly_income || 0, confidence: incomeRes.data?.[0]?.confidence_score || 0 };
  const obligations = obligRes.data || [];

  const result = generateScenarios(structure, income, obligations, objective);

  return ok(result);
}

// ── Save vehicle ───────────────────────────────────────────────────────────
async function upsertVehicle(userId, body) {
  const dealId = toStr(body.dealId);
  const vehicleRole = toStr(body.vehicleRole) || 'purchase';

  if (!dealId) return fail('dealId is required.', 'ERR_VALIDATION', 400);

  const vehicleId = toStr(body.id);
  const payload = {
    user_id: userId,
    deal_id: dealId,
    vehicle_role: vehicleRole,
    vin: toStr(body.vin),
    year: body.year ? parseInt(body.year, 10) : null,
    make: toStr(body.make),
    model: toStr(body.model),
    trim_level: toStr(body.trimLevel),
    mileage: body.mileage ? parseInt(body.mileage, 10) : null,
    color: toStr(body.color),
    stock_number: toStr(body.stockNumber),
    condition: toStr(body.condition) || 'used',
    msrp: toNum(body.msrp),
    invoice_cost: toNum(body.invoiceCost),
    wholesale_value: toNum(body.wholesaleValue),
    retail_book_value: toNum(body.retailBookValue),
    nada_value: toNum(body.nadaValue),
    kbb_value: toNum(body.kbbValue),
    mmr_value: toNum(body.mmrValue),
    book_value_basis: toStr(body.bookValueBasis),
    payoff_amount: toNum(body.payoffAmount),
    payoff_lender: toStr(body.payoffLender),
    collateral_notes: toStr(body.collateralNotes),
  };

  let result;
  if (vehicleId) {
    result = await supabase
      .from('automotive_vehicles')
      .update(payload)
      .eq('id', vehicleId)
      .eq('user_id', userId)
      .select('id')
      .single();
  } else {
    result = await supabase
      .from('automotive_vehicles')
      .insert(payload)
      .select('id')
      .single();
  }

  if (result.error) return fail('Failed to save vehicle.', 'ERR_DB', 500);

  await createTimelineEvent(userId, dealId, 'vehicle_saved', { vehicleRole, vin: payload.vin, year: payload.year, make: payload.make, model: payload.model });

  // Update structure collateral value from trade/purchase vehicle
  if (vehicleRole === 'purchase' && (body.nadaValue || body.kbbValue || body.wholesaleValue)) {
    const colValue = toNum(body.nadaValue) || toNum(body.kbbValue) || toNum(body.wholesaleValue);
    await supabase
      .from('automotive_deal_structures')
      .upsert({
        user_id: userId,
        deal_id: dealId,
        collateral_value: colValue,
        collateral_value_basis: toStr(body.bookValueBasis) || 'nada',
      }, { onConflict: 'deal_id' });
  }

  return ok({ vehicleId: result.data?.id });
}

// ── Save obligations ───────────────────────────────────────────────────────
async function upsertObligation(userId, body) {
  const dealId = toStr(body.dealId);
  const obligationType = toStr(body.obligationType);

  if (!dealId || !obligationType) {
    return fail('dealId and obligationType are required.', 'ERR_VALIDATION', 400);
  }

  const oblId = toStr(body.id);
  const payload = {
    user_id: userId,
    deal_id: dealId,
    applicant_id: toStr(body.applicantId),
    obligation_type: obligationType,
    creditor_name: toStr(body.creditorName),
    monthly_payment: toNum(body.monthlyPayment),
    balance_remaining: toNum(body.balanceRemaining) || null,
    account_status: toStr(body.accountStatus) || 'current',
    is_bureau_verified: body.isBureauVerified === true,
    is_paying_off: body.isPayingOff === true,
    source: toStr(body.source) || 'manual',
    notes: toStr(body.notes),
  };

  let result;
  if (oblId) {
    result = await supabase
      .from('automotive_obligations')
      .update(payload)
      .eq('id', oblId)
      .eq('user_id', userId)
      .select('id')
      .single();
  } else {
    result = await supabase
      .from('automotive_obligations')
      .insert(payload)
      .select('id')
      .single();
  }

  if (result.error) return fail('Failed to save obligation.', 'ERR_DB', 500);

  return ok({ obligationId: result.data?.id });
}

async function deleteObligation(userId, body) {
  const oblId = toStr(body.obligationId);
  if (!oblId) return fail('obligationId is required.', 'ERR_VALIDATION', 400);

  const { error } = await supabase
    .from('automotive_obligations')
    .delete()
    .eq('id', oblId)
    .eq('user_id', userId);

  if (error) return fail('Failed to delete obligation.', 'ERR_DB', 500);
  return ok({ deleted: true });
}

// ── Load full structure workspace ──────────────────────────────────────────
async function loadStructureWorkspace(userId, dealId) {
  const [structure, metrics, vehicles, obligations, incomeCalcs] = await Promise.all([
    supabase.from('automotive_deal_structures').select('*').eq('deal_id', dealId).eq('user_id', userId).maybeSingle(),
    supabase.from('automotive_deal_metrics').select('*').eq('deal_id', dealId).eq('user_id', userId).maybeSingle(),
    supabase.from('automotive_vehicles').select('*').eq('deal_id', dealId).eq('user_id', userId),
    supabase.from('automotive_obligations').select('*').eq('deal_id', dealId).eq('user_id', userId),
    supabase.from('automotive_income_calculations').select('*').eq('deal_id', dealId).eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
  ]);

  return {
    structure: structure.data,
    metrics: metrics.data,
    vehicles: vehicles.data || [],
    obligations: obligations.data || [],
    incomeHistory: incomeCalcs.data || [],
  };
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
    const dealId = event.queryStringParameters?.dealId;
    if (!dealId) return fail('dealId query parameter is required.', 'ERR_VALIDATION', 400);
    const workspace = await loadStructureWorkspace(userId, dealId);
    return ok(workspace);
  }

  if (event.httpMethod !== 'POST') return fail('Method not allowed', 'ERR_METHOD', 405);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return fail('Invalid JSON body', 'ERR_PARSE', 400);
  }

  const action = body.action;
  switch (action) {
    case 'analyze_structure':   return analyzeFullStructure(userId, body);
    case 'get_scenarios':       return getScenarios(userId, body);
    case 'upsert_vehicle':      return upsertVehicle(userId, body);
    case 'upsert_obligation':   return upsertObligation(userId, body);
    case 'delete_obligation':   return deleteObligation(userId, body);
    default:
      return fail(`Unknown action: ${action}`, 'ERR_ACTION', 400);
  }
}
