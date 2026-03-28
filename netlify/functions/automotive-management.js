import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import {
  getPermissionsForRole,
  hasPermission,
  requirePermission,
  PERMISSIONS,
  summarizeManagerPerformance,
  detectStuckDeals,
  buildAgingBuckets,
} from '../../lib/automotive/management-governance.js';

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

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function logAudit({ ownerUserId, actorUserId, storeId = null, dealId = null, area, action, entityType, entityId = null, beforePayload = {}, afterPayload = {}, metadata = {} }) {
  await supabase.from('automotive_audit_events').insert({
    owner_user_id: ownerUserId,
    actor_user_id: actorUserId,
    store_id: storeId,
    deal_id: dealId,
    area,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_payload: beforePayload,
    after_payload: afterPayload,
    metadata,
  });
}

async function resolveTenantContext(actorUserId) {
  const [profileRes, membershipRes] = await Promise.all([
    supabase
      .from('automotive_user_profiles')
      .select('*')
      .eq('user_id', actorUserId)
      .eq('is_active', true)
      .limit(1),
    supabase
      .from('automotive_user_store_memberships')
      .select('*')
      .eq('user_id', actorUserId)
      .eq('is_active', true),
  ]);

  const profile = (profileRes.data || [])[0] || null;
  const memberships = membershipRes.data || [];

  const ownerUserId = profile?.owner_user_id || memberships[0]?.owner_user_id || actorUserId;
  const globalRole = profile?.global_role || 'finance_manager';

  return {
    ownerUserId,
    globalRole,
    profile,
    memberships,
    activeStoreIds: memberships.map((m) => m.store_id),
  };
}

function roleForStore(context, storeId) {
  const scoped = context.memberships.find((m) => m.store_id === storeId);
  return scoped?.role_at_store || context.globalRole;
}

function ensurePermission(context, permission, storeId = null, description = permission) {
  const role = storeId ? roleForStore(context, storeId) : context.globalRole;
  requirePermission(role, permission, description);
}

async function bootstrapManagement(actor) {
  const context = await resolveTenantContext(actor.id);

  // Already bootstrapped
  const { data: existingStores } = await supabase
    .from('automotive_stores')
    .select('id')
    .eq('owner_user_id', context.ownerUserId)
    .limit(1);

  if ((existingStores || []).length > 0) {
    return ok({ bootstrapped: false, reason: 'already_initialized', ownerUserId: context.ownerUserId });
  }

  const { data: group, error: groupError } = await supabase
    .from('automotive_groups')
    .insert({
      owner_user_id: context.ownerUserId,
      group_name: 'Primary Dealer Group',
      group_code: 'PRIMARY',
    })
    .select('*')
    .single();

  if (groupError || !group) return fail('Failed to create group.', 'ERR_DB', 500);

  const { data: store, error: storeError } = await supabase
    .from('automotive_stores')
    .insert({
      owner_user_id: context.ownerUserId,
      group_id: group.id,
      store_name: 'Main Store',
      store_code: 'STORE-1',
    })
    .select('*')
    .single();

  if (storeError || !store) return fail('Failed to create store.', 'ERR_DB', 500);

  await supabase.from('automotive_user_profiles').upsert({
    owner_user_id: context.ownerUserId,
    user_id: actor.id,
    display_name: actor.user_metadata?.full_name || actor.email || 'Owner',
    email: actor.email || null,
    global_role: 'owner_executive',
    default_store_id: store.id,
    can_access_sensitive_data: true,
    is_active: true,
  }, { onConflict: 'owner_user_id,user_id' });

  await supabase.from('automotive_user_store_memberships').upsert({
    owner_user_id: context.ownerUserId,
    user_id: actor.id,
    store_id: store.id,
    role_at_store: 'owner_executive',
    can_manage_users: true,
    can_manage_integrations: true,
    can_view_commissions: true,
    can_override_income: true,
    can_override_structure: true,
    is_active: true,
  }, { onConflict: 'owner_user_id,user_id,store_id' });

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId: store.id,
    area: 'management',
    action: 'bootstrap_management',
    entityType: 'tenant',
    entityId: group.id,
    afterPayload: { groupId: group.id, storeId: store.id },
  });

  return ok({ bootstrapped: true, group, store, ownerUserId: context.ownerUserId });
}

