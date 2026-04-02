/**
 * lib/automotive/management-governance.js
 *
 * Phase 5 management-scale governance helpers.
 * Deterministic role/permission matrix + team KPI utilities.
 */

export const MANAGEMENT_ROLES = Object.freeze({
  finance_manager: 'finance_manager',
  senior_finance_manager: 'senior_finance_manager',
  finance_director: 'finance_director',
  desk_manager: 'desk_manager',
  general_sales_manager: 'general_sales_manager',
  store_admin: 'store_admin',
  group_admin: 'group_admin',
  owner_executive: 'owner_executive',
  read_only_analyst: 'read_only_analyst',
});

export const PERMISSIONS = Object.freeze({
  DEAL_CREATE: 'deal.create',
  DEAL_EDIT: 'deal.edit',
  DOCS_REVIEW: 'docs.review',
  INCOME_OVERRIDE: 'income.override',
  STRUCTURE_OVERRIDE: 'structure.override',
  CALLBACK_EDIT: 'callback.edit',
  MENU_EDIT: 'menu.edit',
  PRESENTATION_CUSTOMER: 'presentation.customer',
  CIT_MANAGE: 'cit.manage',
  ISSUES_MANAGE: 'issues.manage',
  GUIDELINES_MANAGE: 'guidelines.manage',
  PRODUCTS_MANAGE: 'products.manage',
  TEMPLATES_MANAGE: 'templates.manage',
  REPORTING_STORE: 'reporting.store',
  REPORTING_GROUP: 'reporting.group',
  COMMISSIONS_VIEW: 'commissions.view',
  INTEGRATIONS_MANAGE: 'integrations.manage',
  USERS_MANAGE: 'users.manage',
  AUDIT_VIEW: 'audit.view',
});

const ROLE_PERMISSION_MAP = Object.freeze({
  finance_manager: [
    PERMISSIONS.DEAL_CREATE,
    PERMISSIONS.DEAL_EDIT,
    PERMISSIONS.DOCS_REVIEW,
    PERMISSIONS.MENU_EDIT,
    PERMISSIONS.PRESENTATION_CUSTOMER,
    PERMISSIONS.CIT_MANAGE,
    PERMISSIONS.ISSUES_MANAGE,
    PERMISSIONS.REPORTING_STORE,
  ],
  senior_finance_manager: [
    PERMISSIONS.DEAL_CREATE,
    PERMISSIONS.DEAL_EDIT,
    PERMISSIONS.DOCS_REVIEW,
    PERMISSIONS.INCOME_OVERRIDE,
    PERMISSIONS.STRUCTURE_OVERRIDE,
    PERMISSIONS.CALLBACK_EDIT,
    PERMISSIONS.MENU_EDIT,
    PERMISSIONS.PRESENTATION_CUSTOMER,
    PERMISSIONS.CIT_MANAGE,
    PERMISSIONS.ISSUES_MANAGE,
    PERMISSIONS.REPORTING_STORE,
    PERMISSIONS.COMMISSIONS_VIEW,
  ],
  finance_director: Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.USERS_MANAGE),
  desk_manager: [
    PERMISSIONS.DEAL_CREATE,
    PERMISSIONS.DEAL_EDIT,
    PERMISSIONS.CALLBACK_EDIT,
    PERMISSIONS.REPORTING_STORE,
  ],
  general_sales_manager: [
    PERMISSIONS.DEAL_EDIT,
    PERMISSIONS.MENU_EDIT,
    PERMISSIONS.REPORTING_STORE,
    PERMISSIONS.COMMISSIONS_VIEW,
  ],
  store_admin: [
    ...Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.REPORTING_GROUP),
  ],
  group_admin: Object.values(PERMISSIONS),
  owner_executive: Object.values(PERMISSIONS),
  read_only_analyst: [
    PERMISSIONS.REPORTING_STORE,
    PERMISSIONS.REPORTING_GROUP,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.COMMISSIONS_VIEW,
  ],
});

export function normalizeRole(role) {
  const key = String(role || '').trim();
  return ROLE_PERMISSION_MAP[key] ? key : MANAGEMENT_ROLES.finance_manager;
}

export function getPermissionsForRole(role) {
  const normalized = normalizeRole(role);
  return [...(ROLE_PERMISSION_MAP[normalized] || [])];
}

export function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

