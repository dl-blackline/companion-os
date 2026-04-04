/**
 * transaction-manager.js — Unified transaction feed + categories + notes.
 *
 * GET                         → list transactions with filters
 * POST update_category        → set category on a transaction
 * POST update_notes           → set/remove notes on a transaction
 * POST list_categories        → get user's category catalog
 * POST create_category        → add custom category
 */
import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import { validatePayloadSize } from '../../lib/_security.js';

function getAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

async function resolveActor(token) {
  if (!token || !supabase) return null;
  try {
    const { data } = await supabase.auth.getUser(token);
    return data?.user || null;
  } catch {
    return null;
  }
}

/* ── System categories ── */

const SYSTEM_CATEGORIES = [
  { name: 'income', icon: 'TrendUp', color: '#34d399' },
  { name: 'investment_income', icon: 'ChartLineUp', color: '#6ee7b7' },
  { name: 'transfer', icon: 'ArrowsLeftRight', color: '#94a3b8' },
  { name: 'housing', icon: 'House', color: '#f59e0b' },
  { name: 'utilities', icon: 'Lightning', color: '#eab308' },
  { name: 'groceries', icon: 'ShoppingCart', color: '#22c55e' },
  { name: 'dining', icon: 'ForkKnife', color: '#f97316' },
  { name: 'fuel', icon: 'GasPump', color: '#ef4444' },
  { name: 'insurance', icon: 'ShieldCheck', color: '#8b5cf6' },
  { name: 'subscriptions', icon: 'Repeat', color: '#6366f1' },
  { name: 'shopping', icon: 'Bag', color: '#ec4899' },
  { name: 'healthcare', icon: 'FirstAid', color: '#f43f5e' },
  { name: 'fitness', icon: 'Barbell', color: '#14b8a6' },
  { name: 'education', icon: 'GraduationCap', color: '#3b82f6' },
  { name: 'auto_loan', icon: 'Car', color: '#a855f7' },
  { name: 'debt_payment', icon: 'CreditCard', color: '#e11d48' },
  { name: 'cash', icon: 'Money', color: '#64748b' },
  { name: 'taxes', icon: 'Receipt', color: '#dc2626' },
  { name: 'childcare', icon: 'Baby', color: '#f472b6' },
  { name: 'travel', icon: 'Airplane', color: '#0ea5e9' },
  { name: 'uncategorized', icon: 'Question', color: '#71717a' },
];

/* ── Queries ── */

async function handleGetTransactions(userId, queryParams) {
  let query = supabase
    .from('normalized_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false });

  // Filter by connection/account
  if (queryParams.connectionId) {
    query = query.eq('connection_id', queryParams.connectionId);
  }

  // Filter by institution
  if (queryParams.institution) {
    query = query.ilike('institution_name', `%${queryParams.institution}%`);
  }

  // Filter by category
  if (queryParams.category) {
    if (queryParams.category === 'uncategorized') {
      query = query.or('category.is.null,category.eq.uncategorized');
    } else {
      query = query.eq('category', queryParams.category);
    }
  }

  // Filter by user_category_override
  if (queryParams.userCategory) {
    query = query.eq('user_category_override', queryParams.userCategory);
  }

  // Date range
  if (queryParams.dateFrom) {
    query = query.gte('transaction_date', queryParams.dateFrom);
  }
  if (queryParams.dateTo) {
    query = query.lte('transaction_date', queryParams.dateTo);
  }

  // Amount range
  if (queryParams.amountMin) {
    query = query.gte('amount', Number(queryParams.amountMin));
  }
  if (queryParams.amountMax) {
    query = query.lte('amount', Number(queryParams.amountMax));
  }

  // Direction (inflow/outflow)
  if (queryParams.direction) {
    query = query.eq('direction', queryParams.direction);
  }

  // Notes presence
  if (queryParams.hasNotes === 'true') {
    query = query.not('notes', 'is', null).neq('notes', '');
  }

  // Text search — sanitize PostgREST metacharacters to prevent filter injection
  if (queryParams.search) {
    const safeTerm = queryParams.search.replace(/[,.()|%_]/g, "");
    if (safeTerm) {
      const term = `%${safeTerm}%`;
      query = query.or(`description.ilike.${term},merchant_name.ilike.${term}`);
    }
  }

  // Pagination
  const limit = Math.min(Number(queryParams.limit) || 50, 200);
  const offset = Number(queryParams.offset) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return fail(`Query failed: ${error.message}`, 'ERR_DB', 500);
  }

  const total = count ?? 0;

  return ok({
    transactions: data || [],
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
    },
  });
}