async function getAccessProfile(actor) {
  const context = await resolveTenantContext(actor.id);

  const [storesRes, profilesRes, permissionsRes] = await Promise.all([
    supabase
      .from('automotive_stores')
      .select('*')
      .eq('owner_user_id', context.ownerUserId)
      .eq('is_active', true)
      .order('store_name'),
    supabase
      .from('automotive_user_profiles')
      .select('*')
      .eq('owner_user_id', context.ownerUserId)
      .eq('is_active', true)
      .order('display_name'),
    supabase
      .from('automotive_permission_definitions')
      .select('key,label,category,description')
      .order('category'),
  ]);

  const stores = storesRes.data || [];
  const profiles = profilesRes.data || [];

  const scopedPermissions = {};
  for (const storeId of context.activeStoreIds) {
    const role = roleForStore(context, storeId);
    scopedPermissions[storeId] = getPermissionsForRole(role);
  }

  return ok({
    ownerUserId: context.ownerUserId,
    actor: {
      userId: actor.id,
      globalRole: context.globalRole,
      permissions: getPermissionsForRole(context.globalRole),
      activeStoreIds: context.activeStoreIds,
      scopedPermissions,
    },
    stores,
    userProfiles: profiles,
    permissionCatalog: permissionsRes.data || [],
  });
}

async function upsertStore(actor, body) {
  const context = await resolveTenantContext(actor.id);
  ensurePermission(context, PERMISSIONS.USERS_MANAGE, null, 'manage stores');

  const storeId = toStr(body.id);
  const payload = {
    owner_user_id: context.ownerUserId,
    group_id: toStr(body.groupId),
    store_name: toStr(body.storeName),
    store_code: toStr(body.storeCode),
    timezone: toStr(body.timezone) || 'America/Chicago',
    address: body.address && typeof body.address === 'object' ? body.address : {},
    is_active: toBool(body.isActive, true),
  };

  if (!payload.store_name) return fail('storeName is required.', 'ERR_VALIDATION', 400);

  let result;
  if (storeId) {
    result = await supabase
      .from('automotive_stores')
      .update(payload)
      .eq('id', storeId)
      .eq('owner_user_id', context.ownerUserId)
      .select('*')
      .single();
  } else {
    result = await supabase
      .from('automotive_stores')
      .insert(payload)
      .select('*')
      .single();
  }

  if (result.error || !result.data) return fail('Failed to save store.', 'ERR_DB', 500);

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId: result.data.id,
    area: 'management',
    action: storeId ? 'store_updated' : 'store_created',
    entityType: 'store',
    entityId: result.data.id,
    afterPayload: result.data,
  });

  return ok({ store: result.data });
}

async function upsertUserProfile(actor, body) {
  const context = await resolveTenantContext(actor.id);
  ensurePermission(context, PERMISSIONS.USERS_MANAGE, null, 'manage user profiles');

  const userId = toStr(body.userId);
  if (!userId) return fail('userId is required.', 'ERR_VALIDATION', 400);

  const payload = {
    owner_user_id: context.ownerUserId,
    user_id: userId,
    display_name: toStr(body.displayName),
    email: toStr(body.email),
    global_role: toStr(body.globalRole) || 'finance_manager',
    default_store_id: toStr(body.defaultStoreId),
    can_access_sensitive_data: toBool(body.canAccessSensitiveData, false),
    is_active: toBool(body.isActive, true),
  };

  const { data, error } = await supabase
    .from('automotive_user_profiles')
    .upsert(payload, { onConflict: 'owner_user_id,user_id' })
    .select('*')
    .single();

  if (error || !data) return fail('Failed to save user profile.', 'ERR_DB', 500);

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId: payload.default_store_id,
    area: 'management',
    action: 'user_profile_upserted',
    entityType: 'user_profile',
    entityId: data.id,
    afterPayload: data,
  });

  return ok({ userProfile: data });
}

