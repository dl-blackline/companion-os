/**
 * Financial Scorecard — Premium scorecard computation, vehicle equity,
 * and next-step intelligence.
 *
 * POST actions:
 *   compute_scorecard — Compute full financial scorecard from all data sources
 *   upsert_vehicle    — Add or update a vehicle record
 *   delete_vehicle    — Remove a vehicle
 *   update_vehicle_value — Update estimated value and recompute equity
 *
 * GET — Returns latest scorecard, vehicles, and guided next actions.
 */

import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';

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

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function labelFromScore(score) {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'stable';
  if (score >= 45) return 'moderate';
  if (score >= 25) return 'under pressure';
  return 'needs attention';
}

// ── Scorecard Dimension Calculators ─────────────────────────────────────────

function computeLiquidity({ accounts, obligations, pulse }) {
  const totalBalance = toNumber(pulse?.metrics?.totalBalance ?? 0);
  const liquidityDays = toNumber(pulse?.metrics?.liquidityDays ?? 0);

  const unpaidObligations = obligations.filter((o) => o.status !== 'paid');
  const dueSoon = unpaidObligations.filter((o) => {
    if (!o.due_date) return false;
    const d = new Date(o.due_date);
    const now = new Date();
    const in14 = new Date(now);
    in14.setDate(now.getDate() + 14);
    return d >= now && d <= in14;
  });
  const nearTermLoad = dueSoon.reduce((s, o) => s + toNumber(o.amount_due || o.minimum_due), 0);
  const coverageRatio = nearTermLoad > 0 ? totalBalance / nearTermLoad : totalBalance > 0 ? 10 : 0;

  let score = 50;
  if (liquidityDays >= 90) score += 30;
  else if (liquidityDays >= 60) score += 20;
  else if (liquidityDays >= 30) score += 10;
  else if (liquidityDays < 14) score -= 20;

  if (coverageRatio >= 3) score += 15;
  else if (coverageRatio >= 1.5) score += 5;
  else if (coverageRatio < 1) score -= 15;

  if (totalBalance <= 0) score -= 10;

  return {
    score: clamp(Math.round(score), 0, 100),
    label: labelFromScore(clamp(Math.round(score), 0, 100)),
    detail: {
      totalBalance,
      liquidityDays: Math.round(liquidityDays),
      nearTermLoad,
      coverageRatio: Math.round(coverageRatio * 100) / 100,
      accountCount: accounts.length,
    },
  };
}

function computeBillPressure({ obligations }) {
  const now = new Date();
  const in7 = new Date(now); in7.setDate(now.getDate() + 7);
  const in14 = new Date(now); in14.setDate(now.getDate() + 14);

  const unpaid = obligations.filter((o) => o.status !== 'paid');
  const overdue = unpaid.filter((o) => o.due_date && new Date(o.due_date) < now);
  const dueSoon7 = unpaid.filter((o) => o.due_date && new Date(o.due_date) >= now && new Date(o.due_date) <= in7);
  const dueSoon14 = unpaid.filter((o) => o.due_date && new Date(o.due_date) >= now && new Date(o.due_date) <= in14);

  const overdueAmount = overdue.reduce((s, o) => s + toNumber(o.amount_due || o.minimum_due), 0);
  const recurringMonthly = unpaid.filter((o) => o.is_recurring).reduce((s, o) => s + toNumber(o.amount_due || o.minimum_due), 0);

  let score = 80;
  score -= overdue.length * 12;
  score -= Math.min(20, dueSoon7.length * 4);
  if (overdueAmount > 1000) score -= 10;
  if (dueSoon14.length >= 5) score -= 8;

  return {
    score: clamp(Math.round(score), 0, 100),
    label: labelFromScore(clamp(Math.round(score), 0, 100)),
    detail: {
      overdueCount: overdue.length,
      overdueAmount,
      dueSoon7Count: dueSoon7.length,
      dueSoon14Count: dueSoon14.length,
      recurringMonthlyBurden: recurringMonthly,
      totalObligations: unpaid.length,
    },
  };
}

