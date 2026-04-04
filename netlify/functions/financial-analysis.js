import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import { validatePayloadSize } from '../../lib/_security.js';

// ─── Auth helpers (matches existing pattern) ────────────────
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

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ─── Income Signal Detection ────────────────────────────────
// Analyses transaction history to detect recurring income deposits

function detectIncomeSignals(transactions) {
  // Income transactions are negative amounts in Plaid convention (money in)
  const incomeTransactions = transactions
    .filter((tx) => toNumber(tx.amount) < 0 && !tx.pending && tx.transaction_date)
    .map((tx) => ({
      ...tx,
      absAmount: Math.abs(toNumber(tx.amount)),
      date: new Date(tx.transaction_date),
      source: tx.name || tx.merchant_name || 'Unknown',
    }))
    .sort((a, b) => a.date - b.date);

  if (incomeTransactions.length === 0) return [];

  // Group by normalized source name
  const sourceGroups = {};
  for (const tx of incomeTransactions) {
    const key = normalizeSourceName(tx.source);
    if (!sourceGroups[key]) sourceGroups[key] = [];
    sourceGroups[key].push(tx);
  }

  const signals = [];

  for (const [sourceName, txs] of Object.entries(sourceGroups)) {
    if (txs.length < 2) continue;

    const amounts = txs.map((t) => t.absAmount);
    const dates = txs.map((t) => t.date);
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const amountVariance = Math.sqrt(
      amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / amounts.length
    );

    // Detect frequency from intervals between deposits
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      const daysDiff = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      if (daysDiff > 0) intervals.push(daysDiff);
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length;
    const frequency = classifyFrequency(avgInterval);
    const confidence = computeIncomeConfidence({ txs, avgAmount, amountVariance, avgInterval, intervals });

    // Only report signals with minimum confidence
    if (confidence < 0.3) continue;

    const lastDate = dates[dates.length - 1];
    const nextExpected = estimateNextDate(lastDate, frequency);

    const estimatedMonthly = estimateMonthlyAmount(avgAmount, frequency);

    signals.push({
      signal_name: sourceName,
      detected_source: txs[0].source,
      frequency,
      estimated_amount: Number(avgAmount.toFixed(2)),
      amount_variance: Number(amountVariance.toFixed(2)),
      confidence_score: Number(confidence.toFixed(3)),
      last_occurrence: lastDate.toISOString().slice(0, 10),
      next_expected: nextExpected ? nextExpected.toISOString().slice(0, 10) : null,
      occurrence_count: txs.length,
      sample_transaction_ids: txs.slice(-5).map((t) => t.id),
      estimated_monthly: Number(estimatedMonthly.toFixed(2)),
    });
  }

  return signals.sort((a, b) => b.estimated_monthly - a.estimated_monthly);
}

