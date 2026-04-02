import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox').toLowerCase();

const plaidConfigured = Boolean(PLAID_CLIENT_ID && PLAID_SECRET);

let plaidClient = null;

function getPlaidClient() {
  if (!plaidConfigured) {
    throw new Error('Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.');
  }
  if (plaidClient) return plaidClient;

  const environment = PlaidEnvironments[PLAID_ENV] || PlaidEnvironments.sandbox;
  const config = new Configuration({
    basePath: environment,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  });

  plaidClient = new PlaidApi(config);
  return plaidClient;
}

function getAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadSummary(userId) {
  const [connectionsRes, accountsRes, txRes, stripeBalancesRes, stripeTxRes] = await Promise.all([
    supabase
      .from('financial_connections')
      .select('id, provider, institution_name, status, last_sync_at, error_message')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('financial_accounts')
      .select('id, connection_id, name, official_name, mask, type, subtype, current_balance, available_balance, iso_currency_code')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('financial_transactions')
      .select('id, account_id, name, merchant_name, amount, iso_currency_code, category, pending, transaction_date')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(50),
    // Stripe FC: latest balance per connection (distinct on connection_id, ordered by as_of desc)
    supabase
      .from('account_balance_snapshots')
      .select('connection_id, current_balance, available_balance, currency, as_of')
      .eq('user_id', userId)
      .order('as_of', { ascending: false }),
    // Stripe FC: normalized transactions from the last 90 days
    supabase
      .from('normalized_transactions')
      .select('id, connection_id, amount, direction, description, merchant_name, category, status, transaction_date')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(500),
  ]);

  const connections = connectionsRes.data || [];
  const plaidAccounts = accountsRes.data || [];
  const plaidTransactions = txRes.data || [];

  // Deduplicate Stripe balance snapshots: keep latest per connection_id
  const stripeBalanceMap = new Map();
  for (const snap of (stripeBalancesRes.data || [])) {
    if (!stripeBalanceMap.has(snap.connection_id)) {
      stripeBalanceMap.set(snap.connection_id, snap);
    }
  }

  // Convert Stripe balances to the same shape as Plaid accounts for pulse calculation
  const stripeAccountsForPulse = [...stripeBalanceMap.values()].map(snap => ({
    current_balance: snap.current_balance,
    available_balance: snap.available_balance,
  }));

  // Convert Stripe normalized transactions to the shape pulse expects
  // Stripe normalized_transactions stores amount as positive + direction (inflow/outflow)
  // Plaid convention: negative = income, positive = expense
  const stripeTxForPulse = (stripeTxRes.data || []).map(tx => ({
    transaction_date: tx.transaction_date,
    pending: tx.status === 'pending',
    amount: tx.direction === 'inflow' ? -toNumber(tx.amount) : toNumber(tx.amount),
    name: tx.description,
    merchant_name: tx.merchant_name,
    category: tx.category,
  }));

  // Merge both sources
  const allAccounts = [...plaidAccounts, ...stripeAccountsForPulse];
  const allTransactions = [...plaidTransactions, ...stripeTxForPulse];

  const pulse = buildHealthPulse({ accounts: allAccounts, transactions: allTransactions });
  return {
    configured: plaidConfigured,
    connected: connections.some((c) => c.status === 'connected'),
    connections,
    accounts: allAccounts,
    transactions: allTransactions,
    pulse,
  };
}