async function assignUserStore(actor, body) {
  const context = await resolveTenantContext(actor.id);
  ensurePermission(context, PERMISSIONS.USERS_MANAGE, null, 'assign users to stores');

  const userId = toStr(body.userId);
  const storeId = toStr(body.storeId);
  if (!userId || !storeId) return fail('userId and storeId are required.', 'ERR_VALIDATION', 400);

  const roleAtStore = toStr(body.roleAtStore) || 'finance_manager';
  const payload = {
    owner_user_id: context.ownerUserId,
    user_id: userId,
    store_id: storeId,
    role_at_store: roleAtStore,
    can_manage_users: toBool(body.canManageUsers, false),
    can_manage_integrations: toBool(body.canManageIntegrations, false),
    can_view_commissions: toBool(body.canViewCommissions, false),
    can_override_income: toBool(body.canOverrideIncome, false),
    can_override_structure: toBool(body.canOverrideStructure, false),
    is_active: toBool(body.isActive, true),
  };

  const { data, error } = await supabase
    .from('automotive_user_store_memberships')
    .upsert(payload, { onConflict: 'owner_user_id,user_id,store_id' })
    .select('*')
    .single();

  if (error || !data) return fail('Failed to assign store membership.', 'ERR_DB', 500);

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId,
    area: 'management',
    action: 'user_store_assigned',
    entityType: 'membership',
    entityId: data.id,
    afterPayload: data,
  });

  return ok({ membership: data });
}

async function createApprovalRequest(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const storeId = toStr(body.storeId);
  ensurePermission(context, PERMISSIONS.DEAL_EDIT, storeId, 'create approval request');

  const payload = {
    owner_user_id: context.ownerUserId,
    store_id: storeId,
    deal_id: toStr(body.dealId),
    request_type: toStr(body.requestType),
    status: 'pending',
    priority: toStr(body.priority) || 'normal',
    requested_by_user_id: actor.id,
    assigned_reviewer_id: toStr(body.assignedReviewerId),
    requested_note: toStr(body.requestedNote),
    due_at: toStr(body.dueAt),
    payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
  };

  if (!payload.request_type) return fail('requestType is required.', 'ERR_VALIDATION', 400);

  const { data, error } = await supabase
    .from('automotive_approval_requests')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) return fail('Failed to create approval request.', 'ERR_DB', 500);

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId,
    dealId: payload.deal_id,
    area: 'approval',
    action: 'approval_request_created',
    entityType: 'approval_request',
    entityId: data.id,
    afterPayload: data,
  });

  return ok({ approvalRequest: data });
}

async function decideApprovalRequest(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const approvalRequestId = toStr(body.approvalRequestId);
  const decision = toStr(body.decision);
  if (!approvalRequestId || !decision) {
    return fail('approvalRequestId and decision are required.', 'ERR_VALIDATION', 400);
  }

  const { data: request } = await supabase
    .from('automotive_approval_requests')
    .select('*')
    .eq('id', approvalRequestId)
    .eq('owner_user_id', context.ownerUserId)
    .maybeSingle();

  if (!request) return fail('Approval request not found.', 'ERR_NOT_FOUND', 404);

  ensurePermission(context, PERMISSIONS.STRUCTURE_OVERRIDE, request.store_id, 'decide approval requests');

  const nextStatus = decision === 'approve'
    ? 'approved'
    : decision === 'reject'
      ? 'rejected'
      : decision === 'revise_required'
        ? 'revise_required'
        : request.status;

  const { data: updated, error } = await supabase
    .from('automotive_approval_requests')
    .update({
      status: nextStatus,
      decided_by_user_id: actor.id,
      decision_note: toStr(body.note),
      decision_at: new Date().toISOString(),
    })
    .eq('id', approvalRequestId)
    .eq('owner_user_id', context.ownerUserId)
    .select('*')
    .single();

  if (error || !updated) return fail('Failed to update approval request.', 'ERR_DB', 500);

  await supabase.from('automotive_approval_decisions').insert({
    owner_user_id: context.ownerUserId,
    approval_request_id: approvalRequestId,
    action: decision,
    actor_user_id: actor.id,
    note: toStr(body.note),
    payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
  });

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId: updated.store_id,
    dealId: updated.deal_id,
    area: 'approval',
    action: `approval_${decision}`,
    entityType: 'approval_request',
    entityId: updated.id,
    beforePayload: request,
    afterPayload: updated,
  });

  return ok({ approvalRequest: updated });
}

