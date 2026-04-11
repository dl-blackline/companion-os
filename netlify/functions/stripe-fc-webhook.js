/**
 * stripe-fc-webhook.js — Stripe Financial Connections webhook handler.
 *
 * Processes:
 *   financial_connections.account.created
 *   financial_connections.account.disconnected
 *   financial_connections.account.deactivated
 *   financial_connections.account.reactivated
 *   financial_connections.account.refreshed_balance
 *   financial_connections.account.refreshed_transactions
 *   financial_connections.account.refreshed_ownership
 */
import crypto from 'crypto';
import Stripe from 'stripe';
import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_FC_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_TIMESTAMP_TOLERANCE_S = 300;
const PG_UNIQUE_VIOLATION = '23505';

function requireStripe() {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' });
}

/* ── Signature verification (replicates billing-webhook.js pattern) ── */

function parseStripeSignature(signatureHeader) {
  const segments = String(signatureHeader || '').split(',').map((s) => s.trim());
  let timestamp = null;
  const v1Signatures = [];
  for (const segment of segments) {
    const eqIdx = segment.indexOf('=');
    if (eqIdx === -1) continue;
    const key = segment.slice(0, eqIdx);
    const value = segment.slice(eqIdx + 1);
    if (key === 't') timestamp = value;
    if (key === 'v1') v1Signatures.push(value);
  }
  return { timestamp, v1Signatures };
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET (or STRIPE_FC_WEBHOOK_SECRET) is not configured.');
  }

  const { timestamp, v1Signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || v1Signatures.length === 0) throw new Error('Missing Stripe signature metadata.');

  const webhookAgeSeconds = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (Math.abs(webhookAgeSeconds) > STRIPE_TIMESTAMP_TOLERANCE_S) {
    throw new Error(`Stripe webhook timestamp outside tolerance (${webhookAgeSeconds}s).`);
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedHex = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'hex');

  const matched = v1Signatures.some((sig) => {
    try {
      const providedBuf = Buffer.from(sig, 'hex');
      return (
        expectedBuf.length === providedBuf.length &&
        crypto.timingSafeEqual(expectedBuf, providedBuf)
      );
    } catch {
      return false;
    }
  });

  if (!matched) {
    throw new Error('Invalid Stripe webhook signature.');
  }
}

/* ── Idempotency ── */

async function isEventProcessed(eventId) {
  const { data } = await supabase
    .from('webhook_events_processed')
    .select('id')
    .eq('event_id', eventId)
    .single();
  return Boolean(data);
}

async function markEventProcessed(eventId, eventType, summary = {}) {
  const { error } = await supabase.from('webhook_events_processed').upsert(
    {
      event_id: eventId,
      event_type: eventType,
      payload_summary: summary,
    },
    { onConflict: 'event_id' },
  );
  if (error && error.code !== PG_UNIQUE_VIOLATION) {
    throw error;
  }
}

/* ── Helpers ── */

async function findConnectionByStripeId(stripeAccountId) {
  const { data } = await supabase
    .from('financial_connections')
    .select('id, user_id, institution_name, account_display_name, account_last4, account_subtype')
    .eq('stripe_account_id', stripeAccountId)
    .single();
  return data;
}

function classifyDirection(amount) {
  return amount > 0 ? 'inflow' : 'outflow';
}

