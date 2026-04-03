import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { ScorecardDashboard, UserVehicle } from '@/types/premium-finance';

const EMPTY: ScorecardDashboard = {
  scorecard: null,
  vehicles: [],
  equitySnapshots: [],
};

export function useFinancialScorecard() {
  const { getAccessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<ScorecardDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) throw new Error('You must be signed in.');
    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Scorecard request failed.');
    }
    return payload.data;
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    if (!user) {
      setDashboard(EMPTY);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await authedFetch('/.netlify/functions/financial-scorecard');
      setDashboard(data as ScorecardDashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scorecard.');
    } finally {
      setLoading(false);
    }
  }, [user, authedFetch]);

  useEffect(() => { void refresh(); }, [refresh]);

  const computeScorecard = useCallback(async () => {
    try {
      setComputing(true);
      setError(null);
      const data = await authedFetch('/.netlify/functions/financial-scorecard', {
        method: 'POST',
        body: JSON.stringify({ action: 'compute_scorecard' }),
      });
      await refresh();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scorecard computation failed.');
      return null;
    } finally {
      setComputing(false);
    }
  }, [authedFetch, refresh]);

  const upsertVehicle = useCallback(async (vehicle: Partial<UserVehicle> & { year: number; make: string; model: string }) => {
    await authedFetch('/.netlify/functions/financial-scorecard', {
      method: 'POST',
      body: JSON.stringify({ action: 'upsert_vehicle', ...vehicle }),
    });
    // Recompute scorecard so vehicle_position updates immediately
    try {
      await authedFetch('/.netlify/functions/financial-scorecard', {
        method: 'POST',
        body: JSON.stringify({ action: 'compute_scorecard' }),
      });
    } catch {
      // Scorecard recompute is best-effort; vehicle was already saved
    }
    await refresh();
  }, [authedFetch, refresh]);

  const deleteVehicle = useCallback(async (vehicleId: string) => {
    await authedFetch('/.netlify/functions/financial-scorecard', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_vehicle', vehicleId }),
    });
    try {
      await authedFetch('/.netlify/functions/financial-scorecard', {
        method: 'POST',
        body: JSON.stringify({ action: 'compute_scorecard' }),
      });
    } catch {
      // best-effort recompute
    }
    await refresh();
  }, [authedFetch, refresh]);

  return {
    dashboard,
    loading,
    computing,
    error,
    refresh,
    computeScorecard,
    upsertVehicle,
    deleteVehicle,
  };
}
