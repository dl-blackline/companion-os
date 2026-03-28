import { supabase } from '../../lib/_supabase.js';
import { fail, ok, preflight } from '../../lib/_responses.js';

function getAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function stringOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function createTimelineEvent(userId, dealId, eventType, payload = {}) {
  await supabase.from('automotive_timeline_events').insert({
    user_id: userId,
    deal_id: dealId,
    event_type: eventType,
    event_payload: payload,
  });
}

async function loadDashboard(userId) {
  const [
    dealsRes,
    flagsRes,
    productsRes,
    presentationsRes,
    metricsRes,
    vehiclesRes,
    lendersRes,
    callbacksRes,
    citRes,
    issuesRes,
    cancellationsRes,
    commissionsRes,
    documentsRes,
  ] = await Promise.all([
    supabase
      .from('automotive_deals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('automotive_review_flags')
      .select('id, deal_id, category, severity, status, message, recommended_action, created_at')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('automotive_fi_products')
      .select('id, name, category, provider, cost, sell_price, is_active, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('automotive_menu_presentations')
      .select('id, deal_id, title, status, menu_payload, created_at, updated_at, presented_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(40),
    supabase
      .from('automotive_deal_metrics')
      .select('deal_id, payment_estimate, structure_pressure_score, approval_readiness_score, summary, calculated_at'),
    supabase
      .from('automotive_vehicles')
      .select('deal_id, vehicle_role, year, make, model')
      .eq('user_id', userId),
    supabase
      .from('automotive_lenders')
      .select('id, lender_name')
      .eq('user_id', userId),
    supabase
      .from('automotive_callbacks')
      .select('deal_id, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('automotive_cit_cases')
      .select('deal_id, current_status, updated_at')
      .eq('user_id', userId),
    supabase
      .from('automotive_customer_issues')
      .select('deal_id, current_status, updated_at')
      .eq('user_id', userId),
    supabase
      .from('automotive_cancellation_cases')
      .select('deal_id, current_status, requested_at')
      .eq('user_id', userId),
    supabase
      .from('automotive_commission_records')
      .select('status')
      .eq('user_id', userId),
    supabase
      .from('automotive_documents')
      .select('id, deal_id, document_type, filename, document_status, confidence_score, reviewed_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const deals = dealsRes.data || [];
  const recentFlags = flagsRes.data || [];
  const products = productsRes.data || [];
  const presentations = presentationsRes.data || [];
  const metrics = metricsRes.data || [];
  const vehicles = vehiclesRes.data || [];
  const lenders = lendersRes.data || [];
  const callbacks = callbacksRes.data || [];
  const citCases = citRes.data || [];
  const issues = issuesRes.data || [];
  const cancellations = cancellationsRes.data || [];
  const commissions = commissionsRes.data || [];
  const documents = documentsRes.data || [];

  const metricsByDealId = new Map(metrics.map((row) => [row.deal_id, row]));
  const lenderNameById = new Map(lenders.map((row) => [row.id, row.lender_name]));
  const presentationByDealId = new Map(presentations.map((row) => [row.deal_id, row]));

  const vehiclesByDealId = new Map();
  for (const vehicle of vehicles) {
    if (!vehiclesByDealId.has(vehicle.deal_id)) {
      vehiclesByDealId.set(vehicle.deal_id, []);
    }
    vehiclesByDealId.get(vehicle.deal_id).push(vehicle);
  }

  const callbacksByDealId = new Map();
  for (const callback of callbacks) {
    if (!callbacksByDealId.has(callback.deal_id)) {
      callbacksByDealId.set(callback.deal_id, []);
    }
    callbacksByDealId.get(callback.deal_id).push(callback);
  }

  const citByDealId = new Map();
  for (const cit of citCases) {
    if (!citByDealId.has(cit.deal_id)) {
      citByDealId.set(cit.deal_id, []);
    }
    citByDealId.get(cit.deal_id).push(cit);
  }

  const issuesByDealId = new Map();
  for (const issue of issues) {
    if (!issuesByDealId.has(issue.deal_id)) {
      issuesByDealId.set(issue.deal_id, []);
    }
    issuesByDealId.get(issue.deal_id).push(issue);
  }

  const flagsByDealId = new Map();
  for (const flag of recentFlags) {
    flagsByDealId.set(flag.deal_id, (flagsByDealId.get(flag.deal_id) || 0) + 1);
  }

  const docsByDealId = new Map();
  for (const document of documents) {
    if (!docsByDealId.has(document.deal_id)) {
      docsByDealId.set(document.deal_id, []);
    }
    docsByDealId.get(document.deal_id).push(document);
  }

  const enrichedDeals = deals.map((deal) => {
    const metric = metricsByDealId.get(deal.id);
    const purchaseVehicle = (vehiclesByDealId.get(deal.id) || []).find((vehicle) => vehicle.vehicle_role === 'purchase')
      || (vehiclesByDealId.get(deal.id) || [])[0];
    const vehicleSummary = purchaseVehicle
      ? [purchaseVehicle.year, purchaseVehicle.make, purchaseVehicle.model].filter(Boolean).join(' ')
      : null;
    const callbackRows = callbacksByDealId.get(deal.id) || [];
    const latestCallback = callbackRows[0] || null;
    const issueRows = issuesByDealId.get(deal.id) || [];
    const citRows = citByDealId.get(deal.id) || [];
    const openCit = citRows.some((cit) => !['resolved', 'unfunded', 'archived'].includes(cit.current_status));
    const docsForDeal = docsByDealId.get(deal.id) || [];
    const hasWeakDocs = docsForDeal.some((doc) => ['uploaded', 'needs_review', 'rejected'].includes(doc.document_status));
    const latestPresentation = presentationByDealId.get(deal.id);
    const activityCandidates = [deal.updated_at, metric?.calculated_at, latestCallback?.created_at, latestPresentation?.updated_at]
      .filter(Boolean)
      .sort()
      .reverse();

    return {
      ...deal,
      lender_name: deal.lender_id ? lenderNameById.get(deal.lender_id) || null : null,
      vehicle_summary: vehicleSummary,
      callback_status: latestCallback?.status || null,
      callback_count: callbackRows.length,
      open_flag_count: flagsByDealId.get(deal.id) || 0,
      issue_count: issueRows.filter((issue) => !['resolved', 'closed'].includes(issue.current_status)).length,
      has_open_cit: openCit,
      menu_status: latestPresentation?.status || 'not_started',
      structure_pressure_score: metric?.structure_pressure_score ?? null,
      approval_readiness_score: metric?.approval_readiness_score ?? null,
      payment_estimate: metric?.payment_estimate ?? null,
      file_summary: metric?.summary || (hasWeakDocs ? 'Documents still need review.' : null),
      last_activity_at: activityCandidates[0] || deal.updated_at,
    };
  });

  const summary = {
    totalDeals: enrichedDeals.length,
    openFlags: recentFlags.length,
    dealsReadyForMenu: enrichedDeals.filter((deal) => ['menu_ready', 'presented', 'submitted'].includes(deal.status)).length,
    dealsInCit: enrichedDeals.filter((deal) => deal.status === 'cit_hold' || deal.has_open_cit).length,
    dealsNeedingDocs: enrichedDeals.filter((deal) => ['docs_pending', 'docs_under_review', 'document_review'].includes(deal.status)).length,
    callbacksWaiting: callbacks.filter((callback) => ['received', 'needs_review'].includes(callback.status)).length,
    bookedNotFunded: enrichedDeals.filter((deal) => ['booked', 'submitted'].includes(deal.status)).length,
    cancellationRequests: cancellations.filter((row) => !['refunded', 'closed'].includes(row.current_status)).length,
    customerIssues: issues.filter((row) => !['resolved', 'closed'].includes(row.current_status)).length,
    commissionsPending: commissions.filter((row) => row.status === 'pending').length,
  };

  return {
    summary,
    deals: enrichedDeals,
    recentFlags,
    products,
    presentations,
    recentDocuments: documents,
  };
}

async function createDeal(userId, body) {
  const dealName = stringOrNull(body.dealName);
  const dealType = stringOrNull(body.dealType) || 'retail';

  if (!dealName) {
    return fail('dealName is required.', 'ERR_VALIDATION', 400);
  }

  const { data: created, error } = await supabase
    .from('automotive_deals')
    .insert({
      user_id: userId,
      store_id: stringOrNull(body.storeId),
      deal_name: dealName,
      deal_type: dealType,
      status: 'intake',
      assigned_user_id: stringOrNull(body.assignedUserId) || userId,
      next_step_owner_user_id: stringOrNull(body.assignedUserId) || userId,
      stage_entered_at: new Date().toISOString(),
      source_channel: stringOrNull(body.sourceChannel),
      customer_payment_target: toNumber(body.customerPaymentTarget),
      notes: stringOrNull(body.notes),
    })
    .select('id, deal_name, deal_type, status')
    .single();

  if (error || !created) {
    return fail('Failed to create deal.', 'ERR_DB', 500);
  }

  await createTimelineEvent(userId, created.id, 'deal_created', {
    dealName: created.deal_name,
    dealType: created.deal_type,
  });

  return ok(await loadDashboard(userId));
}

async function setDealStatus(userId, body) {
  const dealId = stringOrNull(body.dealId);
  const status = stringOrNull(body.status);

  if (!dealId || !status) {
    return fail('dealId and status are required.', 'ERR_VALIDATION', 400);
  }

  const { data: updated, error } = await supabase
    .from('automotive_deals')
    .update({ status })
    .eq('id', dealId)
    .eq('user_id', userId)
    .select('id, status')
    .single();

  if (error || !updated) {
    return fail('Failed to update deal status.', 'ERR_DB', 500);
  }

  await createTimelineEvent(userId, dealId, 'deal_status_updated', { status: updated.status });

  return ok(await loadDashboard(userId));
}

async function upsertStructure(userId, body) {
  const dealId = stringOrNull(body.dealId);
  if (!dealId) {
    return fail('dealId is required.', 'ERR_VALIDATION', 400);
  }

  const payload = {
    user_id: userId,
    deal_id: dealId,
    selling_price: toNumber(body.sellingPrice),
    cash_down: toNumber(body.cashDown),
    rebates: toNumber(body.rebates),
    trade_allowance: toNumber(body.tradeAllowance),
    trade_payoff: toNumber(body.tradePayoff),
    amount_financed: toNumber(body.amountFinanced),
    term_months: toNumber(body.termMonths),
    apr_percent: toNumber(body.aprPercent),
    payment_estimate: toNumber(body.paymentEstimate),
    backend_total: toNumber(body.backendTotal),
    ttl_fees: toNumber(body.ttlFees),
    collateral_value_basis: stringOrNull(body.collateralValueBasis),
    collateral_value: toNumber(body.collateralValue),
  };

  const { error } = await supabase
    .from('automotive_deal_structures')
    .upsert(payload, { onConflict: 'deal_id' });

  if (error) {
    return fail('Failed to save deal structure.', 'ERR_DB', 500);
  }

  const ltv = payload.collateral_value > 0
    ? (payload.amount_financed / payload.collateral_value) * 100
    : 0;

  await supabase
    .from('automotive_deal_metrics')
    .upsert({
      user_id: userId,
      deal_id: dealId,
      ltv_percent: Number(ltv.toFixed(2)),
      payment_estimate: payload.payment_estimate,
      structure_pressure_score: ltv > 120 ? 85 : ltv > 100 ? 70 : 45,
      approval_readiness_score: ltv > 120 ? 45 : ltv > 100 ? 62 : 78,
      summary: ltv > 120 ? 'Structure pressure elevated.' : 'Structure within expected range.',
      calculated_at: new Date().toISOString(),
    }, { onConflict: 'deal_id' });

  await createTimelineEvent(userId, dealId, 'structure_updated', {
    amountFinanced: payload.amount_financed,
    ltvPercent: Number(ltv.toFixed(2)),
  });

  return ok(await loadDashboard(userId));
}

async function upsertProduct(userId, body) {
  const name = stringOrNull(body.name);
  const category = stringOrNull(body.category);

  if (!name || !category) {
    return fail('name and category are required.', 'ERR_VALIDATION', 400);
  }

  const payload = {
    id: stringOrNull(body.id) || undefined,
    user_id: userId,
    name,
    category,
    provider: stringOrNull(body.provider),
    cost: toNumber(body.cost),
    sell_price: toNumber(body.sellPrice),
    is_active: body.isActive !== false,
  };

  const { error } = await supabase
    .from('automotive_fi_products')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    return fail('Failed to save F&I product.', 'ERR_DB', 500);
  }

  return ok(await loadDashboard(userId));
}

async function addReviewFlag(userId, body) {
  const dealId = stringOrNull(body.dealId);
  const category = stringOrNull(body.category);
  const severity = stringOrNull(body.severity) || 'medium';
  const message = stringOrNull(body.message);

  if (!dealId || !category || !message) {
    return fail('dealId, category, and message are required.', 'ERR_VALIDATION', 400);
  }

  const { error } = await supabase
    .from('automotive_review_flags')
    .insert({
      user_id: userId,
      deal_id: dealId,
      category,
      severity,
      status: 'open',
      message,
      recommended_action: stringOrNull(body.recommendedAction),
    });

  if (error) {
    return fail('Failed to save review flag.', 'ERR_DB', 500);
  }

  await createTimelineEvent(userId, dealId, 'review_flag_added', { category, severity, message });
  return ok(await loadDashboard(userId));
}

async function upsertPresentation(userId, body) {
  const dealId = stringOrNull(body.dealId);
  const title = stringOrNull(body.title);

  if (!dealId || !title) {
    return fail('dealId and title are required.', 'ERR_VALIDATION', 400);
  }

  const { error } = await supabase
    .from('automotive_menu_presentations')
    .upsert({
      user_id: userId,
      deal_id: dealId,
      title,
      status: 'presented',
      menu_payload: body.menuPayload && typeof body.menuPayload === 'object' ? body.menuPayload : {},
      presented_at: new Date().toISOString(),
    }, { onConflict: 'deal_id' });

  if (error) {
    return fail('Failed to save menu presentation.', 'ERR_DB', 500);
  }

  await supabase
    .from('automotive_deals')
    .update({ status: 'presented' })
    .eq('id', dealId)
    .eq('user_id', userId);

  await createTimelineEvent(userId, dealId, 'menu_presented', { title });

  return ok(await loadDashboard(userId));
}

async function captureAcknowledgment(userId, body, event) {
  const dealId = stringOrNull(body.dealId);
  const presentationId = stringOrNull(body.presentationId);
  const customerName = stringOrNull(body.customerName);
  const typedSignature = stringOrNull(body.typedSignature);

  if (!dealId || !presentationId || !customerName || !typedSignature) {
    return fail('dealId, presentationId, customerName, and typedSignature are required.', 'ERR_VALIDATION', 400);
  }

  const ipAddress = event.headers?.['x-forwarded-for'] || event.headers?.['client-ip'] || null;
  const userAgent = event.headers?.['user-agent'] || null;

  const { error } = await supabase
    .from('automotive_signature_acknowledgments')
    .insert({
      user_id: userId,
      deal_id: dealId,
      presentation_id: presentationId,
      customer_name: customerName,
      typed_signature: typedSignature,
      ip_address: ipAddress,
      user_agent: userAgent,
      acknowledged_at: new Date().toISOString(),
    });

  if (error) {
    return fail('Failed to capture acknowledgment.', 'ERR_DB', 500);
  }

  await supabase
    .from('automotive_menu_presentations')
    .update({ status: 'acknowledged' })
    .eq('id', presentationId)
    .eq('user_id', userId);

  await createTimelineEvent(userId, dealId, 'presentation_acknowledged', {
    presentationId,
    customerName,
  });

  return ok(await loadDashboard(userId));
}

async function logIntegrationEvent(userId, body) {
  const dealId = stringOrNull(body.dealId);
  const direction = stringOrNull(body.direction) || 'inbound';
  const sourceSystem = stringOrNull(body.sourceSystem) || 'manual';

  const { error } = await supabase
    .from('automotive_integration_events')
    .insert({
      user_id: userId,
      deal_id: dealId,
      direction,
      source_system: sourceSystem,
      status: stringOrNull(body.status) || 'recorded',
      payload_raw: body.payloadRaw && typeof body.payloadRaw === 'object' ? body.payloadRaw : {},
      payload_mapped: body.payloadMapped && typeof body.payloadMapped === 'object' ? body.payloadMapped : {},
      error_message: stringOrNull(body.errorMessage),
      retry_count: toNumber(body.retryCount),
    });

  if (error) {
    return fail('Failed to log integration event.', 'ERR_DB', 500);
  }

  if (dealId) {
    await createTimelineEvent(userId, dealId, 'integration_event_logged', { direction, sourceSystem });
  }

  return ok(await loadDashboard(userId));
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);

  try {
    if (event.httpMethod === 'GET') {
      return ok(await loadDashboard(user.id));
    }

    if (event.httpMethod !== 'POST') {
      return fail('Method not allowed', 'ERR_METHOD', 405);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return fail('Invalid JSON body', 'ERR_VALIDATION', 400);
    }

    if (body.action === 'create_deal') {
      return createDeal(user.id, body);
    }

    if (body.action === 'set_deal_status') {
      return setDealStatus(user.id, body);
    }

    if (body.action === 'upsert_structure') {
      return upsertStructure(user.id, body);
    }

    if (body.action === 'upsert_product') {
      return upsertProduct(user.id, body);
    }

    if (body.action === 'add_review_flag') {
      return addReviewFlag(user.id, body);
    }

    if (body.action === 'upsert_presentation') {
      return upsertPresentation(user.id, body);
    }

    if (body.action === 'capture_acknowledgment') {
      return captureAcknowledgment(user.id, body, event);
    }

    if (body.action === 'log_integration_event') {
      return logIntegrationEvent(user.id, body);
    }

    return fail('Unknown action.', 'ERR_VALIDATION', 400);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : 'Automotive finance request failed.',
      'ERR_AUTOMOTIVE_FINANCE',
      500,
    );
  }
}
