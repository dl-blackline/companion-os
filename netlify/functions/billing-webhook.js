/**
 * billing-webhook.js — Stripe webhook receiver.
 *
 * Keeps billing tables and user_entitlements in sync after Stripe events.
 */
import crypto from 'crypto';
import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRICE_PRO_MONTHLY;
const STRIPE_PRICE_ENTERPRISE = process.env.STRIPE_PRICE_ENTERPRISE || process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY;

async function writeAudit(action, targetId, details) {
  await supabase.from('audit_logs').insert({
    actor_email: 'stripe-webhook',
    action,
    target_type: 'billing',
    target_id: targetId,
    details,
  });
}

function mapPriceToPlan(priceId) {
  if (!priceId) return 'free';
  if (priceId === STRIPE_PRICE_ENTERPRISE) return 'enterprise';
  if (priceId === STRIPE_PRICE_PRO) return 'pro';
  return 'free';
}

function mapStripeStatusToEntitlement(status) {
  if (status === 'trialing') return 'trial';
  if (status === 'active') return 'active';
  if (status === 'past_due' || status === 'unpaid') return 'suspended';
  if (status === 'canceled' || status === 'incomplete_expired') return 'expired';
  return 'none';
}

function parseStripeSignature(signatureHeader) {
  const segments = String(signatureHeader || '')
    .split(',')
    .map((segment) => segment.trim());

  const parts = {};
  for (const segment of segments) {
    const [key, value] = segment.split('=');
    parts[key] = value;
  }

  return {
    timestamp: parts.t,
    signature: parts.v1,
  };
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }

  const { timestamp, signature } = parseStripeSignature(signatureHeader);
  if (!timestamp || !signature) {
    throw new Error('Missing Stripe signature metadata.');
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signature, 'utf8');

  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    throw new Error('Invalid Stripe webhook signature.');
  }
}

async function stripeGet(path) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || 'Stripe request failed.');
  }

  return json;
}

async function resolveUserIdFromCustomer(stripeCustomerId) {
  if (!stripeCustomerId) return null;

  const { data } = await supabase
    .from('billing_customers')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  return data?.user_id || null;
}

async function upsertCustomer(userId, stripeCustomerId) {
  if (!userId || !stripeCustomerId) return;

  await supabase.from('billing_customers').upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
    },
    { onConflict: 'user_id' },
  );
}

async function syncEntitlement(userId, plan, status, overriddenBy = null) {
  if (!userId) return;

  const isActive = status === 'active' || status === 'trial';
  const effectivePlan = isActive && (plan === 'pro' || plan === 'enterprise') ? plan : 'free';

  await supabase.from('user_entitlements').upsert(
    {
      user_id: userId,
      plan: effectivePlan,
      status,
      overridden_by: overriddenBy,
    },
    { onConflict: 'user_id' },
  );
}

async function handleSubscriptionEvent(subscription) {
  const stripeCustomerId = subscription.customer;
  const stripeSubscriptionId = subscription.id;
  const stripePriceId = subscription.items?.data?.[0]?.price?.id || null;
  const plan = mapPriceToPlan(stripePriceId);
  const entitlementStatus = mapStripeStatusToEntitlement(subscription.status);

  let userId = subscription.metadata?.supabase_user_id || null;
  if (!userId) {
    userId = await resolveUserIdFromCustomer(stripeCustomerId);
  }

  if (!userId) {
    return;
  }

  await upsertCustomer(userId, stripeCustomerId);

  await supabase.from('billing_subscriptions').upsert(
    {
      user_id: userId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      stripe_price_id: stripePriceId,
      status: subscription.status,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      metadata: subscription.metadata || {},
    },
    { onConflict: 'user_id' },
  );

  await syncEntitlement(userId, plan, entitlementStatus);
  await writeAudit('billing.subscription.synced', stripeSubscriptionId, {
    user_id: userId,
    plan,
    status: subscription.status,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
  });
}

async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id || session.metadata?.supabase_user_id || null;
  const stripeCustomerId = session.customer || null;
  const stripeSubscriptionId = session.subscription || null;

  if (!userId || !stripeCustomerId) {
    return;
  }

  await upsertCustomer(userId, stripeCustomerId);

  if (!stripeSubscriptionId) {
    return;
  }

  const subscription = await stripeGet(`subscriptions/${stripeSubscriptionId}`);
  await handleSubscriptionEvent(subscription);
  await writeAudit('billing.checkout.completed', stripeSubscriptionId, {
    user_id: userId,
    stripe_customer_id: stripeCustomerId,
  });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 'ERR_METHOD', 405);

  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const rawBody = event.body || '';
  const signature = event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'];

  try {
    verifyWebhookSignature(rawBody, signature);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Invalid signature', 'ERR_SIGNATURE', 400);
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return fail('Invalid webhook payload JSON', 'ERR_JSON', 400);
  }

  try {
    const eventType = stripeEvent.type;
    const object = stripeEvent.data?.object;

    if (eventType === 'checkout.session.completed') {
      await handleCheckoutCompleted(object);
    }

    if (
      eventType === 'customer.subscription.created' ||
      eventType === 'customer.subscription.updated' ||
      eventType === 'customer.subscription.deleted'
    ) {
      await handleSubscriptionEvent(object);
    }

    if (eventType === 'invoice.payment_failed') {
      const stripeCustomerId = object.customer;
      const userId = await resolveUserIdFromCustomer(stripeCustomerId);
      if (userId) {
        await syncEntitlement(userId, 'free', 'suspended');
        await writeAudit('billing.payment_failed', stripeCustomerId, {
          user_id: userId,
          invoice_id: object.id,
        });
      }
    }

    return ok({ received: true, type: eventType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    return fail(message, 'ERR_WEBHOOK', 500);
  }
}
