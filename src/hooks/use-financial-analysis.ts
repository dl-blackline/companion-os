import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { FinancialAnalysisDashboard } from '@/types/financial-analysis';

const EMPTY_DASHBOARD: FinancialAnalysisDashboard = {
  incomeSignals: [],
  expenseSignals: [],
  cashFlowPeriods: [],
  incomeAnalysis: null,
  balanceSnapshots: [],
  goals: [],
  summary: {
    estimatedMonthlyIncome: 0,
    estimatedMonthlyExpenses: 0,
    estimatedMonthlySurplus: 0,
    incomeSourceCount: 0,
    recurringExpenseCount: 0,
    incomeConfidence: 0,
    lastAnalyzedAt: null,
  },
};

export function useFinancialAnalysis() {
  const { getAccessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<FinancialAnalysisDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) {
      throw new Error('You must be signed in to access financial analysis.');
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
      throw new Error(payload?.error || 'Financial analysis request failed.');
    }

    return payload.data as FinancialAnalysisDashboard;
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    if (!user) {
      setDashboard(EMPTY_DASHBOARD);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-analysis');
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load financial analysis.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-analysis', {
        method: 'POST',
        body: JSON.stringify({ action: 'run_analysis' }),
      });
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
      throw err;
    } finally {
      setAnalyzing(false);
    }
  }, [authedFetch]);

  const confirmIncomeSignal = useCallback(async (signalId: string, userLabel?: string) => {
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-analysis', {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm_income_signal', signalId, userLabel }),
      });
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm signal.');
      throw err;
    }
  }, [authedFetch]);

  const confirmExpenseSignal = useCallback(async (signalId: string, userLabel?: string, linkToObligation?: boolean) => {
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-analysis', {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm_expense_signal', signalId, userLabel, linkToObligation }),
      });
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm expense signal.');
      throw err;
    }
  }, [authedFetch]);

  const dismissSignal = useCallback(async (signalId: string, signalType: 'income' | 'expense') => {
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-analysis', {
        method: 'POST',
        body: JSON.stringify({ action: 'dismiss_signal', signalId, signalType }),
      });
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss signal.');
      throw err;
    }
  }, [authedFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    dashboard,
    loading,
    analyzing,
    error,
    refresh,
    runAnalysis,
    confirmIncomeSignal,
    confirmExpenseSignal,
    dismissSignal,
  };
}