function classifyCategory(description, merchantName) {
  const text = `${description || ''} ${merchantName || ''}`.toLowerCase();
  const rules = [
    { pattern: /payroll|salary|direct dep|wage/i, category: 'income' },
    { pattern: /interest|dividend|yield/i, category: 'investment_income' },
    { pattern: /transfer|zelle|venmo|cashapp|paypal/i, category: 'transfer' },
    { pattern: /rent|mortgage|hoa/i, category: 'housing' },
    { pattern: /electric|gas|water|sewer|utility|power/i, category: 'utilities' },
    { pattern: /grocery|whole foods|trader joe|kroger|safeway/i, category: 'groceries' },
    { pattern: /restaurant|doordash|uber eats|grubhub|mcdonald|starbucks/i, category: 'dining' },
    { pattern: /gas station|shell|chevron|exxon|fuel/i, category: 'fuel' },
    { pattern: /insurance|geico|progressive|state farm/i, category: 'insurance' },
    { pattern: /netflix|spotify|hulu|disney|hbo|subscription/i, category: 'subscriptions' },
    { pattern: /amazon|target|walmart|costco|best buy/i, category: 'shopping' },
    { pattern: /pharmacy|cvs|walgreens|medical|doctor|hospital/i, category: 'healthcare' },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return 'uncategorized';
}

/* ── Event handlers ── */

async function handleAccountCreated(stripeAccount) {
  // Find the owning user via the customer → billing_customers mapping
  const customerId = stripeAccount.account_holder?.customer;
  if (!customerId) {
    console.warn('[stripe-fc-webhook] account.created without customer ID, skipping.');
    return;
  }

  const { data: customerRecord } = await supabase
    .from('billing_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!customerRecord) {
    console.warn(`[stripe-fc-webhook] No user found for customer ${customerId}`);
    return;
  }

  const userId = customerRecord.user_id;

  await supabase.from('financial_connections').upsert(
    {
      user_id: userId,
      provider: 'stripe',
      stripe_account_id: stripeAccount.id,
      institution_name: stripeAccount.institution_name || null,
      account_display_name: stripeAccount.display_name || null,
      account_last4: stripeAccount.last4 || null,
      account_type: stripeAccount.category || null,
      account_subtype: stripeAccount.subcategory || null,
      livemode: stripeAccount.livemode ?? true,
      status: 'connected',
      last_sync_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,stripe_account_id', ignoreDuplicates: false },
  );
}

async function handleAccountDisconnected(stripeAccount) {
  await supabase
    .from('financial_connections')
    .update({
      status: 'disconnected',
      disconnected_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', stripeAccount.id);
}

async function handleAccountDeactivated(stripeAccount) {
  await supabase
    .from('financial_connections')
    .update({
      status: 'error',
      error_message: 'Account deactivated — relink required.',
    })
    .eq('stripe_account_id', stripeAccount.id);
}

async function handleAccountReactivated(stripeAccount) {
  await supabase
    .from('financial_connections')
    .update({
      status: 'connected',
      error_message: null,
      disconnected_at: null,
      last_sync_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', stripeAccount.id);
}

async function handleRefreshedBalance(stripeAccount) {
  const conn = await findConnectionByStripeId(stripeAccount.id);
  if (!conn) return;

  const balance = stripeAccount.balance;
  if (!balance) return;

  const cashCurrent = balance.cash?.current?.[0] || null;
  const cashAvailable = balance.cash?.available?.[0] || null;

  await supabase.from('account_balance_snapshots').insert({
    user_id: conn.user_id,
    connection_id: conn.id,
    current_balance: cashCurrent?.amount !== null ? cashCurrent.amount / 100 : null,
    available_balance: cashAvailable?.amount !== null ? cashAvailable.amount / 100 : null,
    currency: cashCurrent?.currency || cashAvailable?.currency || 'usd',
    as_of: balance.as_of ? new Date(balance.as_of * 1000).toISOString() : new Date().toISOString(),
  });

  // Update last_sync_at
  await supabase
    .from('financial_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', conn.id);
}

async function handleRefreshedTransactions(stripeAccount) {
  const conn = await findConnectionByStripeId(stripeAccount.id);
  if (!conn) return;

  const stripe = requireStripe();

  let hasMore = true;
  let startingAfter = undefined;

  while (hasMore) {
    const params = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;

    const txList = await stripe.financialConnections.transactions.list(stripeAccount.id, params);
    const txData = txList.data || [];

    if (txData.length > 0) {
      const rows = txData.map((tx) => {
        const amountDollars = (tx.amount || 0) / 100;
        return {
          user_id: conn.user_id,
          connection_id: conn.id,
          stripe_transaction_id: tx.id,
          stripe_financial_connections_account_id: stripeAccount.id,
          institution_name: conn.institution_name,
          account_display_name: conn.account_display_name,
          account_last4: conn.account_last4,
          account_subtype: conn.account_subtype,
          transaction_date: tx.transacted_at
            ? new Date(tx.transacted_at * 1000).toISOString().slice(0, 10)
            : null,
          posted_at: tx.posted_at ? new Date(tx.posted_at * 1000).toISOString() : null,
          amount: Math.abs(amountDollars),
          direction: classifyDirection(tx.amount),
          description: tx.description || null,
          merchant_name: tx.merchant_data?.name || null,
          category: classifyCategory(tx.description, tx.merchant_data?.name),
          status: tx.status === 'pending' ? 'pending' : 'posted',
          livemode: tx.livemode ?? true,
          raw_metadata: tx,
        };
      });

      await supabase
        .from('normalized_transactions')
        .upsert(rows, { onConflict: 'connection_id,stripe_transaction_id' });

      startingAfter = txData[txData.length - 1].id;
    }

    hasMore = txList.has_more;
  }

  await supabase
    .from('financial_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', conn.id);
}

async function handleRefreshedOwnership(stripeAccount) {
  // Ownership data is not yet used in product logic.
  // Persist the event for future use.
  const conn = await findConnectionByStripeId(stripeAccount.id);
  if (!conn) return;

  console.info(`[stripe-fc-webhook] Ownership refreshed for ${stripeAccount.id} (user ${conn.user_id}). No product action yet.`);
}

/* ── Main handler ── */

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 'ERR_METHOD', 405);
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
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

  const eventId = stripeEvent.id;
  const eventType = stripeEvent.type;
  const object = stripeEvent.data?.object;

  // Idempotency check
  if (await isEventProcessed(eventId)) {
    return ok({ received: true, type: eventType, duplicate: true });
  }

  try {
    switch (eventType) {
      case 'financial_connections.account.created':
        await handleAccountCreated(object);
        break;

      case 'financial_connections.account.disconnected':
        await handleAccountDisconnected(object);
        break;

      case 'financial_connections.account.deactivated':
        await handleAccountDeactivated(object);
        break;

      case 'financial_connections.account.reactivated':
        await handleAccountReactivated(object);
        break;

      case 'financial_connections.account.refreshed_balance':
        await handleRefreshedBalance(object);
        break;

      case 'financial_connections.account.refreshed_transactions':
        await handleRefreshedTransactions(object);
        break;

      case 'financial_connections.account.refreshed_ownership':
        await handleRefreshedOwnership(object);
        break;

      default:
        console.info(`[stripe-fc-webhook] Unhandled event type: ${eventType}`);
    }

    await markEventProcessed(eventId, eventType, {
      account_id: object?.id,
      status: object?.status,
    });

    return ok({ received: true, type: eventType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    console.error(`[stripe-fc-webhook] Error processing ${eventType}:`, message);
    return fail(message, 'ERR_WEBHOOK', 500);
  }
}
