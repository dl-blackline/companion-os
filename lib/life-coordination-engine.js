/**
 * Life Coordination Engine
 *
 * The synchronization layer that connects goals, finance, calendar, planning,
 * and obligations into one unified personal operating system.
 *
 * This module answers:
 * - Is a goal financially realistic?
 * - What should happen this month to stay on track?
 * - What upcoming obligations threaten this goal?
 * - Should this be broken into milestones?
 * - What is the next best action?
 * - What changes if income, bills, or calendar load shifts?
 */

import { supabase } from './_supabase.js';

/* ── Helpers ───────────────────────────────────────────────────── */

function daysBetween(a, b) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.ceil(ms / 86_400_000);
}

function monthsBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

function toISODate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/* ── Signal Emitter ────────────────────────────────────────────── */

async function emitSignal(userId, signal) {
  const { error } = await supabase.from('life_coordination_signals').insert({
    user_id: userId,
    signal_type: signal.type,
    source_system: signal.source,
    target_system: signal.target,
    severity: signal.severity || 'info',
    title: signal.title,
    summary: signal.summary || null,
    action_hint: signal.actionHint || null,
    related_goal_id: signal.goalId || null,
    related_financial_goal_id: signal.financialGoalId || null,
    related_obligation_id: signal.obligationId || null,
    related_calendar_event_id: signal.calendarEventId || null,
    payload: signal.payload || {},
    expires_at: signal.expiresAt || null,
  });
  if (error) console.error('[life-coord] signal emit failed:', error.message);
}

/* ── Goal → Finance Sync ──────────────────────────────────────── */

/**
 * When a user creates a financial goal (e.g. "Save $5,000 in 6 months"),
 * this function:
 * 1. Creates/updates a financial_savings_goal
 * 2. Calculates the required monthly pace
 * 3. Compares against available cash flow
 * 4. Generates calendar milestones
 * 5. Assesses feasibility
 * 6. Emits coordination signals
 */
export async function syncGoalToFinance(userId, goal) {
  const now = new Date();
  const targetDate = goal.target_date ? new Date(goal.target_date) : null;
  const targetAmount = Number(goal.target_amount) || 0;
  const currentAmount = Number(goal.current_amount) || 0;
  const remaining = targetAmount - currentAmount;

  // Calculate monthly pace
  let monthlyPace = null;
  let monthsRemaining = null;
  if (targetDate && remaining > 0) {
    monthsRemaining = Math.max(1, monthsBetween(now, targetDate));
    monthlyPace = Math.ceil((remaining / monthsRemaining) * 100) / 100;
  }

  // Upsert financial savings goal
  const savingsPayload = {
    user_id: userId,
    name: goal.title,
    target_amount: targetAmount,
    target_date: targetDate ? toISODate(targetDate) : null,
    priority: goal.priority || 'medium',
    current_amount: currentAmount,
    monthly_contribution_target: monthlyPace,
    linked_goal_id: goal.id,
    status: goal.status === 'completed' ? 'completed' : goal.status === 'paused' ? 'paused' : 'active',
    notes: goal.description || null,
  };

  let financialGoalId = goal.financial_goal_id;
  if (financialGoalId) {
    await supabase
      .from('financial_savings_goals')
      .update(savingsPayload)
      .eq('id', financialGoalId);
  } else {
    const { data } = await supabase
      .from('financial_savings_goals')
      .insert(savingsPayload)
      .select('id')
      .single();
    financialGoalId = data?.id || null;
  }

  // Link back to the goal
  if (financialGoalId) {
    await supabase
      .from('user_goals')
      .update({
        financial_goal_id: financialGoalId,
        monthly_pace: monthlyPace,
        last_coordinated_at: now.toISOString(),
      })
      .eq('id', goal.id);
  }

  // Emit signal
  await emitSignal(userId, {
    type: goal.financial_goal_id ? 'goal_financial_updated' : 'goal_financial_created',
    source: 'goals',
    target: 'finance',
    severity: 'info',
    title: `Financial goal synced: ${goal.title}`,
    summary: monthlyPace
      ? `Requires ${formatCurrency(monthlyPace)}/month over ${monthsRemaining} months to reach ${formatCurrency(targetAmount)}`
      : `Target: ${formatCurrency(targetAmount)}`,
    goalId: goal.id,
    financialGoalId,
    payload: { monthlyPace, monthsRemaining, remaining, targetAmount, currentAmount },
  });

  return { financialGoalId, monthlyPace, monthsRemaining };
}