async function listApprovals(actor, body) {
  const context = await resolveTenantContext(actor.id);

  const requestedStoreId = toStr(body.storeId);
  const storeId = requestedStoreId && context.activeStoreIds.includes(requestedStoreId)
    ? requestedStoreId
    : null;

  const role = storeId ? roleForStore(context, storeId) : context.globalRole;
  if (!hasPermission(role, PERMISSIONS.REPORTING_STORE) && !hasPermission(role, PERMISSIONS.STRUCTURE_OVERRIDE)) {
    return fail('Insufficient permissions to list approvals.', 'ERR_PERMISSION', 403);
  }

  let query = supabase
    .from('automotive_approval_requests')
    .select('*')
    .eq('owner_user_id', context.ownerUserId)
    .order('created_at', { ascending: false })
    .limit(Math.min(toNum(body.limit, 100), 500));

  if (storeId) query = query.eq('store_id', storeId);
  if (toStr(body.status)) query = query.eq('status', toStr(body.status));
  if (toStr(body.requestType)) query = query.eq('request_type', toStr(body.requestType));

  const { data, error } = await query;
  if (error) return fail('Failed to list approvals.', 'ERR_DB', 500);

  return ok({ approvals: data || [] });
}

async function upsertTemplateSet(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const storeId = toStr(body.storeId);
  ensurePermission(context, PERMISSIONS.TEMPLATES_MANAGE, storeId, 'manage template sets');

  const id = toStr(body.id);
  const payload = {
    owner_user_id: context.ownerUserId,
    group_id: toStr(body.groupId),
    store_id: storeId,
    set_name: toStr(body.setName),
    description: toStr(body.description),
    is_default: toBool(body.isDefault, false),
    is_active: toBool(body.isActive, true),
    created_by_user_id: actor.id,
  };

  if (!payload.set_name) return fail('setName is required.', 'ERR_VALIDATION', 400);

  let result;
  if (id) {
    result = await supabase
      .from('automotive_template_sets')
      .update(payload)
      .eq('id', id)
      .eq('owner_user_id', context.ownerUserId)
      .select('*')
      .single();
  } else {
    result = await supabase
      .from('automotive_template_sets')
      .insert(payload)
      .select('*')
      .single();
  }

  if (result.error || !result.data) return fail('Failed to save template set.', 'ERR_DB', 500);

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId,
    area: 'templates',
    action: id ? 'template_set_updated' : 'template_set_created',
    entityType: 'template_set',
    entityId: result.data.id,
    afterPayload: result.data,
  });

  return ok({ templateSet: result.data });
}

async function upsertTemplate(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const storeId = toStr(body.storeId);
  ensurePermission(context, PERMISSIONS.TEMPLATES_MANAGE, storeId, 'manage templates');

  const id = toStr(body.id);
  const payload = {
    owner_user_id: context.ownerUserId,
    set_id: toStr(body.setId),
    store_id: storeId,
    template_type: toStr(body.templateType),
    template_name: toStr(body.templateName),
    version_number: toNum(body.versionNumber, 1),
    status: toStr(body.status) || 'draft',
    applies_to_deal_types: Array.isArray(body.appliesToDealTypes) ? body.appliesToDealTypes : ['retail'],
    is_default: toBool(body.isDefault, false),
    payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
    created_by_user_id: actor.id,
  };

  if (!payload.set_id || !payload.template_type || !payload.template_name) {
    return fail('setId, templateType, and templateName are required.', 'ERR_VALIDATION', 400);
  }

  let result;
  if (id) {
    result = await supabase
      .from('automotive_templates')
      .update(payload)
      .eq('id', id)
      .eq('owner_user_id', context.ownerUserId)
      .select('*')
      .single();
  } else {
    result = await supabase
      .from('automotive_templates')
      .insert(payload)
      .select('*')
      .single();
  }

  if (result.error || !result.data) return fail('Failed to save template.', 'ERR_DB', 500);

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId,
    area: 'templates',
    action: id ? 'template_updated' : 'template_created',
    entityType: 'template',
    entityId: result.data.id,
    afterPayload: result.data,
  });

  return ok({ template: result.data });
}