function computeDebtPressure({ obligations, pulse }) {
  const creditObligations = obligations.filter(
    (o) => o.status !== 'paid' && toNumber(o.credit_limit) > 0
  );
  const totalBalances = creditObligations.reduce((s, o) => s + toNumber(o.current_balance), 0);
  const totalLimits = creditObligations.reduce((s, o) => s + toNumber(o.credit_limit), 0);
  const utilization = totalLimits > 0 ? (totalBalances / totalLimits) * 100 : 0;

  const totalMinimumDues = obligations
    .filter((o) => o.status !== 'paid')
    .reduce((s, o) => s + toNumber(o.minimum_due), 0);

  const income30d = toNumber(pulse?.metrics?.income30d ?? 0);
  const debtToIncomeRatio = income30d > 0 ? (totalMinimumDues / income30d) * 100 : 0;

  let score = 70;
  if (utilization > 75) score -= 25;
  else if (utilization > 50) score -= 12;
  else if (utilization > 30) score -= 5;
  else if (utilization <= 10) score += 15;

  if (debtToIncomeRatio > 40) score -= 15;
  else if (debtToIncomeRatio > 25) score -= 8;
  else if (debtToIncomeRatio < 10) score += 10;

  return {
    score: clamp(Math.round(score), 0, 100),
    label: labelFromScore(clamp(Math.round(score), 0, 100)),
    detail: {
      revolvingBalance: totalBalances,
      revolvingLimit: totalLimits,
      utilizationPercent: Math.round(utilization * 10) / 10,
      totalMinimumDues,
      debtToIncomePercent: Math.round(debtToIncomeRatio * 10) / 10,
      revolvingAccountCount: creditObligations.length,
    },
  };
}