/* ── Feasibility Assessment ───────────────────────────────────── */

/**
 * Evaluates whether a financial goal is realistic given the user's
 * actual cash flow, obligations, and existing savings commitments.
 */
export async function assessGoalFeasibility(userId, goalId) {
  // Load the goal
  const { data: goal } = await supabase
    .from('user_goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (!goal || !goal.is_financial || !goal.target_amount) {
    return { feasible: null, reason: 'Not a financial goal' };
  }

  const now = new Date();
  const targetDate = goal.target_date ? new Date(goal.target_date) : null;
  const remaining = (goal.target_amount || 0) - (goal.current_amount || 0);
  const monthsLeft = targetDate ? Math.max(1, monthsBetween(now, targetDate)) : 12;
  const requiredMonthly = remaining / monthsLeft;

  // Get recent financial pulse / cash flow data
  const { data: accounts } = await supabase
    .from('financial_accounts')
    .select('current_balance, available_balance')
    .eq('user_id', userId);

  const totalBalance = (accounts || []).reduce((sum, a) => sum + (a.current_balance || 0), 0);

  // Get upcoming obligations for the month
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const { data: obligations } = await supabase
    .from('financial_obligations')
    .select('amount_due, minimum_due, planned_payment')
    .eq('user_id', userId)
    .gte('due_date', toISODate(now))
    .lte('due_date', toISODate(monthEnd))
    .in('status', ['planned', 'overdue']);

  const monthlyObligations = (obligations || []).reduce(
    (sum, o) => sum + (o.planned_payment || o.minimum_due || o.amount_due || 0),
    0
  );

  // Get existing savings commitments
  const { data: otherGoals } = await supabase
    .from('financial_savings_goals')
    .select('monthly_contribution_target')
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('linked_goal_id', goalId);

  const existingSavings = (otherGoals || []).reduce(
    (sum, g) => sum + (g.monthly_contribution_target || 0),
    0
  );

  // Estimate available monthly surplus (rough: balance / 3 months - obligations - existing savings)
  const estimatedMonthlySurplus = Math.max(0, (totalBalance / 3) - monthlyObligations - existingSavings);

  let score;
  let label;
  let notes;

  if (requiredMonthly <= 0) {
    score = 100;
    label = 'achieved';
    notes = 'Goal already reached or exceeded.';
  } else if (estimatedMonthlySurplus >= requiredMonthly * 1.2) {
    score = 90;
    label = 'highly_feasible';
    notes = `Surplus of ${formatCurrency(estimatedMonthlySurplus)}/mo comfortably covers the ${formatCurrency(requiredMonthly)}/mo needed.`;
  } else if (estimatedMonthlySurplus >= requiredMonthly) {
    score = 70;
    label = 'feasible';
    notes = `Monthly surplus (${formatCurrency(estimatedMonthlySurplus)}) can cover the ${formatCurrency(requiredMonthly)}/mo pace, but it's tight.`;
  } else if (estimatedMonthlySurplus >= requiredMonthly * 0.6) {
    score = 45;
    label = 'at_risk';
    notes = `Surplus (${formatCurrency(estimatedMonthlySurplus)}/mo) falls short of required ${formatCurrency(requiredMonthly)}/mo. Consider extending timeline or reducing target.`;
  } else {
    score = 20;
    label = 'unrealistic';
    notes = `Available surplus (${formatCurrency(estimatedMonthlySurplus)}/mo) is well below the ${formatCurrency(requiredMonthly)}/mo needed. Major adjustments needed.`;
  }

  // Update goal with feasibility
  await supabase
    .from('user_goals')
    .update({
      feasibility_score: score,
      feasibility_notes: notes,
      last_coordinated_at: now.toISOString(),
    })
    .eq('id', goalId);

  // Emit signal if at risk or worse
  if (score < 70) {
    await emitSignal(userId, {
      type: score < 45 ? 'cash_flow_insufficient' : 'savings_pace_at_risk',
      source: 'coordination',
      target: 'all',
      severity: score < 45 ? 'high' : 'medium',
      title: score < 45
        ? `Goal "${goal.title}" may be unrealistic`
        : `Goal "${goal.title}" pace is at risk`,
      summary: notes,
      actionHint: score < 45
        ? 'Consider extending the timeline, reducing the target, or freeing cash by pausing lower-priority goals.'
        : 'Review obligations and see if any discretionary spending can shift toward this goal.',
      goalId: goal.id,
      financialGoalId: goal.financial_goal_id,
      payload: {
        feasibilityScore: score,
        label,
        requiredMonthly,
        estimatedMonthlySurplus,
        monthlyObligations,
        existingSavings,
        monthsLeft,
        remaining,
      },
    });
  }

  return { score, label, notes, requiredMonthly, estimatedMonthlySurplus, monthlyObligations };
}