async function listTemplates(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const requestedStoreId = toStr(body.storeId);
  const storeId = requestedStoreId && context.activeStoreIds.includes(requestedStoreId) ? requestedStoreId : null;
  ensurePermission(context, PERMISSIONS.REPORTING_STORE, storeId, 'view templates');

  let query = supabase
    .from('automotive_templates')
    .select('*')
    .eq('owner_user_id', context.ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(toNum(body.limit, 200), 500));

  if (storeId) query = query.eq('store_id', storeId);
  if (toStr(body.templateType)) query = query.eq('template_type', toStr(body.templateType));
  if (toStr(body.status)) query = query.eq('status', toStr(body.status));

  const { data, error } = await query;
  if (error) return fail('Failed to list templates.', 'ERR_DB', 500);

  return ok({ templates: data || [] });
}

async function upsertLenderPlaybook(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const storeId = toStr(body.storeId);
  ensurePermission(context, PERMISSIONS.GUIDELINES_MANAGE, storeId, 'manage lender playbooks');

  const id = toStr(body.id);
  const payload = {
    owner_user_id: context.ownerUserId,
    store_id: storeId,
    lender_id: toStr(body.lenderId),
    playbook_name: toStr(body.playbookName),
    version_number: toNum(body.versionNumber, 1),
    status: toStr(body.status) || 'draft',
    tendencies: body.tendencies && typeof body.tendencies === 'object' ? body.tendencies : {},
    callback_patterns: body.callbackPatterns && typeof body.callbackPatterns === 'object' ? body.callbackPatterns : {},
    preferred_deal_types: Array.isArray(body.preferredDealTypes) ? body.preferredDealTypes : ['retail'],
    pti_dti_guidance: body.ptiDtiGuidance && typeof body.ptiDtiGuidance === 'object' ? body.ptiDtiGuidance : {},
    stip_expectations: body.stipExpectations && typeof body.stipExpectations === 'object' ? body.stipExpectations : {},
    backend_tolerance_notes: toStr(body.backendToleranceNotes),
    common_pitfalls: Array.isArray(body.commonPitfalls) ? body.commonPitfalls : [],
    escalation_notes: toStr(body.escalationNotes),
    source_doc_refs: Array.isArray(body.sourceDocRefs) ? body.sourceDocRefs : [],
    internal_notes: body.internalNotes && typeof body.internalNotes === 'object' ? body.internalNotes : {},
    ai_inference_notes: body.aiInferenceNotes && typeof body.aiInferenceNotes === 'object' ? body.aiInferenceNotes : {},
    created_by_user_id: actor.id,
  };

  if (!payload.playbook_name || !payload.lender_id) {
    return fail('playbookName and lenderId are required.', 'ERR_VALIDATION', 400);
  }

  let result;
  if (id) {
    result = await supabase
      .from('automotive_lender_playbooks')
      .update(payload)
      .eq('id', id)
      .eq('owner_user_id', context.ownerUserId)
      .select('*')
      .single();
  } else {
    result = await supabase
      .from('automotive_lender_playbooks')
      .insert(payload)
      .select('*')
      .single();
  }

  if (result.error || !result.data) return fail('Failed to save lender playbook.', 'ERR_DB', 500);

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId,
    area: 'playbooks',
    action: id ? 'lender_playbook_updated' : 'lender_playbook_created',
    entityType: 'lender_playbook',
    entityId: result.data.id,
    afterPayload: result.data,
  });

  return ok({ lenderPlaybook: result.data });
}