function normalizeSourceName(name) {
  return (name || 'Unknown')
    .replace(/[0-9]{4,}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/#\d+/g, '')
    .trim()
    .toLowerCase()
    .slice(0, 60);
}

function classifyFrequency(avgDays) {
  if (avgDays <= 9) return 'weekly';
  if (avgDays <= 17) return 'biweekly';
  if (avgDays <= 19) return 'semi_monthly';
  if (avgDays <= 35) return 'monthly';
  return 'irregular';
}

function computeIncomeConfidence({ txs, avgAmount, amountVariance, avgInterval, intervals }) {
  let score = 0.4; // base

  // Consistency bonus: more occurrences = higher confidence
  if (txs.length >= 6) score += 0.2;
  else if (txs.length >= 4) score += 0.15;
  else if (txs.length >= 3) score += 0.1;

  // Amount consistency: low variance relative to mean = higher confidence
  const cv = avgAmount > 0 ? amountVariance / avgAmount : 1;
  if (cv < 0.05) score += 0.2;
  else if (cv < 0.15) score += 0.15;
  else if (cv < 0.3) score += 0.1;
  else score -= 0.1;

  // Interval consistency
  const intervalVariance = intervals.length > 1
    ? Math.sqrt(intervals.reduce((s, i) => s + Math.pow(i - avgInterval, 2), 0) / intervals.length)
    : 0;
  if (intervalVariance < 2) score += 0.15;
  else if (intervalVariance < 5) score += 0.1;
  else score -= 0.1;

  // Size bonus: larger amounts more likely to be real income
  if (avgAmount >= 500) score += 0.05;
  if (avgAmount >= 1500) score += 0.05;

  return Math.max(0, Math.min(1, score));
}

function estimateNextDate(lastDate, frequency) {
  const d = new Date(lastDate);
  switch (frequency) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'semi_monthly': d.setDate(d.getDate() + 15); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return d;
}

function estimateMonthlyAmount(avgAmount, frequency) {
  switch (frequency) {
    case 'weekly': return avgAmount * (52 / 12);
    case 'biweekly': return avgAmount * (26 / 12);
    case 'semi_monthly': return avgAmount * 2;
    case 'monthly': return avgAmount;
    default: return avgAmount;
  }
}

// ─── Recurring Expense Detection ────────────────────────────

function detectRecurringExpenses(transactions) {
  // Expense transactions are positive amounts in Plaid convention (money out)
  const expenses = transactions
    .filter((tx) => toNumber(tx.amount) > 0 && !tx.pending && tx.transaction_date)
    .map((tx) => ({
      ...tx,
      absAmount: toNumber(tx.amount),
      date: new Date(tx.transaction_date),
      source: tx.merchant_name || tx.name || 'Unknown',
    }))
    .sort((a, b) => a.date - b.date);

  if (expenses.length === 0) return [];

  const merchantGroups = {};
  for (const tx of expenses) {
    const key = normalizeSourceName(tx.source);
    if (!merchantGroups[key]) merchantGroups[key] = [];
    merchantGroups[key].push(tx);
  }

  const signals = [];

  for (const [merchantKey, txs] of Object.entries(merchantGroups)) {
    if (txs.length < 2) continue;

    const amounts = txs.map((t) => t.absAmount);
    const dates = txs.map((t) => t.date);
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const amountVariance = Math.sqrt(
      amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / amounts.length
    );

    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      const daysDiff = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      if (daysDiff > 0) intervals.push(daysDiff);
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length;
    const frequency = classifyExpenseFrequency(avgInterval);
    const confidence = computeExpenseConfidence({ txs, avgAmount, amountVariance, avgInterval, intervals });

    if (confidence < 0.35) continue;

    const lastDate = dates[dates.length - 1];
    const nextExpected = estimateNextDate(lastDate, frequency);
    const category = inferExpenseCategory(txs[0].source, txs[0].category);

    signals.push({
      signal_name: merchantKey,
      merchant_name: txs[0].source,
      category,
      frequency,
      estimated_amount: Number(avgAmount.toFixed(2)),
      amount_variance: Number(amountVariance.toFixed(2)),
      confidence_score: Number(confidence.toFixed(3)),
      last_occurrence: lastDate.toISOString().slice(0, 10),
      next_expected: nextExpected ? nextExpected.toISOString().slice(0, 10) : null,
      occurrence_count: txs.length,
      sample_transaction_ids: txs.slice(-5).map((t) => t.id),
    });
  }

  return signals.sort((a, b) => b.estimated_amount - a.estimated_amount);
}

function classifyExpenseFrequency(avgDays) {
  if (avgDays <= 9) return 'weekly';
  if (avgDays <= 17) return 'biweekly';
  if (avgDays <= 19) return 'semi_monthly';
  if (avgDays <= 35) return 'monthly';
  if (avgDays <= 100) return 'quarterly';
  if (avgDays <= 380) return 'annual';
  return 'irregular';
}

function computeExpenseConfidence({ txs, avgAmount, amountVariance, avgInterval, intervals }) {
  let score = 0.35;

  if (txs.length >= 6) score += 0.2;
  else if (txs.length >= 4) score += 0.15;
  else if (txs.length >= 3) score += 0.1;

  const cv = avgAmount > 0 ? amountVariance / avgAmount : 1;
  if (cv < 0.05) score += 0.2;
  else if (cv < 0.15) score += 0.15;
  else if (cv < 0.3) score += 0.1;
  else score -= 0.1;

  const intervalVariance = intervals.length > 1
    ? Math.sqrt(intervals.reduce((s, i) => s + Math.pow(i - avgInterval, 2), 0) / intervals.length)
    : 0;
  if (intervalVariance < 3) score += 0.15;
  else if (intervalVariance < 7) score += 0.1;
  else score -= 0.1;

  return Math.max(0, Math.min(1, score));
}

function inferExpenseCategory(name, plaidCategories) {
  const n = (name || '').toLowerCase();
  const cats = (plaidCategories || []).join(' ').toLowerCase();

  if (n.includes('mortgage') || n.includes('home loan') || cats.includes('mortgage')) return 'rent_mortgage';
  if (n.includes('rent') || cats.includes('rent')) return 'rent_mortgage';
  if (n.includes('electric') || n.includes('gas company') || n.includes('water') || n.includes('power') || cats.includes('utilities')) return 'utility';
  if (n.includes('insurance') || cats.includes('insurance')) return 'insurance';
  if (n.includes('netflix') || n.includes('spotify') || n.includes('hulu') || n.includes('disney') || n.includes('apple.com/bill') || cats.includes('subscription')) return 'subscription';
  if (n.includes('loan') || n.includes('sallie mae') || n.includes('navient') || cats.includes('loan')) return 'loan';
  if (n.includes('credit card') || n.includes('capital one') || n.includes('chase') || n.includes('amex')) return 'credit_card';
  if (n.includes('transfer') || n.includes('xfer')) return 'transfer';
  return 'other';
}

// ─── Cash Flow Analysis ─────────────────────────────────────

function computeCashFlowSummary(transactions, periodStart, periodEnd) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const periodTxs = transactions.filter((tx) => {
    if (!tx.transaction_date || tx.pending) return false;
    const d = new Date(tx.transaction_date);
    return d >= start && d <= end;
  });

  const inflows = periodTxs.filter((tx) => toNumber(tx.amount) < 0);
  const outflows = periodTxs.filter((tx) => toNumber(tx.amount) > 0);

  const totalInflow = inflows.reduce((s, tx) => s + Math.abs(toNumber(tx.amount)), 0);
  const totalOutflow = outflows.reduce((s, tx) => s + toNumber(tx.amount), 0);

  // Category aggregation for outflows
  const categoryTotals = {};
  for (const tx of outflows) {
    const cat = inferExpenseCategory(tx.merchant_name || tx.name, tx.category);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + toNumber(tx.amount);
  }

  const topCategories = Object.entries(categoryTotals)
    .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const largestInflows = inflows
    .sort((a, b) => Math.abs(toNumber(b.amount)) - Math.abs(toNumber(a.amount)))
    .slice(0, 5)
    .map((tx) => ({
      name: tx.merchant_name || tx.name,
      amount: Number(Math.abs(toNumber(tx.amount)).toFixed(2)),
      date: tx.transaction_date,
    }));

  const largestOutflows = outflows
    .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
    .slice(0, 5)
    .map((tx) => ({
      name: tx.merchant_name || tx.name,
      amount: Number(toNumber(tx.amount).toFixed(2)),
      date: tx.transaction_date,
    }));

  return {
    period_start: periodStart,
    period_end: periodEnd,
    total_inflow: Number(totalInflow.toFixed(2)),
    total_outflow: Number(totalOutflow.toFixed(2)),
    net_flow: Number((totalInflow - totalOutflow).toFixed(2)),
    transaction_count: periodTxs.length,
    top_expense_categories: topCategories,
    largest_inflows: largestInflows,
    largest_outflows: largestOutflows,
  };
}

