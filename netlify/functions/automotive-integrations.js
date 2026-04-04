import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import { validatePayloadSize } from '../../lib/_security.js';
import { createHash } from 'node:crypto';
import {
  normalizeInboundPayload,
  detectDuplicate,
  generateOutboundPayload,
  validateOutboundPayload,
  getRetryConfig,
  buildIntegrationEventLog,
} from '../../lib/automotive/integration-framework.js';

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
function toBool(v) { return v === true || v === 'true'; }
function toObject(v, fallback = {}) { return v && typeof v === 'object' && !Array.isArray(v) ? v : fallback; }

function hashSecret(secret) {
  const raw = toStr(secret);
  if (!raw) return null;
  return createHash('sha256').update(raw).digest('hex');
}

// ── Integration Sources ────────────────────────────────────────────────────
async function upsertSource(userId, body) {
  const sourceId = toStr(body.id);
  const sourceType = toStr(body.sourceType);
  if (!sourceType) return fail('sourceType is required.', 'ERR_VALIDATION', 400);

  const payload = {
    user_id: userId,
    source_type: sourceType,
    source_name: toStr(body.sourceName) || sourceType,
    webhook_secret_hash: hashSecret(body.webhookSecret),
    field_map: toObject(body.fieldMap),
    normalization_rules: {
      ...toObject(body.normalizationRules),
      auto_create_deal: toBool(body.autoCreateDeal),
    },
    duplicate_check_fields: Array.isArray(body.dedupFields) ? body.dedupFields : ['customer_last_name', 'vin'],
    is_active: body.isActive !== false,
    notes: toStr(body.notes),
  };

  let result;
  if (sourceId) {
    result = await supabase
      .from('automotive_integration_sources')
      .update(payload)
      .eq('id', sourceId)
      .eq('user_id', userId)
      .select('id')
      .single();
  } else {
    result = await supabase
      .from('automotive_integration_sources')
      .insert(payload)
      .select('id')
      .single();
  }

  if (result.error) return fail('Failed to save integration source.', 'ERR_DB', 500);
  return ok({ sourceId: result.data?.id });
}

async function listSources(userId) {
  const { data, error } = await supabase
    .from('automotive_integration_sources')
    .select('id, source_type, source_name, is_active, created_at')
    .eq('user_id', userId)
    .order('source_name');
  if (error) return fail('Failed to fetch sources.', 'ERR_DB', 500);
  return ok({ sources: data });
}

// ── Integration Destinations ───────────────────────────────────────────────
async function upsertDestination(userId, body) {
  const destId = toStr(body.id);
  const destinationType = toStr(body.destinationType);
  if (!destinationType) return fail('destinationType is required.', 'ERR_VALIDATION', 400);

  const payload = {
    user_id: userId,
    destination_type: destinationType,
    destination_name: toStr(body.destinationName) || destinationType,
    endpoint_url: toStr(body.endpointUrl),
    auth_type: toStr(body.authType) || 'none',
    auth_config: {
      ...toObject(body.authConfig),
      ...(toStr(body.authHeaderName) && toStr(body.authHeaderValue)
        ? { headerName: toStr(body.authHeaderName), headerValue: toStr(body.authHeaderValue) }
        : {}),
    },
    field_map: toObject(body.fieldMap),
    transform_rules: toObject(body.transformRules),
    requires_approval: body.requiresApproval !== false,
    retry_config: toObject(body.retryConfig, { max_retries: 3, backoff_seconds: 30 }),
    is_active: body.isActive !== false,
    notes: toStr(body.notes),
  };

  let result;
  if (destId) {
    result = await supabase
      .from('automotive_integration_destinations')
      .update(payload)
      .eq('id', destId)
      .eq('user_id', userId)
      .select('id')
      .single();
  } else {
    result = await supabase
      .from('automotive_integration_destinations')
      .insert(payload)
      .select('id')
      .single();
  }

  if (result.error) return fail('Failed to save integration destination.', 'ERR_DB', 500);
  return ok({ destinationId: result.data?.id });
}

async function listDestinations(userId) {
  const { data, error } = await supabase
    .from('automotive_integration_destinations')
    .select('id, destination_type, destination_name, endpoint_url, auth_type, requires_approval, is_active, created_at')
    .eq('user_id', userId)
    .order('destination_name');
  if (error) return fail('Failed to fetch destinations.', 'ERR_DB', 500);
  return ok({ destinations: data });
}