async function listLenderPlaybooks(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const requestedStoreId = toStr(body.storeId);
  const storeId = requestedStoreId && context.activeStoreIds.includes(requestedStoreId) ? requestedStoreId : null;
  ensurePermission(context, PERMISSIONS.REPORTING_STORE, storeId, 'view lender playbooks');

  let query = supabase
    .from('automotive_lender_playbooks')
    .select('*')
    .eq('owner_user_id', context.ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(toNum(body.limit, 200), 500));

  if (storeId) query = query.eq('store_id', storeId);
  if (toStr(body.lenderId)) query = query.eq('lender_id', toStr(body.lenderId));
  if (toStr(body.status)) query = query.eq('status', toStr(body.status));

  const { data, error } = await query;
  if (error) return fail('Failed to list lender playbooks.', 'ERR_DB', 500);

  return ok({ lenderPlaybooks: data || [] });
}

async function getTeamDashboard(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const requestedStoreId = toStr(body.storeId);
  const storeId = requestedStoreId && context.activeStoreIds.includes(requestedStoreId) ? requestedStoreId : null;
  ensurePermission(context, PERMISSIONS.REPORTING_STORE, storeId, 'view team dashboard');

  let dealsQuery = supabase
    .from('automotive_deals')
    .select('id, deal_name, status, store_id, assigned_user_id, next_step_owner_user_id, created_at, updated_at')
    .eq('user_id', context.ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (storeId) dealsQuery = dealsQuery.eq('store_id', storeId);
  else if (context.activeStoreIds.length > 0) dealsQuery = dealsQuery.in('store_id', context.activeStoreIds);

  const [dealsRes, metricsRes, cancellationsRes, citRes, usersRes, approvalsRes, auditRes] = await Promise.all([
    dealsQuery,
    supabase.from('automotive_deal_metrics').select('deal_id, structure_pressure_score, approval_readiness_score, back_gross').eq('user_id', context.ownerUserId),
    supabase.from('automotive_cancellation_cases').select('id, deal_id, current_status, assigned_user_id').eq('user_id', context.ownerUserId),
    supabase.from('automotive_cit_cases').select('id, deal_id, current_status, assigned_to').eq('user_id', context.ownerUserId),
    supabase.from('automotive_user_profiles').select('user_id, display_name, email, global_role').eq('owner_user_id', context.ownerUserId).eq('is_active', true),
    supabase.from('automotive_approval_requests').select('id, status, request_type, created_at, due_at').eq('owner_user_id', context.ownerUserId),
    supabase.from('automotive_audit_events').select('id, action, area, actor_user_id, created_at').eq('owner_user_id', context.ownerUserId).order('created_at', { ascending: false }).limit(200),
  ]);

  const deals = dealsRes.data || [];
  const metrics = metricsRes.data || [];
  const cancellations = cancellationsRes.data || [];
  const citCases = citRes.data || [];
  const profiles = usersRes.data || [];
  const approvals = approvalsRes.data || [];
  const audits = auditRes.data || [];

  const managerPerformance = summarizeManagerPerformance({
    deals,
    metrics,
    cancellations,
    citCases,
    userProfiles: profiles,
  });

  const stuckDeals = detectStuckDeals(deals);
  const approvalAging = buildAgingBuckets(approvals.filter((a) => ['pending', 'in_review'].includes(a.status)));

  return ok({
    scope: storeId ? 'store' : 'multi_store',
    storeId,
    managerPerformance,
    stuckDeals,
    approvalAging,
    openApprovals: approvals.filter((a) => ['pending', 'in_review', 'revise_required'].includes(a.status)).length,
    recentAuditEvents: audits.slice(0, 30),
  });
}

async function getExecutiveDashboard(actor, body) {
  const context = await resolveTenantContext(actor.id);
  ensurePermission(context, PERMISSIONS.REPORTING_GROUP, null, 'view executive dashboard');

  const [storesRes, dealsRes, metricsRes, citRes, cancellationsRes, commissionRes] = await Promise.all([
    supabase.from('automotive_stores').select('id,store_name,group_id').eq('owner_user_id', context.ownerUserId).eq('is_active', true),
    supabase.from('automotive_deals').select('id,store_id,status,created_at').eq('user_id', context.ownerUserId),
    supabase.from('automotive_deal_metrics').select('deal_id,back_gross').eq('user_id', context.ownerUserId),
    supabase.from('automotive_cit_cases').select('store_id,current_status,days_open').eq('user_id', context.ownerUserId),
    supabase.from('automotive_cancellation_cases').select('store_id,current_status').eq('user_id', context.ownerUserId),
    supabase.from('automotive_commission_records').select('store_id,status,projected_amount,finalized_amount,chargeback_amount').eq('user_id', context.ownerUserId),
  ]);

  const stores = storesRes.data || [];
  const deals = dealsRes.data || [];
  const metrics = metricsRes.data || [];
  const citCases = citRes.data || [];
  const cancellations = cancellationsRes.data || [];
  const commissions = commissionRes.data || [];

  const metricByDeal = new Map(metrics.map((m) => [m.deal_id, m]));
  const storeSummary = stores.map((store) => {
    const storeDeals = deals.filter((d) => d.store_id === store.id);
    const funded = storeDeals.filter((d) => d.status === 'funded').length;
    const booked = storeDeals.filter((d) => d.status === 'booked').length;
    const cancelled = storeDeals.filter((d) => d.status === 'cancelled').length;

    const totalBackGross = storeDeals.reduce((sum, d) => sum + Number(metricByDeal.get(d.id)?.back_gross || 0), 0);
    const pvr = funded > 0 ? totalBackGross / funded : 0;

    const storeCit = citCases.filter((c) => c.store_id === store.id);
    const openCit = storeCit.filter((c) => !['resolved', 'unfunded', 'archived'].includes(c.current_status));
    const avgCitDays = openCit.length > 0
      ? openCit.reduce((s, c) => s + Number(c.days_open || 0), 0) / openCit.length
      : 0;

    const storeCancellations = cancellations.filter((c) => c.store_id === store.id);
    const storeCommissions = commissions.filter((c) => c.store_id === store.id);

    return {
      storeId: store.id,
      storeName: store.store_name,
      funded,
      booked,
      cancelled,
      pvr: Math.round(pvr * 100) / 100,
      openCit: openCit.length,
      avgCitDays: Math.round(avgCitDays * 100) / 100,
      cancellations: storeCancellations.length,
      projectedCommissions: Math.round(storeCommissions.reduce((s, c) => s + Number(c.projected_amount || 0), 0) * 100) / 100,
      finalizedCommissions: Math.round(storeCommissions.reduce((s, c) => s + Number(c.finalized_amount || 0), 0) * 100) / 100,
      chargebacks: Math.round(storeCommissions.reduce((s, c) => s + Number(c.chargeback_amount || 0), 0) * 100) / 100,
    };
  });

  return ok({
    scope: 'group',
    storeComparisons: storeSummary,
    totals: {
      stores: stores.length,
      deals: deals.length,
      funded: deals.filter((d) => d.status === 'funded').length,
      booked: deals.filter((d) => d.status === 'booked').length,
      cancelled: deals.filter((d) => d.status === 'cancelled').length,
    },
  });
}

async function searchAuditEvents(actor, body) {
  const context = await resolveTenantContext(actor.id);
  ensurePermission(context, PERMISSIONS.AUDIT_VIEW, toStr(body.storeId), 'view audit events');

  let query = supabase
    .from('automotive_audit_events')
    .select('*')
    .eq('owner_user_id', context.ownerUserId)
    .order('created_at', { ascending: false })
    .limit(Math.min(toNum(body.limit, 100), 500));

  if (toStr(body.storeId)) query = query.eq('store_id', toStr(body.storeId));
  if (toStr(body.dealId)) query = query.eq('deal_id', toStr(body.dealId));
  if (toStr(body.area)) query = query.eq('area', toStr(body.area));
  if (toStr(body.action)) query = query.eq('action', toStr(body.action));
  if (toStr(body.actorUserId)) query = query.eq('actor_user_id', toStr(body.actorUserId));

  const { data, error } = await query;
  if (error) return fail('Failed to search audit events.', 'ERR_DB', 500);

  return ok({ auditEvents: data || [] });
}

async function addCoachingNote(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const storeId = toStr(body.storeId);
  ensurePermission(context, PERMISSIONS.REPORTING_STORE, storeId, 'add coaching notes');

  const payload = {
    owner_user_id: context.ownerUserId,
    store_id: storeId,
    manager_user_id: actor.id,
    target_user_id: toStr(body.targetUserId),
    deal_id: toStr(body.dealId),
    note_type: toStr(body.noteType) || 'general',
    title: toStr(body.title),
    body: toStr(body.body),
    tags: Array.isArray(body.tags) ? body.tags : [],
    is_reference_case: toBool(body.isReferenceCase, false),
    reference_case_label: toStr(body.referenceCaseLabel),
  };

  if (!payload.title || !payload.body) return fail('title and body are required.', 'ERR_VALIDATION', 400);

  const { data, error } = await supabase
    .from('automotive_coaching_notes')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) return fail('Failed to save coaching note.', 'ERR_DB', 500);

  await logAudit({
    ownerUserId: context.ownerUserId,
    actorUserId: actor.id,
    storeId,
    dealId: payload.deal_id,
    area: 'coaching',
    action: 'coaching_note_created',
    entityType: 'coaching_note',
    entityId: data.id,
    afterPayload: data,
  });

  return ok({ coachingNote: data });
}

