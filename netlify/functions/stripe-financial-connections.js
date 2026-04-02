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

  // Stripe FC balance.current and balance.cash.available are currency-keyed objects
  // e.g. balance.current = { "usd": -7800 } (amount in cents)
  const currency = Object.keys(balance.current || {})[0] || 'usd';
  const currentCents = balance.current?.[currency];
  const availableCents = balance.cash?.available?.[currency];

  console.log(`[stripe-fc] Balance snapshot: currency=${currency}, currentCents=${currentCents}, availableCents=${availableCents}, raw=`, JSON.stringify(balance));

  await supabase.from('account_balance_snapshots').insert({
    user_id: userId,
    connection_id: connectionId,
    current_balance: currentCents != null ? currentCents / 100 : null,
    available_balance: availableCents != null ? availableCents / 100 : null,
    currency,
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

  // The frontend may pass account IDs from the Stripe JS result as a hint
  const accountIdsFromClient = body?.accountIds || [];

  console.log(`[stripe-fc] complete_session: user=${user.id}, sessionId=${sessionId}, clientAccountIds=${JSON.stringify(accountIdsFromClient)}`);

  // Step 1: Try to get accounts from the session retrieve
  let accounts = [];
  try {
    const session = await stripe.financialConnections.sessions.retrieve(sessionId);
    accounts = session.accounts?.data || [];
    console.log(`[stripe-fc] Session retrieve returned ${accounts.length} account(s), session.status=${session.status || 'n/a'}`);
  } catch (err) {
    console.error('[stripe-fc] Session retrieve failed:', err.message);
    // Don't bail yet — we may still be able to fetch accounts directly
  }

  // Step 2: If session retrieve returned no accounts, try fetching each
  //         account ID provided by the frontend directly from Stripe
  if (accounts.length === 0 && accountIdsFromClient.length > 0) {
    console.log(`[stripe-fc] Session had 0 accounts, fetching ${accountIdsFromClient.length} account(s) by ID from client hint`);
    for (const acctId of accountIdsFromClient) {
      try {
        const acct = await stripe.financialConnections.accounts.retrieve(acctId);
        if (acct && acct.id) {
          accounts.push(acct);
          console.log(`[stripe-fc] Retrieved account ${acct.id} (${acct.institution_name || 'unknown'})`);
        }
      } catch (err) {
        console.warn(`[stripe-fc] Could not retrieve account ${acctId}:`, err.message);
      }
    }
  }

  // Step 3: Last resort — list recent accounts for this customer
  if (accounts.length === 0) {
    console.log('[stripe-fc] Still 0 accounts, trying accounts.list as last resort');
    try {
      const customerIdRow = await supabase
        .from('billing_customers')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customerIdRow?.data?.stripe_customer_id) {
        const listed = await stripe.financialConnections.accounts.list({
          account_holder: {
            customer: customerIdRow.data.stripe_customer_id,
          },
          limit: 20,
        });
        // Only take active accounts we haven't already persisted
        const { data: existingConns } = await supabase
          .from('financial_connections')
          .select('stripe_account_id')
          .eq('user_id', user.id)
          .eq('provider', 'stripe');
        const existingIds = new Set((existingConns || []).map(c => c.stripe_account_id));
        accounts = (listed.data || []).filter(a => a.status === 'active' && !existingIds.has(a.id));
        console.log(`[stripe-fc] accounts.list returned ${listed.data?.length || 0} total, ${accounts.length} new active`);
      }
    } catch (err) {
      console.warn('[stripe-fc] accounts.list fallback failed:', err.message);
    }
  }

  if (accounts.length === 0) {
    console.warn('[stripe-fc] No accounts found via any method');
    return ok({ linked: 0, message: 'No accounts were linked. The session may have expired or the connection was not completed.' });
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

  // Trigger transaction refresh for each account (non-blocking).
  // Stripe processes this asynchronously — the frontend will call
  // sync_transactions after a short delay to pick up the results.
  for (const stripeAccountId of linkedAccountIds) {
    try {
      await stripe.financialConnections.accounts.refresh(stripeAccountId, {
        features: ['transactions'],
      });
      console.log(`[stripe-fc] Transaction refresh triggered for ${stripeAccountId}`);
    } catch (refreshErr) {
      // May fail if prefetch already started a refresh — that's fine
      console.warn(`[stripe-fc] Transaction refresh trigger for ${stripeAccountId}:`, refreshErr.message);
    }

    // Quick non-blocking attempt: if prefetch already produced data, grab it now
    try {
      const txCount = await fetchAndPersistTransactions(stripe, user.id, stripeAccountId);
      transactionsSynced += txCount;
      if (txCount > 0) console.log(`[stripe-fc] ${txCount} prefetched transactions persisted for ${stripeAccountId}`);
    } catch (err) {
      console.warn(`[stripe-fc] Quick tx fetch for ${stripeAccountId}:`, err.message);
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

  // Refresh transactions — trigger and attempt a quick fetch
  let txSynced = 0;
  try {
    // Check if a previous refresh already completed
    const acctCheck = await stripe.financialConnections.accounts.retrieve(conn.stripe_account_id);
    const existingStatus = acctCheck.transaction_refresh?.status;

    if (existingStatus !== 'succeeded') {
      // Trigger a new refresh
      await stripe.financialConnections.accounts.refresh(conn.stripe_account_id, {
        features: ['transactions'],
      });
      console.log(`[stripe-fc] Transaction refresh triggered for ${conn.stripe_account_id} (was: ${existingStatus})`);
    } else {
      console.log(`[stripe-fc] Transaction refresh already succeeded for ${conn.stripe_account_id}`);
    }

    // Fetch whatever is available now
    txSynced = await fetchAndPersistTransactions(stripe, user.id, conn.stripe_account_id);
    console.log(`[stripe-fc] ${txSynced} transactions fetched for ${conn.stripe_account_id}`);
  } catch (err) {
    console.warn(`[stripe-fc] Transaction refresh for ${conn.stripe_account_id}:`, err.message);
  }

  // Update sync time
  await supabase
    .from('financial_connections')
    .update({ last_sync_at: new Date().toISOString(), error_message: null })
    .eq('id', conn.id)
    .eq('user_id', user.id);

  return ok({ refreshed: true, transactionsSynced: txSynced });
}

async function handleSyncTransactions(user) {
  const stripe = requireStripe();

  // Get all connected Stripe accounts for this user
  const { data: connections } = await supabase
    .from('financial_connections')
    .select('id, stripe_account_id, institution_name')
    .eq('user_id', user.id)
    .eq('provider', 'stripe')
    .eq('status', 'connected');

  if (!connections || connections.length === 0) {
    return ok({ synced: 0, accounts: [], message: 'No connected accounts.' });
  }

  let totalSynced = 0;
  const accountResults = [];

  for (const conn of connections) {
    if (!conn.stripe_account_id) continue;

    try {
      // Check the transaction_refresh status on Stripe
      const acct = await stripe.financialConnections.accounts.retrieve(conn.stripe_account_id);
      const refreshStatus = acct.transaction_refresh?.status || 'none';
      console.log(`[stripe-fc] sync_transactions: ${conn.stripe_account_id} (${conn.institution_name}) refresh_status=${refreshStatus}`);

      if (refreshStatus === 'succeeded') {
        const count = await fetchAndPersistTransactions(stripe, user.id, conn.stripe_account_id);
        totalSynced += count;
        accountResults.push({ id: conn.id, institution: conn.institution_name, status: 'synced', count });
      } else if (refreshStatus === 'pending') {
        accountResults.push({ id: conn.id, institution: conn.institution_name, status: 'pending', count: 0 });
      } else {
        // No refresh or failed — trigger a new one
        try {
          await stripe.financialConnections.accounts.refresh(conn.stripe_account_id, {
            features: ['transactions'],
          });
          accountResults.push({ id: conn.id, institution: conn.institution_name, status: 'refresh_triggered', count: 0 });
        } catch (refreshErr) {
          console.warn(`[stripe-fc] Could not trigger refresh for ${conn.stripe_account_id}:`, refreshErr.message);
          accountResults.push({ id: conn.id, institution: conn.institution_name, status: 'error', count: 0 });
        }
      }
    } catch (err) {
      console.warn(`[stripe-fc] sync_transactions error for ${conn.stripe_account_id}:`, err.message);
      accountResults.push({ id: conn.id, institution: conn.institution_name, status: 'error', count: 0 });
    }
  }

  const allDone = accountResults.every((a) => a.status === 'synced' || a.status === 'error');

  return ok({
    synced: totalSynced,
    accounts: accountResults,
    complete: allDone,
  });
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

async function handleRemoveAccount(user, body) {
  const connectionId = body?.connectionId;
  if (!connectionId) return fail('Missing connectionId', 'ERR_VALIDATION', 400);

  const { data: conn } = await supabase
    .from('financial_connections')
    .select('id, stripe_account_id')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!conn) return fail('Account not found', 'ERR_NOT_FOUND', 404);

  // Disconnect on Stripe side if still active
  if (conn.stripe_account_id) {
    try {
      const stripe = requireStripe();
      await stripe.financialConnections.accounts.disconnect(conn.stripe_account_id);
    } catch (err) {
      // Already disconnected or not found — fine, we're deleting anyway
      console.warn(`[stripe-fc] Stripe disconnect before remove for ${conn.stripe_account_id}:`, err.message);
    }
  }

  // Delete related data first (balance snapshots, transactions), then the connection
  await supabase.from('normalized_transactions').delete().eq('connection_id', conn.id).eq('user_id', user.id);
  await supabase.from('account_balance_snapshots').delete().eq('connection_id', conn.id).eq('user_id', user.id);
  await supabase.from('financial_connections').delete().eq('id', conn.id).eq('user_id', user.id);

  console.log(`[stripe-fc] Removed account ${conn.id} (stripe: ${conn.stripe_account_id || 'n/a'})`);
  return ok({ removed: true });
}

async function handleGetLinkedAccounts(userId) {
  console.log(`[stripe-fc] GET linked accounts for user=${userId}`);

  const [connectionsRes, balancesRes, txCountRes, ledgerRes] = await Promise.all([
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
    supabase
      .from('ledger_entries')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true }),
  ]);

  if (connectionsRes.error) console.error('[stripe-fc] GET connections error:', connectionsRes.error.message);
  if (balancesRes.error) console.error('[stripe-fc] GET balances error:', balancesRes.error.message);
  if (txCountRes.error) console.error('[stripe-fc] GET tx count error:', txCountRes.error.message);
  if (ledgerRes.error) console.error('[stripe-fc] GET ledger error:', ledgerRes.error.message);

  const connections = connectionsRes.data || [];
  const balances = balancesRes.data || [];
  const ledgerEntries = ledgerRes.data || [];

  console.log(`[stripe-fc] Found ${connections.length} connections, ${balances.length} balance snapshots, ${txCountRes.count ?? 0} transactions, ${ledgerEntries.length} ledger entries`);

  // Attach latest balance to each connection
  const enriched = connections.map((conn) => {
    const latestBalance = balances.find((b) => b.connection_id === conn.id);
    return {
      ...conn,
      latest_balance: latestBalance || null,
    };
  });

  // Compute aggregate metrics from connected accounts
  const connectedAccounts = enriched.filter((a) => a.status === 'connected' && a.latest_balance);
  let totalBalance = 0;
  let totalAvailableCredit = 0;
  let totalCashOnHand = 0;

  for (const acct of connectedAccounts) {
    const bal = acct.latest_balance;
    const current = bal.current_balance ?? 0;
    const available = bal.available_balance ?? 0;
    const subtype = (acct.account_subtype || '').toLowerCase();

    totalBalance += current;

    if (subtype === 'credit_card' || subtype === 'credit') {
      // For credit cards, available_balance is remaining credit limit
      totalAvailableCredit += available;
    } else {
      // checking, savings = cash on hand
      totalCashOnHand += current;
    }
  }

  return ok({
    accounts: enriched,
    totalTransactions: txCountRes.count || 0,
    ledgerEntries,
    aggregates: {
      totalBalance,
      totalAvailableCredit,
      totalCashOnHand,
      accountCount: connectedAccounts.length,
    },
  });
}

/* ── Account update (nickname, notes) ── */

async function handleUpdateAccount(user, body) {
  const connectionId = body?.connectionId;
  if (!connectionId) return fail('Missing connectionId', 'ERR_VALIDATION', 400);

  const updates = {};
  if (body.nickname !== undefined) updates.nickname = body.nickname || null;
  if (body.user_notes !== undefined) updates.user_notes = body.user_notes || null;
  if (body.website_url !== undefined) updates.website_url = body.website_url || null;

  if (Object.keys(updates).length === 0) return fail('Nothing to update', 'ERR_VALIDATION', 400);

  const { error } = await supabase
    .from('financial_connections')
    .update(updates)
    .eq('id', connectionId)
    .eq('user_id', user.id);

  if (error) return fail('Failed to update account: ' + error.message, 'ERR_DB', 500);
  return ok({ updated: true });
}

/* ── Ledger entries ── */

async function handleCreateLedgerEntry(user, body) {
  const { title, amount, direction, due_date, recurrence, category, notes, connection_id } = body || {};
  if (!title || amount == null || !direction || !due_date) {
    return fail('Missing required fields: title, amount, direction, due_date', 'ERR_VALIDATION', 400);
  }
  if (!['inflow', 'outflow'].includes(direction)) return fail('direction must be inflow or outflow', 'ERR_VALIDATION', 400);

  const { data, error } = await supabase
    .from('ledger_entries')
    .insert({
      user_id: user.id,
      connection_id: connection_id || null,
      title,
      amount: Math.abs(Number(amount)),
      direction,
      due_date,
      recurrence: recurrence || 'once',
      category: category || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return fail('Failed to create ledger entry: ' + error.message, 'ERR_DB', 500);
  return ok(data);
}

async function handleUpdateLedgerEntry(user, body) {
  const entryId = body?.entryId;
  if (!entryId) return fail('Missing entryId', 'ERR_VALIDATION', 400);

  const allowed = ['title', 'amount', 'direction', 'due_date', 'recurrence', 'category', 'notes', 'status', 'connection_id'];
  const updates = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }
  if (updates.amount != null) updates.amount = Math.abs(Number(updates.amount));
  if (updates.status === 'completed') updates.completed_at = new Date().toISOString();

  if (Object.keys(updates).length === 0) return fail('Nothing to update', 'ERR_VALIDATION', 400);

  const { data, error } = await supabase
    .from('ledger_entries')
    .update(updates)
    .eq('id', entryId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return fail('Failed to update ledger entry: ' + error.message, 'ERR_DB', 500);
  return ok(data);
}

async function handleDeleteLedgerEntry(user, body) {
  const entryId = body?.entryId;
  if (!entryId) return fail('Missing entryId', 'ERR_VALIDATION', 400);

  const { error } = await supabase
    .from('ledger_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', user.id);

  if (error) return fail('Failed to delete ledger entry: ' + error.message, 'ERR_DB', 500);
  return ok({ deleted: true });
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
    if (action === 'sync_transactions') return handleSyncTransactions(user);
    if (action === 'update_account') return handleUpdateAccount(user, body);
    if (action === 'disconnect_account') return handleDisconnectAccount(user, body);
    if (action === 'remove_account') return handleRemoveAccount(user, body);
    if (action === 'create_ledger_entry') return handleCreateLedgerEntry(user, body);
    if (action === 'update_ledger_entry') return handleUpdateLedgerEntry(user, body);
    if (action === 'delete_ledger_entry') return handleDeleteLedgerEntry(user, body);

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