/* ── Obligation → Goal Threat Detection ───────────────────────── */

/**
 * Detects when upcoming obligations conflict with savings goals.
 */
export async function detectObligationThreats(userId) {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 86_400_000);

  // Get upcoming obligations
  const { data: obligations } = await supabase
    .from('financial_obligations')
    .select('*')
    .eq('user_id', userId)
    .gte('due_date', toISODate(now))
    .lte('due_date', toISODate(twoWeeksOut))
    .in('status', ['planned', 'overdue']);

  const totalUpcoming = (obligations || []).reduce(
    (sum, o) => sum + (o.planned_payment || o.amount_due || 0),
    0
  );

  // Get active financial goals
  const { data: goals } = await supabase
    .from('user_goals')
    .select('id, title, monthly_pace, financial_goal_id')
    .eq('user_id', userId)
    .eq('is_financial', true)
    .eq('status', 'active');

  const totalGoalPace = (goals || []).reduce((sum, g) => sum + (g.monthly_pace || 0), 0);

  // Get balance
  const { data: accounts } = await supabase
    .from('financial_accounts')
    .select('current_balance')
    .eq('user_id', userId);

  const totalBalance = (accounts || []).reduce((sum, a) => sum + (a.current_balance || 0), 0);

  const threats = [];
  if (totalUpcoming > 0 && totalBalance > 0) {
    const afterObligations = totalBalance - totalUpcoming;
    if (afterObligations < totalGoalPace) {
      for (const goal of (goals || [])) {
        threats.push({
          goalId: goal.id,
          goalTitle: goal.title,
          monthlyPace: goal.monthly_pace,
          shortfall: totalGoalPace - afterObligations,
        });

        await emitSignal(userId, {
          type: 'obligation_threatens_goal',
          source: 'finance',
          target: 'goals',
          severity: 'medium',
          title: `Upcoming obligations may affect "${goal.title}"`,
          summary: `${formatCurrency(totalUpcoming)} in obligations due in the next 14 days. After paying these, available balance (${formatCurrency(afterObligations)}) may not cover the ${formatCurrency(goal.monthly_pace || 0)}/mo savings pace.`,
          actionHint: 'Consider timing the savings transfer after obligations clear, or adjusting the pace temporarily.',
          goalId: goal.id,
          financialGoalId: goal.financial_goal_id,
          payload: { totalUpcoming, afterObligations, monthlyPace: goal.monthly_pace },
        });
      }
    }
  }

  return threats;
}

/* ── Goal Milestones → Calendar ───────────────────────────────── */

/**
 * Creates calendar events for goal milestones and checkpoints.
 */
export async function syncGoalToCalendar(userId, goal) {
  if (!goal.target_date) return [];

  const now = new Date();
  const targetDate = new Date(goal.target_date);
  const months = monthsBetween(now, targetDate);

  if (months <= 0) return [];

  const events = [];

  // Create monthly checkpoint events
  const checkpointCount = Math.min(months, 12);
  const monthlyTarget = goal.is_financial
    ? (goal.target_amount - (goal.current_amount || 0)) / months
    : null;

  for (let i = 1; i <= checkpointCount; i++) {
    const checkDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    if (checkDate > targetDate) break;

    const eventPayload = {
      user_id: userId,
      title: `${goal.title} — ${goal.is_financial ? 'Savings' : 'Progress'} checkpoint`,
      event_type: goal.is_financial ? 'savings_transfer' : 'reminder',
      scheduled_date: toISODate(checkDate),
      amount: monthlyTarget,
      status: 'scheduled',
      notes: goal.is_financial
        ? `Monthly target: ${formatCurrency(monthlyTarget)}. Cumulative target: ${formatCurrency(monthlyTarget * i + (goal.current_amount || 0))}`
        : `Check progress on "${goal.title}" — month ${i} of ${months}`,
      linked_goal_id: goal.id,
      linked_milestone_title: `Month ${i} checkpoint`,
    };

    events.push(eventPayload);
  }

  // Create deadline event
  events.push({
    user_id: userId,
    title: `${goal.title} — Target deadline`,
    event_type: 'reminder',
    scheduled_date: toISODate(targetDate),
    amount: goal.is_financial ? goal.target_amount : null,
    status: 'scheduled',
    notes: `Goal deadline: ${goal.title}`,
    linked_goal_id: goal.id,
    linked_milestone_title: 'Final deadline',
  });

  // Delete old auto-generated events for this goal
  await supabase
    .from('financial_calendar_events')
    .delete()
    .eq('user_id', userId)
    .eq('linked_goal_id', goal.id);

  // Insert new events
  const { error } = await supabase
    .from('financial_calendar_events')
    .insert(events);

  if (error) console.error('[life-coord] calendar sync failed:', error.message);

  return events;
}

