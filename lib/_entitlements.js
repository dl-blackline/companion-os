import { supabase } from './_supabase.js';
import { isSuperAdmin } from './_super-admin.js';

const FEATURE_QUOTAS = Object.freeze({
  media_generation: {
    free: 10,
    pro: 250,
    enterprise: null,
    admin_override: null,
  },
  agent_task: {
    free: 3,
    pro: 100,
    enterprise: null,
    admin_override: null,
  },
});

export function getCurrentUsageWindowStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getUserEntitlement(userId, email) {
  // Super-admin bypass: always return highest entitlement
  if (isSuperAdmin(email)) {
    return { plan: 'admin_override', status: 'active' };
  }

  if (!userId) {
    return { plan: 'free', status: 'none' };
  }

  const { data } = await supabase
    .from('user_entitlements')
    .select('plan, status')
    .eq('user_id', userId)
    .single();

  return {
    plan: data?.plan || 'free',
    status: data?.status || 'none',
  };
}

export function getQuotaLimit(plan, featureKey) {
  const featureConfig = FEATURE_QUOTAS[featureKey];
  if (!featureConfig) return null;
  return featureConfig[plan] ?? null;
}

export async function getFeatureUsage(userId, featureKey, since = getCurrentUsageWindowStart()) {
  const { count } = await supabase
    .from('feature_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature_key', featureKey)
    .gte('created_at', since);

  return count || 0;
}

export async function getUsageSummary(userId, email) {
  const entitlement = await getUserEntitlement(userId, email);
  const since = getCurrentUsageWindowStart();
  const features = {};

  for (const featureKey of Object.keys(FEATURE_QUOTAS)) {
    const limit = getQuotaLimit(entitlement.plan, featureKey);
    const used = await getFeatureUsage(userId, featureKey, since);
    features[featureKey] = {
      used,
      limit,
      remaining: limit === null ? null : Math.max(limit - used, 0),
      windowStart: since,
    };
  }

  return {
    ...entitlement,
    features,
  };
}

export async function ensureFeatureWithinQuota(userId, featureKey, email) {
  const summary = await getUsageSummary(userId, email);
  const feature = summary.features[featureKey];

  if (!feature) {
    return { allowed: true, ...summary, feature: null };
  }

  if (feature.limit === null) {
    return { allowed: true, ...summary, feature };
  }

  const allowed = feature.used < feature.limit;
  return {
    allowed,
    ...summary,
    feature,
    message: allowed
      ? null
      : `Monthly ${featureKey.replace('_', ' ')} limit reached for the ${summary.plan} plan. Upgrade to continue.`,
  };
}

export async function recordFeatureUsage(userId, featureKey, metadata = {}) {
  await supabase.from('feature_usage_events').insert({
    user_id: userId,
    feature_key: featureKey,
    metadata,
  });
}