function buildHealthPulse({ accounts, transactions }) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const recent = (transactions || []).filter((tx) => {
    if (!tx.transaction_date || tx.pending) return false;
    return new Date(tx.transaction_date) >= thirtyDaysAgo;
  });

  const income30d = recent
    .filter((tx) => toNumber(tx.amount) < 0)
    .reduce((sum, tx) => sum + Math.abs(toNumber(tx.amount)), 0);

  const expenses30d = recent
    .filter((tx) => toNumber(tx.amount) > 0)
    .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

  const netCashFlow30d = income30d - expenses30d;
  const totalBalance = (accounts || []).reduce((sum, account) => sum + toNumber(account.current_balance), 0);
  const avgDailyExpenses = expenses30d / 30;
  const liquidityDays = avgDailyExpenses > 0 ? totalBalance / avgDailyExpenses : 999;
  const savingsRate = income30d > 0 ? netCashFlow30d / income30d : 0;

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        35 +
          Math.min(30, Math.max(-20, netCashFlow30d / 40)) +
          Math.min(25, Math.max(0, liquidityDays * 0.8)) +
          Math.min(10, Math.max(-10, savingsRate * 30))
      )
    )
  );

  const trend = netCashFlow30d >= 0 ? 'improving' : 'tightening';
  const narrative =
    score >= 75
      ? 'Financial posture looks strong. Keep contributions and spending discipline steady.'
      : score >= 55
        ? 'Overall stable, but there is room to improve monthly surplus and liquidity.'
        : 'Finances are under pressure. Focus on reducing discretionary spend and rebuilding cash runway.';

  return {
    score,
    trend,
    narrative,
    metrics: {
      income30d: Number(income30d.toFixed(2)),
      expenses30d: Number(expenses30d.toFixed(2)),
      netCashFlow30d: Number(netCashFlow30d.toFixed(2)),
      savingsRate: Number((savingsRate * 100).toFixed(1)),
      liquidityDays: Number(liquidityDays.toFixed(1)),
      totalBalance: Number(totalBalance.toFixed(2)),
    },
    lastEvaluatedAt: new Date().toISOString(),
  };
}

async function upsertAccounts({ userId, connectionId, accounts }) {
  if (!accounts || accounts.length === 0) return;

  const rows = accounts.map((account) => ({
    user_id: userId,
    connection_id: connectionId,
    account_id: account.account_id,
    name: account.name || null,
    official_name: account.official_name || null,
    mask: account.mask || null,
    type: account.type || null,
    subtype: account.subtype || null,
    current_balance: account.balances?.current ?? null,
    available_balance: account.balances?.available ?? null,
    iso_currency_code: account.balances?.iso_currency_code || null,
  }));

  await supabase
    .from('financial_accounts')
    .upsert(rows, { onConflict: 'connection_id,account_id' });
}

async function upsertTransactions({ userId, connectionId, added }) {
  if (!added || added.length === 0) return;

  const rows = added.map((tx) => ({
    user_id: userId,
    connection_id: connectionId,
    account_id: tx.account_id,
    provider_transaction_id: tx.transaction_id,
    name: tx.name || null,
    merchant_name: tx.merchant_name || null,
    amount: tx.amount,
    iso_currency_code: tx.iso_currency_code || null,
    category: tx.category || [],
    pending: Boolean(tx.pending),
    authorized_date: tx.authorized_date || null,
    transaction_date: tx.date || null,
    raw: tx,
  }));

  await supabase
    .from('financial_transactions')
    .upsert(rows, { onConflict: 'connection_id,provider_transaction_id' });
}

async function deleteTransactions({ connectionId, removed }) {
  if (!removed || removed.length === 0) return;
  const ids = removed.map((t) => t.transaction_id).filter(Boolean);
  if (ids.length === 0) return;

  await supabase
    .from('financial_transactions')
    .delete()
    .eq('connection_id', connectionId)
    .in('provider_transaction_id', ids);
}

