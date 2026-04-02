import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type {
  LifeOSDashboard,
  LifeGoal,
  CoordinationSignal,
  LifePlan,
  CreateGoalInput,
  UpdateGoalInput,
  FeasibilityResult,
  CoordinationRefreshResult,
} from '@/types/life-os';

const API = '/.netlify/functions/life-os';

const EMPTY_DASHBOARD: LifeOSDashboard = {
  goals: [],
  signals: [],
  plans: [],
  savingsGoals: [],
  upcomingEvents: [],
  activeObligations: [],
};

export function useLifeOS() {
  const { getAccessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<LifeOSDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const token = getAccessToken();
      if (!token) throw new Error('You must be signed in.');
      const res = await fetch(input, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      return res.json();
    },
    [getAccessToken],
  );

  /* ── Load Dashboard ─────────────────────────────── */

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const data = await authedFetch(API);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, authedFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* ── Goal CRUD ──────────────────────────────────── */

  const createGoal = useCallback(
    async (input: CreateGoalInput): Promise<LifeGoal | null> => {
      try {
        setSaving(true);
        setError(null);
        const data = await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'create_goal', ...input }),
        });
        await refresh();
        return data.goal;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [authedFetch, refresh],
  );

  const updateGoal = useCallback(
    async (input: UpdateGoalInput): Promise<LifeGoal | null> => {
      try {
        setSaving(true);
        setError(null);
        const data = await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'update_goal', ...input }),
        });
        await refresh();
        return data.goal;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [authedFetch, refresh],
  );

  const deleteGoal = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setSaving(true);
        setError(null);
        await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'delete_goal', id }),
        });
        await refresh();
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [authedFetch, refresh],
  );

  /* ── Progress ───────────────────────────────────── */

  const updateProgress = useCallback(
    async (id: string, progress?: number, currentAmount?: number): Promise<boolean> => {
      try {
        setSaving(true);
        await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'update_progress', id, progress, currentAmount }),
        });
        await refresh();
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [authedFetch, refresh],
  );

  const completeMilestone = useCallback(
    async (goalId: string, milestoneId: string): Promise<boolean> => {
      try {
        setSaving(true);
        await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'complete_milestone', goalId, milestoneId }),
        });
        await refresh();
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [authedFetch, refresh],
  );

  /* ── Coordination ───────────────────────────────── */

  const assessFeasibility = useCallback(
    async (goalId: string): Promise<FeasibilityResult | null> => {
      try {
        const data = await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'assess_feasibility', goalId }),
        });
        await refresh();
        return data;
      } catch (err: any) {
        setError(err.message);
        return null;
      }
    },
    [authedFetch, refresh],
  );

  const generatePlan = useCallback(
    async (periodType: 'weekly' | 'monthly' = 'monthly'): Promise<LifePlan | null> => {
      try {
        setSaving(true);
        const data = await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'generate_plan', periodType }),
        });
        await refresh();
        return data;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [authedFetch, refresh],
  );

  const refreshCoordination = useCallback(
    async (): Promise<CoordinationRefreshResult | null> => {
      try {
        setSaving(true);
        const data = await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'refresh_coordination' }),
        });
        await refresh();
        return data;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [authedFetch, refresh],
  );

  /* ── Signal Management ──────────────────────────── */

  const dismissSignal = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'dismiss_signal', id }),
        });
        setDashboard(prev => ({
          ...prev,
          signals: prev.signals.filter(s => s.id !== id),
        }));
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [authedFetch],
  );

  const acknowledgeSignal = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await authedFetch(API, {
          method: 'POST',
          body: JSON.stringify({ action: 'acknowledge_signal', id }),
        });
        setDashboard(prev => ({
          ...prev,
          signals: prev.signals.filter(s => s.id !== id),
        }));
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [authedFetch],
  );

  return {
    dashboard,
    loading,
    saving,
    error,
    refresh,
    // Goal CRUD
    createGoal,
    updateGoal,
    deleteGoal,
    // Progress
    updateProgress,
    completeMilestone,
    // Coordination
    assessFeasibility,
    generatePlan,
    refreshCoordination,
    // Signals
    dismissSignal,
    acknowledgeSignal,
  };
}
