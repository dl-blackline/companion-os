import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type {
  LinkedAccountsDashboard,
  StripeSessionPayload,
} from '@/types/stripe-financial';

const EMPTY_DASHBOARD: LinkedAccountsDashboard = {
  accounts: [],
  totalTransactions: 0,
};

const FC_URL = '/.netlify/functions/stripe-financial-connections';

export function useStripeFinancialConnections() {
  const { getFreshAccessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<LinkedAccountsDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const token = await getFreshAccessToken();
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
        const serverMsg = payload?.error;
        const fallback =
          response.status === 502
            ? 'The server encountered an error. Please try again in a moment.'
            : response.status === 401
              ? 'Your session has expired. Please sign in again.'
              : 'Request failed.';
        throw new Error(serverMsg || fallback);
      }
      return payload.data;
    },
    [getFreshAccessToken],
  );

  const refresh = useCallback(async () => {
    if (!user) {
      setDashboard(EMPTY_DASHBOARD);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch(FC_URL);
      const result = data as LinkedAccountsDashboard;
      console.log(`[stripe-fc] refresh: ${result.accounts.length} accounts, ${result.totalTransactions} transactions`);
      setDashboard(result);
    } catch (err) {
      console.error('[stripe-fc] refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load linked accounts.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user]);

  const createSession = useCallback(async (): Promise<StripeSessionPayload | null> => {
    setConnecting(true);
    setError(null);
    try {
      const data = await authedFetch(FC_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'create_session' }),
      });
      return data as StripeSessionPayload;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session.');
      return null;
    } finally {
      setConnecting(false);
    }
  }, [authedFetch]);

  const completeSession = useCallback(
    async (sessionId: string, accountIds?: string[]): Promise<boolean> => {
      setError(null);
      try {
        const result = await authedFetch(FC_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'complete_session', sessionId, accountIds }),
        });
        console.log('[stripe-fc] completeSession result:', JSON.stringify(result));
        await refresh();
        return true;
      } catch (err) {
        console.error('[stripe-fc] completeSession failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to complete session.');
        return false;
      }
    },
    [authedFetch, refresh],
  );

  const refreshAccount = useCallback(
    async (connectionId: string) => {
      setError(null);
      try {
        await authedFetch(FC_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'refresh_account', connectionId }),
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh account.');
      }
    },
    [authedFetch, refresh],
  );

  const disconnectAccount = useCallback(
    async (connectionId: string) => {
      setError(null);
      try {
        await authedFetch(FC_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'disconnect_account', connectionId }),
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to disconnect account.');
      }
    },
    [authedFetch, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    dashboard,
    loading,
    connecting,
    error,
    refresh,
    createSession,
    completeSession,
    refreshAccount,
    disconnectAccount,
  };
}
