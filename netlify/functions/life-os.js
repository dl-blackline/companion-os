/**
 * Life OS — Unified Personal Operating System API
 *
 * Endpoints:
 *   GET  → load full life dashboard (goals, signals, plans, events)
 *   POST → actions:
 *     - create_goal / update_goal / delete_goal
 *     - update_progress
 *     - create_milestone / complete_milestone
 *     - create_task / complete_task
 *     - sync_goal_finance (manually trigger goal→finance sync)
 *     - assess_feasibility
 *     - generate_plan (weekly/monthly)
 *     - refresh_coordination
 *     - dismiss_signal / acknowledge_signal
 */

import { supabase } from '../../lib/_supabase.js';
import { ok, fail, preflight } from '../../lib/_responses.js';
import {
  syncGoalToFinance,
  syncGoalToCalendar,
  assessGoalFeasibility,
  generateLifePlan,
  runCoordinationRefresh,
  loadLifeDashboard,
} from '../../lib/life-coordination-engine.js';

/* ── Auth ──────────────────────────────────────────────────────── */

function getAuthToken(event) {
  const h = event.headers?.authorization || event.headers?.Authorization;
  return h?.replace('Bearer ', '') || '';
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

/* ── Helpers ───────────────────────────────────────────────────── */

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseDate(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ── Goal CRUD ─────────────────────────────────────────────────── */

async function createGoal(userId, body) {
  const isFinancial = body.isFinancial === true || body.life_category === 'financial' || (body.targetAmount != null && body.targetAmount > 0);

  const goalPayload = {
    user_id: userId,
    domain: body.domain || body.life_category || 'personal',
    title: body.title,
    description: body.description || null,
    status: body.status || 'active',
    priority: body.priority || 'medium',
    target_date: parseDate(body.targetDate || body.deadline),
    progress: 0,
    milestones: (body.milestones || []).map(m => ({
      id: generateId(),
      title: m.title,
      description: m.description || '',
      completed: false,
      deadline: m.deadline || null,
    })),
    metadata: body.metadata || {},
    life_category: isFinancial ? 'financial' : (body.life_category || 'personal'),
    is_financial: isFinancial,
    target_amount: toNumber(body.targetAmount),
    current_amount: toNumber(body.currentAmount) || 0,
  };

  const { data: goal, error } = await supabase
    .from('user_goals')
    .insert(goalPayload)
    .select('*')
    .single();

  if (error) return fail(error.message, 'ERR_DB', 400);
  if (isFinancial && goal.target_amount > 0) {
    const syncResult = await syncGoalToFinance(userId, goal);
    goal.financial_goal_id = syncResult.financialGoalId;
    goal.monthly_pace = syncResult.monthlyPace;

    // Create calendar milestones
    await syncGoalToCalendar(userId, goal);

    // Assess feasibility
    await assessGoalFeasibility(userId, goal.id);
  }

  return ok({ goal });
}

async function updateGoal(userId, body) {
  if (!body.id) return fail('Goal id required', 'ERR_VALIDATION', 400);

  const updates = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.targetDate !== undefined) updates.target_date = parseDate(body.targetDate);
  if (body.progress !== undefined) updates.progress = body.progress;
  if (body.milestones !== undefined) updates.milestones = body.milestones;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  if (body.life_category !== undefined) updates.life_category = body.life_category;
  if (body.targetAmount !== undefined) {
    updates.target_amount = toNumber(body.targetAmount);
    updates.is_financial = true;
  }
  if (body.currentAmount !== undefined) updates.current_amount = toNumber(body.currentAmount);

  const { data: goal, error } = await supabase
    .from('user_goals')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return fail(error.message, 'ERR_DB', 400);

  // Re-sync if financial
  if (goal.is_financial) {
    await syncGoalToFinance(userId, goal);
    await syncGoalToCalendar(userId, goal);
    await assessGoalFeasibility(userId, goal.id);
  }

  return ok({ goal });
}

async function deleteGoal(userId, body) {
  if (!body.id) return fail('Goal id required', 'ERR_VALIDATION', 400);

  // Load goal to check for financial link
  const { data: goal } = await supabase
    .from('user_goals')
    .select('financial_goal_id')
    .eq('id', body.id)
    .eq('user_id', userId)
    .single();

  // Delete linked savings goal
  if (goal?.financial_goal_id) {
    await supabase
      .from('financial_savings_goals')
      .delete()
      .eq('id', goal.financial_goal_id);
  }

  // Delete linked calendar events
  await supabase
    .from('financial_calendar_events')
    .delete()
    .eq('user_id', userId)
    .eq('linked_goal_id', body.id);

  // Delete goal
  await supabase
    .from('user_goals')
    .delete()
    .eq('id', body.id)
    .eq('user_id', userId);

  return ok({ deleted: true });
}

async function updateProgress(userId, body) {
  if (!body.id) return fail('Goal id required', 'ERR_VALIDATION', 400);

  const updates = {};
  if (body.progress !== undefined) updates.progress = body.progress;
  if (body.currentAmount !== undefined) updates.current_amount = toNumber(body.currentAmount);

  const { data: goal, error } = await supabase
    .from('user_goals')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) return fail(error.message, 'ERR_DB', 400);

  // Update savings goal current amount
  if (goal.is_financial && goal.financial_goal_id && body.currentAmount !== undefined) {
    await supabase
      .from('financial_savings_goals')
      .update({ current_amount: toNumber(body.currentAmount) })
      .eq('id', goal.financial_goal_id);
  }

  // Check if goal completed
  if (goal.is_financial && goal.target_amount > 0 && goal.current_amount >= goal.target_amount) {
    await supabase
      .from('user_goals')
      .update({ status: 'completed', progress: 1 })
      .eq('id', goal.id);

    if (goal.financial_goal_id) {
      await supabase
        .from('financial_savings_goals')
        .update({ status: 'completed', pace_status: 'completed' })
        .eq('id', goal.financial_goal_id);
    }
  }

  return ok({ goal });
}

