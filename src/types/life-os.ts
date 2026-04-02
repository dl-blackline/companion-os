/* ── Life OS Types ─────────────────────────────────────────────── */

export type LifeCategory =
  | 'financial'
  | 'health'
  | 'career'
  | 'relationship'
  | 'business'
  | 'education'
  | 'creative'
  | 'personal';

export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';
export type PaceStatus = 'on_track' | 'at_risk' | 'behind' | 'ahead' | 'completed';

export interface LifeGoalMilestone {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  deadline?: string;
}

export interface LifeGoal {
  id: string;
  user_id: string;
  domain: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  priority: GoalPriority;
  target_date: string | null;
  progress: number;
  milestones: LifeGoalMilestone[];
  metadata: Record<string, unknown>;
  // Life OS fields
  life_category: LifeCategory;
  is_financial: boolean;
  target_amount: number | null;
  current_amount: number | null;
  monthly_pace: number | null;
  financial_goal_id: string | null;
  feasibility_score: number | null;
  feasibility_notes: string | null;
  last_coordinated_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Coordination Signals ─────────────────────────────────────── */

export type SignalType =
  | 'goal_financial_created'
  | 'goal_financial_updated'
  | 'goal_financial_completed'
  | 'savings_pace_on_track'
  | 'savings_pace_at_risk'
  | 'savings_pace_behind'
  | 'cash_flow_insufficient'
  | 'obligation_threatens_goal'
  | 'milestone_deadline_created'
  | 'milestone_completed'
  | 'goal_deadline_approaching'
  | 'payment_window_pressure'
  | 'income_event_upcoming'
  | 'action_suggested'
  | 'plan_generated'
  | 'scorecard_updated'
  | 'feasibility_assessed'
  | 'coordination_refresh';

export type SignalSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type SignalStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed' | 'expired';

export interface CoordinationSignal {
  id: string;
  user_id: string;
  signal_type: SignalType;
  source_system: string;
  target_system: string;
  severity: SignalSeverity;
  title: string;
  summary: string | null;
  action_hint: string | null;
  related_goal_id: string | null;
  related_financial_goal_id: string | null;
  related_obligation_id: string | null;
  related_calendar_event_id: string | null;
  payload: Record<string, unknown>;
  status: SignalStatus;
  resolved_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Life Plans ───────────────────────────────────────────────── */

export interface PlanAction {
  priority: GoalPriority | 'critical';
  category: string;
  action: string;
  detail: string;
  relatedGoalId?: string;
  relatedObligationId?: string;
}

export interface PlanKeyDate {
  date: string;
  label: string;
  amount?: number | null;
  type: string;
}

export interface PlanRisk {
  severity: string;
  title: string;
  detail: string;
  relatedGoalId?: string;
}

export interface LifePlan {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  actions: PlanAction[];
  keyDates: PlanKeyDate[];
  risks: PlanRisk[];
  narrative: string | null;
  financialSnapshot: {
    totalBalance: number;
    totalObligations: number;
    totalSavingsPace: number;
    surplusAfterObligations: number;
  };
  goalsCount: number;
  obligationsCount: number;
}

/* ── Life OS Dashboard ────────────────────────────────────────── */

export interface LifeOSDashboard {
  goals: LifeGoal[];
  signals: CoordinationSignal[];
  plans: LifePlan[];
  savingsGoals: Array<{
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    monthly_contribution_target: number | null;
    pace_status: PaceStatus;
    linked_goal_id: string | null;
    status: string;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    event_type: string;
    scheduled_date: string;
    amount: number | null;
    status: string;
    linked_goal_id: string | null;
  }>;
  activeObligations: Array<{
    id: string;
    institution_name: string | null;
    account_label: string | null;
    category: string;
    due_date: string | null;
    amount_due: number | null;
    status: string;
  }>;
}

/* ── Goal Form Input ──────────────────────────────────────────── */

export interface CreateGoalInput {
  title: string;
  description?: string;
  life_category: LifeCategory;
  priority: GoalPriority;
  targetDate?: string;
  isFinancial?: boolean;
  targetAmount?: number;
  currentAmount?: number;
  milestones?: Array<{ title: string; description?: string; deadline?: string }>;
}

export interface UpdateGoalInput {
  id: string;
  title?: string;
  description?: string;
  status?: GoalStatus;
  priority?: GoalPriority;
  targetDate?: string;
  life_category?: LifeCategory;
  targetAmount?: number;
  currentAmount?: number;
  progress?: number;
  milestones?: LifeGoalMilestone[];
}

/* ── Feasibility Assessment ───────────────────────────────────── */

export interface FeasibilityResult {
  score: number;
  label: string;
  notes: string;
  requiredMonthly: number;
  estimatedMonthlySurplus: number;
  monthlyObligations: number;
}

/* ── Coordination Refresh Result ──────────────────────────────── */

export interface CoordinationRefreshResult {
  assessments: Array<{
    goalId: string;
    title: string;
    score: number;
    label: string;
    notes: string;
  }>;
  threats: Array<{
    goalId: string;
    goalTitle: string;
    monthlyPace: number | null;
    shortfall: number;
  }>;
  plan: LifePlan;
  refreshedAt: string;
}
