/**
 * stripe-financial-connections.js — Stripe Financial Connections backend.
 *
 * Actions:
 *   POST create_session         → create FC session, return client_secret
 *   POST complete_session       → persist linked accounts after return
 *   POST refresh_account        → trigger balance/transaction refresh
 *   POST disconnect_account     → soft-disconnect a linked account
 *   GET                         → list linked accounts + latest balances
 */
import Stripe from 'stripe';
import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const RETURN_URL =
  process.env.STRIPE_FINANCIAL_CONNECTIONS_RETURN_URL ||
  `${process.env.APP_URL || 'https://vukos.netlify.app'}/finance/stripe/return`;

function requireStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' });
}

function getAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

async function resolveActor(token) {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    console.warn('[stripe-fc] Auth token validation failed:', error.message);
  }
  return data?.user || null;
}

/* ── Helpers ── */

function mapStripeAccountToRow(userId, stripeAccount) {
  return {
    user_id: userId,
    provider: 'stripe',
    stripe_account_id: stripeAccount.id,
    institution_name: stripeAccount.institution_name || null,
    account_display_name: stripeAccount.display_name || stripeAccount.account_holder?.name || null,
    account_last4: stripeAccount.last4 || null,
    account_type: stripeAccount.category || null,
    account_subtype: stripeAccount.subcategory || null,
    livemode: stripeAccount.livemode ?? true,
    status: stripeAccount.status === 'active' ? 'connected' : 'disconnected',
    disconnected_at:
      stripeAccount.status === 'disconnected' || stripeAccount.status === 'inactive'
        ? new Date().toISOString()
        : null,
    last_sync_at: new Date().toISOString(),
    error_message: null,
  };
}

