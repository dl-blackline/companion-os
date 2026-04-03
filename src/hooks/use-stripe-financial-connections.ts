import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type {
  LinkedAccountsDashboard,
  LedgerEntry,
  StripeSessionPayload,
} from '@/types/stripe-financial';

const EMPTY_DASHBOARD: LinkedAccountsDashboard = {
  accounts: [],
  totalTransactions: 0,
  ledgerEntries: [],
  aggregates: {
    totalBalance: 0,
    totalAvailableCredit: 0,
    totalCashOnHand: 0,
    accountCount: 0,
  },
};

const FC_URL = '/.netlify/functions/stripe-financial-connections';

// How often to poll for transactions after linking (ms)
const TX_SYNC_INTERVAL = 10_000;
// Max time to keep polling (ms)
const TX_SYNC_MAX_DURATION = 120_000;

export function useStripeFinancialConnections() {
  const { getFreshAccessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<LinkedAccountsDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncStartRef = useRef<number>(0);

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

      // Deduplicate accounts by stripe_account_id (keep latest) and filter to connected only
      const seen = new Map<string, typeof result.accounts[number]>();
      for (const acct of result.accounts) {
        const key = acct.stripe_account_id || acct.id;
        const existing = seen.get(key);
        if (!existing || acct.status === 'connected') {
          seen.set(key, acct);
        }
      }
      result.accounts = Array.from(seen.values());

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

  const syncTransactions = useCallback(async (): Promise<boolean> => {
    try {
      const result = await authedFetch(FC_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'sync_transactions' }),
      });
      console.log('[stripe-fc] syncTransactions:', JSON.stringify(result));
      if (result.synced > 0) {
        await refresh();
      }
      return result.complete === true;
    } catch (err) {
      console.warn('[stripe-fc] syncTransactions error:', err);
      return false;
    }
  }, [authedFetch, refresh]);

  const stopSyncPolling = useCallback(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    setSyncing(false);
  }, []);

  const startSyncPolling = useCallback(() => {
    stopSyncPolling();
    setSyncing(true);
    syncStartRef.current = Date.now();
    syncTimerRef.current = setInterval(async () => {
      if (Date.now() - syncStartRef.current > TX_SYNC_MAX_DURATION) {
        console.log('[stripe-fc] Transaction sync polling timed out after 2 minutes');
        stopSyncPolling();
        return;
      }
      const complete = await syncTransactions();
      if (complete) {
        console.log('[stripe-fc] Transaction sync complete');
        stopSyncPolling();
      }
    }, TX_SYNC_INTERVAL);
  }, [syncTransactions, stopSyncPolling]);

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

        // If transactions weren't all synced immediately, start polling
        if (result.syncStatus === 'transactions_syncing') {
          startSyncPolling();
        }
        return true;
      } catch (err) {
        console.error('[stripe-fc] completeSession failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to complete session.');
        return false;
      }
    },
    [authedFetch, refresh, startSyncPolling],
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

  const removeAccount = useCallback(
    async (connectionId: string) => {
      setError(null);
      try {
        await authedFetch(FC_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'remove_account', connectionId }),
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove account.');
      }
    },
    [authedFetch, refresh],
  );

  const updateAccount = useCallback(
    async (connectionId: string, updates: { nickname?: string; user_notes?: string; website_url?: string }) => {
      setError(null);
      try {
        await authedFetch(FC_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'update_account', connectionId, ...updates }),
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update account.');
      }
    },
    [authedFetch, refresh],
  );

  const createLedgerEntry = useCallback(
    async (entry: { title: string; amount: number; direction: 'inflow' | 'outflow'; due_date: string; recurrence?: string; category?: string; notes?: string; connection_id?: string }) => {
      setError(null);
      try {
        const data = await authedFetch(FC_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'create_ledger_entry', ...entry }),
        }) as LedgerEntry;
        await refresh();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create ledger entry.');
        return null;
      }
    },
    [authedFetch, refresh],
  );

  const updateLedgerEntry = useCallback(
    async (entryId: string, updates: Record<string, unknown>) => {
      setError(null);
      try {
        await authedFetch(FC_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'update_ledger_entry', entryId, ...updates }),
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update ledger entry.');
      }
    },
    [authedFetch, refresh],
  );

  const deleteLedgerEntry = useCallback(
    async (entryId: string) => {
      setError(null);
      try {
        await authedFetch(FC_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'delete_ledger_entry', entryId }),
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete ledger entry.');
      }
    },
    [authedFetch, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Cleanup sync polling on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, []);

  return {
    dashboard,
    loading,
    connecting,
    syncing,
    error,
    refresh,
    createSession,
    completeSession,
    refreshAccount,
    syncTransactions,
    updateAccount,
    disconnectAccount,
    removeAccount,
    createLedgerEntry,
    updateLedgerEntry,
    deleteLedgerEntry,
  };
}
