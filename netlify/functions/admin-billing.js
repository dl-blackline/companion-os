/**
 * admin-billing.js — Admin-only billing analytics endpoint.
 */
import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import { isSuperAdminUser } from '../../lib/_super-admin.js';

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

async function isAdmin(userId) {
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  return data?.role === 'admin';
}

async function isAdminOrSuperAdmin(user) {
  if (isSuperAdminUser(user)) return true;
  return isAdmin(user.id);
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return fail('Method not allowed', 'ERR_METHOD', 405);

  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace('Bearer ', '');

  const actor = await resolveActor(token);
  if (!actor) return fail('Unauthorized', 'ERR_AUTH', 401);

  const actorIsAdmin = await isAdminOrSuperAdmin(actor);
  if (!actorIsAdmin) return fail('Admin access required', 'ERR_FORBIDDEN', 403);

  try {
    const [{ data: entitlements }, { data: subscriptions }] = await Promise.all([
      supabase
        .from('user_entitlements')
        .select('user_id,plan,status,updated_at')
        .order('updated_at', { ascending: false }),
      supabase
        .from('billing_subscriptions')
        .select('user_id,stripe_subscription_id,stripe_price_id,status,current_period_end,cancel_at_period_end,updated_at')
        .order('updated_at', { ascending: false })
        .limit(50),
    ]);

    const planCounts = {
      free: 0,
      pro: 0,
      enterprise: 0,
      admin_override: 0,
    };

    for (const row of entitlements || []) {
      if (row.plan in planCounts) {
        planCounts[row.plan] += 1;
      }
    }

    const paidActive = (entitlements || []).filter(
      (row) => (row.plan === 'pro' || row.plan === 'enterprise') && (row.status === 'active' || row.status === 'trial'),
    ).length;

    const cancellationsScheduled = (subscriptions || []).filter((row) => row.cancel_at_period_end).length;

    return ok({
      countsByPlan: planCounts,
      paidActive,
      cancellationsScheduled,
      recentSubscriptions: subscriptions || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load billing analytics';
    return fail(message, 'ERR_INTERNAL', 500);
  }
}
