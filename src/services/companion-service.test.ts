import { describe, it, expect } from 'vitest';
import {
  mapGoalRow,
  mapConstraintRow,
  mapInitiativeRow,
  mapInteractionRow,
} from '@/services/companion-service';

// ─── mapGoalRow ───────────────────────────────────────────────────────────────

describe('mapGoalRow', () => {
  const row = {
    id: 'goal-1',
    user_id: 'user-1',
    domain: 'business',
    title: 'Launch MVP',
    description: 'Ship version 1',
    status: 'active',
    priority: 'high',
    target_date: '2026-06-01T00:00:00Z',
    progress: 0.65,
    milestones: [{ title: 'Design', completed: true, completedAt: 1700000000000 }],
    metadata: { team: 'alpha' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  };

  it('maps snake_case row to camelCase UserGoal', () => {
    const goal = mapGoalRow(row);
    expect(goal.id).toBe('goal-1');
    expect(goal.userId).toBe('user-1');
    expect(goal.domain).toBe('business');
    expect(goal.title).toBe('Launch MVP');
    expect(goal.description).toBe('Ship version 1');
    expect(goal.status).toBe('active');
    expect(goal.priority).toBe('high');
    expect(goal.targetDate).toBe('2026-06-01T00:00:00Z');
    expect(goal.progress).toBe(0.65);
    expect(goal.milestones).toHaveLength(1);
    expect(goal.milestones[0].title).toBe('Design');
    expect(goal.metadata).toEqual({ team: 'alpha' });
    expect(goal.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(goal.updatedAt).toBe('2026-02-01T00:00:00Z');
  });

  it('defaults milestones to empty array when not an array', () => {
    const goal = mapGoalRow({ ...row, milestones: null as unknown as unknown[] });
    expect(goal.milestones).toEqual([]);
  });

  it('defaults metadata to empty object when null', () => {
    const goal = mapGoalRow({ ...row, metadata: null as unknown as Record<string, unknown> });
    expect(goal.metadata).toEqual({});
  });
});

// ─── mapConstraintRow ─────────────────────────────────────────────────────────

describe('mapConstraintRow', () => {
  const row = {
    id: 'cst-1',
    user_id: 'user-1',
    domain: 'financial',
    label: 'Monthly budget',
    value: '$5000',
    is_active: true,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('maps snake_case row to camelCase UserConstraint', () => {
    const c = mapConstraintRow(row);
    expect(c.id).toBe('cst-1');
    expect(c.userId).toBe('user-1');
    expect(c.domain).toBe('financial');
    expect(c.label).toBe('Monthly budget');
    expect(c.value).toBe('$5000');
    expect(c.isActive).toBe(true);
    expect(c.createdAt).toBe('2026-01-01T00:00:00Z');
  });

  it('maps inactive constraint', () => {
    const c = mapConstraintRow({ ...row, is_active: false });
    expect(c.isActive).toBe(false);
  });
});

// ─── mapInitiativeRow ─────────────────────────────────────────────────────────

describe('mapInitiativeRow', () => {
  const row = {
    id: 'init-1',
    user_id: 'user-1',
    type: 'daily_plan',
    title: 'Morning routine',
    body: 'Start with meditation',
    priority: 'medium',
    status: 'pending',
    related_goal_id: 'goal-1',
    metadata: {},
    scheduled_for: '2026-03-21T08:00:00Z',
    created_at: '2026-03-20T00:00:00Z',
    updated_at: '2026-03-20T00:00:00Z',
  };

  it('maps snake_case row to camelCase CompanionInitiative', () => {
    const init = mapInitiativeRow(row);
    expect(init.id).toBe('init-1');
    expect(init.userId).toBe('user-1');
    expect(init.type).toBe('daily_plan');
    expect(init.title).toBe('Morning routine');
    expect(init.body).toBe('Start with meditation');
    expect(init.priority).toBe('medium');
    expect(init.status).toBe('pending');
    expect(init.relatedGoalId).toBe('goal-1');
    expect(init.scheduledFor).toBe('2026-03-21T08:00:00Z');
  });

  it('handles null optional fields', () => {
    const init = mapInitiativeRow({ ...row, body: null, related_goal_id: null, scheduled_for: null });
    expect(init.body).toBeNull();
    expect(init.relatedGoalId).toBeNull();
    expect(init.scheduledFor).toBeNull();
  });
});

// ─── mapInteractionRow ────────────────────────────────────────────────────────

describe('mapInteractionRow', () => {
  const row = {
    id: 'ilog-1',
    user_id: 'user-1',
    module: 'email',
    action: 'sent_email',
    summary: 'Investor follow-up',
    outcome: 'delivered',
    metadata: { to: 'investor@example.com' },
    created_at: '2026-03-20T10:00:00Z',
  };

  it('maps snake_case row to camelCase InteractionLogEntry', () => {
    const entry = mapInteractionRow(row);
    expect(entry.id).toBe('ilog-1');
    expect(entry.userId).toBe('user-1');
    expect(entry.module).toBe('email');
    expect(entry.action).toBe('sent_email');
    expect(entry.summary).toBe('Investor follow-up');
    expect(entry.outcome).toBe('delivered');
    expect(entry.metadata).toEqual({ to: 'investor@example.com' });
    expect(entry.createdAt).toBe('2026-03-20T10:00:00Z');
  });

  it('handles null summary and outcome', () => {
    const entry = mapInteractionRow({ ...row, summary: null, outcome: null });
    expect(entry.summary).toBeNull();
    expect(entry.outcome).toBeNull();
  });

  it('defaults metadata to empty object when null', () => {
    const entry = mapInteractionRow({ ...row, metadata: null as unknown as Record<string, unknown> });
    expect(entry.metadata).toEqual({});
  });
});