// ─── Savings Goal Feasibility ───────────────────────────────

function assessGoalFeasibility({ goal, monthlyIncome, monthlyExpenses, existingGoalsMonthlyTotal }) {
  const remaining = Math.max(0, toNumber(goal.target_amount) - toNumber(goal.current_amount));
  if (remaining <= 0) {
    return { feasibility_score: 1, pacing_status: 'ahead', feasibility_notes: 'Goal has been reached.', estimated_monthly_capacity: 0 };
  }

  const netSurplus = monthlyIncome - monthlyExpenses;
  const availableForGoals = Math.max(0, netSurplus * 0.7); // Reserve 30% buffer
  const capacityForThisGoal = Math.max(0, availableForGoals - existingGoalsMonthlyTotal + toNumber(goal.monthly_contribution_target));

  let pacing_status = 'unknown';
  let feasibility_score = 0.5;
  let feasibility_notes = '';

  const monthlyTarget = toNumber(goal.monthly_contribution_target);

  if (goal.target_date) {
    const now = new Date();
    const target = new Date(goal.target_date);
    const monthsLeft = Math.max(0.5, (target - now) / (1000 * 60 * 60 * 24 * 30));
    const requiredMonthly = remaining / monthsLeft;

    if (monthlyTarget >= requiredMonthly * 1.1) {
      pacing_status = 'ahead';
      feasibility_score = 0.9;
      feasibility_notes = `Current contribution pace exceeds what is needed. On track to meet goal.`;
    } else if (monthlyTarget >= requiredMonthly * 0.9) {
      pacing_status = 'on_track';
      feasibility_score = 0.75;
      feasibility_notes = `Current contribution pace is approximately aligned with goal timeline.`;
    } else if (monthlyTarget >= requiredMonthly * 0.6) {
      pacing_status = 'at_risk';
      feasibility_score = 0.5;
      feasibility_notes = `Current pace may fall short. Consider increasing contributions or adjusting timeline.`;
    } else {
      pacing_status = 'behind';
      feasibility_score = 0.25;
      feasibility_notes = `Significant gap between current pace and goal timeline. Realignment recommended.`;
    }

    if (capacityForThisGoal < requiredMonthly) {
      feasibility_score = Math.min(feasibility_score, 0.3);
      feasibility_notes += ' Available surplus may not support this contribution rate.';
    }
  } else if (monthlyTarget > 0) {
    if (capacityForThisGoal >= monthlyTarget) {
      pacing_status = 'on_track';
      feasibility_score = 0.7;
      feasibility_notes = 'Contributions appear sustainable given current cash flow.';
    } else {
      pacing_status = 'at_risk';
      feasibility_score = 0.4;
      feasibility_notes = 'Current cash flow may not comfortably support the planned contribution.';
    }
  }

  return {
    feasibility_score: Number(feasibility_score.toFixed(3)),
    pacing_status,
    feasibility_notes,
    estimated_monthly_capacity: Number(capacityForThisGoal.toFixed(2)),
  };
}

