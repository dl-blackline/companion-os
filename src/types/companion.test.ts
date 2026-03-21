import { describe, it, expect } from 'vitest';
import type {
  GoalDomain,
  GoalStatus,
  GoalPriority,
  ConstraintDomain,
  InitiativeType,
  InitiativeStatus,
  InteractionModule,
  UserGoal,
  UserConstraint,
  CompanionInitiative,
  InteractionLogEntry,
  UnifiedUserModel,
  CompanionContext,
  CreateGoalPayload,
  UpdateGoalPayload,
  CreateConstraintPayload,
  UpdateInitiativePayload,
  GoalMilestone,
} from '@/types/companion';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGoal(overrides: Partial<UserGoal> = {}): UserGoal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    domain: 'personal',
    title: 'Test goal',
    description: null,
    status: 'active',
    priority: 'medium',
    targetDate: null,
    progress: 0,
    milestones: [],
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeConstraint(overrides: Partial<UserConstraint> = {}): UserConstraint {
  return {
    id: 'cst-1',
    userId: 'user-1',
    domain: 'general',
    label: 'Test constraint',
    value: 'some value',
    isActive: true,
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeInitiative(overrides: Partial<CompanionInitiative> = {}): CompanionInitiative {
  return {
    id: 'init-1',
    userId: 'user-1',
    type: 'suggestion',
    title: 'Test initiative',
    body: null,
    priority: 'medium',
    status: 'pending',
    relatedGoalId: null,
    metadata: {},
    scheduledFor: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeInteraction(overrides: Partial<InteractionLogEntry> = {}): InteractionLogEntry {
  return {
    id: 'ilog-1',
    userId: 'user-1',
    module: 'chat',
    action: 'test_action',
    summary: null,
    outcome: null,
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Goal Domain Tests ────────────────────────────────────────────────────────

describe('GoalDomain type', () => {
  it('accepts all valid goal domains', () => {
    const domains: GoalDomain[] = ['business', 'health', 'personal', 'financial', 'education', 'creative'];
    expect(domains).toHaveLength(6);
  });
});

describe('GoalStatus type', () => {
  it('accepts all valid goal statuses', () => {
    const statuses: GoalStatus[] = ['active', 'completed', 'paused', 'archived'];
    expect(statuses).toHaveLength(4);
  });
});

describe('GoalPriority type', () => {
  it('accepts all valid goal priorities', () => {
    const priorities: GoalPriority[] = ['low', 'medium', 'high', 'critical'];
    expect(priorities).toHaveLength(4);
  });
});

describe('GoalMilestone type', () => {
  it('creates a milestone with required fields', () => {
    const milestone: GoalMilestone = { title: 'Phase 1', completed: false };
    expect(milestone.title).toBe('Phase 1');
    expect(milestone.completed).toBe(false);
    expect(milestone.completedAt).toBeUndefined();
  });

  it('allows completedAt on completed milestones', () => {
    const milestone: GoalMilestone = { title: 'Done', completed: true, completedAt: 1700000000000 };
    expect(milestone.completedAt).toBe(1700000000000);
  });
});

// ─── Constraint Tests ─────────────────────────────────────────────────────────

describe('ConstraintDomain type', () => {
  it('accepts all valid constraint domains', () => {
    const domains: ConstraintDomain[] = ['general', 'financial', 'time', 'health', 'dietary', 'work', 'content', 'privacy'];
    expect(domains).toHaveLength(8);
  });
});

// ─── Initiative Tests ─────────────────────────────────────────────────────────

describe('InitiativeType type', () => {
  it('accepts all valid initiative types', () => {
    const types: InitiativeType[] = ['suggestion', 'reminder', 'daily_plan', 'follow_up', 'optimisation'];
    expect(types).toHaveLength(5);
  });
});

describe('InitiativeStatus type', () => {
  it('accepts all valid initiative statuses', () => {
    const statuses: InitiativeStatus[] = ['pending', 'accepted', 'dismissed', 'completed', 'expired'];
    expect(statuses).toHaveLength(5);
  });
});

// ─── InteractionModule Tests ──────────────────────────────────────────────────

describe('InteractionModule type', () => {
  it('accepts all valid interaction modules', () => {
    const modules: InteractionModule[] = ['chat', 'crm', 'email', 'roleplay', 'planning', 'media', 'companion_engine'];
    expect(modules).toHaveLength(7);
  });
});

// ─── UserGoal Tests ───────────────────────────────────────────────────────────

describe('UserGoal', () => {
  it('creates a valid goal with defaults', () => {
    const goal = makeGoal();
    expect(goal.id).toBe('goal-1');
    expect(goal.domain).toBe('personal');
    expect(goal.status).toBe('active');
    expect(goal.progress).toBe(0);
    expect(goal.milestones).toEqual([]);
  });

  it('supports all domain types', () => {
    const domains: GoalDomain[] = ['business', 'health', 'personal', 'financial', 'education', 'creative'];
    for (const domain of domains) {
      const goal = makeGoal({ domain });
      expect(goal.domain).toBe(domain);
    }
  });

  it('tracks progress as 0-1 float', () => {
    const goal = makeGoal({ progress: 0.75 });
    expect(goal.progress).toBe(0.75);
  });

  it('can include milestones', () => {
    const goal = makeGoal({
      milestones: [
        { title: 'Phase 1', completed: true, completedAt: 1700000000000 },
        { title: 'Phase 2', completed: false },
      ],
    });
    expect(goal.milestones).toHaveLength(2);
    expect(goal.milestones[0].completed).toBe(true);
    expect(goal.milestones[1].completed).toBe(false);
  });
});

// ─── UserConstraint Tests ─────────────────────────────────────────────────────

describe('UserConstraint', () => {
  it('creates a valid constraint', () => {
    const c = makeConstraint({ label: 'Budget', value: '$5000/mo', domain: 'financial' });
    expect(c.label).toBe('Budget');
    expect(c.value).toBe('$5000/mo');
    expect(c.domain).toBe('financial');
    expect(c.isActive).toBe(true);
  });

  it('can be deactivated', () => {
    const c = makeConstraint({ isActive: false });
    expect(c.isActive).toBe(false);
  });

  it('supports content boundary domain', () => {
    const c = makeConstraint({ domain: 'content', label: 'Avoid politics', value: 'Do not discuss political topics' });
    expect(c.domain).toBe('content');
    expect(c.label).toBe('Avoid politics');
  });

  it('supports privacy preference domain', () => {
    const c = makeConstraint({ domain: 'privacy', label: 'Data retention', value: 'Do not store conversation history beyond 30 days' });
    expect(c.domain).toBe('privacy');
    expect(c.label).toBe('Data retention');
  });
});

// ─── CompanionInitiative Tests ────────────────────────────────────────────────

describe('CompanionInitiative', () => {
  it('creates a valid initiative', () => {
    const init = makeInitiative({ type: 'daily_plan', title: 'Morning routine' });
    expect(init.type).toBe('daily_plan');
    expect(init.status).toBe('pending');
  });

  it('can link to a goal', () => {
    const init = makeInitiative({ relatedGoalId: 'goal-1' });
    expect(init.relatedGoalId).toBe('goal-1');
  });

  it('supports scheduling', () => {
    const init = makeInitiative({ scheduledFor: '2026-03-21T08:00:00Z' });
    expect(init.scheduledFor).toBe('2026-03-21T08:00:00Z');
  });
});

// ─── InteractionLogEntry Tests ────────────────────────────────────────────────

describe('InteractionLogEntry', () => {
  it('creates a valid log entry', () => {
    const entry = makeInteraction({ module: 'email', action: 'sent_email', summary: 'Investor follow-up' });
    expect(entry.module).toBe('email');
    expect(entry.action).toBe('sent_email');
    expect(entry.summary).toBe('Investor follow-up');
  });
});

// ─── UnifiedUserModel Tests ───────────────────────────────────────────────────

describe('UnifiedUserModel', () => {
  it('assembles from parts', () => {
    const model: UnifiedUserModel = {
      userId: 'user-1',
      goals: [makeGoal({ domain: 'business' }), makeGoal({ id: 'goal-2', domain: 'health' })],
      constraints: [makeConstraint()],
      pendingInitiatives: [makeInitiative()],
    };
    expect(model.goals).toHaveLength(2);
    expect(model.constraints).toHaveLength(1);
    expect(model.pendingInitiatives).toHaveLength(1);
  });
});

// ─── CompanionContext Tests ───────────────────────────────────────────────────

describe('CompanionContext', () => {
  it('assembles context with all four sections', () => {
    const ctx: CompanionContext = {
      goals: [makeGoal()],
      constraints: [makeConstraint()],
      recentInteractions: [makeInteraction()],
      pendingInitiatives: [makeInitiative()],
    };
    expect(ctx.goals).toHaveLength(1);
    expect(ctx.constraints).toHaveLength(1);
    expect(ctx.recentInteractions).toHaveLength(1);
    expect(ctx.pendingInitiatives).toHaveLength(1);
  });

  it('allows empty sections', () => {
    const ctx: CompanionContext = {
      goals: [],
      constraints: [],
      recentInteractions: [],
      pendingInitiatives: [],
    };
    expect(ctx.goals).toHaveLength(0);
  });
});

// ─── Payload Tests ────────────────────────────────────────────────────────────

describe('CreateGoalPayload', () => {
  it('has required and optional fields', () => {
    const payload: CreateGoalPayload = {
      userId: 'user-1',
      domain: 'business',
      title: 'Launch MVP',
      description: 'Ship first version',
      priority: 'high',
      targetDate: '2026-06-01',
    };
    expect(payload.userId).toBe('user-1');
    expect(payload.domain).toBe('business');
    expect(payload.description).toBe('Ship first version');
  });

  it('works without optional fields', () => {
    const payload: CreateGoalPayload = {
      userId: 'user-1',
      domain: 'personal',
      title: 'Read more books',
    };
    expect(payload.description).toBeUndefined();
    expect(payload.priority).toBeUndefined();
  });
});

describe('UpdateGoalPayload', () => {
  it('supports partial updates', () => {
    const payload: UpdateGoalPayload = { progress: 0.5 };
    expect(payload.progress).toBe(0.5);
    expect(payload.status).toBeUndefined();
  });

  it('supports status update', () => {
    const payload: UpdateGoalPayload = { status: 'completed' };
    expect(payload.status).toBe('completed');
  });
});

describe('CreateConstraintPayload', () => {
  it('has all required fields', () => {
    const payload: CreateConstraintPayload = {
      userId: 'user-1',
      domain: 'financial',
      label: 'Monthly budget',
      value: '$10,000',
    };
    expect(payload.label).toBe('Monthly budget');
  });
});

describe('UpdateInitiativePayload', () => {
  it('requires status', () => {
    const payload: UpdateInitiativePayload = { status: 'accepted' };
    expect(payload.status).toBe('accepted');
  });
});