function computeSavingsHealth({ goals }) {
  const activeGoals = goals.filter((g) => g.status === 'active');
  if (activeGoals.length === 0) {
    return {
      score: 40,
      label: 'incomplete visibility',
      detail: { activeGoals: 0, totalTarget: 0, totalSaved: 0, overallProgress: 0, note: 'No active savings goals configured.' },
    };
  }

  const totalTarget = activeGoals.reduce((s, g) => s + toNumber(g.target_amount), 0);
  const totalSaved = activeGoals.reduce((s, g) => s + toNumber(g.current_amount), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const now = new Date();
  let onTrack = 0;
  let behind = 0;
  for (const goal of activeGoals) {
    if (!goal.target_date) { onTrack++; continue; }
    const remaining = Math.max(0, toNumber(goal.target_amount) - toNumber(goal.current_amount));
    const monthly = toNumber(goal.monthly_contribution_target);
    if (remaining <= 0) { onTrack++; continue; }
    if (monthly <= 0) { behind++; continue; }
    const monthsNeeded = remaining / monthly;
    const monthsLeft = Math.max(0, (new Date(goal.target_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (monthsNeeded <= monthsLeft * 1.1) onTrack++;
    else behind++;
  }

  let score = 50;
  score += Math.min(20, (overallProgress / 100) * 20);
  score += (onTrack / activeGoals.length) * 20;
  score -= (behind / activeGoals.length) * 15;
  if (activeGoals.length >= 2) score += 5;

  return {
    score: clamp(Math.round(score), 0, 100),
    label: labelFromScore(clamp(Math.round(score), 0, 100)),
    detail: {
      activeGoals: activeGoals.length,
      totalTarget,
      totalSaved,
      overallProgress: Math.round(overallProgress * 10) / 10,
      goalsOnTrack: onTrack,
      goalsBehind: behind,
    },
  };
}

function computeOrganization({ obligations, decodedBills, goals, vehicles }) {
  const totalBills = decodedBills.length;
  const confirmed = decodedBills.filter((b) => b.review_status === 'confirmed' || b.review_status === 'merged').length;
  const pendingReview = decodedBills.filter((b) => b.review_status === 'pending_review').length;

  const recurringConfirmed = obligations.filter((o) => o.is_recurring).length;
  const hasGoals = goals.length > 0;
  const hasVehicles = vehicles.length > 0;

  let score = 30;
  if (totalBills > 0) score += 10;
  if (totalBills > 0 && pendingReview === 0) score += 15;
  else if (totalBills > 0) score += Math.max(0, 15 - pendingReview * 3);
  if (recurringConfirmed >= 3) score += 15;
  else if (recurringConfirmed >= 1) score += 8;
  if (hasGoals) score += 10;
  if (hasVehicles) score += 10;
  if (obligations.length >= 5) score += 10;

  return {
    score: clamp(Math.round(score), 0, 100),
    label: labelFromScore(clamp(Math.round(score), 0, 100)),
    detail: {
      decodedBillsTotal: totalBills,
      decodedBillsConfirmed: confirmed,
      pendingReview,
      recurringObligations: recurringConfirmed,
      totalObligations: obligations.length,
      hasSavingsGoals: hasGoals,
      hasVehicles,
    },
  };
}

function computeVehiclePosition({ vehicles }) {
  const active = vehicles.filter((v) => v.status === 'active');
  if (active.length === 0) {
    return {
      score: 50,
      label: 'incomplete visibility',
      detail: { vehicleCount: 0, note: 'No vehicles tracked.' },
    };
  }

  const totalEquity = active.reduce((s, v) => s + toNumber(v.equity_position), 0);
  const totalPayment = active.reduce((s, v) => s + toNumber(v.monthly_payment), 0);
  const negativeCount = active.filter((v) => toNumber(v.equity_position) < 0).length;

  let score = 60;
  if (totalEquity > 0) score += 20;
  else if (totalEquity < -5000) score -= 20;
  else if (totalEquity < 0) score -= 10;

  if (negativeCount === 0) score += 10;
  else score -= negativeCount * 8;

  if (totalPayment > 1500) score -= 10;
  else if (totalPayment > 800) score -= 5;
  else if (totalPayment === 0) score += 10;

  return {
    score: clamp(Math.round(score), 0, 100),
    label: labelFromScore(clamp(Math.round(score), 0, 100)),
    detail: {
      vehicleCount: active.length,
      totalEquity,
      totalMonthlyPayment: totalPayment,
      negativeEquityCount: negativeCount,
      vehicles: active.map((v) => ({
        id: v.id,
        label: `${v.year} ${v.make} ${v.model}${v.trim ? ' ' + v.trim : ''}`,
        equity: toNumber(v.equity_position),
        monthlyPayment: toNumber(v.monthly_payment),
        payoff: toNumber(v.current_payoff),
        value: toNumber(v.estimated_value),
      })),
    },
  };
}

// ── Next-Step Guidance ──────────────────────────────────────────────────────

function generateNextActions({ billPressure, organization, savings, vehicle, decodedBills, obligations }) {
  const actions = [];

  const pendingBills = decodedBills.filter((b) => b.review_status === 'pending_review');
  if (pendingBills.length > 0) {
    actions.push({
      type: 'review_bill',
      priority: 'high',
      title: `Review ${pendingBills.length} decoded bill${pendingBills.length > 1 ? 's' : ''}`,
      description: 'Confirm or edit extracted bill data to improve your financial picture.',
    });
  }

  if (billPressure.detail.overdueCount > 0) {
    actions.push({
      type: 'resolve_overdue',
      priority: 'critical',
      title: `Resolve ${billPressure.detail.overdueCount} overdue obligation${billPressure.detail.overdueCount > 1 ? 's' : ''}`,
      description: 'Address overdue items to reduce financial pressure.',
    });
  }

  if (billPressure.detail.dueSoon7Count >= 3) {
    actions.push({
      type: 'review_upcoming',
      priority: 'high',
      title: 'Review high-pressure upcoming week',
      description: `${billPressure.detail.dueSoon7Count} obligations due within 7 days.`,
    });
  }

  if (organization.detail.recurringObligations < 2) {
    actions.push({
      type: 'mark_recurring',
      priority: 'medium',
      title: 'Identify recurring obligations',
      description: 'Mark known recurring bills to improve cash flow awareness.',
    });
  }

  if (!organization.detail.hasSavingsGoals) {
    actions.push({
      type: 'create_goal',
      priority: 'medium',
      title: 'Create a savings goal',
      description: 'Set a target to track savings progress and improve financial health.',
    });
  }

  if (!organization.detail.hasVehicles) {
    actions.push({
      type: 'add_vehicle',
      priority: 'low',
      title: 'Add vehicle information',
      description: 'Track vehicle equity to complete your financial picture.',
    });
  }

  if (organization.detail.decodedBillsTotal < 3) {
    actions.push({
      type: 'upload_bill',
      priority: 'medium',
      title: 'Upload another statement or bill',
      description: 'Improve financial completeness by decoding more bills.',
    });
  }

  if (savings.detail.goalsBehind > 0) {
    actions.push({
      type: 'adjust_goal',
      priority: 'medium',
      title: 'Review savings goal pace',
      description: `${savings.detail.goalsBehind} goal${savings.detail.goalsBehind > 1 ? 's are' : ' is'} behind target pace.`,
    });
  }

  return actions.sort((a, b) => {
    const pri = { critical: 0, high: 1, medium: 2, low: 3 };
    return (pri[a.priority] ?? 4) - (pri[b.priority] ?? 4);
  });
}

// ── Insights Generation ─────────────────────────────────────────────────────

function generateScorecardInsights({ liquidity, billPressure, debtPressure, savings, organization, vehicle }) {
  const insights = [];

  if (billPressure.detail.dueSoon14Count >= 4) {
    insights.push({
      type: 'obligation_load',
      severity: 'high',
      message: `Upcoming 14-day obligation load appears heavy with ${billPressure.detail.dueSoon14Count} items due.`,
    });
  }

  if (billPressure.detail.overdueCount > 0) {
    insights.push({
      type: 'overdue_pressure',
      severity: 'high',
      message: `${billPressure.detail.overdueCount} bill${billPressure.detail.overdueCount > 1 ? 's' : ''} may be overdue or under pressure.`,
    });
  }

  if (debtPressure.detail.utilizationPercent > 75) {
    insights.push({
      type: 'utilization',
      severity: 'medium',
      message: `Revolving utilization at ${debtPressure.detail.utilizationPercent}% — elevated minimum payment burden.`,
    });
  }

  if (organization.score < 45) {
    insights.push({
      type: 'visibility',
      severity: 'medium',
      message: 'Current financial visibility is incomplete. Confirm decoded bills and add recurring obligations to improve accuracy.',
    });
  }

  const negVehicles = (vehicle.detail.vehicles || []).filter((v) => v.equity < 0);
  if (negVehicles.length > 0) {
    insights.push({
      type: 'negative_equity',
      severity: 'medium',
      message: `${negVehicles.length} vehicle${negVehicles.length > 1 ? 's appear' : ' appears'} to be in negative equity.`,
    });
  }

  if (savings.detail.goalsBehind > 0) {
    insights.push({
      type: 'savings_pace',
      severity: 'low',
      message: 'Savings pace is behind target on one or more goals.',
    });
  }

  if (liquidity.score >= 70) {
    insights.push({
      type: 'liquidity_strength',
      severity: 'positive',
      message: 'Short-term liquidity appears strong.',
    });
  } else if (liquidity.score < 40) {
    insights.push({
      type: 'liquidity_pressure',
      severity: 'high',
      message: 'Short-term liquidity appears pressured relative to near-term obligations.',
    });
  }

  if (debtPressure.detail.debtToIncomePercent > 35) {
    insights.push({
      type: 'debt_income',
      severity: 'medium',
      message: `Minimum payment burden at ${debtPressure.detail.debtToIncomePercent}% of monthly income appears elevated.`,
    });
  }

  return insights;
}

// ── Compute Full Scorecard ──────────────────────────────────────────────────

async function computeScorecard(userId) {
  const [
    { data: accounts },
    { data: obligations },
    { data: goals },
    { data: vehicles },
    { data: decodedBills },
    { data: incomeSignals },
  ] = await Promise.all([
    supabase.from('financial_accounts').select('*').eq('user_id', userId),
    supabase.from('financial_obligations').select('*').eq('user_id', userId),
    supabase.from('financial_savings_goals').select('*').eq('user_id', userId),
    supabase.from('user_vehicles').select('*').eq('user_id', userId),
    supabase.from('decoded_bills').select('*').eq('user_id', userId),
    supabase.from('recurring_income_signals').select('*').eq('user_id', userId).eq('status', 'active'),
  ]);

  // Build a pseudo-pulse from income signals if no accounts linked
  const estimatedIncome = (incomeSignals || [])
    .filter((s) => s.is_user_confirmed)
    .reduce((sum, s) => sum + toNumber(s.estimated_amount), 0);

  const totalBalance = (accounts || []).reduce((s, a) => s + toNumber(a.current_balance), 0);
  const expenses30d = (obligations || [])
    .filter((o) => o.status !== 'paid')
    .reduce((s, o) => s + toNumber(o.minimum_due || o.amount_due), 0);

  const pulse = {
    metrics: {
      totalBalance,
      income30d: estimatedIncome || expenses30d * 1.2,
      expenses30d,
      liquidityDays: expenses30d > 0 ? (totalBalance / (expenses30d / 30)) : totalBalance > 0 ? 180 : 0,
    },
  };

  const liquidity = computeLiquidity({ accounts: accounts || [], obligations: obligations || [], pulse });
  const billPressure = computeBillPressure({ obligations: obligations || [] });
  const debtPressure = computeDebtPressure({ obligations: obligations || [], pulse });
  const savingsHealth = computeSavingsHealth({ goals: goals || [] });
  const organization = computeOrganization({
    obligations: obligations || [],
    decodedBills: decodedBills || [],
    goals: goals || [],
    vehicles: vehicles || [],
  });
  const vehiclePosition = computeVehiclePosition({ vehicles: vehicles || [] });

  const dimensions = [
    { name: 'liquidity', ...liquidity },
    { name: 'bill_pressure', ...billPressure },
    { name: 'debt_pressure', ...debtPressure },
    { name: 'savings_health', ...savingsHealth },
    { name: 'organization', ...organization },
    { name: 'vehicle_position', ...vehiclePosition },
  ];

  const weights = { liquidity: 0.2, bill_pressure: 0.2, debt_pressure: 0.2, savings_health: 0.15, organization: 0.1, vehicle_position: 0.15 };
  const overall = Math.round(dimensions.reduce((s, d) => s + d.score * (weights[d.name] || 0.16), 0));

  const strongest = dimensions.reduce((best, d) => d.score > best.score ? d : best, dimensions[0]);
  const mostUrgent = dimensions.reduce((worst, d) => d.score < worst.score ? d : worst, dimensions[0]);

  const nextActions = generateNextActions({
    billPressure,
    organization,
    savings: savingsHealth,
    vehicle: vehiclePosition,
    decodedBills: decodedBills || [],
    obligations: obligations || [],
  });

  const insights = generateScorecardInsights({
    liquidity, billPressure, debtPressure, savings: savingsHealth, organization, vehicle: vehiclePosition,
  });

  const snapshot = {
    user_id: userId,
    liquidity_score: liquidity.score,
    liquidity_label: liquidity.label,
    liquidity_detail: liquidity.detail,
    bill_pressure_score: billPressure.score,
    bill_pressure_label: billPressure.label,
    bill_pressure_detail: billPressure.detail,
    debt_pressure_score: debtPressure.score,
    debt_pressure_label: debtPressure.label,
    debt_pressure_detail: debtPressure.detail,
    savings_health_score: savingsHealth.score,
    savings_health_label: savingsHealth.label,
    savings_health_detail: savingsHealth.detail,
    organization_score: organization.score,
    organization_label: organization.label,
    organization_detail: organization.detail,
    vehicle_position_score: vehiclePosition.score,
    vehicle_position_label: vehiclePosition.label,
    vehicle_position_detail: vehiclePosition.detail,
    overall_score: overall,
    overall_label: labelFromScore(overall),
    strongest_area: strongest.name,
    most_urgent_area: mostUrgent.name,
    next_actions: nextActions,
    insights,
  };

  await supabase
    .from('financial_scorecard_snapshots')
    .insert(snapshot);

  return { scorecard: { ...snapshot, id: undefined }, vehicles: vehicles || [] };
}

// ── Vehicle CRUD ────────────────────────────────────────────────────────────

async function upsertVehicle({ user, body }) {
  const id = body?.id;
  const year = toNumber(body?.year);
  const make = (body?.make || '').trim();
  const model = (body?.model || '').trim();

  if (!year || !make || !model) {
    return fail('Year, make, and model are required.', 'ERR_VALIDATION', 400);
  }

  const estimatedValue = toNumber(body?.estimatedValue ?? body?.estimated_value);
  const currentPayoff = toNumber(body?.currentPayoff ?? body?.current_payoff);
  const equity = estimatedValue - currentPayoff;

  const row = {
    user_id: user.id,
    year,
    make,
    model,
    trim: (body?.trim || '').trim() || null,
    mileage: body?.mileage ? toNumber(body.mileage) : null,
    condition: body?.condition || 'good',
    current_payoff: currentPayoff || null,
    monthly_payment: body?.monthlyPayment || body?.monthly_payment ? toNumber(body.monthlyPayment ?? body.monthly_payment) : null,
    lender: (body?.lender || '').trim() || null,
    term_remaining_months: body?.termRemainingMonths ?? body?.term_remaining_months ? toNumber(body.termRemainingMonths ?? body.term_remaining_months) : null,
    interest_rate: body?.interestRate ?? body?.interest_rate ? toNumber(body.interestRate ?? body.interest_rate) : null,
    estimated_value: estimatedValue || null,
    value_source: body?.valueSource || body?.value_source || 'user_estimate',
    value_as_of: body?.valueAsOf || body?.value_as_of || new Date().toISOString().slice(0, 10),
    equity_position: equity,
    status: body?.status || 'active',
    notes: (body?.notes || '').trim() || null,
  };

  let vehicle;
  if (id) {
    const { data, error } = await supabase
      .from('user_vehicles')
      .update(row)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) return fail('Failed to update vehicle.', 'ERR_DB', 500);
    vehicle = data;
  } else {
    const { data, error } = await supabase
      .from('user_vehicles')
      .insert(row)
      .select('*')
      .single();
    if (error) return fail('Failed to create vehicle.', 'ERR_DB', 500);
    vehicle = data;
  }

  // Snapshot equity
  if (vehicle) {
    await supabase
      .from('vehicle_equity_snapshots')
      .upsert({
        user_id: user.id,
        vehicle_id: vehicle.id,
        estimated_value: estimatedValue || null,
        payoff_balance: currentPayoff || null,
        equity_position: equity,
        value_source: row.value_source,
        snapshot_date: new Date().toISOString().slice(0, 10),
      }, { onConflict: 'vehicle_id,snapshot_date' });
  }

  return ok({ vehicle });
}

async function deleteVehicle({ user, body }) {
  const vehicleId = body?.vehicleId;
  if (!vehicleId) return fail('vehicleId is required.', 'ERR_VALIDATION', 400);

  await supabase
    .from('user_vehicles')
    .delete()
    .eq('id', vehicleId)
    .eq('user_id', user.id);

  return ok({ vehicleId, deleted: true });
}

// ── GET handler ────────────────────────────────────────────────────────────

async function loadDashboard(userId) {
  const [
    { data: scorecards },
    { data: vehicles },
    { data: equitySnapshots },
  ] = await Promise.all([
    supabase
      .from('financial_scorecard_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('computed_at', { ascending: false })
      .limit(1),
    supabase
      .from('user_vehicles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('vehicle_equity_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(50),
  ]);

  const latest = scorecards?.[0] || null;

  return {
    scorecard: latest,
    vehicles: vehicles || [],
    equitySnapshots: equitySnapshots || [],
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);

  if (event.httpMethod === 'GET') {
    const result = await loadDashboard(user.id);
    return ok(result);
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return fail('Invalid JSON.', 'ERR_PARSE', 400);
    }

    const action = body.action;
    switch (action) {
      case 'compute_scorecard':
        try {
          const result = await computeScorecard(user.id);
          return ok(result);
        } catch (err) {
          return fail(err instanceof Error ? err.message : 'Scorecard computation failed.', 'ERR_COMPUTE', 500);
        }
      case 'upsert_vehicle':
        return upsertVehicle({ user, body });
      case 'delete_vehicle':
        return deleteVehicle({ user, body });
      default:
        return fail(`Unknown action: ${action}`, 'ERR_UNKNOWN_ACTION', 400);
    }
  }

  return fail('Method not allowed.', 'ERR_METHOD', 405);
}