// ── Preview outbound payload (no send) ────────────────────────────────────
async function previewOutbound(userId, body) {
  const dealId = toStr(body.dealId);
  const destinationType = toStr(body.destinationType);
  if (!dealId || !destinationType) return fail('dealId and destinationType are required.', 'ERR_VALIDATION', 400);

  const { data: deal } = await supabase
    .from('automotive_deals')
    .select(`
      id, status, deal_type, deal_name,
      automotive_applicants(first_name, last_name, ssn_last_four, date_of_birth),
      automotive_vehicles(vin, year, make, model, mileage, msrp),
      automotive_deal_structures(amount_financed, apr_percent, term_months, selling_price, cash_down)
    `)
    .eq('id', dealId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!deal) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  // Load destination custom field map if any
  const { data: dest } = await supabase
    .from('automotive_integration_destinations')
    .select('field_map')
    .eq('user_id', userId)
    .eq('destination_type', destinationType)
    .maybeSingle();

  const customMap = dest?.field_map || {};
  const { payload, mappedFields, unmappedInternalKeys } = generateOutboundPayload(deal, destinationType, customMap);
  const validation = validateOutboundPayload(payload, destinationType);

  return ok({ payload, mappedFields, unmappedInternalKeys, validation, destinationType });
}

// ── Send to destination ────────────────────────────────────────────────────
async function sendOutbound(userId, body) {
  const dealId = toStr(body.dealId);
  const destinationId = toStr(body.destinationId);
  if (!dealId || !destinationId) return fail('dealId and destinationId are required.', 'ERR_VALIDATION', 400);

  // Load destination config
  const { data: dest } = await supabase
    .from('automotive_integration_destinations')
    .select('*')
    .eq('id', destinationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!dest) return fail('Destination not found.', 'ERR_NOT_FOUND', 404);
  if (!dest.endpoint_url) return fail('Destination has no endpoint URL configured.', 'ERR_CONFIG', 422);

  // Load deal
  const { data: deal } = await supabase
    .from('automotive_deals')
    .select(`
      id, status, deal_type, deal_name,
      automotive_applicants(first_name, last_name, ssn_last_four, date_of_birth),
      automotive_vehicles(vin, year, make, model, mileage, msrp),
      automotive_deal_structures(amount_financed, apr_percent, term_months, selling_price, cash_down)
    `)
    .eq('id', dealId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!deal) return fail('Deal not found.', 'ERR_NOT_FOUND', 404);

  const { payload, mappedFields } = generateOutboundPayload(deal, dest.destination_type, dest.field_map || {});
  const validation = validateOutboundPayload(payload, dest.destination_type);

  if (!validation.isValid) {
    return fail(`Payload validation failed: ${validation.errors.join(', ')}`, 'ERR_VALIDATION', 422);
  }

  // Build request headers — avoid forwarding any secrets blindly
  const headers = { 'Content-Type': 'application/json' };
  if (dest.auth_type === 'bearer' && dest.auth_config?.token) {
    headers.Authorization = `Bearer ${dest.auth_config.token}`;
  }
  if (dest.auth_type === 'api_key' && dest.auth_config?.headerName && dest.auth_config?.headerValue) {
    headers[dest.auth_config.headerName] = dest.auth_config.headerValue;
  }
  if (dest.auth_type === 'basic' && dest.auth_config?.username && dest.auth_config?.password) {
    const encoded = Buffer.from(`${dest.auth_config.username}:${dest.auth_config.password}`).toString('base64');
    headers.Authorization = `Basic ${encoded}`;
  }

  const startedAt = Date.now();
  let responseStatusCode = 0;
  let responseBody = '';
  let sendError = null;

  try {
    const response = await fetch(dest.endpoint_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    responseStatusCode = response.status;
    responseBody = await response.text().catch(() => '');
  } catch (err) {
    sendError = err?.message || String(err);
  }

  const durationMs = Date.now() - startedAt;
  const succeeded = !sendError && responseStatusCode >= 200 && responseStatusCode < 300;

  // Log the integration event
  const logEntry = buildIntegrationEventLog({
    userId,
    dealId,
    direction: 'outbound',
    sourceOrDestination: dest.destination_type,
    status: succeeded ? 'sent' : 'failed',
    rawPayload: payload,
    mappedPayload: {
      mappedFields,
      responseStatusCode,
      responseBody: responseBody.slice(0, 2000),
      durationMs,
    },
    errorMessage: sendError,
  });

  await supabase.from('automotive_integration_events').insert(logEntry);

  if (!succeeded) {
    const retryConfig = getRetryConfig(dest.destination_type);
    return fail(
      `Outbound send failed (HTTP ${responseStatusCode}). ${sendError || responseBody.slice(0, 200)}`,
      'ERR_OUTBOUND',
      502,
      { retryConfig, responseStatusCode }
    );
  }

  return ok({ sent: true, responseStatusCode, destinationType: dest.destination_type, durationMs });
}

// ── Inbound webhook ────────────────────────────────────────────────────────
async function ingestInbound(userId, body) {
  const sourceId = toStr(body.sourceId);
  const rawPayload = body.rawPayload;
  if (!sourceId || !rawPayload) return fail('sourceId and rawPayload are required.', 'ERR_VALIDATION', 400);

  // Load source config
  const { data: source } = await supabase
    .from('automotive_integration_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!source) return fail('Integration source not found.', 'ERR_NOT_FOUND', 404);
  if (!source.is_active) return fail('Integration source is inactive.', 'ERR_CONFIG', 422);

  const { normalized, unmappedFields } = normalizeInboundPayload(rawPayload, source.source_type, source.field_map || {});

  // Dedup check
  const { data: existingDeals } = await supabase
    .from('automotive_deals')
    .select('id, deal_name, status, automotive_vehicles(vin), automotive_applicants(last_name)')
    .eq('user_id', userId)
    .not('status', 'eq', 'archived');

  const dedupComparableDeals = (existingDeals || []).map((deal) => ({
    id: deal.id,
    deal_name: deal.deal_name,
    status: deal.status,
    vin: deal.automotive_vehicles?.[0]?.vin || null,
    vehicle_vin: deal.automotive_vehicles?.[0]?.vin || null,
    customer_last_name: deal.automotive_applicants?.[0]?.last_name || null,
    applicant_last_name: deal.automotive_applicants?.[0]?.last_name || null,
  }));

  const { isDuplicate, matchedDealId, matchScore } = detectDuplicate(
    normalized,
    dedupComparableDeals,
    source.duplicate_check_fields || ['customer_last_name', 'vin'],
  );

  // Log the inbound event
  const logEntry = buildIntegrationEventLog({
    userId,
    dealId: isDuplicate ? matchedDealId : null,
    direction: 'inbound',
    sourceOrDestination: source.source_type,
    status: isDuplicate ? 'needs_review' : 'mapped',
    rawPayload,
    mappedPayload: normalized,
  });

  await supabase.from('automotive_integration_events').insert(logEntry);

  if (isDuplicate) {
    return ok({
      ingested: false,
      reason: 'duplicate',
      matchedDealId,
      matchScore,
      normalized,
    });
  }

  // Create deal if source is configured to do so
  const shouldAutoCreateDeal = Boolean(source.normalization_rules?.auto_create_deal === true);
  let createdDealId = null;
  if (shouldAutoCreateDeal) {
    const { data: newDeal } = await supabase
      .from('automotive_deals')
      .insert({
        user_id: userId,
        status: 'lead_received',
        deal_type: normalized.deal_type || 'retail',
        deal_name: [normalized.applicant_first_name, normalized.applicant_last_name].filter(Boolean).join(' ') || 'Inbound Lead',
        source_channel: source.source_type,
        lead_source: source.source_type,
        store_reference: normalized.dealer_reference || null,
        notes: `Auto-created from ${source.source_name} integration.`,
      })
      .select('id')
      .single();

    createdDealId = newDeal?.id || null;

    // Update the integration event with the new deal ID
    if (createdDealId) {
      await supabase
        .from('automotive_integration_events')
        .update({ deal_id: createdDealId })
        .eq('user_id', userId)
        .is('deal_id', null)
        .eq('event_type', 'lead_received')
        .order('created_at', { ascending: false })
        .limit(1);
    }
  }

  return ok({
    ingested: true,
    autoCreatedDeal: shouldAutoCreateDeal,
    createdDealId,
    normalized,
    unmappedFields,
  });
}

// ── Integration event log ──────────────────────────────────────────────────
async function getIntegrationEvents(userId, body) {
  const dealId = toStr(body.dealId);
  const limit = Math.min(parseInt(body.limit, 10) || 50, 200);

  let query = supabase
    .from('automotive_integration_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (dealId) query = query.eq('deal_id', dealId);

  const { data, error } = await query;
  if (error) return fail('Failed to fetch events.', 'ERR_DB', 500);
  return ok({ events: data });
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
    if (params.resource === 'sources') return listSources(userId);
    if (params.resource === 'destinations') return listDestinations(userId);
    return fail('Unknown resource.', 'ERR_QUERY', 400);
  }

  if (event.httpMethod !== 'POST') return fail('Method not allowed', 'ERR_METHOD', 405);

  const sizeCheck = validatePayloadSize(event.body);
  if (!sizeCheck.valid) return fail(sizeCheck.error, 'ERR_PAYLOAD_SIZE', 413);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return fail('Invalid JSON body', 'ERR_PARSE', 400);
  }

  const action = body.action;
  switch (action) {
    case 'upsert_source':       return upsertSource(userId, body);
    case 'list_sources':        return listSources(userId);
    case 'upsert_destination':  return upsertDestination(userId, body);
    case 'list_destinations':   return listDestinations(userId);
    case 'preview_outbound':    return previewOutbound(userId, body);
    case 'send_outbound':       return sendOutbound(userId, body);
    case 'ingest_inbound':      return ingestInbound(userId, body);
    case 'get_events':          return getIntegrationEvents(userId, body);
    default:
      return fail(`Unknown action: ${action}`, 'ERR_ACTION', 400);
  }
}
