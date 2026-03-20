// ─── Companion Service ────────────────────────────────────────────────────────
// Typed client for the Core Companion Engine API. Provides goal/constraint CRUD,
// initiative management, interaction logging, and full context retrieval.

import type {
  AsyncResult,
  UserGoal,
  UserConstraint,
  CompanionInitiative,
  InteractionLogEntry,
  CompanionContext,
  GoalDomain,
  GoalStatus,
  GoalPriority,
  ConstraintDomain,
  InitiativeStatus,
  InteractionModule,
  CreateGoalPayload,
  UpdateGoalPayload,
  CreateConstraintPayload,
  UpdateInitiativePayload,
} from '@/types';
import { success, error, appError } from '@/types';

const API_BASE = '/.netlify/functions/companion-engine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function post<T>(body: Record<string, unknown>): Promise<AsyncResult<T>> {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return error(appError('server', (data as Record<string, string>).error || 'Request failed'));
    }

    const data = (await res.json()) as T;
    return success(data);
  } catch (e) {
    return error(appError('network', (e as Error).message, { retryable: true }));
  }
}

// ─── Row → Domain mappers ─────────────────────────────────────────────────────

interface GoalRow {
  id: string;
  user_id: string;
  domain: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  target_date: string | null;
  progress: number;
  milestones: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ConstraintRow {
  id: string;
  user_id: string;
  domain: string;
  label: string;
  value: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface InitiativeRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  priority: string;
  status: string;
  related_goal_id: string | null;
  metadata: Record<string, unknown>;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

interface InteractionRow {
  id: string;
  user_id: string;
  module: string;
  action: string;
  summary: string | null;
  outcome: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function mapGoalRow(row: GoalRow): UserGoal {
  return {
    id: row.id,
    userId: row.user_id,
    domain: row.domain as GoalDomain,
    title: row.title,
    description: row.description,
    status: row.status as GoalStatus,
    priority: row.priority as GoalPriority,
    targetDate: row.target_date,
    progress: row.progress,
    milestones: Array.isArray(row.milestones) ? row.milestones as UserGoal['milestones'] : [],
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapConstraintRow(row: ConstraintRow): UserConstraint {
  return {
    id: row.id,
    userId: row.user_id,
    domain: row.domain as ConstraintDomain,
    label: row.label,
    value: row.value,
    isActive: row.is_active,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInitiativeRow(row: InitiativeRow): CompanionInitiative {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as CompanionInitiative['type'],
    title: row.title,
    body: row.body,
    priority: row.priority as GoalPriority,
    status: row.status as InitiativeStatus,
    relatedGoalId: row.related_goal_id,
    metadata: row.metadata || {},
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInteractionRow(row: InteractionRow): InteractionLogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    module: row.module as InteractionModule,
    action: row.action,
    summary: row.summary,
    outcome: row.outcome,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function listGoals(
  userId: string,
  filters?: { domain?: GoalDomain; status?: GoalStatus },
): Promise<AsyncResult<UserGoal[]>> {
  const result = await post<{ goals: GoalRow[] }>({
    action: 'goals.list',
    user_id: userId,
    ...filters,
  });
  if (!result.ok) return result;
  return success(result.data.goals.map(mapGoalRow));
}

export async function createUserGoal(payload: CreateGoalPayload): Promise<AsyncResult<UserGoal>> {
  const result = await post<{ goal: GoalRow }>({
    action: 'goals.create',
    user_id: payload.userId,
    domain: payload.domain,
    title: payload.title,
    description: payload.description,
    priority: payload.priority,
    target_date: payload.targetDate,
  });
  if (!result.ok) return result;
  return success(mapGoalRow(result.data.goal));
}

export async function updateUserGoal(
  goalId: string,
  updates: UpdateGoalPayload,
): Promise<AsyncResult<UserGoal>> {
  const result = await post<{ goal: GoalRow }>({
    action: 'goals.update',
    goal_id: goalId,
    ...updates,
    target_date: updates.targetDate,
  });
  if (!result.ok) return result;
  return success(mapGoalRow(result.data.goal));
}

export async function deleteUserGoal(goalId: string): Promise<AsyncResult<boolean>> {
  const result = await post<{ deleted: boolean }>({
    action: 'goals.delete',
    goal_id: goalId,
  });
  if (!result.ok) return result;
  return success(true);
}

// ─── Constraints ──────────────────────────────────────────────────────────────

export async function listConstraints(
  userId: string,
  filters?: { activeOnly?: boolean },
): Promise<AsyncResult<UserConstraint[]>> {
  const result = await post<{ constraints: ConstraintRow[] }>({
    action: 'constraints.list',
    user_id: userId,
    active_only: filters?.activeOnly,
  });
  if (!result.ok) return result;
  return success(result.data.constraints.map(mapConstraintRow));
}

export async function createUserConstraint(
  payload: CreateConstraintPayload,
): Promise<AsyncResult<UserConstraint>> {
  const result = await post<{ constraint: ConstraintRow }>({
    action: 'constraints.create',
    user_id: payload.userId,
    domain: payload.domain,
    label: payload.label,
    value: payload.value,
  });
  if (!result.ok) return result;
  return success(mapConstraintRow(result.data.constraint));
}

export async function deleteUserConstraint(constraintId: string): Promise<AsyncResult<boolean>> {
  const result = await post<{ deleted: boolean }>({
    action: 'constraints.delete',
    constraint_id: constraintId,
  });
  if (!result.ok) return result;
  return success(true);
}

// ─── Initiatives ──────────────────────────────────────────────────────────────

export async function listInitiatives(
  userId: string,
  filters?: { status?: InitiativeStatus; limit?: number },
): Promise<AsyncResult<CompanionInitiative[]>> {
  const result = await post<{ initiatives: InitiativeRow[] }>({
    action: 'initiatives.list',
    user_id: userId,
    ...filters,
  });
  if (!result.ok) return result;
  return success(result.data.initiatives.map(mapInitiativeRow));
}

export async function updateInitiative(
  initiativeId: string,
  payload: UpdateInitiativePayload,
): Promise<AsyncResult<CompanionInitiative>> {
  const result = await post<{ initiative: InitiativeRow }>({
    action: 'initiatives.update',
    initiative_id: initiativeId,
    status: payload.status,
  });
  if (!result.ok) return result;
  return success(mapInitiativeRow(result.data.initiative));
}

export async function generateProactiveInitiatives(
  userId: string,
): Promise<AsyncResult<CompanionInitiative[]>> {
  const result = await post<{ initiatives: InitiativeRow[] }>({
    action: 'initiatives.generate',
    user_id: userId,
  });
  if (!result.ok) return result;
  return success(result.data.initiatives.map(mapInitiativeRow));
}

// ─── Interactions ─────────────────────────────────────────────────────────────

export async function logUserInteraction(params: {
  userId: string;
  module: InteractionModule;
  action: string;
  summary?: string;
  outcome?: string;
  metadata?: Record<string, unknown>;
}): Promise<AsyncResult<InteractionLogEntry>> {
  const result = await post<{ entry: InteractionRow }>({
    action: 'interactions.log',
    user_id: params.userId,
    module: params.module,
    interaction_action: params.action,
    summary: params.summary,
    outcome: params.outcome,
    metadata: params.metadata,
  });
  if (!result.ok) return result;
  return success(mapInteractionRow(result.data.entry));
}

export async function listRecentInteractions(
  userId: string,
  filters?: { module?: InteractionModule; limit?: number },
): Promise<AsyncResult<InteractionLogEntry[]>> {
  const result = await post<{ interactions: InteractionRow[] }>({
    action: 'interactions.list',
    user_id: userId,
    ...filters,
  });
  if (!result.ok) return result;
  return success(result.data.interactions.map(mapInteractionRow));
}

// ─── Context ──────────────────────────────────────────────────────────────────

export async function getCompanionContext(
  userId: string,
): Promise<AsyncResult<{ context: CompanionContext; formatted: string }>> {
  const result = await post<{
    context: {
      goals: GoalRow[];
      constraints: ConstraintRow[];
      recentInteractions: InteractionRow[];
      pendingInitiatives: InitiativeRow[];
    };
    formatted: string;
  }>({
    action: 'context.get',
    user_id: userId,
  });
  if (!result.ok) return result;

  const raw = result.data.context;
  return success({
    context: {
      goals: raw.goals.map(mapGoalRow),
      constraints: raw.constraints.map(mapConstraintRow),
      recentInteractions: raw.recentInteractions.map(mapInteractionRow),
      pendingInitiatives: raw.pendingInitiatives.map(mapInitiativeRow),
    },
    formatted: result.data.formatted,
  });
}
