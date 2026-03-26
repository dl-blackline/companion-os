import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { FinancialSummary } from '@/types/financial';

interface LinkTokenResult {
  configured: boolean;
  mode: 'live' | 'demo';
  linkToken?: string;
  message?: string;
}

const EMPTY_SUMMARY: FinancialSummary = {
  configured: false,
  connected: false,
  connections: [],
  accounts: [],
  transactions: [],
  pulse: {
    score: 0,
    trend: 'tightening',
    narrative: 'No financial data linked yet.',
    metrics: {
      income30d: 0,
      expenses30d: 0,
      netCashFlow30d: 0,
      savingsRate: 0,
      liquidityDays: 0,
      totalBalance: 0,
    },
    lastEvaluatedAt: new Date(0).toISOString(),
  },
};

export function useFinancialHealth() {
  const { getAccessToken, user } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) {
      throw new Error('You must be signed in to access financial tools.');
    }

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
      throw new Error(payload?.error || 'Financial request failed.');
    }

    return payload.data;
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    if (!user) {
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-management');
      setSummary(data as FinancialSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load financial summary.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user]);

  const createLinkToken = useCallback(async (): Promise<LinkTokenResult> => {
    const data = await authedFetch('/.netlify/functions/financial-management', {
      method: 'POST',
      body: JSON.stringify({ action: 'create_link_token' }),
    });

    return data as LinkTokenResult;
  }, [authedFetch]);

  const exchangePublicToken = useCallback(async (publicToken: string) => {
    setSyncing(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-management', {
        method: 'POST',
        body: JSON.stringify({ action: 'exchange_public_token', publicToken }),
      });
      setSummary(data as FinancialSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect financial account.');
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [authedFetch]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-management', {
        method: 'POST',
        body: JSON.stringify({ action: 'sync' }),
      });
      setSummary(data as FinancialSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync financial accounts.');
    } finally {
      setSyncing(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    summary,
    loading,
    syncing,
    error,
    refresh,
    sync,
    createLinkToken,
    exchangePublicToken,
  };
}