/* ── Life Plan Generation ─────────────────────────────────────── */

/**
 * Generates a unified life plan for a period (weekly/monthly).
 * Aggregates all active goals, financial state, obligations, and
 * calendar events into recommended actions.
 */
export async function generateLifePlan(userId, periodType = 'monthly') {
  const now = new Date();
  let periodStart, periodEnd;

  if (periodType === 'weekly') {
    const dayOfWeek = now.getDay();
    periodStart = new Date(now);
    periodStart.setDate(now.getDate() - dayOfWeek);
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // Load all active goals
  const { data: goals } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('priority', { ascending: false });

  // Load financial snapshot
  const { data: obligations } = await supabase
    .from('financial_obligations')
    .select('*')
    .eq('user_id', userId)
    .gte('due_date', toISODate(periodStart))
    .lte('due_date', toISODate(periodEnd))
    .in('status', ['planned', 'overdue']);

  const { data: savingsGoals } = await supabase
    .from('financial_savings_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  const { data: calendarEvents } = await supabase
    .from('financial_calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_date', toISODate(periodStart))
    .lte('scheduled_date', toISODate(periodEnd))
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true });

  const { data: accounts } = await supabase
    .from('financial_accounts')
    .select('current_balance, available_balance')
    .eq('user_id', userId);

  const totalBalance = (accounts || []).reduce((sum, a) => sum + (a.current_balance || 0), 0);

  // Build recommended actions
  const actions = [];
  const risks = [];
  const keyDates = [];

  // 1. Obligation actions
  for (const ob of (obligations || [])) {
    const daysUntilDue = daysBetween(now, ob.due_date);
    keyDates.push({
      date: ob.due_date,
      label: `${ob.account_label || ob.category} payment due`,
      amount: ob.amount_due,
      type: 'obligation',
    });

    if (ob.status === 'overdue') {
      actions.push({
        priority: 'critical',
        category: 'finance',
        action: `Pay overdue: ${ob.account_label || ob.category}`,
        detail: `${formatCurrency(ob.amount_due || 0)} is overdue. Pay immediately to avoid penalties.`,
        relatedObligationId: ob.id,
      });
    } else if (daysUntilDue <= 3) {
      actions.push({
        priority: 'high',
        category: 'finance',
        action: `Pay upcoming: ${ob.account_label || ob.category}`,
        detail: `${formatCurrency(ob.planned_payment || ob.amount_due || 0)} due in ${daysUntilDue} day(s).`,
        relatedObligationId: ob.id,
      });
    }
  }

  // 2. Goal milestone actions
  for (const goal of (goals || [])) {
    if (goal.is_financial && goal.monthly_pace) {
      actions.push({
        priority: goal.priority === 'critical' ? 'high' : 'medium',
        category: 'savings',
        action: `Transfer ${formatCurrency(goal.monthly_pace)} toward "${goal.title}"`,
        detail: goal.feasibility_notes || `Monthly savings pace to stay on track.`,
        relatedGoalId: goal.id,
      });
    }

    // Check milestone deadlines
    const milestones = goal.milestones || [];
    for (const ms of milestones) {
      if (ms.completed) continue;
      if (ms.deadline) {
        const msDate = new Date(ms.deadline);
        if (msDate >= periodStart && msDate <= periodEnd) {
          keyDates.push({ date: toISODate(msDate), label: `Milestone: ${ms.title}`, type: 'milestone' });
          actions.push({
            priority: 'medium',
            category: 'goal',
            action: `Complete milestone: ${ms.title}`,
            detail: `Part of goal "${goal.title}" — due ${toISODate(msDate)}.`,
            relatedGoalId: goal.id,
          });
        }
      }
    }

    // Deadline approaching
    if (goal.target_date) {
      const daysToDeadline = daysBetween(now, goal.target_date);
      if (daysToDeadline <= 30 && daysToDeadline > 0) {
        risks.push({
          severity: daysToDeadline <= 7 ? 'high' : 'medium',
          title: `Goal deadline approaching: "${goal.title}"`,
          detail: `${daysToDeadline} days remaining. Progress: ${Math.round((goal.progress || 0) * 100)}%.`,
          relatedGoalId: goal.id,
        });
      }
    }
  }

  // 3. Calendar event actions
  for (const evt of (calendarEvents || [])) {
    keyDates.push({
      date: evt.scheduled_date,
      label: evt.title,
      amount: evt.amount,
      type: evt.event_type,
    });
  }

  // 4. Risk: total obligations exceed balance
  const totalObligations = (obligations || []).reduce(
    (sum, o) => sum + (o.planned_payment || o.amount_due || 0),
    0
  );
  const totalSavingsPace = (goals || [])
    .filter(g => g.is_financial)
    .reduce((sum, g) => sum + (g.monthly_pace || 0), 0);

  if (totalObligations + totalSavingsPace > totalBalance * 0.8) {
    risks.push({
      severity: 'high',
      title: 'Cash pressure warning',
      detail: `Obligations (${formatCurrency(totalObligations)}) + savings targets (${formatCurrency(totalSavingsPace)}) approach available balance (${formatCurrency(totalBalance)}).`,
    });
  }

  // Build narrative
  const narrative = buildPlanNarrative({
    periodType,
    periodStart,
    periodEnd,
    goals: goals || [],
    obligations: obligations || [],
    savings: savingsGoals || [],
    totalBalance,
    actions,
    risks,
  });

  // Sort actions by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

  // Sort key dates
  keyDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Upsert the plan
  const planPayload = {
    user_id: userId,
    period_type: periodType,
    period_start: toISODate(periodStart),
    period_end: toISODate(periodEnd),
    goals_snapshot: (goals || []).map(g => ({
      id: g.id,
      title: g.title,
      domain: g.domain,
      lifeCat: g.life_category,
      isFinancial: g.is_financial,
      progress: g.progress,
      targetAmount: g.target_amount,
      currentAmount: g.current_amount,
      monthlyPace: g.monthly_pace,
      feasibilityScore: g.feasibility_score,
    })),
    financial_snapshot: {
      totalBalance,
      totalObligations,
      totalSavingsPace,
      surplusAfterObligations: totalBalance - totalObligations,
    },
    obligations_snapshot: (obligations || []).map(o => ({
      id: o.id,
      label: o.account_label || o.category,
      dueDate: o.due_date,
      amount: o.amount_due,
      status: o.status,
    })),
    calendar_snapshot: (calendarEvents || []).map(e => ({
      id: e.id,
      title: e.title,
      date: e.scheduled_date,
      type: e.event_type,
      amount: e.amount,
    })),
    recommended_actions: actions,
    key_dates: keyDates,
    risks,
    narrative,
    status: 'active',
  };

  const { data: existingPlan } = await supabase
    .from('life_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('period_type', periodType)
    .eq('period_start', toISODate(periodStart))
    .maybeSingle();

  if (existingPlan) {
    await supabase
      .from('life_plans')
      .update(planPayload)
      .eq('id', existingPlan.id);
    planPayload.id = existingPlan.id;
  } else {
    const { data } = await supabase
      .from('life_plans')
      .insert(planPayload)
      .select('id')
      .single();
    planPayload.id = data?.id;
  }

  // Emit plan signal
  await emitSignal(userId, {
    type: 'plan_generated',
    source: 'planning',
    target: 'all',
    severity: risks.length > 0 ? 'medium' : 'info',
    title: `${periodType === 'weekly' ? 'Weekly' : 'Monthly'} plan updated`,
    summary: `${actions.length} actions, ${keyDates.length} key dates, ${risks.length} risks.`,
    payload: { planId: planPayload.id, periodType },
  });

  return {
    id: planPayload.id,
    periodType,
    periodStart: toISODate(periodStart),
    periodEnd: toISODate(periodEnd),
    actions,
    keyDates,
    risks,
    narrative,
    financialSnapshot: planPayload.financial_snapshot,
    goalsCount: (goals || []).length,
    obligationsCount: (obligations || []).length,
  };
}

/* ── Full Coordination Refresh ────────────────────────────────── */

/**
 * Runs a full coordination pass across all systems.
 * Called periodically or when significant changes happen.
 */
export async function runCoordinationRefresh(userId) {
  // Clear expired signals
  await supabase
    .from('life_coordination_signals')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString());

  // Get all active financial goals
  const { data: financialGoals } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('is_financial', true)
    .eq('status', 'active');

  // Assess feasibility for each
  const assessments = [];
  for (const goal of (financialGoals || [])) {
    const result = await assessGoalFeasibility(userId, goal.id);
    assessments.push({ goalId: goal.id, title: goal.title, ...result });
  }

  // Detect obligation threats
  const threats = await detectObligationThreats(userId);

  // Update savings goal pace statuses
  for (const goal of (financialGoals || [])) {
    if (goal.financial_goal_id) {
      const assessment = assessments.find(a => a.goalId === goal.id);
      let paceStatus = 'on_track';
      if (assessment) {
        if (assessment.score >= 90) paceStatus = 'ahead';
        else if (assessment.score >= 70) paceStatus = 'on_track';
        else if (assessment.score >= 45) paceStatus = 'at_risk';
        else paceStatus = 'behind';
      }

      await supabase
        .from('financial_savings_goals')
        .update({ pace_status: paceStatus })
        .eq('id', goal.financial_goal_id);
    }
  }

  // Generate monthly plan
  const plan = await generateLifePlan(userId, 'monthly');

  return {
    assessments,
    threats,
    plan,
    refreshedAt: new Date().toISOString(),
  };
}