async function persistAccount(userId, stripeAccount) {
  const row = mapStripeAccountToRow(userId, stripeAccount);

  const { data, error } = await supabase
    .from('financial_connections')
    .upsert(row, { onConflict: 'user_id,stripe_account_id', ignoreDuplicates: false })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to persist account: ${error.message}`);
  return data.id;
}

async function persistBalanceSnapshot(userId, connectionId, balance) {
  if (!balance) return;

  await supabase.from('account_balance_snapshots').insert({
    user_id: userId,
    connection_id: connectionId,
    current_balance: balance.current != null ? balance.current / 100 : null,
    available_balance: balance.cash?.available?.[0]?.amount != null
      ? balance.cash.available[0].amount / 100
      : null,
    currency: balance.cash?.available?.[0]?.currency || 'usd',
    as_of: balance.as_of ? new Date(balance.as_of * 1000).toISOString() : new Date().toISOString(),
  });
}

function classifyDirection(amount) {
  if (amount > 0) return 'inflow';
  if (amount < 0) return 'outflow';
  return 'inflow';
}

function classifyCategory(description, merchantName) {
  const text = `${description || ''} ${merchantName || ''}`.toLowerCase();

  const rules = [
    { pattern: /payroll|salary|direct dep|wage/i, category: 'income' },
    { pattern: /interest|dividend|yield/i, category: 'investment_income' },
    { pattern: /transfer|zelle|venmo|cashapp|paypal/i, category: 'transfer' },
    { pattern: /rent|mortgage|hoa/i, category: 'housing' },
    { pattern: /electric|gas|water|sewer|utility|power/i, category: 'utilities' },
    { pattern: /grocery|whole foods|trader joe|kroger|safeway|walmart.*grocery/i, category: 'groceries' },
    { pattern: /restaurant|doordash|uber eats|grubhub|mcdonald|starbucks|chipotle/i, category: 'dining' },
    { pattern: /gas station|shell|chevron|exxon|bp|fuel/i, category: 'fuel' },
    { pattern: /insurance|geico|progressive|state farm|allstate/i, category: 'insurance' },
    { pattern: /netflix|spotify|hulu|disney|hbo|subscription/i, category: 'subscriptions' },
    { pattern: /amazon|target|walmart|costco|best buy/i, category: 'shopping' },
    { pattern: /pharmacy|cvs|walgreens|medical|doctor|hospital|dental/i, category: 'healthcare' },
    { pattern: /gym|fitness|peloton/i, category: 'fitness' },
    { pattern: /tuition|student|education|school/i, category: 'education' },
    { pattern: /car payment|auto loan|toyota financial|ally auto/i, category: 'auto_loan' },
    { pattern: /credit card payment|minimum payment/i, category: 'debt_payment' },
    { pattern: /atm|withdrawal|cash/i, category: 'cash' },
    { pattern: /tax|irs|state tax/i, category: 'taxes' },
    { pattern: /child|daycare|tutor/i, category: 'childcare' },
    { pattern: /travel|airline|hotel|airbnb|booking/i, category: 'travel' },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.category;
  }

  return 'uncategorized';
}

async function persistTransactions(userId, connectionId, stripeAccountId, institutionName, displayName, last4, subtype, transactions) {
  if (!transactions || transactions.length === 0) return 0;

  const rows = transactions.map((tx) => {
    const amountDollars = (tx.amount || 0) / 100;
    return {
      user_id: userId,
      connection_id: connectionId,
      stripe_transaction_id: tx.id,
      stripe_financial_connections_account_id: stripeAccountId,
      institution_name: institutionName,
      account_display_name: displayName,
      account_last4: last4,
      account_subtype: subtype,
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

  const { error } = await supabase
    .from('normalized_transactions')
    .upsert(rows, { onConflict: 'connection_id,stripe_transaction_id' });

  if (error) {
    console.error('[stripe-fc] Transaction persist error:', error.message);
  }

  return rows.length;
}

/* ── Actions ── */

async function handleCreateSession(user) {
  const stripe = requireStripe();

  const permissions = ['balances', 'transactions', 'ownership'];
  const prefetch = ['balances', 'transactions'];
  console.log(`[stripe-fc] create_session: user=${user.id}, permissions=${permissions.join(',')}, prefetch=${prefetch.join(',')}`);

  const session = await stripe.financialConnections.sessions.create({
    account_holder: {
      type: 'customer',
      customer: await getOrCreateStripeCustomer(stripe, user),
    },
    permissions,
    prefetch,
    filters: {
      account_subcategories: ['checking', 'savings', 'credit_card'],
    },
  });

  console.log(`[stripe-fc] Session created: ${session.id}`);

  return ok({
    clientSecret: session.client_secret,
    sessionId: session.id,
  });
}

async function getOrCreateStripeCustomer(stripe, user) {
  // Check if user already has a billing_customers record
  const { data: existing } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  // Create a Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { supabase_user_id: user.id },
  });

  await supabase.from('billing_customers').upsert(
    { user_id: user.id, stripe_customer_id: customer.id },
    { onConflict: 'user_id' },
  );

  return customer.id;
}

async function handleCompleteSession(user, body) {
  const stripe = requireStripe();
  const sessionId = body?.sessionId;
  if (!sessionId) return fail('Missing sessionId', 'ERR_VALIDATION', 400);

  console.log(`[stripe-fc] complete_session: user=${user.id}, sessionId=${sessionId}`);

  let session;
  try {
    session = await stripe.financialConnections.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('[stripe-fc] Session retrieve failed:', err.message);
    return fail('Failed to retrieve Stripe session. It may have expired.', 'ERR_STRIPE_SESSION', 400);
  }

  const accounts = session.accounts?.data || [];
  console.log(`[stripe-fc] Session contains ${accounts.length} account(s)`);

  if (accounts.length === 0) {
    return ok({ linked: 0, message: 'No accounts were linked.' });
  }

  let linked = 0;
  let balancesSynced = 0;
  let transactionsSynced = 0;
  const errors = [];
  const linkedAccountIds = [];

  for (const account of accounts) {
    try {
      console.log(`[stripe-fc] Persisting account ${account.id} (${account.institution_name || 'unknown'}, ${account.display_name || account.last4 || 'n/a'})`);
      const connectionId = await persistAccount(user.id, account);

      // Persist prefetched balance if available
      let balancePersisted = false;
      if (account.balance) {
        try {
          await persistBalanceSnapshot(user.id, connectionId, account.balance);
          balancePersisted = true;
          balancesSynced++;
          console.log(`[stripe-fc] Prefetched balance persisted for ${account.id}`);
        } catch (err) {
          console.warn(`[stripe-fc] Balance snapshot for ${account.id}:`, err.message);
        }
      }

      // If balance was not prefetched, explicitly refresh it from Stripe
      if (!balancePersisted) {
        try {
          console.log(`[stripe-fc] No prefetched balance for ${account.id}, triggering explicit refresh`);
          const refreshed = await stripe.financialConnections.accounts.refresh(account.id, {
            features: ['balance'],
          });
          if (refreshed.balance) {
            await persistBalanceSnapshot(user.id, connectionId, refreshed.balance);
            balancesSynced++;
            console.log(`[stripe-fc] Explicitly refreshed balance persisted for ${account.id}`);
          }
        } catch (err) {
          console.warn(`[stripe-fc] Explicit balance refresh for ${account.id}:`, err.message);
        }
      }

      // Subscribe to automatic refreshes (non-critical)
      try {
        await stripe.financialConnections.accounts.subscribe(account.id, {
          features: ['transactions'],
        });
      } catch (err) {
        console.warn(`[stripe-fc] Could not subscribe ${account.id} to transactions:`, err.message);
      }

      try {
        await stripe.financialConnections.accounts.subscribe(account.id, {
          features: ['balances'],
        });
      } catch (err) {
        console.warn(`[stripe-fc] Could not subscribe ${account.id} to balances:`, err.message);
      }

      linked++;
      linkedAccountIds.push(account.id);
    } catch (err) {
      console.error(`[stripe-fc] Failed to persist account ${account.id}:`, err.message);
      errors.push({ accountId: account.id, error: err.message });
    }
  }

  console.log(`[stripe-fc] ${linked}/${accounts.length} accounts persisted, ${balancesSynced} balances synced`);

  // Fetch initial transactions only for successfully linked accounts (non-critical)
  for (const stripeAccountId of linkedAccountIds) {
    try {
      const txCount = await fetchAndPersistTransactions(stripe, user.id, stripeAccountId);
      transactionsSynced += txCount;
      console.log(`[stripe-fc] ${txCount} transactions persisted for ${stripeAccountId}`);
    } catch (err) {
      console.warn(`[stripe-fc] Initial tx fetch for ${stripeAccountId}:`, err.message);
    }
  }

  console.log(`[stripe-fc] complete_session done: linked=${linked}, balances=${balancesSynced}, transactions=${transactionsSynced}, errors=${errors.length}`);

  return ok({
    linked,
    accounts: linkedAccountIds,
    balancesSynced,
    transactionsSynced,
    syncStatus: transactionsSynced > 0 ? 'complete' : 'transactions_syncing',
    ...(errors.length > 0 ? { partialErrors: errors } : {}),
  });
}

async function fetchAndPersistTransactions(stripe, userId, stripeAccountId) {
  console.log(`[stripe-fc] Fetching transactions for stripe account ${stripeAccountId}`);
  // Get connection record
  const { data: conn } = await supabase
    .from('financial_connections')
    .select('id, institution_name, account_display_name, account_last4, account_subtype')
    .eq('user_id', userId)
    .eq('stripe_account_id', stripeAccountId)
    .maybeSingle();

  if (!conn) {
    console.warn(`[stripe-fc] No connection record for stripe account ${stripeAccountId}`);
    return 0;
  }

  let hasMore = true;
  let startingAfter = undefined;
  let totalPersisted = 0;

  while (hasMore) {
    const params = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;

    const txList = await stripe.financialConnections.transactions.list(stripeAccountId, params);
    const txData = txList.data || [];
    console.log(`[stripe-fc] Fetched ${txData.length} transactions batch (hasMore=${txList.has_more})`);

    if (txData.length > 0) {
      const count = await persistTransactions(
        userId,
        conn.id,
        stripeAccountId,
        conn.institution_name,
        conn.account_display_name,
        conn.account_last4,
        conn.account_subtype,
        txData,
      );
      totalPersisted += count;
      startingAfter = txData[txData.length - 1].id;
    }

    hasMore = txList.has_more;
  }

  return totalPersisted;
}

async function handleRefreshAccount(user, body) {
  const stripe = requireStripe();
  const connectionId = body?.connectionId;
  if (!connectionId) return fail('Missing connectionId', 'ERR_VALIDATION', 400);

  const { data: conn } = await supabase
    .from('financial_connections')
    .select('id, stripe_account_id, status')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!conn) return fail('Account not found', 'ERR_NOT_FOUND', 404);
  if (!conn.stripe_account_id) return fail('Not a Stripe FC account', 'ERR_VALIDATION', 400);

  // Refresh balance
  try {
    const account = await stripe.financialConnections.accounts.refresh(conn.stripe_account_id, {
      features: ['balance'],
    });
    if (account.balance) {
      await persistBalanceSnapshot(user.id, conn.id, account.balance);
    }
  } catch (err) {
    console.warn(`[stripe-fc] Balance refresh for ${conn.stripe_account_id}:`, err.message);
  }

  // Refresh transactions
  try {
    await stripe.financialConnections.accounts.refresh(conn.stripe_account_id, {
      features: ['transactions'],
    });
    await fetchAndPersistTransactions(stripe, user.id, conn.stripe_account_id);
  } catch (err) {
    console.warn(`[stripe-fc] Transaction refresh for ${conn.stripe_account_id}:`, err.message);
  }

  // Update sync time
  await supabase
    .from('financial_connections')
    .update({ last_sync_at: new Date().toISOString(), error_message: null })
    .eq('id', conn.id)
    .eq('user_id', user.id);

  return ok({ refreshed: true });
}

async function handleDisconnectAccount(user, body) {
  const connectionId = body?.connectionId;
  if (!connectionId) return fail('Missing connectionId', 'ERR_VALIDATION', 400);

  const { data: conn } = await supabase
    .from('financial_connections')
    .select('id, stripe_account_id')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!conn) return fail('Account not found', 'ERR_NOT_FOUND', 404);

  // Disconnect on Stripe side
  if (conn.stripe_account_id) {
    try {
      const stripe = requireStripe();
      await stripe.financialConnections.accounts.disconnect(conn.stripe_account_id);
    } catch (err) {
      console.warn(`[stripe-fc] Stripe disconnect for ${conn.stripe_account_id}:`, err.message);
    }
  }

  await supabase
    .from('financial_connections')
    .update({
      status: 'disconnected',
      disconnected_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', conn.id)
    .eq('user_id', user.id);

  return ok({ disconnected: true });
}

async function handleGetLinkedAccounts(userId) {
  console.log(`[stripe-fc] GET linked accounts for user=${userId}`);

  const [connectionsRes, balancesRes, txCountRes] = await Promise.all([
    supabase
      .from('financial_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'stripe')
      .order('created_at', { ascending: false }),
    supabase
      .from('account_balance_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('as_of', { ascending: false }),
    supabase
      .from('normalized_transactions')
      .select('connection_id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  if (connectionsRes.error) console.error('[stripe-fc] GET connections error:', connectionsRes.error.message);
  if (balancesRes.error) console.error('[stripe-fc] GET balances error:', balancesRes.error.message);
  if (txCountRes.error) console.error('[stripe-fc] GET tx count error:', txCountRes.error.message);

  const connections = connectionsRes.data || [];
  const balances = balancesRes.data || [];

  console.log(`[stripe-fc] Found ${connections.length} connections, ${balances.length} balance snapshots, ${txCountRes.count ?? 0} transactions`);

  // Attach latest balance to each connection
  const enriched = connections.map((conn) => {
    const latestBalance = balances.find((b) => b.connection_id === conn.id);
    return {
      ...conn,
      latest_balance: latestBalance || null,
    };
  });

  return ok({
    accounts: enriched,
    totalTransactions: txCountRes.count || 0,
  });
}

/* ── Handler ── */

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  if (!token) {
    console.warn('[stripe-fc] No auth token in request headers');
    return fail('Unauthorized — no token provided', 'ERR_AUTH', 401);
  }

  const user = await resolveActor(token);
  if (!user) {
    console.warn('[stripe-fc] Token present but user resolution failed (expired or invalid)');
    return fail('Unauthorized — session expired or invalid', 'ERR_AUTH', 401);
  }

  try {
    if (event.httpMethod === 'GET') {
      return handleGetLinkedAccounts(user.id);
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

    const action = body.action;

    if (action === 'create_session') return handleCreateSession(user);
    if (action === 'complete_session') return handleCompleteSession(user, body);
    if (action === 'refresh_account') return handleRefreshAccount(user, body);
    if (action === 'disconnect_account') return handleDisconnectAccount(user, body);

    return fail('Unknown action', 'ERR_VALIDATION', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe FC request failed.';
    const isStripeError = error?.type?.startsWith?.('Stripe') || error?.raw?.type;
    console.error('[stripe-fc] Error:', message, isStripeError ? `(Stripe type: ${error.type})` : '');
    return fail(
      isStripeError ? 'A payment provider error occurred. Please try again.' : message,
      'ERR_STRIPE_FC',
      isStripeError ? 502 : 500,
    );
  }
}