async function syncPlaidConnection({ userId, connection }) {
  const client = getPlaidClient();

  let cursor = connection.cursor || null;
  let hasMore = true;

  while (hasMore) {
    const syncRes = await client.transactionsSync({
      access_token: connection.access_token,
      cursor,
      count: 100,
    });

    const added = syncRes.data.added || [];
    const modified = syncRes.data.modified || [];
    const removed = syncRes.data.removed || [];

    await Promise.all([
      upsertTransactions({ userId, connectionId: connection.id, added }),
      upsertTransactions({ userId, connectionId: connection.id, added: modified }),
      deleteTransactions({ connectionId: connection.id, removed }),
    ]);

    cursor = syncRes.data.next_cursor;
    hasMore = Boolean(syncRes.data.has_more);
  }

  const accountsRes = await client.accountsGet({
    access_token: connection.access_token,
  });

  await upsertAccounts({
    userId,
    connectionId: connection.id,
    accounts: accountsRes.data.accounts || [],
  });

  await supabase
    .from('financial_connections')
    .update({
      cursor,
      status: 'connected',
      error_message: null,
      last_sync_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
    .eq('user_id', userId);
}

async function handleCreateLinkToken(user) {
  if (!plaidConfigured) {
    return ok({
      configured: false,
      mode: 'demo',
      message: 'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to enable live bank linking.',
    });
  }

  const client = getPlaidClient();
  const response = await client.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: 'Vuk OS',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  });

  return ok({
    configured: true,
    mode: 'live',
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
  });
}

async function handleExchangePublicToken(user, body) {
  if (!plaidConfigured) {
    return fail('Plaid is not configured on the server.', 'ERR_CONFIG', 500);
  }

  const publicToken = body?.publicToken;
  if (!publicToken) {
    return fail('Missing required field: publicToken', 'ERR_VALIDATION', 400);
  }

  const client = getPlaidClient();
  const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });

  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const itemRes = await client.itemGet({ access_token: accessToken });
  const institutionId = itemRes.data.item?.institution_id || null;

  let institutionName = null;
  if (institutionId) {
    try {
      const institution = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = institution.data.institution?.name || null;
    } catch {
      institutionName = null;
    }
  }

  const { data: upserted, error } = await supabase
    .from('financial_connections')
    .upsert(
      {
        user_id: user.id,
        provider: 'plaid',
        item_id: itemId,
        access_token: accessToken,
        institution_name: institutionName,
        status: 'connected',
        error_message: null,
      },
      { onConflict: 'item_id' }
    )
    .select('id, user_id, access_token, cursor')
    .single();

  if (error || !upserted) {
    return fail('Failed to persist financial connection', 'ERR_DB', 500);
  }

  await syncPlaidConnection({
    userId: user.id,
    connection: upserted,
  });

  return ok(await loadSummary(user.id));
}

async function handleSync(user) {
  const { data: connections } = await supabase
    .from('financial_connections')
    .select('id, user_id, access_token, cursor, status')
    .eq('user_id', user.id)
    .eq('provider', 'plaid')
    .neq('status', 'disconnected');

  if (!connections || connections.length === 0) {
    return ok(await loadSummary(user.id));
  }

  for (const connection of connections) {
    try {
      await syncPlaidConnection({ userId: user.id, connection });
    } catch (error) {
      await supabase
        .from('financial_connections')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Sync failed',
        })
        .eq('id', connection.id)
        .eq('user_id', user.id);
    }
  }

  return ok(await loadSummary(user.id));
}

async function handleDisconnect(user, body) {
  const connectionId = body?.connectionId;

  let query = supabase
    .from('financial_connections')
    .update({ status: 'disconnected', error_message: null })
    .eq('user_id', user.id);

  if (connectionId) {
    query = query.eq('id', connectionId);
  }

  await query;
  return ok(await loadSummary(user.id));
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);

  try {
    if (event.httpMethod === 'GET') {
      return ok(await loadSummary(user.id));
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
    if (action === 'create_link_token') {
      return handleCreateLinkToken(user);
    }

    if (action === 'exchange_public_token') {
      return handleExchangePublicToken(user, body);
    }

    if (action === 'sync') {
      return handleSync(user);
    }

    if (action === 'disconnect') {
      return handleDisconnect(user, body);
    }

    return fail('Unknown action', 'ERR_VALIDATION', 400);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : 'Financial management request failed.',
      'ERR_FINANCE',
      500
    );
  }
}
