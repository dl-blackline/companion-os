/**
 * billing-subscription.js — End-user subscription management endpoint.
 *
 * Routes:
 *   GET  /billing-subscription                 -> current subscription status
 *   POST /billing-subscription { action }      -> checkout / billing portal URLs
 */
import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import { getUsageSummary } from '../../lib/_entitlements.js';
import { isSuperAdminUser } from '../../lib/_super-admin.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRICE_PRO_MONTHLY;
const STRIPE_PRICE_ENTERPRISE = process.env.STRIPE_PRICE_ENTERPRISE || process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY;
const SITE_URL = process.env.URL || process.env.SITE_URL || 'http://localhost:8888';

function getAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

function originFromEvent(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  return origin || SITE_URL;
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

function planToPriceId(plan) {
  if (plan === 'pro') return STRIPE_PRICE_PRO || '';
  if (plan === 'enterprise') return STRIPE_PRICE_ENTERPRISE || '';
  return '';
}

async function stripePost(path, params) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  const body = new URLSearchParams(params).toString();
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || 'Stripe request failed.');
  }

  return json;
}

async function ensureStripeCustomer(user) {
  const { data: existing } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const customer = await stripePost('customers', {
    email: user.email || '',
    'metadata[supabase_user_id]': user.id,
  });

  await supabase.from('billing_customers').upsert(
    {
      user_id: user.id,
      stripe_customer_id: customer.id,
    },
    { onConflict: 'user_id' },
  );

  return customer.id;
}

async function getSubscriptionSnapshot(actor) {
  // Super-admin gets an immediate override without touching the DB for entitlements
  if (isSuperAdminUser(actor)) {
    const usage = await getUsageSummary(actor.id, actor.email);
    return {
      currentPlan: 'admin_override',
      status: 'active',
      trialEndsAt: null,
      expiresAt: null,
      customerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canManageBilling: false,
      usage: usage.features,
    };
  }

  const userId = actor.id;
  const [{ data: entitlement }, { data: subscription }, { data: customer }, usage] = await Promise.all([
    supabase.from('user_entitlements').select('plan,status,trial_ends_at,expires_at').eq('user_id', userId).single(),
    supabase
      .from('billing_subscriptions')
      .select('stripe_subscription_id,status,current_period_end,cancel_at_period_end')
      .eq('user_id', userId)
      .single(),
    supabase.from('billing_customers').select('stripe_customer_id').eq('user_id', userId).single(),
    getUsageSummary(userId),
  ]);

  return {
    currentPlan: entitlement?.plan || 'free',
    status: entitlement?.status || 'none',
    trialEndsAt: entitlement?.trial_ends_at || null,
    expiresAt: entitlement?.expires_at || null,
    customerId: customer?.stripe_customer_id || null,
    stripeSubscriptionId: subscription?.stripe_subscription_id || null,
    currentPeriodEnd: subscription?.current_period_end || null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    canManageBilling: Boolean(customer?.stripe_customer_id),
    usage: usage.features,
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();

  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const actor = await resolveActor(token);
  if (!actor) return fail('Unauthorized', 'ERR_AUTH', 401);

  try {
    if (event.httpMethod === 'GET') {
      return ok(await getSubscriptionSnapshot(actor));
    }

    if (event.httpMethod !== 'POST') {
      return fail('Method not allowed', 'ERR_METHOD', 405);
    }

    const body = JSON.parse(event.body || '{}');
    const action = body.action;
    const origin = originFromEvent(event);

    if (action === 'checkout') {
      const targetPlan = body.plan;
      if (targetPlan !== 'pro' && targetPlan !== 'enterprise') {
        return fail('Invalid plan selected.', 'ERR_VALIDATION', 400);
      }

      const priceId = planToPriceId(targetPlan);
      if (!priceId) {
        return fail(`Price for plan '${targetPlan}' is not configured.`, 'ERR_CONFIG', 500);
      }

      const customerId = await ensureStripeCustomer(actor);

      const session = await stripePost('checkout/sessions', {
        mode: 'subscription',
        customer: customerId,
        client_reference_id: actor.id,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: `${origin}/settings?billing=success`,
        cancel_url: `${origin}/settings?billing=cancelled`,
        'metadata[supabase_user_id]': actor.id,
      });

      return ok({ checkoutUrl: session.url });
    }

    if (action === 'portal') {
      const customerId = await ensureStripeCustomer(actor);
      const portal = await stripePost('billing_portal/sessions', {
        customer: customerId,
        return_url: `${origin}/settings?billing=portal-return`,
      });

      return ok({ portalUrl: portal.url });
    }

    return fail('Unknown action', 'ERR_VALIDATION', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Billing operation failed.';
    return fail(message, 'ERR_BILLING', 500);
  }
}