async function handleUpdateCategory(userId, body) {
  const { transactionId, category } = body;
  if (!transactionId) return fail('Missing transactionId', 'ERR_VALIDATION', 400);
  if (!category) return fail('Missing category', 'ERR_VALIDATION', 400);

  const { data, error } = await supabase
    .from('normalized_transactions')
    .update({ user_category_override: category })
    .eq('id', transactionId)
    .eq('user_id', userId)
    .select('id, category, user_category_override')
    .single();

  if (error || !data) return fail('Transaction not found', 'ERR_NOT_FOUND', 404);

  return ok({ transaction: data });
}

async function handleUpdateNotes(userId, body) {
  const { transactionId, notes } = body;
  if (!transactionId) return fail('Missing transactionId', 'ERR_VALIDATION', 400);

  // Allow empty string to clear notes
  const noteValue = typeof notes === 'string' ? (notes.trim() || null) : null;

  const { data, error } = await supabase
    .from('normalized_transactions')
    .update({ notes: noteValue })
    .eq('id', transactionId)
    .eq('user_id', userId)
    .select('id, notes')
    .single();

  if (error || !data) return fail('Transaction not found', 'ERR_NOT_FOUND', 404);

  return ok({ transaction: data });
}

async function handleListCategories(userId) {
  const { data: userCategories } = await supabase
    .from('transaction_categories')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  // Merge system categories with user custom categories
  const systemCats = SYSTEM_CATEGORIES.map((c) => ({
    ...c,
    is_system: true,
    user_id: userId,
  }));

  const custom = (userCategories || []).filter((c) => !c.is_system);

  return ok({
    categories: [...systemCats, ...custom],
  });
}

async function handleCreateCategory(userId, body) {
  const { name, icon, color } = body;
  if (!name || !name.trim()) return fail('Missing category name', 'ERR_VALIDATION', 400);

  const normalized = name.trim().toLowerCase().replace(/\s+/g, '_');

  // Check if it conflicts with system categories
  if (SYSTEM_CATEGORIES.some((c) => c.name === normalized)) {
    return fail('Cannot override a system category', 'ERR_VALIDATION', 400);
  }

  const { data, error } = await supabase
    .from('transaction_categories')
    .upsert(
      {
        user_id: userId,
        name: normalized,
        icon: icon || null,
        color: color || null,
        is_system: false,
      },
      { onConflict: 'user_id,name' },
    )
    .select()
    .single();

  if (error) return fail(`Failed to create category: ${error.message}`, 'ERR_DB', 500);

  return ok({ category: data });
}

/* ── Handler ── */

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);

  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      return await handleGetTransactions(user.id, params);
    }

    if (event.httpMethod !== 'POST') {
      return fail('Method not allowed', 'ERR_METHOD', 405);
    }

    const sizeCheck = validatePayloadSize(event.body);
    if (!sizeCheck.valid) return fail(sizeCheck.error, 'ERR_PAYLOAD_SIZE', 413);

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return fail('Invalid JSON body', 'ERR_VALIDATION', 400);
    }

    const action = body.action;

    if (action === 'update_category') return await handleUpdateCategory(user.id, body);
    if (action === 'update_notes') return await handleUpdateNotes(user.id, body);
    if (action === 'list_categories') return await handleListCategories(user.id);
    if (action === 'create_category') return await handleCreateCategory(user.id, body);

    return fail('Unknown action', 'ERR_VALIDATION', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transaction manager error.';
    return fail(message, 'ERR_TRANSACTION', 500);
  }
}