export function requirePermission(role, permission, context = 'this action') {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role ${normalizeRole(role)} cannot perform ${context}. Missing permission: ${permission}`);
  }
}

export function buildAgingBuckets(items = [], dateField = 'created_at') {
  const now = Date.now();
  const result = {
    lt1d: 0,
    d1to2: 0,
    d3to5: 0,
    d6to10: 0,
    gt10: 0,
  };

  for (const row of items) {
    const raw = row?.[dateField];
    if (!raw) continue;
    const ts = new Date(raw).getTime();
    if (!Number.isFinite(ts)) continue;
    const ageDays = Math.floor((now - ts) / (1000 * 60 * 60 * 24));

    if (ageDays < 1) result.lt1d += 1;
    else if (ageDays <= 2) result.d1to2 += 1;
    else if (ageDays <= 5) result.d3to5 += 1;
    else if (ageDays <= 10) result.d6to10 += 1;
    else result.gt10 += 1;
  }

  return result;
}

export function summarizeManagerPerformance({
  deals = [],
  metrics = [],
  cancellations = [],
  citCases = [],
  userProfiles = [],
} = {}) {
  const profileByUser = new Map(userProfiles.map((u) => [u.user_id, u]));
  const metricByDeal = new Map(metrics.map((m) => [m.deal_id, m]));

  const managerMap = new Map();

  function ensure(userId) {
    if (!managerMap.has(userId)) {
      const profile = profileByUser.get(userId) || null;
      managerMap.set(userId, {
        userId,
        displayName: profile?.display_name || profile?.email || 'Unassigned',
        role: profile?.global_role || 'finance_manager',
        workingDeals: 0,
        fundedDeals: 0,
        bookedDeals: 0,
        docsOrCallbackBlocked: 0,
        openCit: 0,
        avgPressure: 0,
        avgReadiness: 0,
        pvr: 0,
        cancellations: 0,
      });
    }
    return managerMap.get(userId);
  }

  for (const deal of deals) {
    const managerId = deal.assigned_user_id || deal.next_step_owner_user_id || 'unassigned';
    const row = ensure(managerId);
    row.workingDeals += 1;

    if (deal.status === 'funded') row.fundedDeals += 1;
    if (deal.status === 'booked') row.bookedDeals += 1;
    if (['docs_pending', 'docs_under_review', 'callback_received', 'callback_interpreted'].includes(deal.status)) {
      row.docsOrCallbackBlocked += 1;
    }

    const dm = metricByDeal.get(deal.id);
    if (dm) {
      row.avgPressure += Number(dm.structure_pressure_score || 0);
      row.avgReadiness += Number(dm.approval_readiness_score || 0);
      row.pvr += Number(dm.back_gross || 0);
    }
  }

  for (const cancellation of cancellations) {
    const managerId = cancellation.assigned_user_id || 'unassigned';
    const row = ensure(managerId);
    row.cancellations += 1;
  }

  for (const cit of citCases) {
    if (['resolved', 'archived', 'unfunded'].includes(cit.status)) continue;
    const managerId = cit.assigned_to || 'unassigned';
    const row = ensure(managerId);
    row.openCit += 1;
  }

  const output = [];
  for (const row of managerMap.values()) {
    const denom = Math.max(1, row.workingDeals);
    output.push({
      ...row,
      avgPressure: Math.round((row.avgPressure / denom) * 100) / 100,
      avgReadiness: Math.round((row.avgReadiness / denom) * 100) / 100,
      pvr: Math.round((row.pvr / Math.max(1, row.fundedDeals)) * 100) / 100,
    });
  }

  output.sort((a, b) => b.workingDeals - a.workingDeals);
  return output;
}

export function detectStuckDeals(deals = []) {
  const now = Date.now();
  return deals
    .map((deal) => {
      const activityTs = new Date(deal.updated_at || deal.created_at).getTime();
      const ageDays = Number.isFinite(activityTs)
        ? Math.floor((now - activityTs) / (1000 * 60 * 60 * 24))
        : 0;

      let reason = null;
      if (['docs_pending', 'docs_under_review'].includes(deal.status) && ageDays >= 2) {
        reason = 'Document stage aging beyond 48 hours';
      } else if (['callback_received', 'callback_interpreted'].includes(deal.status) && ageDays >= 1) {
        reason = 'Callback unresolved for 24+ hours';
      } else if (deal.status === 'cit_hold' && ageDays >= 3) {
        reason = 'CIT hold unresolved for 72+ hours';
      }

      return reason ? { dealId: deal.id, dealName: deal.deal_name, status: deal.status, ageDays, reason } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.ageDays - a.ageDays);
}