async function listCoachingNotes(actor, body) {
  const context = await resolveTenantContext(actor.id);
  const storeId = toStr(body.storeId);
  ensurePermission(context, PERMISSIONS.REPORTING_STORE, storeId, 'view coaching notes');

  let query = supabase
    .from('automotive_coaching_notes')
    .select('*')
    .eq('owner_user_id', context.ownerUserId)
    .order('created_at', { ascending: false })
    .limit(Math.min(toNum(body.limit, 100), 500));

  if (storeId) query = query.eq('store_id', storeId);
  if (toStr(body.targetUserId)) query = query.eq('target_user_id', toStr(body.targetUserId));
  if (toStr(body.noteType)) query = query.eq('note_type', toStr(body.noteType));

  const { data, error } = await query;
  if (error) return fail('Failed to load coaching notes.', 'ERR_DB', 500);

  return ok({ coachingNotes: data || [] });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const actor = await resolveActor(token);
  if (!actor) return fail('Unauthorized', 'ERR_AUTH', 401);

  if (event.httpMethod !== 'POST') {
    return fail('Method not allowed', 'ERR_METHOD', 405);
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return fail('Invalid JSON body', 'ERR_PARSE', 400);
  }

  try {
    switch (body.action) {
      case 'bootstrap_management':
        return bootstrapManagement(actor);
      case 'get_access_profile':
        return getAccessProfile(actor);
      case 'upsert_store':
        return upsertStore(actor, body);
      case 'upsert_user_profile':
        return upsertUserProfile(actor, body);
      case 'assign_user_store':
        return assignUserStore(actor, body);
      case 'create_approval_request':
        return createApprovalRequest(actor, body);
      case 'decide_approval_request':
        return decideApprovalRequest(actor, body);
      case 'list_approvals':
        return listApprovals(actor, body);
      case 'upsert_template_set':
        return upsertTemplateSet(actor, body);
      case 'upsert_template':
        return upsertTemplate(actor, body);
      case 'list_templates':
        return listTemplates(actor, body);
      case 'upsert_lender_playbook':
        return upsertLenderPlaybook(actor, body);
      case 'list_lender_playbooks':
        return listLenderPlaybooks(actor, body);
      case 'get_team_dashboard':
        return getTeamDashboard(actor, body);
      case 'get_executive_dashboard':
        return getExecutiveDashboard(actor, body);
      case 'search_audit_events':
        return searchAuditEvents(actor, body);
      case 'add_coaching_note':
        return addCoachingNote(actor, body);
      case 'list_coaching_notes':
        return listCoachingNotes(actor, body);
      default:
        return fail(`Unknown action: ${body.action || 'undefined'}`, 'ERR_ACTION', 400);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Management request failed.', 'ERR_MANAGEMENT', 500);
  }
}