async function completeMilestone(userId, body) {
  if (!body.goalId || !body.milestoneId) return fail('goalId and milestoneId required', 'ERR_VALIDATION', 400);

  const { data: goal } = await supabase
    .from('user_goals')
    .select('milestones, title')
    .eq('id', body.goalId)
    .eq('user_id', userId)
    .single();

  if (!goal) return fail('Goal not found', 'ERR_NOT_FOUND', 404);

  const milestones = (goal.milestones || []).map(m => {
    if (m.id === body.milestoneId) {
      return { ...m, completed: true, completedAt: new Date().toISOString() };
    }
    return m;
  });

  // Recalculate progress based on milestones
  const total = milestones.length;
  const completed = milestones.filter(m => m.completed).length;
  const progress = total > 0 ? completed / total : 0;

  await supabase
    .from('user_goals')
    .update({ milestones, progress })
    .eq('id', body.goalId);

  return ok({ milestones, progress });
}

/* ── Signal Management ────────────────────────────────────────── */

async function dismissSignal(userId, body) {
  if (!body.id) return fail('Signal id required', 'ERR_VALIDATION', 400);

  await supabase
    .from('life_coordination_signals')
    .update({ status: 'dismissed' })
    .eq('id', body.id)
    .eq('user_id', userId);

  return ok({ dismissed: true });
}

async function acknowledgeSignal(userId, body) {
  if (!body.id) return fail('Signal id required', 'ERR_VALIDATION', 400);

  await supabase
    .from('life_coordination_signals')
    .update({ status: 'acknowledged' })
    .eq('id', body.id)
    .eq('user_id', userId);

  return ok({ acknowledged: true });
}

/* ── Handler ──────────────────────────────────────────────────── */

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (!supabase) return fail('Server configuration error', 'ERR_CONFIG', 500);

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail('Unauthorized', 'ERR_AUTH', 401);
  const userId = user.id;

  /* ── GET — load dashboard ── */
  if (event.httpMethod === 'GET') {
    try {
      const dashboard = await loadLifeDashboard(userId);
      return ok(dashboard);
    } catch (err) {
      console.error('[life-os] dashboard error:', err);
      return fail('Failed to load life dashboard', 'ERR_INTERNAL', 500);
    }
  }

  /* ── POST — actions ── */
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 'ERR_METHOD', 405);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return fail('Invalid JSON', 'ERR_PARSE', 400);
  }

  const { action } = body;

  try {
    switch (action) {
      case 'create_goal':
        return await createGoal(userId, body);

      case 'update_goal':
        return await updateGoal(userId, body);

      case 'delete_goal':
        return await deleteGoal(userId, body);

      case 'update_progress':
        return await updateProgress(userId, body);

      case 'complete_milestone':
        return await completeMilestone(userId, body);

      case 'sync_goal_finance': {
        const { data: goal } = await supabase
          .from('user_goals')
          .select('*')
          .eq('id', body.goalId)
          .eq('user_id', userId)
          .single();
        if (!goal) return fail('Goal not found', 'ERR_NOT_FOUND', 404);
        const result = await syncGoalToFinance(userId, goal);
        await syncGoalToCalendar(userId, goal);
        return ok(result);
      }

      case 'assess_feasibility': {
        if (!body.goalId) return fail('goalId required', 'ERR_VALIDATION', 400);
        const result = await assessGoalFeasibility(userId, body.goalId);
        return ok(result);
      }

      case 'generate_plan': {
        const plan = await generateLifePlan(userId, body.periodType || 'monthly');
        return ok(plan);
      }

      case 'refresh_coordination': {
        const result = await runCoordinationRefresh(userId);
        return ok(result);
      }

      case 'dismiss_signal':
        return await dismissSignal(userId, body);

      case 'acknowledge_signal':
        return await acknowledgeSignal(userId, body);

      default:
        return fail(`Unknown action: ${action}`, 'ERR_UNKNOWN_ACTION', 400);
    }
  } catch (err) {
    console.error(`[life-os] action=${action} error:`, err);
    return fail(err.message || 'Internal error', 'ERR_INTERNAL', 500);
  }
}
