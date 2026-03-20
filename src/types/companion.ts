// ─── Companion Engine Domain Types ────────────────────────────────────────────
// Types for the Core Companion Engine: unified user model, initiative layer,
// interaction log, and context assembly.

// ─── Goal Domain ──────────────────────────────────────────────────────────────

export type GoalDomain =
  | 'business'
  | 'health'
  | 'personal'
  | 'financial'
  | 'education'
  | 'creative';

export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';

export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';

export interface GoalMilestone {
  readonly title: string;
  readonly completed: boolean;
  readonly completedAt?: number;
}

export interface UserGoal {
  readonly id: string;
  readonly userId: string;
  readonly domain: GoalDomain;
  readonly title: string;
  readonly description: string | null;
  readonly status: GoalStatus;
  readonly priority: GoalPriority;
  readonly targetDate: string | null;
  readonly progress: number;
  readonly milestones: readonly GoalMilestone[];
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ─── Constraints ──────────────────────────────────────────────────────────────

export type ConstraintDomain =
  | 'general'
  | 'financial'
  | 'time'
  | 'health'
  | 'dietary'
  | 'work';

export interface UserConstraint {
  readonly id: string;
  readonly userId: string;
  readonly domain: ConstraintDomain;
  readonly label: string;
  readonly value: string;
  readonly isActive: boolean;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ─── Initiative Layer ─────────────────────────────────────────────────────────

export type InitiativeType =
  | 'suggestion'
  | 'reminder'
  | 'daily_plan'
  | 'follow_up'
  | 'optimisation';

export type InitiativeStatus =
  | 'pending'
  | 'accepted'
  | 'dismissed'
  | 'completed'
  | 'expired';

export interface CompanionInitiative {
  readonly id: string;
  readonly userId: string;
  readonly type: InitiativeType;
  readonly title: string;
  readonly body: string | null;
  readonly priority: GoalPriority;
  readonly status: InitiativeStatus;
  readonly relatedGoalId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly scheduledFor: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ─── Interaction Log ──────────────────────────────────────────────────────────

export type InteractionModule =
  | 'chat'
  | 'crm'
  | 'email'
  | 'roleplay'
  | 'planning'
  | 'media'
  | 'companion_engine';

export interface InteractionLogEntry {
  readonly id: string;
  readonly userId: string;
  readonly module: InteractionModule;
  readonly action: string;
  readonly summary: string | null;
  readonly outcome: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

// ─── Unified User Model ──────────────────────────────────────────────────────

export interface UnifiedUserModel {
  readonly userId: string;
  readonly goals: readonly UserGoal[];
  readonly constraints: readonly UserConstraint[];
  readonly pendingInitiatives: readonly CompanionInitiative[];
}

// ─── Companion Context ────────────────────────────────────────────────────────
// Assembled context block that the Context Engine prepares before any AI call.

export interface CompanionContext {
  readonly goals: readonly UserGoal[];
  readonly constraints: readonly UserConstraint[];
  readonly recentInteractions: readonly InteractionLogEntry[];
  readonly pendingInitiatives: readonly CompanionInitiative[];
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface CreateGoalPayload {
  readonly userId: string;
  readonly domain: GoalDomain;
  readonly title: string;
  readonly description?: string;
  readonly priority?: GoalPriority;
  readonly targetDate?: string;
}

export interface UpdateGoalPayload {
  readonly status?: GoalStatus;
  readonly priority?: GoalPriority;
  readonly progress?: number;
  readonly title?: string;
  readonly description?: string;
  readonly targetDate?: string | null;
  readonly milestones?: readonly GoalMilestone[];
}

export interface CreateConstraintPayload {
  readonly userId: string;
  readonly domain: ConstraintDomain;
  readonly label: string;
  readonly value: string;
}

export interface UpdateInitiativePayload {
  readonly status: InitiativeStatus;
}