// ─── Backend Action Handlers ────────────────────────────────

async function runFullAnalysis(userId) {
  // 1. Load all transactions (up to 180 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);

  const { data: transactions } = await supabase
    .from('financial_transactions')
    .select('id, account_id, name, merchant_name, amount, iso_currency_code, category, pending, transaction_date')
    .eq('user_id', userId)
    .gte('transaction_date', cutoff.toISOString().slice(0, 10))
    .order('transaction_date', { ascending: true });

  const txs = transactions || [];

  // 2. Detect income signals
  const incomeSignals = detectIncomeSignals(txs);

  // Upsert income signals
  // Clear previous detected (non-confirmed) signals
  await supabase
    .from('recurring_income_signals')
    .delete()
    .eq('user_id', userId)
    .eq('is_user_confirmed', false);

  if (incomeSignals.length > 0) {
    const incomeRows = incomeSignals.map((s) => ({
      user_id: userId,
      signal_name: s.signal_name,
      detected_source: s.detected_source,
      frequency: s.frequency,
      estimated_amount: s.estimated_amount,
      amount_variance: s.amount_variance,
      confidence_score: s.confidence_score,
      last_occurrence: s.last_occurrence,
      next_expected: s.next_expected,
      occurrence_count: s.occurrence_count,
      sample_transaction_ids: s.sample_transaction_ids,
      status: 'detected',
    }));
    await supabase.from('recurring_income_signals').insert(incomeRows);
  }

  // 3. Detect recurring expenses
  const expenseSignals = detectRecurringExpenses(txs);

  await supabase
    .from('recurring_expense_signals')
    .delete()
    .eq('user_id', userId)
    .eq('is_user_confirmed', false);

  if (expenseSignals.length > 0) {
    const expenseRows = expenseSignals.map((s) => ({
      user_id: userId,
      signal_name: s.signal_name,
      merchant_name: s.merchant_name,
      category: s.category,
      frequency: s.frequency,
      estimated_amount: s.estimated_amount,
      amount_variance: s.amount_variance,
      confidence_score: s.confidence_score,
      last_occurrence: s.last_occurrence,
      next_expected: s.next_expected,
      occurrence_count: s.occurrence_count,
      sample_transaction_ids: s.sample_transaction_ids,
      status: 'detected',
    }));
    await supabase.from('recurring_expense_signals').insert(expenseRows);
  }

  // 4. Compute cash flow for current and previous month
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const currentFlow = computeCashFlowSummary(txs, currentMonthStart, currentMonthEnd);
  const prevFlow = computeCashFlowSummary(txs, prevMonthStart, prevMonthEnd);

  // Persist cash flow summaries
  for (const flow of [currentFlow, prevFlow]) {
    const label = new Date(flow.period_start).toLocaleString('en-US', { month: 'short', year: 'numeric' });
    await supabase
      .from('cash_flow_summaries')
      .upsert({
        user_id: userId,
        period_start: flow.period_start,
        period_end: flow.period_end,
        period_label: label,
        total_inflow: flow.total_inflow,
        total_outflow: flow.total_outflow,
        net_flow: flow.net_flow,
        transaction_count: flow.transaction_count,
        top_expense_categories: flow.top_expense_categories,
        largest_inflows: flow.largest_inflows,
        largest_outflows: flow.largest_outflows,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,period_start' });
  }

  // 5. Build income analysis snapshot
  const totalMonthlyIncome = incomeSignals.reduce((s, sig) => s + (sig.estimated_monthly || 0), 0);
  const primaryFrequency = incomeSignals.length > 0 ? incomeSignals[0].frequency : null;
  const avgConfidence = incomeSignals.length > 0
    ? incomeSignals.reduce((s, sig) => s + sig.confidence_score, 0) / incomeSignals.length
    : 0;

  const analysisWindow = { start: cutoff.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };

  await supabase.from('income_analysis_snapshots').insert({
    user_id: userId,
    estimated_monthly_income: Number(totalMonthlyIncome.toFixed(2)),
    detected_source_count: incomeSignals.length,
    primary_frequency: primaryFrequency,
    confidence_score: Number(avgConfidence.toFixed(3)),
    source_breakdown: incomeSignals.map((s) => ({
      source: s.detected_source,
      frequency: s.frequency,
      estimated_monthly: s.estimated_monthly,
      confidence: s.confidence_score,
    })),
    analysis_window_start: analysisWindow.start,
    analysis_window_end: analysisWindow.end,
    methodology: 'transaction_pattern',
  });

  // 6. Snapshot balances
  const { data: accounts } = await supabase
    .from('financial_accounts')
    .select('id, current_balance, available_balance, iso_currency_code')
    .eq('user_id', userId);

  if (accounts && accounts.length > 0) {
    const today = now.toISOString().slice(0, 10);
    const snapshotRows = accounts.map((a) => ({
      user_id: userId,
      account_id: a.id,
      current_balance: a.current_balance,
      available_balance: a.available_balance,
      iso_currency_code: a.iso_currency_code || 'USD',
      snapshot_date: today,
      source: 'sync',
    }));

    await supabase
      .from('account_balance_snapshots')
      .upsert(snapshotRows, { onConflict: 'account_id,snapshot_date' });
  }

  // 7. Assess savings goal feasibility
  const { data: goals } = await supabase
    .from('financial_savings_goals')
    .select('id, name, target_amount, current_amount, monthly_contribution_target, target_date, status')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (goals && goals.length > 0) {
    const monthlyExpenses = expenseSignals.reduce((s, sig) => s + estimateMonthlyAmount(sig.estimated_amount, sig.frequency), 0);
    const existingGoalsMonthlyTotal = goals.reduce((s, g) => s + toNumber(g.monthly_contribution_target), 0);

    for (const goal of goals) {
      const assessment = assessGoalFeasibility({
        goal,
        monthlyIncome: totalMonthlyIncome,
        monthlyExpenses,
        existingGoalsMonthlyTotal,
      });

      await supabase
        .from('financial_savings_goals')
        .update({
          feasibility_score: assessment.feasibility_score,
          pacing_status: assessment.pacing_status,
          feasibility_notes: assessment.feasibility_notes,
          estimated_monthly_capacity: assessment.estimated_monthly_capacity,
        })
        .eq('id', goal.id)
        .eq('user_id', userId);
    }
  }

  return { incomeSignals: incomeSignals.length, expenseSignals: expenseSignals.length };
}

async function loadAnalysisDashboard(userId) {
  const [incomeRes, expenseRes, cashFlowRes, incomeAnalysisRes, balanceRes, goalsRes] = await Promise.all([
    supabase
      .from('recurring_income_signals')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['detected', 'confirmed'])
      .order('estimated_amount', { ascending: false }),
    supabase
      .from('recurring_expense_signals')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['detected', 'confirmed'])
      .order('estimated_amount', { ascending: false }),
    supabase
      .from('cash_flow_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('period_start', { ascending: false })
      .limit(6),
    supabase
      .from('income_analysis_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('computed_at', { ascending: false })
      .limit(1),
    supabase
      .from('account_balance_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(30),
    supabase
      .from('financial_savings_goals')
      .select('id, name, target_amount, target_date, priority, current_amount, monthly_contribution_target, feasibility_score, pacing_status, feasibility_notes, estimated_monthly_capacity, status, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  const incomeSignals = incomeRes.data || [];
  const expenseSignals = expenseRes.data || [];
  const cashFlowPeriods = cashFlowRes.data || [];
  const latestIncomeAnalysis = incomeAnalysisRes.data?.[0] || null;
  const balanceSnapshots = balanceRes.data || [];
  const goals = goalsRes.data || [];

  // Compute summary totals
  const estimatedMonthlyIncome = latestIncomeAnalysis?.estimated_monthly_income || 0;
  const estimatedMonthlyExpenses = expenseSignals.reduce((s, sig) => {
    return s + estimateMonthlyAmount(toNumber(sig.estimated_amount), sig.frequency);
  }, 0);

  return {
    incomeSignals,
    expenseSignals,
    cashFlowPeriods,
    incomeAnalysis: latestIncomeAnalysis,
    balanceSnapshots,
    goals,
    summary: {
      estimatedMonthlyIncome: Number(estimatedMonthlyIncome.toFixed(2)),
      estimatedMonthlyExpenses: Number(estimatedMonthlyExpenses.toFixed(2)),
      estimatedMonthlySurplus: Number((estimatedMonthlyIncome - estimatedMonthlyExpenses).toFixed(2)),
      incomeSourceCount: incomeSignals.length,
      recurringExpenseCount: expenseSignals.length,
      incomeConfidence: latestIncomeAnalysis?.confidence_score || 0,
      lastAnalyzedAt: latestIncomeAnalysis?.computed_at || null,
    },
  };
}

async function confirmIncomeSignal(userId, body) {
  const signalId = body?.signalId;
  const userLabel = body?.userLabel || null;

  if (!signalId) return fail('Missing signalId', 'ERR_VALIDATION', 400);

  const { error } = await supabase
    .from('recurring_income_signals')
    .update({
      is_user_confirmed: true,
      user_label: userLabel,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', signalId)
    .eq('user_id', userId);

  if (error) return fail('Failed to confirm signal', 'ERR_DB', 500);
  return ok(await loadAnalysisDashboard(userId));
}

async function dismissSignal(userId, body) {
  const signalId = body?.signalId;
  const signalType = body?.signalType; // 'income' or 'expense'

  if (!signalId || !signalType) return fail('Missing signalId or signalType', 'ERR_VALIDATION', 400);

  const table = signalType === 'income' ? 'recurring_income_signals' : 'recurring_expense_signals';

  const { error } = await supabase
    .from(table)
    .update({ status: 'dismissed' })
    .eq('id', signalId)
    .eq('user_id', userId);

  if (error) return fail('Failed to dismiss signal', 'ERR_DB', 500);
  return ok(await loadAnalysisDashboard(userId));
}

async function confirmExpenseSignal(userId, body) {
  const signalId = body?.signalId;
  const userLabel = body?.userLabel || null;
  const linkToObligation = body?.linkToObligation || false;

  if (!signalId) return fail('Missing signalId', 'ERR_VALIDATION', 400);

  const updatePayload = {
    is_user_confirmed: true,
    user_label: userLabel,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  };

  // Optionally create an obligation from this signal
  if (linkToObligation) {
    const { data: signal } = await supabase
      .from('recurring_expense_signals')
      .select('*')
      .eq('id', signalId)
      .eq('user_id', userId)
      .single();

    if (signal) {
      const { data: obligation } = await supabase
        .from('financial_obligations')
        .insert({
          user_id: userId,
          account_label: userLabel || signal.signal_name,
          institution_name: signal.merchant_name,
          category: signal.category || 'bill',
          amount_due: signal.estimated_amount,
          minimum_due: signal.estimated_amount,
          due_date: signal.next_expected,
          status: 'planned',
          is_recurring: true,
          notes: `Auto-detected from transaction pattern. Frequency: ${signal.frequency}. Confidence: ${(signal.confidence_score * 100).toFixed(0)}%.`,
        })
        .select('id')
        .single();

      if (obligation) {
        updatePayload.linked_obligation_id = obligation.id;
      }
    }
  }

  const { error } = await supabase
    .from('recurring_expense_signals')
    .update(updatePayload)
    .eq('id', signalId)
    .eq('user_id', userId);

  if (error) return fail('Failed to confirm expense signal', 'ERR_DB', 500);
  return ok(await loadAnalysisDashboard(userId));
}

// ─── Handler ────────────────────────────────────────────────

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);

  try {
    if (event.httpMethod === 'GET') {
      return ok(await loadAnalysisDashboard(user.id));
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

    if (action === 'run_analysis') {
      const result = await runFullAnalysis(user.id);
      const dashboard = await loadAnalysisDashboard(user.id);
      return ok({ ...dashboard, analysisResult: result });
    }

    if (action === 'confirm_income_signal') {
      return await confirmIncomeSignal(user.id, body);
    }

    if (action === 'confirm_expense_signal') {
      return await confirmExpenseSignal(user.id, body);
    }

    if (action === 'dismiss_signal') {
      return await dismissSignal(user.id, body);
    }

    if (action === 'add_manual_income') {
      const sourceName = (body.sourceName || '').trim();
      const amount = toNumber(body.amount);
      const frequency = body.frequency || 'monthly';

      if (!sourceName || amount <= 0) {
        return fail('Source name and amount are required.', 'ERR_VALIDATION', 400);
      }

      const validFreq = ['weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'annual'];
      if (!validFreq.includes(frequency)) {
        return fail('Invalid frequency.', 'ERR_VALIDATION', 400);
      }

      const { error: insertErr } = await supabase
        .from('recurring_income_signals')
        .insert({
          user_id: user.id,
          signal_name: `Manual: ${sourceName}`,
          detected_source: sourceName,
          user_label: sourceName,
          frequency,
          estimated_amount: amount,
          amount_variance: 0,
          confidence_score: 1.0,
          occurrence_count: 1,
          is_user_confirmed: true,
          status: 'active',
          last_occurrence: new Date().toISOString().slice(0, 10),
        });
      if (insertErr) return fail('Failed to save manual income.', 'ERR_DB', 500);
      const dashboard = await loadAnalysisDashboard(user.id);
      return ok(dashboard);
    }

    if (action === 'add_manual_income') {
      const sourceName = (body.sourceName || '').trim();
      const amount = toNumber(body.amount);
      const frequency = body.frequency || 'monthly';

      if (!sourceName || amount <= 0) {
        return fail('Source name and amount are required.', 'ERR_VALIDATION', 400);
      }

      const validFreq = ['weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'annual'];
      if (!validFreq.includes(frequency)) {
        return fail('Invalid frequency.', 'ERR_VALIDATION', 400);
      }

      const { error: insertErr } = await supabase
        .from('recurring_income_signals')
        .insert({
          user_id: user.id,
          signal_name: `Manual: ${sourceName}`,
          detected_source: sourceName,
          user_label: sourceName,
          frequency,
          estimated_amount: amount,
          amount_variance: 0,
          confidence_score: 1.0,
          occurrence_count: 1,
          is_user_confirmed: true,
          status: 'active',
          last_occurrence: new Date().toISOString().slice(0, 10),
        });
      if (insertErr) return fail('Failed to save manual income.', 'ERR_DB', 500);
      const dashboard = await loadAnalysisDashboard(user.id);
      return ok(dashboard);
    }

    return fail('Unknown action', 'ERR_VALIDATION', 400);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : 'Financial analysis request failed.',
      'ERR_ANALYSIS',
      500
    );
  }
}