/* ── Load Life OS Dashboard ───────────────────────────────────── */

export async function loadLifeDashboard(userId) {
  const [
    { data: goals },
    { data: signals },
    { data: plans },
    { data: savingsGoals },
    { data: calendarEvents },
    { data: obligations },
  ] = await Promise.all([
    supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('life_coordination_signals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('life_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('period_start', { ascending: false })
      .limit(2),
    supabase
      .from('financial_savings_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase
      .from('financial_calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', new Date().toISOString().slice(0, 10))
      .order('scheduled_date', { ascending: true })
      .limit(30),
    supabase
      .from('financial_obligations')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['planned', 'overdue'])
      .order('due_date', { ascending: true }),
  ]);

  return {
    goals: goals || [],
    signals: signals || [],
    plans: plans || [],
    savingsGoals: savingsGoals || [],
    upcomingEvents: calendarEvents || [],
    activeObligations: obligations || [],
  };
}

/* ── Utilities ─────────────────────────────────────────────────── */

function formatCurrency(n) {
  if (n == null || !Number.isFinite(n)) return '$0';
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function buildPlanNarrative({ periodType, goals, obligations, savings, totalBalance, actions, risks }) {
  const parts = [];
  const period = periodType === 'weekly' ? 'This week' : 'This month';

  if (goals.length > 0) {
    const financialGoals = goals.filter(g => g.is_financial);
    const lifeGoals = goals.filter(g => !g.is_financial);
    if (financialGoals.length > 0) {
      parts.push(`${period} you have ${financialGoals.length} active financial goal${financialGoals.length !== 1 ? 's' : ''}.`);
    }
    if (lifeGoals.length > 0) {
      parts.push(`${lifeGoals.length} life goal${lifeGoals.length !== 1 ? 's' : ''} in progress.`);
    }
  }

  if (obligations.length > 0) {
    const total = obligations.reduce((s, o) => s + (o.planned_payment || o.amount_due || 0), 0);
    parts.push(`${obligations.length} payment${obligations.length !== 1 ? 's' : ''} totaling ${formatCurrency(total)} due.`);
  }

  if (risks.length > 0) {
    const critical = risks.filter(r => r.severity === 'high' || r.severity === 'critical');
    if (critical.length > 0) {
      parts.push(`${critical.length} high-priority risk${critical.length !== 1 ? 's' : ''} need${critical.length === 1 ? 's' : ''} attention.`);
    }
  }

  if (totalBalance > 0) {
    parts.push(`Available balance: ${formatCurrency(totalBalance)}.`);
  }

  if (actions.length > 0) {
    parts.push(`${actions.length} recommended action${actions.length !== 1 ? 's' : ''} to keep everything on track.`);
  }

  return parts.join(' ') || `${period} looks clear. No urgent items detected.`;
}
